import { showChat, showNotification } from './ui.js';


export async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!username || !password) {
        showNotification('Please fill in both username and password', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();
        console.log('Login response:', result);

        if (response.ok) {
            this.token = result.token;
            this.currentUser = result.user;
            localStorage.setItem('token', this.token);
            localStorage.setItem('username', result.user.username);

            await this.joinDefaultGroup();
            showChat.call(this);
            showNotification(`Welcome, ${result.user.username}!`, 'success');
        } else {
            showNotification(result.error || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Connection error. Please try again.', 'error');
    }
}

export async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();

    if (!username || !password) {
        showNotification('Username and password are required', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email: email || null, password })
        });

        const result = await response.json();
        console.log('Register response:', result);

        if (response.ok) {
            this.token = result.token;
            this.currentUser = result.user;
            localStorage.setItem('token', this.token);
            localStorage.setItem('username', result.user.username);

            await this.joinDefaultGroup();
            showChat.call(this);
            showNotification(`Welcome, ${result.user.username}!`, 'success');
        } else {
            showNotification(result.error || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Register error:', error);
        showNotification('Connection error. Please try again.', 'error');
    }
}