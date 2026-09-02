/**
 * Aura Media Admin — Client Authentication Manager
 * Handles login, registration, session persistence, and auth UI state
 */

class AuthManager {
  constructor() {
    this.tokenKey = 'aura_auth_token';
    this.token = localStorage.getItem(this.tokenKey) || null;
    this.currentUser = null;
    this.currentMode = 'login'; // 'login' | 'register'

    this.modal = document.getElementById('authModal');
    this.loginForm = document.getElementById('loginForm');
    this.registerForm = document.getElementById('registerForm');
    this.authErrorBox = document.getElementById('authErrorBox');
    this.userMenuDropdown = document.getElementById('userMenuDropdown');

    this.initEvents();
  }

  async init() {
    if (this.token) {
      try {
        const res = await fetch('/api/auth/me', {
          headers: this.getAuthHeader()
        });
        const data = await res.json();
        if (data.success && data.user) {
          this.currentUser = data.user;
        } else {
          this.clearSession();
        }
      } catch (err) {
        console.warn('Failed to restore session:', err);
        this.clearSession();
      }
    }
    this.updateUI();
  }

  initEvents() {
    // Open Auth Modal Buttons
    const signInBtn = document.getElementById('headerSignInBtn');
    if (signInBtn) signInBtn.addEventListener('click', () => this.openModal('login'));

    const signUpBtn = document.getElementById('headerSignUpBtn');
    if (signUpBtn) signUpBtn.addEventListener('click', () => this.openModal('register'));

    // Modal Close
    const closeBtn = document.getElementById('closeAuthModalBtn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());

    const cancelBtn = document.getElementById('cancelAuthModalBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());

    // Switch between Login and Register tabs
    document.querySelectorAll('.auth-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Switch links in forms
    const switchToRegister = document.getElementById('switchToRegisterLink');
    if (switchToRegister) {
      switchToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchTab('register');
      });
    }

    const switchToLogin = document.getElementById('switchToLoginLink');
    if (switchToLogin) {
      switchToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchTab('login');
      });
    }

    // Login Form Submit
    if (this.loginForm) {
      this.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    // Register Form Submit
    if (this.registerForm) {
      this.registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleRegister();
      });
    }

    // User Pill Dropdown Toggle
    const userPill = document.getElementById('userProfilePill');
    if (userPill) {
      userPill.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.userMenuDropdown) {
          this.userMenuDropdown.classList.toggle('active');
        }
      });
    }

    // Close dropdown on outside click
    window.addEventListener('click', () => {
      if (this.userMenuDropdown && this.userMenuDropdown.classList.contains('active')) {
        this.userMenuDropdown.classList.remove('active');
      }
    });

    // Logout Button
    const logoutBtn = document.getElementById('dropdownLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
    }
  }

  getAuthHeader() {
    return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
  }

  isLoggedIn() {
    return !!this.token && !!this.currentUser;
  }

  openModal(mode = 'login') {
    this.hideError();
    this.switchTab(mode);
    if (this.modal) this.modal.classList.add('active');
    if (window.lucide) window.lucide.createIcons();
  }

  closeModal() {
    if (this.modal) this.modal.classList.remove('active');
    this.hideError();
  }

  switchTab(tab) {
    this.currentMode = tab;
    this.hideError();

    document.querySelectorAll('.auth-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });

    if (tab === 'login') {
      if (this.loginForm) this.loginForm.style.display = 'flex';
      if (this.registerForm) this.registerForm.style.display = 'none';
      document.getElementById('authModalTitle').textContent = 'Welcome Back to Aura';
      document.getElementById('authModalSub').textContent = 'Sign in to access your creator studio and manage uploads';
    } else {
      if (this.loginForm) this.loginForm.style.display = 'none';
      if (this.registerForm) this.registerForm.style.display = 'flex';
      document.getElementById('authModalTitle').textContent = 'Create Aura Creator Account';
      document.getElementById('authModalSub').textContent = 'Join Aura Studio to upload wallpapers and audio tones';
    }

    if (window.lucide) window.lucide.createIcons();
  }

  showError(message) {
    if (this.authErrorBox) {
      this.authErrorBox.textContent = message;
      this.authErrorBox.style.display = 'block';
    }
  }

  hideError() {
    if (this.authErrorBox) {
      this.authErrorBox.textContent = '';
      this.authErrorBox.style.display = 'none';
    }
  }

  async handleLogin() {
    const identifier = document.getElementById('loginIdentifierInput').value.trim();
    const password = document.getElementById('loginPasswordInput').value;
    const submitBtn = document.getElementById('loginSubmitBtn');

    if (!identifier || !password) {
      this.showError('Please enter your email/username and password.');
      return;
    }

    this.hideError();
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i data-lucide="loader-2"></i> Signing In...`;
    if (window.lucide) window.lucide.createIcons();

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const result = await res.json();

      if (result.success && result.token) {
        this.token = result.token;
        this.currentUser = result.user;
        localStorage.setItem(this.tokenKey, this.token);
        
        window.showToast(`Welcome back, ${this.currentUser.username}!`, 'success');
        this.closeModal();
        this.updateUI();
        if (window.app) window.app.loadMediaCatalog();
      } else {
        this.showError(result.error || 'Login failed.');
      }
    } catch (err) {
      console.error('Login error:', err);
      this.showError('Unable to connect to server. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Sign In</span> <i data-lucide="arrow-right"></i>`;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  async handleRegister() {
    const username = document.getElementById('regUsernameInput').value.trim();
    const email = document.getElementById('regEmailInput').value.trim();
    const password = document.getElementById('regPasswordInput').value;
    const submitBtn = document.getElementById('registerSubmitBtn');

    if (!username || !email || !password) {
      this.showError('All fields are required.');
      return;
    }

    if (password.length < 6) {
      this.showError('Password must be at least 6 characters long.');
      return;
    }

    this.hideError();
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i data-lucide="loader-2"></i> Creating Account...`;
    if (window.lucide) window.lucide.createIcons();

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const result = await res.json();

      if (result.success && result.token) {
        this.token = result.token;
        this.currentUser = result.user;
        localStorage.setItem(this.tokenKey, this.token);

        window.showToast(`Account created! Welcome, ${this.currentUser.username}.`, 'success');
        this.closeModal();
        this.updateUI();
        if (window.app) window.app.loadMediaCatalog();
      } else {
        this.showError(result.error || 'Registration failed.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      this.showError('Unable to connect to server. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Create Account</span> <i data-lucide="sparkles"></i>`;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  async logout() {
    if (this.token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: this.getAuthHeader()
        });
      } catch (err) {
        console.warn('Logout API warning:', err);
      }
    }

    this.clearSession();
    window.showToast('You have been logged out.', 'info');
    this.updateUI();
    if (window.app) {
      window.app.currentScope = 'all';
      window.app.loadMediaCatalog();
    }
  }

  clearSession() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem(this.tokenKey);
  }

  updateUI() {
    const loggedOutGroup = document.getElementById('headerLoggedOutGroup');
    const loggedInGroup = document.getElementById('headerLoggedInGroup');
    const userAvatarText = document.getElementById('userAvatarInitial');
    const userNameDisplay = document.getElementById('headerUserName');
    const myStudioTab = document.getElementById('myStudioTab');

    if (this.isLoggedIn()) {
      if (loggedOutGroup) loggedOutGroup.style.display = 'none';
      if (loggedInGroup) loggedInGroup.style.display = 'flex';
      if (myStudioTab) myStudioTab.style.display = 'inline-flex';

      if (userAvatarText) {
        userAvatarText.textContent = (this.currentUser.username || 'U').charAt(0).toUpperCase();
        userAvatarText.parentElement.style.backgroundColor = this.currentUser.avatarColor || '#2563EB';
      }
      if (userNameDisplay) {
        userNameDisplay.textContent = this.currentUser.username;
      }
    } else {
      if (loggedOutGroup) loggedOutGroup.style.display = 'flex';
      if (loggedInGroup) loggedInGroup.style.display = 'none';
      if (myStudioTab) myStudioTab.style.display = 'none';
    }

    if (window.lucide) window.lucide.createIcons();
  }
}

window.authManager = new AuthManager();
document.addEventListener('DOMContentLoaded', () => {
  window.authManager.init();
});
