import { generateAvatar, formatTime, escapeHtml } from './utils.js';

export function showAuthModal() {
  document.getElementById('authModal').style.display = 'flex';
  document.getElementById('chatContainer').style.display = 'none';
}

export function showChat() {
  document.getElementById('authModal').style.display = 'none';
  document.getElementById('chatContainer').style.display = 'flex';

  // Assumes these are always methods of your ChatApp instance
  this.initializeSocket();
  this.loadMessages();

  document.getElementById('groupName').textContent = this.currentGroup?.name || 'Fun Friday Group';
}

export function displayMessage(message, scroll = true) {
  const messagesWrapper = document.getElementById('messagesWrapper');
  const messageEl = document.createElement('div');

  const isOwn = message.sender.id === this.currentUser.id;
  const displayedUsername = message.isAnonymous ? 'Anonymous' : message.sender.username;

  messageEl.className = `message${isOwn ? ' own' : ''}`;
  messageEl.setAttribute('data-sender-id', message.sender.id);

  // Online/offline dot class
  const onlineDotClass = message.sender.isOnline ? 'status-dot active' : 'status-dot';
  // Avatar
  const avatar = generateAvatar(displayedUsername);
  const timestamp = formatTime(new Date(message.createdAt));

  // --- Add double check mark if it's your own message ---
  const doubleTick =
    isOwn
      ? `<span class="double-tick" title="Delivered">&#10003;&#10003;</span>`
      : '';

  messageEl.innerHTML = `
    <div class="user-avatar">
      ${avatar}
      <span class="${onlineDotClass}" title="${message.sender.isOnline ? "Online" : "Offline"}"></span>
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="username">${escapeHtml(displayedUsername)}</span>
        <span class="timestamp">${timestamp}</span>
      </div>
      <div class="message-text">
        ${escapeHtml(message.content)}
        ${doubleTick}
      </div>
    </div>
  `;

  messagesWrapper.appendChild(messageEl);
  if (scroll) scrollToBottom();
}


export function displaySystemMessage(content) {
  const messagesWrapper = document.getElementById('messagesWrapper');
  const messageEl = document.createElement('div');
  messageEl.className = 'message system';
  messageEl.innerHTML = `
    <div class="message-content">
      <div class="message-text">${escapeHtml(content)}</div>
    </div>
  `;
  messagesWrapper.appendChild(messageEl);
  scrollToBottom();
}

export function showTypingIndicator(data) {
  const indicator = document.getElementById('typingIndicator');
  const text = document.getElementById('typingText');

  // Fix: Safely check if currentUser is defined
  if (!this.currentUser || !indicator || !text) return;

  const isFromSomeoneElse = data.userId !== this.currentUser.id;

  if (data.isTyping && isFromSomeoneElse) {
    text.textContent = `${data.username} is typing...`;
    indicator.style.display = 'flex';
  } else if (!data.isTyping && isFromSomeoneElse) {
    console.log('[Typing] Hiding indicator');
    indicator.style.display = 'none';
  }
}


export function scrollToBottom() {
  // For entire chat scroll wrapper, prefer a container like #messagesContainer for true scrolling!
  const container = document.getElementById('messagesContainer') || document.getElementById('messagesWrapper');
  if (container) container.scrollTop = container.scrollHeight;
}

export function showNotification(message, type = 'success') {
  // Replace with a real notification/toast/snackbar in production!
  const notification = document.getElementById('notification');
  if (notification) {
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  } else {
    alert(message);
  }
}
