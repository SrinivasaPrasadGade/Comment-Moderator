---
title: Comment Moderator
emoji: 🐨
colorFrom: yellow
colorTo: pink
sdk: docker
pinned: false
license: mit
short_description: Flagging comments
---

Check out the configuration reference at https://huggingface.co/docs/hub/spaces-config-reference

# Comment Moderator

Comment Moderator is an AI-powered, real-time comment moderation system designed to protect online communities with silent precision. It features a beautifully minimalist interface that leverages advanced machine learning (RoBERTa via Detoxify) to score and flag toxic comments with zero latency.

## 🚀 Features
- **Real-Time Moderation:** Instantly scores and flags messages using WebSocket connections.
- **AI-Powered Toxicity Detection:** Uses `detoxify` (RoBERTa) to analyze comments for toxicity, severe toxicity, obscenity, threats, insults, and identity attacks.
- **Sentiment Analysis:** Integrates `vaderSentiment` to gauge the overall sentiment of messages.
- **Moderator Dashboard:** A comprehensive glassmorphism-styled dashboard to review flagged comments, view analytics via Chart.js, and manage community interactions.
- **Live Chat Interface:** A sleek chat interface where approved messages appear instantly.

## 💻 Tech Stack

### Frontend
- **HTML/CSS/Vanilla JS:** Custom Glassmorphism and modern UI/UX design.
- **Socket.IO Client:** For seamless real-time bi-directional communication.
- **Chart.js:** To visualize moderation statistics and category counts in the dashboard.

### Backend
- **Python 3.10:** Core backend language.
- **Flask & Flask-CORS:** REST API and web server routing.
- **Flask-SocketIO:** For managing real-time WebSocket connections and rooms (e.g., moderator rooms).
- **SQLite3:** Lightweight database for storing comments, moderation actions, and statistical data.

### Machine Learning
- **PyTorch (CPU-optimized):** Backend framework for running the ML models efficiently.
- **Detoxify:** Pre-trained RoBERTa model for detecting toxic language.
- **VaderSentiment:** Lexicon and rule-based sentiment analysis tool.

### Deployment & DevOps
- **Docker:** Containerized application for consistent deployments.
- **Gunicorn & GeventWebSocketWorker:** Production-grade WSGI server for handling HTTP and WebSocket traffic.
- **Hugging Face Spaces:** Cloud hosting environment.

## 🚧 Problems Faced & How We Overcame Them

During the development and deployment of the Comment Moderator, we encountered several technical challenges:

### 1. Handling Real-Time Bi-Directional Communication
**Problem:** We needed comments to appear instantly in the chat for users, but simultaneously, flagged comments needed to be intercepted and sent only to the moderator dashboard without delaying the user experience.
**Solution:** We implemented **Flask-SocketIO** to establish real-time WebSocket connections. We utilized Socket.IO "rooms" (e.g., `join_room("moderators")`) to broadcast flagged comments exclusively to connected moderators, while benign comments were broadcasted to all connected clients instantly.

### 2. Large Docker Image Sizes & Memory Usage
**Problem:** Integrating PyTorch and Hugging Face `transformers` models in a Docker container resulted in massive image sizes and high memory consumption, which often crashed lightweight cloud deployment environments.
**Solution:** We optimized the `requirements.txt` to explicitly pull the **CPU-only version of PyTorch** (`--extra-index-url https://download.pytorch.org/whl/cpu`). This drastically reduced the Docker image size and ensured the container could run smoothly within the resource limits of Hugging Face Spaces.

### 3. Production WebSocket Support in Cloud Environments
**Problem:** Deploying a Flask app with WebSockets on platforms like Hugging Face Spaces or Render is tricky because the default Flask development server does not support persistent WebSocket connections in production.
**Solution:** We wrote a custom `Dockerfile` that uses **Gunicorn** combined with the **GeventWebSocketWorker** (`geventwebsocket.gunicorn.workers.GeventWebSocketWorker`). We explicitly bound the server to port `7860` (the required port for Hugging Face Spaces), ensuring robust and stable WebSocket traffic in production.

### 4. Code Sync & Merge Conflicts Across Deployments
**Problem:** Transitioning between local development, Render, and Hugging Face deployments caused diverging branch histories and merge conflicts, especially concerning the UI layout and Docker configurations.
**Solution:** We established a unified repository structure combining `frontend/` and `backend/` under one roof and resolved conflicts by standardizing on a single `Dockerfile`. Unused or conflicting UI elements were cleanly refactored, keeping the local and remote versions strictly synchronized.

## 🛠️ How to Run Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/SrinivasaPrasadGade/Comment-Moderator.git
   cd Comment-Moderator
   ```

2. **Set up Python Virtual Environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r backend/requirements.txt
   ```

4. **Run the Application:**
   ```bash
   python backend/app.py
   ```
   The app will run at `http://localhost:5001`.
