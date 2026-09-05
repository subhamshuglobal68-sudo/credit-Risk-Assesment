// static/js/assistant.js - Plain-language AI Credit Assistant

(function() {
  // Inject widget CSS dynamically to keep base.html clean
  const style = document.createElement('style');
  style.textContent = `
    .credit-assistant-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--teal, #0f766e);
      color: white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      transition: all 0.2s ease;
      border: none;
    }
    .credit-assistant-btn:hover {
      transform: scale(1.05);
      background: #0d9488;
    }
    .credit-assistant-btn span {
      font-size: 28px;
    }
    .credit-assistant-box {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      height: 500px;
      background: var(--card, #ffffff);
      border: 1px solid var(--border, #cbd5e1);
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      display: flex;
      flex-direction: column;
      z-index: 1000;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      transform: translateY(20px) scale(0.95);
      opacity: 0;
      pointer-events: none;
    }
    .credit-assistant-box.active {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: auto;
    }
    .assistant-header {
      background: var(--teal, #0f766e);
      color: white;
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .assistant-header h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .assistant-header button {
      background: transparent;
      border: none;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
    }
    .assistant-body {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: var(--bg, #f8fafc);
    }
    .assistant-bubble {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13.5px;
      line-height: 1.45;
      word-wrap: break-word;
    }
    .assistant-bubble.bot {
      background: var(--panel, #f1f5f9);
      color: var(--text, #1e293b);
      align-self: flex-start;
      border-bottom-left-radius: 2px;
      border: 1px solid var(--border, #cbd5e1);
    }
    .assistant-bubble.user {
      background: var(--teal, #0f766e);
      color: white;
      align-self: flex-end;
      border-bottom-right-radius: 2px;
    }
    .assistant-suggestions {
      padding: 8px 16px;
      background: var(--card, #ffffff);
      border-top: 1px solid var(--border, #cbd5e1);
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .assistant-chip {
      background: var(--panel, #f1f5f9);
      border: 1px solid var(--border, #cbd5e1);
      color: var(--teal, #0f766e);
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 11.5px;
      cursor: pointer;
      transition: all 0.15s ease;
      font-weight: 500;
    }
    .assistant-chip:hover {
      background: var(--teal, #0f766e);
      color: white;
    }
    .assistant-input-area {
      display: flex;
      border-top: 1px solid var(--border, #cbd5e1);
      background: var(--card, #ffffff);
    }
    .assistant-input-area input {
      flex: 1;
      border: none;
      padding: 14px 16px;
      font-size: 13.5px;
      outline: none;
      background: transparent;
      color: var(--text, #1e293b);
    }
    .assistant-input-area button {
      background: transparent;
      border: none;
      color: var(--teal, #0f766e);
      padding: 0 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
    }
    .assistant-input-area button:hover {
      color: #0d9488;
    }
    .assistant-bubble.bot p {
      margin: 0 0 8px;
    }
    .assistant-bubble.bot p:last-child {
      margin-bottom: 0;
    }
    .assistant-bubble.bot ul {
      margin: 0;
      padding-left: 20px;
    }
  `;
  document.head.appendChild(style);

  // Inject markup
  const btn = document.createElement('button');
  btn.className = 'credit-assistant-btn';
  btn.setAttribute('aria-label', 'Open Credit Assistant');
  btn.innerHTML = '<span class="material-symbols-outlined">support_agent</span>';
  document.body.appendChild(btn);

  const box = document.createElement('div');
  box.className = 'credit-assistant-box';
  box.innerHTML = `
    <div class="assistant-header">
      <h3><span class="material-symbols-outlined">smart_toy</span>CREA Credit Assistant</h3>
      <button id="close-assistant" aria-label="Close Assistant"><span class="material-symbols-outlined">close</span></button>
    </div>
    <div class="assistant-body" id="assistant-chat-body">
      <div class="assistant-bubble bot">
        Hello! I am your AI Credit Assistant. I can explain credit scores, outline risk factors, and suggest actions to improve creditworthiness in plain language.
      </div>
    </div>
    <div class="assistant-suggestions">
      <div class="assistant-chip" data-msg="Explain this decision in plain language">Explain Decision</div>
      <div class="assistant-chip" data-msg="How can I improve my credit score?">Improve Score</div>
      <div class="assistant-chip" data-msg="Show security and fraud verification details">Security & Fraud</div>
    </div>
    <form class="assistant-input-area" id="assistant-form-send">
      <input type="text" id="assistant-input" placeholder="Ask a question..." autocomplete="off" aria-label="Type message">
      <button type="submit" aria-label="Send message"><span class="material-symbols-outlined">send</span></button>
    </form>
  `;
  document.body.appendChild(box);

  // Events
  btn.addEventListener('click', () => {
    box.classList.toggle('active');
    scrollToBottom();
  });

  document.getElementById('close-assistant').addEventListener('click', () => {
    box.classList.remove('active');
  });

  const chatBody = document.getElementById('assistant-chat-body');
  const inputEl = document.getElementById('assistant-input');

  function scrollToBottom() {
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function appendBubble(text, isUser = false) {
    const bubble = document.createElement('div');
    bubble.className = `assistant-bubble ${isUser ? 'user' : 'bot'}`;
    
    // Simple markdown mapping for bot responses
    if (!isUser) {
      const html = text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/• (.*?)(<br>|$)/g, '<li>$1</li>');
      bubble.innerHTML = html;
    } else {
      bubble.textContent = text;
    }
    
    chatBody.appendChild(bubble);
    scrollToBottom();
  }

  async function sendMessage(msg) {
    if (!msg.trim()) return;
    appendBubble(msg, true);
    
    // Add temporary loading skeleton
    const loading = document.createElement('div');
    loading.className = 'assistant-bubble bot loading';
    loading.textContent = 'Typing...';
    chatBody.appendChild(loading);
    scrollToBottom();

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();
      loading.remove();
      appendBubble(data.response || 'Sorry, I encountered an error answering your question.');
    } catch (e) {
      loading.remove();
      appendBubble('Sorry, I cannot connect to the assistance service right now.');
    }
  }

  document.getElementById('assistant-form-send').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = inputEl.value.trim();
    if (val) {
      sendMessage(val);
      inputEl.value = '';
    }
  });

  // Wire suggestion chips
  document.querySelectorAll('.assistant-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      sendMessage(chip.dataset.msg);
    });
  });

})();
