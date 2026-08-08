/**
 * Lexa Chat Widget — Interactive Sidebar Chatbot
 * ================================================
 * Embed di website manapun dengan:
 *   <link rel="stylesheet" href="http://localhost:8000/widget/lexa-widget.css">
 *   <script src="http://localhost:8000/widget/lexa-widget.js"></script>
 *   <script>LexaWidget.init({ apiUrl: 'http://localhost:8000' });</script>
 */

const LexaWidget = (() => {
    // ── State ──
    let state = {
        isOpen: false,
        isStreaming: false,
        sessionId: localStorage.getItem('lexa_session_id') || '',
        messages: JSON.parse(localStorage.getItem('lexa_messages') || '[]'),
        config: null,
        apiUrl: 'http://localhost:8000',
        messageCount: 0,
        escalationShown: false,
    };

    // ── DOM References ──
    let els = {};

    // ── Helpers ──
    function formatTime(date) {
        return new Intl.DateTimeFormat('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    }

    function saveToStorage() {
        localStorage.setItem('lexa_session_id', state.sessionId);
        localStorage.setItem('lexa_messages', JSON.stringify(state.messages));
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            els.messages.scrollTop = els.messages.scrollHeight;
        });
    }

    // ── Render HTML ──
    function createWidget() {
        const root = document.createElement('div');
        root.id = 'lexa-widget-root';

        root.innerHTML = `
            <!-- Floating Bubble -->
            <button class="lexa-bubble" id="lexa-bubble" aria-label="Buka chat Lexa">
                <svg class="lexa-icon-chat" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                </svg>
                <svg class="lexa-icon-close" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
                <span class="lexa-badge" id="lexa-badge">1</span>
            </button>

            <!-- Chat Panel -->
            <div class="lexa-panel" id="lexa-panel">
                <!-- Header -->
                <div class="lexa-header">
                    <div class="lexa-header-avatar">💬</div>
                    <div class="lexa-header-info">
                        <div class="lexa-header-name">Lexa</div>
                        <div class="lexa-header-status">Online</div>
                    </div>
                    <div class="lexa-header-actions">
                        <button class="lexa-header-btn" id="lexa-reset-btn" title="Reset Percakapan">
                            <svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                        </button>
                        <button class="lexa-header-btn" id="lexa-minimize-btn" title="Tutup">
                            <svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>
                        </button>
                    </div>
                </div>

                <!-- Error Toast -->
                <div class="lexa-toast" id="lexa-toast">
                    <span>⚠️</span>
                    <span id="lexa-toast-msg">Terjadi kesalahan</span>
                    <button class="lexa-toast-close" id="lexa-toast-close">×</button>
                </div>

                <!-- Messages -->
                <div class="lexa-messages" id="lexa-messages">
                    <!-- Messages rendered here -->
                </div>

                <!-- Typing Indicator -->
                <div class="lexa-typing" id="lexa-typing">
                    <div class="lexa-msg-avatar" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); width: 30px; height: 30px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;">💬</div>
                    <div class="lexa-typing-dots">
                        <span></span><span></span><span></span>
                    </div>
                </div>

                <!-- Quick Replies -->
                <div class="lexa-quick-replies" id="lexa-quick-replies"></div>

                <!-- Escalation Banner -->
                <div class="lexa-escalation" id="lexa-escalation">
                    <span class="lexa-escalation-text">Butuh bantuan lebih lanjut?</span>
                    <button class="lexa-escalation-btn" id="lexa-escalation-btn">💬 Hubungi CS</button>
                </div>

                <!-- Input Area -->
                <div class="lexa-input-area">
                    <div class="lexa-input-wrapper">
                        <textarea
                            class="lexa-input"
                            id="lexa-input"
                            placeholder="Ketik pesan..."
                            rows="1"
                            maxlength="2000"
                        ></textarea>
                    </div>
                    <button class="lexa-send-btn" id="lexa-send-btn" disabled title="Kirim">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                </div>

                <!-- Footer -->
                <div class="lexa-footer">
                    Powered by <a href="https://lexatech.id" target="_blank" rel="noopener">LEXA Software House</a>
                </div>
            </div>
        `;

        document.body.appendChild(root);

        // Cache DOM references
        els.bubble = document.getElementById('lexa-bubble');
        els.badge = document.getElementById('lexa-badge');
        els.panel = document.getElementById('lexa-panel');
        els.messages = document.getElementById('lexa-messages');
        els.typing = document.getElementById('lexa-typing');
        els.quickReplies = document.getElementById('lexa-quick-replies');
        els.escalation = document.getElementById('lexa-escalation');
        els.input = document.getElementById('lexa-input');
        els.sendBtn = document.getElementById('lexa-send-btn');
        els.resetBtn = document.getElementById('lexa-reset-btn');
        els.minimizeBtn = document.getElementById('lexa-minimize-btn');
        els.toast = document.getElementById('lexa-toast');
        els.toastMsg = document.getElementById('lexa-toast-msg');
        els.toastClose = document.getElementById('lexa-toast-close');
        els.escalationBtn = document.getElementById('lexa-escalation-btn');
    }

    // ── Event Binding ──
    function bindEvents() {
        els.bubble.addEventListener('click', togglePanel);
        els.minimizeBtn.addEventListener('click', togglePanel);
        els.sendBtn.addEventListener('click', sendMessage);
        els.resetBtn.addEventListener('click', resetChat);
        els.toastClose.addEventListener('click', hideToast);
        els.escalationBtn.addEventListener('click', escalateToHuman);

        // Input handling
        els.input.addEventListener('input', () => {
            els.sendBtn.disabled = !els.input.value.trim() || state.isStreaming;
            autoResizeInput();
        });

        els.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (els.input.value.trim() && !state.isStreaming) {
                    sendMessage();
                }
            }
        });
    }

    // ── Panel Toggle ──
    function togglePanel() {
        state.isOpen = !state.isOpen;
        els.panel.classList.toggle('lexa-open', state.isOpen);
        els.bubble.classList.toggle('lexa-open', state.isOpen);

        if (state.isOpen) {
            els.badge.classList.remove('lexa-visible');
            els.input.focus();
            scrollToBottom();
        }
    }

    // ── Auto-resize Textarea ──
    function autoResizeInput() {
        els.input.style.height = 'auto';
        els.input.style.height = Math.min(els.input.scrollHeight, 100) + 'px';
    }

    // ── Render Messages ──
    function renderMessage(msg, animate = true) {
        const isUser = msg.role === 'user';
        const div = document.createElement('div');
        div.className = `lexa-msg lexa-msg-${msg.role}`;
        if (!animate) div.style.animation = 'none';

        const timeStr = formatTime(new Date(msg.timestamp || Date.now()));

        let feedbackHTML = '';
        if (!isUser) {
            feedbackHTML = `
                <div class="lexa-msg-feedback">
                    <button class="lexa-feedback-btn ${msg.feedback === 'up' ? 'lexa-selected' : ''}" data-feedback="up" title="Jawaban bagus">👍</button>
                    <button class="lexa-feedback-btn ${msg.feedback === 'down' ? 'lexa-selected' : ''}" data-feedback="down" title="Jawaban kurang tepat">👎</button>
                </div>
            `;
        }

        div.innerHTML = `
            <div class="lexa-msg-avatar">${isUser ? '👤' : '💬'}</div>
            <div class="lexa-msg-content">
                <div class="lexa-msg-bubble">${escapeHtml(msg.content)}</div>
                ${feedbackHTML}
                <span class="lexa-msg-time">${timeStr}</span>
            </div>
        `;

        // Bind feedback buttons
        if (!isUser) {
            div.querySelectorAll('.lexa-feedback-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const feedback = btn.dataset.feedback;
                    msg.feedback = feedback;
                    saveToStorage();

                    // Visual update
                    div.querySelectorAll('.lexa-feedback-btn').forEach(b =>
                        b.classList.remove('lexa-selected')
                    );
                    btn.classList.add('lexa-selected');
                });
            });
        }

        els.messages.appendChild(div);
        return div;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ── Render Streaming Message ──
    function createStreamingBubble() {
        const div = document.createElement('div');
        div.className = 'lexa-msg lexa-msg-bot';
        div.id = 'lexa-streaming-msg';

        div.innerHTML = `
            <div class="lexa-msg-avatar">💬</div>
            <div class="lexa-msg-content">
                <div class="lexa-msg-bubble" id="lexa-streaming-bubble"></div>
            </div>
        `;

        els.messages.appendChild(div);
        return document.getElementById('lexa-streaming-bubble');
    }

    // ── Render Quick Replies ──
    function renderQuickReplies(replies) {
        els.quickReplies.innerHTML = '';
        if (!replies || replies.length === 0) return;

        replies.forEach(text => {
            const btn = document.createElement('button');
            btn.className = 'lexa-quick-btn';
            btn.textContent = text;
            btn.addEventListener('click', () => {
                els.input.value = text;
                sendMessage();
            });
            els.quickReplies.appendChild(btn);
        });
    }

    // ── Load Saved Messages ──
    function loadSavedMessages() {
        state.messages.forEach(msg => renderMessage(msg, false));
        if (state.messages.length > 0) {
            scrollToBottom();
        }
    }

    // ── Show Welcome Message ──
    function showWelcome() {
        if (state.messages.length === 0 && state.config) {
            const welcomeMsg = {
                role: 'bot',
                content: state.config.welcome_message,
                timestamp: Date.now(),
            };
            state.messages.push(welcomeMsg);
            renderMessage(welcomeMsg);
            saveToStorage();

            // Show notification badge
            if (!state.isOpen) {
                els.badge.classList.add('lexa-visible');
            }
        }
    }

    // ── Send Message ──
    async function sendMessage() {
        const text = els.input.value.trim();
        if (!text || state.isStreaming) return;

        // Add user message
        const userMsg = { role: 'user', content: text, timestamp: Date.now() };
        state.messages.push(userMsg);
        renderMessage(userMsg);
        saveToStorage();

        // Clear input
        els.input.value = '';
        els.sendBtn.disabled = true;
        autoResizeInput();

        // Hide quick replies
        els.quickReplies.innerHTML = '';

        // Show typing
        state.isStreaming = true;
        els.typing.classList.add('lexa-visible');
        scrollToBottom();

        try {
            const response = await fetch(`${state.apiUrl}/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    session_id: state.sessionId,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Hide typing, create streaming bubble
            els.typing.classList.remove('lexa-visible');
            const streamBubble = createStreamingBubble();
            let fullResponse = '';

            // Read SSE stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6);

                    try {
                        const data = JSON.parse(jsonStr);

                        if (data.type === 'session') {
                            state.sessionId = data.session_id;
                        } else if (data.type === 'chunk') {
                            fullResponse += data.content;
                            streamBubble.textContent = fullResponse;
                            scrollToBottom();
                        } else if (data.type === 'done') {
                            // Streaming complete
                        } else if (data.type === 'error') {
                            throw new Error(data.message);
                        }
                    } catch (e) {
                        if (e.message && !e.message.includes('JSON')) throw e;
                    }
                }
            }

            // Finalize: replace streaming bubble with proper message
            const streamingEl = document.getElementById('lexa-streaming-msg');
            if (streamingEl) streamingEl.remove();

            const botMsg = {
                role: 'bot',
                content: fullResponse,
                timestamp: Date.now(),
            };
            state.messages.push(botMsg);
            renderMessage(botMsg);
            saveToStorage();

            // Track message count for escalation
            state.messageCount++;
            if (state.messageCount >= 5 && !state.escalationShown) {
                els.escalation.classList.add('lexa-visible');
                state.escalationShown = true;
            }

        } catch (error) {
            els.typing.classList.remove('lexa-visible');

            // Remove streaming bubble if exists
            const streamingEl = document.getElementById('lexa-streaming-msg');
            if (streamingEl) streamingEl.remove();

            // Show error as bot message
            const errorMsg = {
                role: 'bot',
                content: 'Maaf, terjadi gangguan saat memproses pesan Anda. Silakan coba lagi dalam beberapa saat. 🙏',
                timestamp: Date.now(),
            };
            state.messages.push(errorMsg);
            renderMessage(errorMsg);
            saveToStorage();

            showToast(`Gagal mengirim pesan: ${error.message}`);
        } finally {
            state.isStreaming = false;
            scrollToBottom();
        }
    }

    // ── Reset Chat ──
    async function resetChat() {
        if (!confirm('Yakin ingin menghapus semua riwayat percakapan?')) return;

        // Reset server session
        if (state.sessionId) {
            try {
                await fetch(`${state.apiUrl}/chat/reset?session_id=${state.sessionId}`, {
                    method: 'POST',
                });
            } catch (e) {
                // Ignore errors on reset
            }
        }

        // Reset local state
        state.messages = [];
        state.sessionId = '';
        state.messageCount = 0;
        state.escalationShown = false;
        els.messages.innerHTML = '';
        els.escalation.classList.remove('lexa-visible');
        saveToStorage();

        // Show welcome again
        showWelcome();
        if (state.config) {
            renderQuickReplies(state.config.quick_replies);
        }
    }

    // ── Escalation ──
    function escalateToHuman() {
        const whatsappUrl = 'https://wa.me/6285320132014?text=Halo%2C%20saya%20butuh%20bantuan%20dari%20tim%20customer%20service%20LEXA.';
        window.open(whatsappUrl, '_blank');
    }

    // ── Toast Notifications ──
    function showToast(message) {
        els.toastMsg.textContent = message;
        els.toast.classList.add('lexa-visible');
        setTimeout(hideToast, 6000);
    }

    function hideToast() {
        els.toast.classList.remove('lexa-visible');
    }

    // ── Fetch Config ──
    async function fetchConfig() {
        try {
            const res = await fetch(`${state.apiUrl}/config`);
            if (res.ok) {
                state.config = await res.json();
                showWelcome();
                if (state.messages.length <= 1) {
                    renderQuickReplies(state.config.quick_replies);
                }
            }
        } catch (e) {
            // Fallback config
            state.config = {
                welcome_message: 'Halo! 👋 Saya Lexa, ada yang bisa saya bantu?',
                quick_replies: ['Layanan apa saja?', 'Berapa harganya?', 'Hubungi kami'],
            };
            showWelcome();
            renderQuickReplies(state.config.quick_replies);
        }
    }

    // ── Public: Initialize ──
    function init(options = {}) {
        if (options.apiUrl) state.apiUrl = options.apiUrl.replace(/\/$/, '');

        createWidget();
        bindEvents();
        loadSavedMessages();
        fetchConfig();
    }

    return { init };
})();
