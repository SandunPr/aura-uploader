/**
 * Aura Media Admin — Main Application Controller
 * Handles media catalog fetching, filtering, tab switching, rendering, lightbox, and delete actions
 */

class AuraApp {
  constructor() {
    this.currentTab = 'all'; // 'all' | 'my_studio' | 'wallpapers' | 'ringtones' | 'notifications'
    this.searchQuery = '';
    this.currentTagFilter = '';
    this.sortOrder = 'newest';
    this.mediaItems = [];
    this.pendingDeleteId = null;

    this.initElements();
    this.initEvents();
  }

  initElements() {
    this.searchInput = document.getElementById('searchInput');
    this.clearSearchBtn = document.getElementById('clearSearchBtn');
    this.sortSelect = document.getElementById('sortSelect');
    this.activeTagBar = document.getElementById('activeTagBar');
    this.activeTagName = document.getElementById('activeTagName');
    this.removeTagFilterBtn = document.getElementById('removeTagFilterBtn');
    this.mediaLoading = document.getElementById('mediaLoading');
    this.mediaEmpty = document.getElementById('mediaEmpty');
    this.wallpapersBlock = document.getElementById('wallpapersBlock');
    this.wallpaperGrid = document.getElementById('wallpaperGrid');
    this.wallpaperCountPill = document.getElementById('wallpaperCountPill');
    this.audiosBlock = document.getElementById('audiosBlock');
    this.audioList = document.getElementById('audioList');
    this.audioCountPill = document.getElementById('audioCountPill');

    // Lightbox
    this.lightboxModal = document.getElementById('lightboxModal');
    this.lightboxImage = document.getElementById('lightboxImage');
    this.lightboxTitle = document.getElementById('lightboxTitle');
    this.lightboxDesc = document.getElementById('lightboxDesc');
    this.lightboxDownloadBtn = document.getElementById('lightboxDownloadBtn');
    this.lightboxEditBtn = document.getElementById('lightboxEditBtn');
    this.currentLightboxMedia = null;

    // Delete Modal
    this.deleteModal = document.getElementById('deleteConfirmModal');
    this.deleteConfirmBtn = document.getElementById('confirmDeleteBtn');
    this.deleteCancelBtn = document.getElementById('cancelDeleteBtn');
  }

  initEvents() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTab = btn.dataset.tab;
        this.loadMediaCatalog();
      });
    });

    // Dropdown "My Creator Studio" item
    const myUploadsDropdownBtn = document.getElementById('dropdownMyUploadsBtn');
    if (myUploadsDropdownBtn) {
      myUploadsDropdownBtn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const myStudioTab = document.getElementById('myStudioTab');
        if (myStudioTab) {
          myStudioTab.classList.add('active');
          this.currentTab = 'my_studio';
          this.loadMediaCatalog();
        }
      });
    }

    // Search input with debounce
    let searchDebounce = null;
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim();
      this.clearSearchBtn.style.display = this.searchQuery ? 'block' : 'none';
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        this.loadMediaCatalog();
      }, 250);
    });

    this.clearSearchBtn.addEventListener('click', () => {
      this.searchInput.value = '';
      this.searchQuery = '';
      this.clearSearchBtn.style.display = 'none';
      this.loadMediaCatalog();
    });

    // Sort order change
    this.sortSelect.addEventListener('change', (e) => {
      this.sortOrder = e.target.value;
      this.loadMediaCatalog();
    });

    // Remove Tag Filter
    this.removeTagFilterBtn.addEventListener('click', () => {
      this.setTagFilter('');
    });

    // Lightbox Close
    document.getElementById('closeLightboxBtn').addEventListener('click', () => {
      this.lightboxModal.classList.remove('active');
    });
    this.lightboxModal.addEventListener('click', (e) => {
      if (e.target === this.lightboxModal) {
        this.lightboxModal.classList.remove('active');
      }
    });

    // Lightbox Edit Click
    this.lightboxEditBtn.addEventListener('click', () => {
      this.lightboxModal.classList.remove('active');
      if (this.currentLightboxMedia && window.metadataEditor) {
        window.metadataEditor.open(this.currentLightboxMedia);
      }
    });

    // Delete confirmation
    this.deleteCancelBtn.addEventListener('click', () => {
      this.deleteModal.classList.remove('active');
      this.pendingDeleteId = null;
    });

    this.deleteConfirmBtn.addEventListener('click', () => {
      this.executeDelete();
    });
  }

  setTagFilter(tag) {
    this.currentTagFilter = tag ? tag.toLowerCase() : '';
    if (this.currentTagFilter) {
      this.activeTagName.textContent = `#${this.currentTagFilter}`;
      this.activeTagBar.style.display = 'flex';
    } else {
      this.activeTagBar.style.display = 'none';
    }
    this.loadMediaCatalog();
  }

  async loadMediaCatalog() {
    this.mediaLoading.style.display = 'flex';
    this.mediaEmpty.style.display = 'none';
    this.wallpapersBlock.style.display = 'none';
    this.audiosBlock.style.display = 'none';

    // Build Query
    const params = new URLSearchParams();
    if (this.currentTab === 'my_studio') {
      params.append('scope', 'my');
    } else if (this.currentTab === 'wallpapers') {
      params.append('type', 'wallpaper');
    } else if (this.currentTab === 'ringtones') {
      params.append('type', 'audio');
      params.append('audioType', 'ringtone');
    } else if (this.currentTab === 'notifications') {
      params.append('type', 'audio');
      params.append('audioType', 'notification');
    }

    if (this.searchQuery) params.append('search', this.searchQuery);
    if (this.currentTagFilter) params.append('tag', this.currentTagFilter);
    if (this.sortOrder) params.append('sort', this.sortOrder);

    const authHeaders = window.authManager ? window.authManager.getAuthHeader() : {};

    try {
      const promises = [
        fetch(`/api/media?${params.toString()}`, { headers: authHeaders }),
        fetch('/api/media/stats', { headers: authHeaders })
      ];

      if (window.authManager && window.authManager.isLoggedIn()) {
        promises.push(fetch('/api/media/stats?scope=my', { headers: authHeaders }));
      }

      const results = await Promise.all(promises);
      const mediaData = await results[0].json();
      const statsData = await results[1].json();
      let myStatsData = null;
      if (results[2]) {
        myStatsData = await results[2].json();
      }

      this.mediaLoading.style.display = 'none';

      if (statsData.success) {
        this.updateStats(statsData, myStatsData);
      }

      if (mediaData.success) {
        this.mediaItems = mediaData.data;
        this.renderCatalog(this.mediaItems);
      } else if (mediaData.error) {
        window.showToast(mediaData.error, 'error');
      }
    } catch (err) {
      console.error('Failed to load media:', err);
      this.mediaLoading.style.display = 'none';
      window.showToast('Could not load media catalog from server', 'error');
    }
  }

  updateStats(stats, myStats) {
    document.getElementById('statWallpapers').textContent = stats.wallpapers || 0;
    document.getElementById('statRingtones').textContent = stats.ringtones || 0;
    document.getElementById('statNotifications').textContent = stats.notifications || 0;

    document.getElementById('badgeAll').textContent = stats.total || 0;
    document.getElementById('badgeWallpapers').textContent = stats.wallpapers || 0;
    document.getElementById('badgeRingtones').textContent = stats.ringtones || 0;
    document.getElementById('badgeNotifications').textContent = stats.notifications || 0;

    const myBadge = document.getElementById('badgeMyUploads');
    if (myBadge) {
      myBadge.textContent = (myStats && myStats.total) ? myStats.total : 0;
    }
  }

  renderCatalog(items) {
    if (!items || items.length === 0) {
      this.mediaEmpty.style.display = 'flex';
      const emptyTitle = document.getElementById('emptyTitle');
      const emptyDesc = document.getElementById('emptyDesc');

      if (this.currentTab === 'my_studio') {
        emptyTitle.textContent = 'Your Creator Studio is Empty';
        emptyDesc.textContent = 'You haven\'t uploaded any wallpapers or audio files yet. Start sharing your creations!';
      } else if (this.searchQuery || this.currentTagFilter) {
        emptyTitle.textContent = 'No Matches Found';
        emptyDesc.textContent = 'Try adjusting your search keywords or tag filters';
      } else {
        emptyTitle.textContent = 'No Media Assets Found';
        emptyDesc.textContent = 'Upload wallpapers or audio tones using the button above';
      }
      return;
    }

    const wallpapers = items.filter(item => item.type === 'wallpaper');
    const audios = items.filter(item => item.type === 'audio');

    // Render Wallpapers
    if (wallpapers.length > 0 && ['all', 'my_studio', 'wallpapers'].includes(this.currentTab)) {
      this.wallpapersBlock.style.display = 'flex';
      this.wallpaperCountPill.textContent = `${wallpapers.length} wallpaper${wallpapers.length === 1 ? '' : 's'}`;
      this.renderWallpaperCards(wallpapers);
    } else {
      this.wallpapersBlock.style.display = 'none';
    }

    // Render Audios
    if (audios.length > 0 && ['all', 'my_studio', 'ringtones', 'notifications'].includes(this.currentTab)) {
      this.audiosBlock.style.display = 'flex';
      this.audioCountPill.textContent = `${audios.length} audio file${audios.length === 1 ? '' : 's'}`;
      this.renderAudioCards(audios);
    } else {
      this.audiosBlock.style.display = 'none';
    }

    if (window.lucide) window.lucide.createIcons();
  }

  renderWallpaperCards(wallpapers) {
    const currentUserId = window.authManager?.currentUser?.id;
    const isAdmin = window.authManager?.currentUser?.role === 'admin';

    this.wallpaperGrid.innerHTML = wallpapers.map(item => {
      const isOwner = !item.userId || item.userId === currentUserId || isAdmin;
      const authorName = item.author || 'Aura Creator';

      const tagHtml = (item.tags || []).slice(0, 4).map(tag => `
        <span class="tag-chip" onclick="app.setTagFilter('${this.escapeHtml(tag)}')">#${this.escapeHtml(tag)}</span>
      `).join('');

      return `
        <div class="wallpaper-card" data-id="${item.id}">
          <div class="wallpaper-media-wrapper" onclick="app.openLightbox('${item.id}')">
            <img src="${item.url}" alt="${this.escapeHtml(item.title)}" loading="lazy">
            <div class="wallpaper-overlay">
              <div class="overlay-top-row">
                <span class="resolution-badge">HD</span>
                <span class="author-pill"><i data-lucide="user"></i> ${this.escapeHtml(authorName)}</span>
              </div>
              <div class="overlay-actions-row">
                <button class="icon-btn-blur" onclick="event.stopPropagation(); app.openLightbox('${item.id}')" title="Preview Fullscreen">
                  <i data-lucide="maximize-2"></i>
                </button>
                ${isOwner ? `
                <button class="icon-btn-blur" onclick="event.stopPropagation(); app.openEditor('${item.id}')" title="Edit Metadata">
                  <i data-lucide="edit-3"></i>
                </button>` : ''}
                <a href="${item.url}" download="${this.escapeHtml(item.title)}" class="icon-btn-blur" onclick="event.stopPropagation()" title="Download">
                  <i data-lucide="download"></i>
                </a>
                ${isOwner ? `
                <button class="icon-btn-blur danger" onclick="event.stopPropagation(); app.promptDelete('${item.id}', '${this.escapeHtml(item.title)}')" title="Delete">
                  <i data-lucide="trash-2"></i>
                </button>` : ''}
              </div>
            </div>
          </div>
          <div class="wallpaper-info">
            <div class="wallpaper-title-row">
              <h3 class="wallpaper-title" title="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title)}</h3>
            </div>
            <p class="wallpaper-desc">${item.description ? this.escapeHtml(item.description) : '<span style="color:#94a3b8;font-style:italic;">No description added</span>'}</p>
            <div class="tag-cloud">
              ${tagHtml}
            </div>
            <div class="card-footer-meta">
              <span>By ${this.escapeHtml(authorName)}</span>
              <span>${new Date(item.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderAudioCards(audios) {
    const currentUserId = window.authManager?.currentUser?.id;
    const isAdmin = window.authManager?.currentUser?.role === 'admin';

    this.audioList.innerHTML = audios.map(item => {
      const isOwner = !item.userId || item.userId === currentUserId || isAdmin;
      const authorName = item.author || 'Aura Creator';
      const isNotification = item.audioType === 'notification';
      const badgeClass = isNotification ? 'badge-notification' : 'badge-ringtone';
      const badgeIcon = isNotification ? 'bell' : 'music-2';
      const badgeLabel = isNotification ? 'Notification' : 'Ringtone';

      const tagHtml = (item.tags || []).slice(0, 4).map(tag => `
        <span class="tag-chip" onclick="app.setTagFilter('${this.escapeHtml(tag)}')">#${this.escapeHtml(tag)}</span>
      `).join('');

      // Create simulated wave bars heights
      const barHeights = [20, 45, 75, 30, 90, 60, 40, 85, 55, 30, 70, 100, 65, 45, 80, 50, 25, 60, 40, 75, 35, 20];
      const waveBarsHtml = barHeights.map(h => `<div class="wave-bar" style="height: ${h}%;"></div>`).join('');

      return `
        <div class="audio-card" id="audioCard-${item.id}" data-id="${item.id}">
          <div class="audio-card-top">
            <button class="audio-play-circle" id="playBtn-${item.id}" onclick="app.handleAudioPlay('${item.id}', '${item.url}')" title="Play / Pause">
              <i data-lucide="play"></i>
            </button>
            <div class="audio-header-info">
              <div class="audio-title-badge-row">
                <h3 class="audio-title" title="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title)}</h3>
                <span class="${badgeClass}">
                  <i data-lucide="${badgeIcon}"></i> ${badgeLabel}
                </span>
              </div>
              <p class="audio-desc">${item.description ? this.escapeHtml(item.description) : '<span style="color:#94a3b8;font-style:italic;">No description added</span>'}</p>
            </div>
          </div>

          <!-- Waveform visualizer track -->
          <div class="audio-waveform-container" onclick="app.handleAudioPlay('${item.id}', '${item.url}')">
            <div class="waveform-bars">
              ${waveBarsHtml}
            </div>
            <span class="audio-time-stamp">0:00</span>
          </div>

          <div class="tag-cloud">
            ${tagHtml}
          </div>

          <div class="audio-card-footer">
            <div class="card-footer-meta" style="margin-top:0;padding-top:0;border:none;">
              <span>By ${this.escapeHtml(authorName)}</span>
              <span>&bull;</span>
              <span>${new Date(item.createdAt).toLocaleDateString()}</span>
            </div>
            <div class="audio-actions">
              ${isOwner ? `
              <button class="btn-icon-subtle" onclick="app.openEditor('${item.id}')" title="Edit Metadata">
                <i data-lucide="edit-3"></i>
              </button>` : ''}
              <a href="${item.url}" download="${this.escapeHtml(item.title)}.wav" class="btn-icon-subtle" title="Download">
                <i data-lucide="download"></i>
              </a>
              ${isOwner ? `
              <button class="btn-icon-subtle danger" onclick="app.promptDelete('${item.id}', '${this.escapeHtml(item.title)}')" title="Delete">
                <i data-lucide="trash-2"></i>
              </button>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  handleAudioPlay(id, url) {
    const playBtn = document.getElementById(`playBtn-${id}`);
    const cardEl = document.getElementById(`audioCard-${id}`);
    if (window.audioPlayer) {
      window.audioPlayer.togglePlay(id, url, playBtn, cardEl);
    }
  }

  openLightbox(id) {
    const item = this.mediaItems.find(m => m.id === id);
    if (!item) return;

    const currentUserId = window.authManager?.currentUser?.id;
    const isOwner = !item.userId || item.userId === currentUserId || window.authManager?.currentUser?.role === 'admin';

    this.currentLightboxMedia = item;
    this.lightboxImage.src = item.url;
    this.lightboxTitle.textContent = item.title;
    this.lightboxDesc.textContent = item.description || 'No description';
    this.lightboxDownloadBtn.href = item.url;
    this.lightboxDownloadBtn.download = item.title;

    if (this.lightboxEditBtn) {
      this.lightboxEditBtn.style.display = isOwner ? 'inline-flex' : 'none';
    }

    this.lightboxModal.classList.add('active');
    if (window.lucide) window.lucide.createIcons();
  }

  openEditor(id) {
    const item = this.mediaItems.find(m => m.id === id);
    if (item && window.metadataEditor) {
      window.metadataEditor.open(item);
    }
  }

  promptDelete(id, title) {
    this.pendingDeleteId = id;
    document.getElementById('deleteConfirmMessage').innerHTML = `Are you sure you want to delete <strong>"${title}"</strong>? This will permanently remove the file from the server.`;
    this.deleteModal.classList.add('active');
    if (window.lucide) window.lucide.createIcons();
  }

  async executeDelete() {
    if (!this.pendingDeleteId) return;

    const id = this.pendingDeleteId;
    this.deleteModal.classList.remove('active');
    this.pendingDeleteId = null;

    // Stop audio if playing
    if (window.audioPlayer && window.audioPlayer.currentMediaId === id) {
      window.audioPlayer.stop();
    }

    try {
      const res = await fetch(`/api/media/${id}`, {
        method: 'DELETE',
        headers: window.authManager ? window.authManager.getAuthHeader() : {}
      });
      const result = await res.json();
      if (result.success) {
        window.showToast('Media file deleted from server', 'info');
        this.loadMediaCatalog();
      } else {
        window.showToast(result.error || 'Failed to delete file', 'error');
      }
    } catch (err) {
      console.error('Delete error:', err);
      window.showToast('Failed to connect to server', 'error');
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Global Toast Notification Helper
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle-2';
  if (type === 'error') iconName = 'alert-circle';

  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};

// Bootstrap App
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AuraApp();
  window.app.loadMediaCatalog();
  if (window.lucide) window.lucide.createIcons();
});

