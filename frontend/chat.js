const API_BASE_URL = window.location.origin + '/api';

// Check backend status
async function checkBackendStatus() {
    const statusDot = document.getElementById('system-status-dot');
    const statusText = document.getElementById('system-status-text');
    try {
        const response = await fetch(`${API_BASE_URL}/comments`);
        if (response.ok) {
            statusDot.classList.add('online');
            statusText.innerText = 'ONLINE';
            statusText.style.color = '#10b981';
            return true;
        }
    } catch (error) {
        statusDot.classList.remove('online');
        statusText.innerText = 'OFFLINE';
        statusText.style.color = '#ef4444';
        return false;
    }
}

// Load and render approved comments
async function loadChatComments() {
    const commentsList = document.getElementById('chat-messages');
    try {
        const response = await fetch(`${API_BASE_URL}/comments`);
        if (!response.ok) throw new Error('Failed to fetch comments');
        
        const comments = await response.json();
        commentsList.innerHTML = '';
        
        if (comments.length === 0) {
            commentsList.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary); margin: auto; padding: 2rem;">
                    <i class="fa-regular fa-comments" style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>No comments yet. Be the first to share your thoughts!</p>
                </div>
            `;
            return;
        }

        // Display comments from oldest to newest for chat layout
        comments.reverse().forEach(comment => {
            const formattedTime = new Date(comment.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const bubble = document.createElement('div');
            bubble.className = 'message-bubble';
            
            bubble.innerHTML = `
                <div class="message-header">
                    <span class="message-author">${escapeHTML(comment.author)}</span>
                    <span class="message-time">${formattedTime}</span>
                </div>
                <div class="message-body">${escapeHTML(comment.content)}</div>
                <div class="message-score safe">
                    <i class="fa-solid fa-face-smile"></i> Safe: ${Math.round(comment.toxicity_score * 100)}% toxicity
                </div>
            `;
            commentsList.appendChild(bubble);
        });

        // Scroll to the bottom of the feed
        commentsList.scrollTop = commentsList.scrollHeight;
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

// Handle comment form submission
async function handleCommentSubmit(event) {
    event.preventDefault();
    
    const authorInput = document.getElementById('comment-author');
    const contentInput = document.getElementById('comment-content');
    
    const author = authorInput.value.trim();
    const content = contentInput.value.trim();
    
    if (!author || !content) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ author, content })
        });
        
        if (!response.ok) {
            throw new Error('Failed to send comment');
        }
        
        const result = await response.json();
        
        contentInput.value = '';
        
        if (result.status === 'flagged') {
            // Display visual flag toast notification
            if (typeof showToast === 'function') {
                showToast(result.flagged_reason, result.toxicity_score);
            }
        } else {
            // reload comments list
            await loadChatComments();
        }
    } catch (error) {
        console.error('Submission error:', error);
        alert('Could not connect to the Lowkey backend server. Make sure the server is running.');
    }
}

// Utility function to prevent XSS
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Initialize on load
window.addEventListener('DOMContentLoaded', async () => {
    const online = await checkBackendStatus();
    if (online) {
        await loadChatComments();
    }
    
    // Poll for online status periodically
    setInterval(checkBackendStatus, 10000);
});
