import { handleLogin, handleRegister } from './auth.js';
import {
  showAuthModal,
  showChat,
  displayMessage,
  displaySystemMessage,
  scrollToBottom,
  showNotification,
} from './ui.js';

export class ChatApp {
  constructor() {
    this.socket = null;
    this.currentUser = null;
    this.currentGroup = null;
    this.token = localStorage.getItem('token');
    this.typingTimer = null;
    this.isTyping = false;
    this.isAnonymousMode = false; // Chat anonymity toggle
    this.typingUsers = new Set(); // Track users currently typing
    this.init();
  }

  init() {
    this.bindEvents();
    if (this.token) {
      this.validateToken();
    } else {
      showAuthModal();
    }
  }

  bindEvents() {
    // Switch login/register tabs
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      if (btn)
        btn.addEventListener('click', (e) =>
          this.switchAuthTab(e.target.dataset.tab)
        );
    });

    const loginForm = document.getElementById('loginForm');
    if (loginForm)
      loginForm.addEventListener('submit', (e) => handleLogin.call(this, e));

    const registerForm = document.getElementById('registerForm');
    if (registerForm)
      registerForm.addEventListener('submit', (e) => handleRegister.call(this, e));

    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
      messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault(); // prevent newline
          this.sendMessage();
        } else {
          this.handleTyping();
        }
      });
      messageInput.addEventListener('input', () => {
        const btn = document.getElementById('sendBtn');
        if (btn) btn.disabled = !messageInput.value.trim();
      });
    }

    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.addEventListener('click', () => this.sendMessage());

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());

    const emojiBtn = document.getElementById('emojiBtn');
    if (emojiBtn)
      emojiBtn.addEventListener('click', () => {
        const picker = document.getElementById('emojiPicker');
        if (picker)
          picker.style.display =
            picker.style.display === 'none' ? 'block' : 'none';
      });

const picker = document.querySelector('emoji-picker');
if (picker) {
  picker.addEventListener('emoji-click', (event) => {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    if (input) {
      input.value += event.detail.unicode;
      input.focus();

      // ✅ Manually trigger enabling the send button
      if (sendBtn) sendBtn.disabled = !input.value.trim();

      // Hide emoji picker after selection
      const emojiPicker = document.getElementById('emojiPicker');
      if (emojiPicker) emojiPicker.style.display = 'none';
    }
  });
}


    const imageBtn = document.getElementById('imageBtn');
    // if (imageBtn)
    //   imageBtn.addEventListener('click', () =>
    //     showNotification('Image upload not implemented', 'info')
    //   );

    const attachmentBtn = document.getElementById('attachmentBtn');
    // if (attachmentBtn)
    //   attachmentBtn.addEventListener('click', () =>
    //     showNotification('Attachment upload not implemented', 'info')
    //   );

    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle)
      modeToggle.addEventListener('click', () => {
        const body = document.body;
        const currentTheme = body.getAttribute('data-theme');
        body.setAttribute('data-theme', currentTheme === 'dark' ? 'light' : 'dark');
        localStorage.setItem('theme', body.getAttribute('data-theme'));
      });

    const incognitoBtn = document.getElementById('incognitoBtn');
    if (incognitoBtn)
      incognitoBtn.addEventListener('click', () => this.toggleAnonymousMode());
  }

  async validateToken() {
    try {
      const response = await fetch(`/api/chat/groups`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (response.ok) {
        const data = await response.json();
        this.currentGroup = data.group;
        await this.getCurrentUser();
        showChat.call(this);
      } else {
        localStorage.removeItem('token');
        showAuthModal();
      }
    } catch (error) {
      console.error('Token validation failed:', error);
      localStorage.removeItem('token');
      showAuthModal();
    }
  }

  async getCurrentUser() {
    try {
      const payload = JSON.parse(atob(this.token.split('.')[1]));
      this.currentUser = {
        id: payload.userId,
        username: localStorage.getItem('username') || 'Anonymous',
        isOnline: true,
      };
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  }

  switchAuthTab(tab) {
    document.querySelectorAll('.tab-btn').forEach((btn) =>
      btn.classList.remove('active')
    );
    const activeTab = document.querySelector(`[data-tab="${tab}"]`);
    if (activeTab) activeTab.classList.add('active');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (tab === 'login') {
      if (loginForm) loginForm.style.display = 'block';
      if (registerForm) registerForm.style.display = 'none';
    } else {
      if (loginForm) loginForm.style.display = 'none';
      if (registerForm) registerForm.style.display = 'block';
    }
  }

  async joinDefaultGroup() {
    try {
      const response = await fetch(`/api/chat/groups`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (response.ok) {
        const data = await response.json();
        this.currentGroup = data.group;
      }
    } catch (error) {
      console.error('Error joining group:', error);
    }
  }

  initializeSocket() {
    this.socket = io( {
      auth: { token: this.token },
    });

    this.socket.on('connect', () => {
      if (this.currentGroup && this.currentUser) {
        this.socket.emit('join-group', {
          groupId: this.currentGroup.id,
          userId: this.currentUser.id,
          username: this.currentUser.username,
        });
        this.socket.emit('user-status', {
          userId: this.currentUser.id,
          isOnline: true,
        });
      }
    });

    this.socket.on('new-message', (message) => {
      displayMessage.call(this, message);
      // Scroll to bottom on new message
      const messagesWrapper = document.getElementById('messagesWrapper');
      if (messagesWrapper) {
        messagesWrapper.scrollTop = messagesWrapper.scrollHeight;
      }
    });

    this.socket.on('user-typing', (data) => {
      const typingEl = document.getElementById('typingIndicator');
      const typingText = document.getElementById('typingText');
      const messagesWrapper = document.getElementById('messagesWrapper'); // scrolling container

      if (typingEl && typingText && messagesWrapper) {
        if (data.userId === this.currentUser.id) return; // Exclude self

        if (data.isTyping) {
          this.typingUsers.add(data.userId);
        } else {
          this.typingUsers.delete(data.userId);
        }

        if (this.typingUsers.size > 0) {
          // Show the first typing user's name in the list (simple UX)
          const [firstTypingUserId] = this.typingUsers;
          // To improve: keep map of userId -> username if needed
          typingText.textContent = `${data.username} is typing...`;
          typingEl.style.display = 'flex';

          // Scroll chat to bottom so typing indicator is visible
          messagesWrapper.scrollTop = messagesWrapper.scrollHeight;

          console.log('[DEBUG] Typing indicator shown for:', data.username);
        } else {
          typingEl.style.display = 'none';
          console.log('[DEBUG] Typing indicator hidden');
        }
      }
    });

    this.socket.on('user-joined', (data) => {
      displaySystemMessage(`${data.username} joined`);
    });

    this.socket.on('user-left', (data) => {
      displaySystemMessage(`${data.username} left`);
    });

    this.socket.on('user-status', (data) => {
      this.updateUserStatus(data.userId, data.isOnline);
    });

    this.socket.on('disconnect', () => {
      if (this.currentUser) {
        this.socket.emit('user-status', {
          userId: this.currentUser.id,
          isOnline: false,
        });
      }
    });
  }

  sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content || !this.socket || !this.currentGroup) return;
    this.socket.emit('send-message', {
      content,
      senderId: this.currentUser.id,
      groupId: this.currentGroup.id,
      type: 'TEXT',
      isAnonymous: this.isAnonymousMode,
    });
    input.value = '';
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.disabled = true;
    if (this.isTyping) {
      this.socket.emit('typing', {
        groupId: this.currentGroup.id,
        userId: this.currentUser.id,
        username: this.isAnonymousMode ? 'Anonymous' : this.currentUser.username,
        isTyping: false,
      });
      this.isTyping = false;
    }
  }

  handleTyping() {
    if (!this.socket || !this.currentGroup) return;

    if (!this.isTyping) {
      this.isTyping = true;
      this.socket.emit('typing', {
        groupId: this.currentGroup.id,
        userId: this.currentUser.id,
        username: this.isAnonymousMode ? 'Anonymous' : this.currentUser.username,
        isTyping: true,
      });
    }

    clearTimeout(this.typingTimer); // reset timer
    this.typingTimer = setTimeout(() => {
      if (this.isTyping) {
        this.isTyping = false;
        this.socket.emit('typing', {
          groupId: this.currentGroup.id,
          userId: this.currentUser.id,
          username: this.isAnonymousMode ? 'Anonymous' : this.currentUser.username,
          isTyping: false,
        });
        console.log('[TYPING] Stopped typing emitted');
      }
    }, 1000);
  }

  async loadMessages() {
    if (!this.currentGroup) return;
    try {
      const response = await fetch(
        `/api/chat/groups/${this.currentGroup.id}/messages`,
        {
          headers: { Authorization: `Bearer ${this.token}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const messagesWrapper = document.getElementById('messagesWrapper');
        if (messagesWrapper) {
          messagesWrapper.innerHTML = '';
          data.messages.forEach((message) => {
            displayMessage.call(this, message, false);
          });
          scrollToBottom();
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  logout() {
    if (this.socket) {
      this.socket.emit('user-status', {
        userId: this.currentUser.id,
        isOnline: false,
      });
      this.socket.disconnect();
    }
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    this.token = null;
    this.currentUser = null;
    this.currentGroup = null;
    this.isAnonymousMode = false;
    showAuthModal();
    showNotification('Logged out successfully', 'success');
  }

toggleAnonymousMode() {
    this.isAnonymousMode = !this.isAnonymousMode;
    const incognitoBtn = document.getElementById('incognitoBtn');
    if (incognitoBtn) {
        // Toggle highlight class
        incognitoBtn.classList.toggle('incognito-on', this.isAnonymousMode);
        // Tooltip only
        incognitoBtn.title = this.isAnonymousMode
            ? 'You are anonymous'
            : 'Go Incognito';
        // Don't touch .textContent (icon only)
    }
    if (this.isAnonymousMode) {
        displaySystemMessage('You are now chatting as Anonymous');
        showNotification('Switched to incognito mode', 'success');
    } else {
        displaySystemMessage(
            'You are now chatting as ' +
              (this.currentUser ? this.currentUser.username : 'Guest')
        );
        showNotification('Exited incognito mode', 'success');
    }
}


  updateUserStatus(userId, isOnline) {
    const messages = document.querySelectorAll('.message');

    messages.forEach((msgEl) => {
      const header = msgEl.querySelector('.message-header');
      if (header) {
        const usernameSpan = header.querySelector('.username');
        if (usernameSpan) {
          if (msgEl.getAttribute('data-sender-id') == userId) {
            let dot = header.querySelector('.status-dot');

            if (isOnline) {
              if (!dot) {
                dot = document.createElement('span');
                dot.className = 'status-dot active';
                usernameSpan.appendChild(dot);
              } else {
                dot.classList.add('active');
              }
              dot.title = 'Online';
            } else {
              if (dot) {
                dot.remove();
              }
            }
          }
        }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.body.setAttribute('data-theme', savedTheme);
  new ChatApp();
});
