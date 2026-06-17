import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room
from ml_model import score_comment
from database import (save_message, get_flagged_messages, mark_reviewed,
                      get_stats, get_recent_scores, get_category_counts,
                      get_approved_comments, get_all_messages,
                      get_dashboard_stats, moderate_message, init_db)
import time

app = Flask(__name__)

# Define frontend directory
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))

# ─── Static File Serving ────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory(frontend_dir, 'index.html')

@app.route('/<path:path>')
def serve_frontend(path):
    if os.path.exists(os.path.join(frontend_dir, path)):
        return send_from_directory(frontend_dir, path)
    return "Not found", 404

# Enable CORS for all routes and origins
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize SocketIO with CORS allowed origins
socketio = SocketIO(app, cors_allowed_origins="*")

# Ensure the database table exists
init_db()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"}), 200

@app.route("/score", methods=["POST"])
def score():
    data = request.json
    text = data.get("message", "")
    result = score_comment(text)
    return jsonify(result)

@app.route('/flagged', methods=['GET'])
def flagged():
    messages = get_flagged_messages()
    result = [dict(row) for row in messages]
    return jsonify(result), 200

@app.route('/review/<int:msg_id>', methods=['POST'])
def review(msg_id):
    data = request.json or {}
    action = data.get('action')
    
    if action not in ['approve', 'remove']:
        return jsonify({"error": "Invalid action. Must be 'approve' or 'remove'."}), 400
    
    mark_reviewed(msg_id, action)
    return jsonify({"status": "success"}), 200

@app.route('/api/stats', methods=['GET'])
def api_stats():
    """
    Aggregated analytics endpoint polled by the real-time dashboard.
    Returns stats cards data, recent toxicity scores for the line chart,
    and category counts for the bar chart.
    """
    stats = get_stats()
    recent = get_recent_scores(limit=50)
    categories = get_category_counts()

    return jsonify({
        "total_messages": stats["total"],
        "flagged_count": stats["flagged_count"],
        "avg_toxicity": stats["avg_toxicity"],
        "flagged_pct": stats["flagged_pct"],
        "recent_scores": recent,
        "category_counts": categories
    }), 200

# ─── Chat Feed API (used by chat.js) ─────────────────────────────

@app.route('/api/comments', methods=['GET'])
def api_get_comments():
    """Return approved (non-flagged) comments for the chat feed."""
    comments = get_approved_comments()
    return jsonify(comments), 200

@app.route('/api/comments', methods=['POST'])
def api_post_comment():
    """
    Accept a new comment from the chat UI.
    Runs ML scoring, saves to DB, and returns the result.
    """
    data = request.json or {}
    author = data.get('author', 'Anonymous')
    content = data.get('content', '')

    if not content.strip():
        return jsonify({"error": "Empty comment"}), 400

    # Run ML analysis
    result = score_comment(content)
    is_flagged = result.get('flagged', False)

    # Build the message object matching what save_message() expects
    message_obj = {
        "message": content,
        "username": author,
        "result": result,
        "timestamp": time.time(),
        "flagged": is_flagged
    }
    save_message(message_obj)

    return jsonify({
        "status": "flagged" if is_flagged else "approved",
        "toxicity_score": float(result["toxicity_score"]),
        "flagged_reason": result["primary_label"] if is_flagged else None,
        "scores": {k: float(v) for k, v in result["scores"].items()}
    }), 201

# ─── Moderator Dashboard API (used by dashboard.js) ──────────────

@app.route('/api/dashboard/stats', methods=['GET'])
def api_dashboard_stats():
    """Return aggregate stats for the moderator panel doughnut chart."""
    stats = get_dashboard_stats()
    return jsonify(stats), 200

@app.route('/api/dashboard/queue', methods=['GET'])
def api_dashboard_queue():
    """Return all messages with computed status for the moderation queue."""
    messages = get_all_messages()
    return jsonify(messages), 200

@app.route('/api/comments/<int:comment_id>/moderate', methods=['POST'])
def api_moderate_comment(comment_id):
    """Approve or reject a specific comment from the moderator queue."""
    data = request.json or {}
    new_status = data.get('status')

    if new_status not in ['approved', 'rejected']:
        return jsonify({"error": "Invalid status. Must be 'approved' or 'rejected'."}), 400

    moderate_message(comment_id, new_status)
    return jsonify({"status": "success"}), 200

@socketio.on("join_moderator")
def handle_join_moderator():
    """
    Allows a client to join the 'moderators' room.
    Once in this room, the client will receive events targeted specifically at 'moderators'.
    """
    # join_room() puts the current client's connection into a specific room.
    join_room("moderators")
    emit("system_message", {"message": "You have joined the moderators room."})

@socketio.on("send_message")
def handle_message(data):
    text = data.get("message", "")
    username = data.get("username", "Anonymous")
    
    # Analyze the message using our ML model
    result = score_comment(text)
    
    # We define a threshold of 0.8 (or rely on the 'flagged' boolean from the model)
    # The snippet used result["flagged"], but we can also explicitly check a threshold if preferred.
    is_flagged = result.get("flagged", False)
    
    message_obj = {
        "message": text,
        "username": username,
        "result": result,
        "timestamp": time.time(),
        "flagged": is_flagged
    }
    
    # Save the message to the database
    save_message(message_obj)
    
    if is_flagged:
        # emit() sends an event back to the clients.
        # room="moderators" targets ONLY the clients that have joined the "moderators" room.
        # pyrefly: ignore [unexpected-keyword]
        emit("flagged_message", message_obj, room="moderators")
    else:
        # broadcast=True sends the event to ALL connected clients, 
        # not just the one who triggered "send_message".
        emit("new_message", message_obj, broadcast=True)

if __name__ == "__main__":
    # Running on port 5001 as previously configured (can be changed to 5000 if needed)
    socketio.run(app, host='0.0.0.0', port=5001, debug=True, allow_unsafe_werkzeug=True)
