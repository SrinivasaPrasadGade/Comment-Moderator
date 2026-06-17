import sqlite3

def get_db():
    conn = sqlite3.connect("moderation.db")
    conn.row_factory = sqlite3.Row  # Returns dicts instead of tuples
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            message TEXT,
            toxicity_score REAL,
            primary_label TEXT,
            flagged INTEGER,
            reviewed INTEGER DEFAULT 0,
            timestamp REAL
        )
    """)
    conn.commit()

def save_message(msg_obj):
    conn = get_db()
    conn.execute("""
        INSERT INTO messages (username, message, toxicity_score, primary_label, flagged, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        msg_obj["username"],
        msg_obj["message"],
        msg_obj["result"]["toxicity_score"],
        msg_obj["result"]["primary_label"],
        1 if msg_obj["result"]["flagged"] else 0,
        msg_obj["timestamp"]
    ))
    conn.commit()

def get_flagged_messages():
    conn = get_db()
    return conn.execute(
        "SELECT * FROM messages WHERE flagged=1 ORDER BY timestamp DESC"
    ).fetchall()

def mark_reviewed(message_id, action):
    """
    Mark a message as reviewed. 
    action='approve': The comment is actually safe, unflag it.
    action='reject': The comment is truly toxic, keep it flagged (and marked as reviewed).
    """
    conn = get_db()
    if action == "approve":
        conn.execute("UPDATE messages SET reviewed=1, flagged=0 WHERE id=?", (message_id,))
    elif action == "reject":
        conn.execute("UPDATE messages SET reviewed=1, flagged=1 WHERE id=?", (message_id,))
    conn.commit()


def get_stats():
    """
    Return aggregate statistics for the analytics dashboard:
    total messages, flagged count, average toxicity score,
    and the flagged percentage.
    """
    conn = get_db()
    row = conn.execute("""
        SELECT 
            COUNT(*) as total,
            COALESCE(SUM(CASE WHEN flagged = 1 THEN 1 ELSE 0 END), 0) as flagged_count,
            COALESCE(AVG(toxicity_score), 0) as avg_toxicity
        FROM messages
    """).fetchone()

    total = row["total"]
    flagged_count = row["flagged_count"]
    avg_toxicity = row["avg_toxicity"]
    flagged_pct = (flagged_count / total * 100) if total > 0 else 0

    return {
        "total": total,
        "flagged_count": flagged_count,
        "avg_toxicity": round(avg_toxicity, 4),
        "flagged_pct": round(flagged_pct, 1)
    }


def get_recent_scores(limit=50):
    """
    Return the last `limit` messages with their toxicity scores and timestamps,
    ordered from oldest to newest (for the line chart).
    """
    conn = get_db()
    rows = conn.execute("""
        SELECT id, toxicity_score, primary_label, flagged, timestamp
        FROM messages
        ORDER BY id DESC
        LIMIT ?
    """, (limit,)).fetchall()

    # Reverse so oldest is first (for chronological chart)
    return [dict(r) for r in reversed(rows)]


def get_category_counts():
    """
    Return counts of flagged messages grouped by primary_label.
    Only includes labels from flagged messages (not 'clean').
    """
    conn = get_db()
    rows = conn.execute("""
        SELECT primary_label, COUNT(*) as count
        FROM messages
        WHERE flagged = 1 AND primary_label != 'clean'
        GROUP BY primary_label
        ORDER BY count DESC
    """).fetchall()

    return {row["primary_label"]: row["count"] for row in rows}


def get_approved_comments():
    """
    Return approved (non-flagged) messages for the public chat feed,
    ordered newest first. Maps DB column names to the keys the frontend expects.
    """
    conn = get_db()
    rows = conn.execute("""
        SELECT id, username, message, toxicity_score, primary_label, timestamp
        FROM messages
        WHERE flagged = 0
        ORDER BY timestamp DESC
    """).fetchall()

    return [{
        "id": r["id"],
        "author": r["username"],
        "content": r["message"],
        "toxicity_score": r["toxicity_score"],
        "primary_label": r["primary_label"],
        "timestamp": r["timestamp"] * 1000  # JS expects milliseconds
    } for r in rows]


def get_all_messages():
    """
    Return all messages with a computed 'status' field for the moderator queue.
    Status logic:
      - reviewed=1, flagged=0 → 'approved'
      - reviewed=1, flagged=1 → 'rejected'
      - reviewed=0, flagged=1 → 'flagged'
      - reviewed=0, flagged=0 → 'approved' (auto-approved by ML)
    """
    conn = get_db()
    rows = conn.execute("""
        SELECT id, username, message, toxicity_score, primary_label, flagged, reviewed, timestamp
        FROM messages
        ORDER BY timestamp DESC
    """).fetchall()

    result = []
    for r in rows:
        if r["reviewed"] == 1 and r["flagged"] == 0:
            status = "approved"
        elif r["reviewed"] == 1 and r["flagged"] == 1:
            status = "rejected"
        elif r["flagged"] == 1:
            status = "flagged"
        else:
            status = "approved"

        result.append({
            "id": r["id"],
            "author": r["username"],
            "content": r["message"],
            "toxicity_score": r["toxicity_score"],
            "flagged_reason": r["primary_label"] if r["primary_label"] != "clean" else None,
            "status": status,
            "timestamp": r["timestamp"] * 1000  # JS expects milliseconds
        })

    return result


def get_dashboard_stats():
    """
    Return aggregate stats matching what dashboard.js expects:
    total, approved, flagged (pending), rejected, avg_toxicity.
    """
    conn = get_db()
    row = conn.execute("""
        SELECT
            COUNT(*) as total,
            COALESCE(SUM(CASE WHEN flagged = 0 THEN 1 ELSE 0 END), 0) as approved,
            COALESCE(SUM(CASE WHEN flagged = 1 AND reviewed = 0 THEN 1 ELSE 0 END), 0) as flagged,
            COALESCE(SUM(CASE WHEN flagged = 1 AND reviewed = 1 THEN 1 ELSE 0 END), 0) as rejected,
            COALESCE(AVG(toxicity_score), 0) as avg_toxicity
        FROM messages
    """).fetchone()

    return {
        "total": row["total"],
        "approved": row["approved"],
        "flagged": row["flagged"],
        "rejected": row["rejected"],
        "avg_toxicity": row["avg_toxicity"]
    }


def moderate_message(message_id, new_status):
    """
    Update a message's moderation status.
    'approved' → unflag and mark reviewed.
    'rejected' → keep flagged and mark reviewed.
    """
    conn = get_db()
    if new_status == "approved":
        conn.execute("UPDATE messages SET reviewed=1, flagged=0 WHERE id=?", (message_id,))
    elif new_status == "rejected":
        conn.execute("UPDATE messages SET reviewed=1, flagged=1 WHERE id=?", (message_id,))
    conn.commit()

