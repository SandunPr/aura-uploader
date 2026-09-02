/**
 * Aura Media Admin — Metadata Editor Controller
 * Handles metadata editing for Wallpapers (Title, Desc, Tags) and Audios (Title, Desc, Tags, Ringtone/Notification Checker)
 */

class MetadataEditor {
  constructor() {
    this.currentMedia = null;
    this.tags = new Set();
    this.modal = document.getElementById('editModal');
    this.form = document.getElementById('metadataEditForm');
    this.tagContainer = document.getElementById('editTagContainer');
    this.tagInput = document.getElementById('editTagInput');
    this.modalAudio = document.getElementById('modalAudioElement');
    this.modalAudioPlayBtn = document.getElementById('modalAudioPlayBtn');
    this.isModalAudioPlaying = false;

    this.initEvents();
  }

  initEvents() {
    // Close modal
    document.getElementById('closeEditModalBtn').addEventListener('click', () => this.close());
    document.getElementById('cancelEditModalBtn').addEventListener('click', () => this.close());

    // Save metadata
    document.getElementById('saveMetadataBtn').addEventListener('click', () => this.save());

    // Tag input handling
    this.tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        this.addTagFromInput();
      } else if (e.key === 'Backspace' && !this.tagInput.value && this.tags.size > 0) {
        const lastTag = Array.from(this.tags).pop();
        this.removeTag(lastTag);
      }
    });

    this.tagContainer.addEventListener('click', (e) => {
      if (e.target === this.tagContainer) {
        this.tagInput.focus();
      }
    });

    // Suggested tags click
    document.getElementById('suggestedTagsList').addEventListener('click', (e) => {
      const btn = e.target.closest('.quick-tag-btn');
      if (btn) {
        const tagText = btn.textContent.replace('+', '').trim().toLowerCase();
        this.addTag(tagText);
      }
    });

    // Modal audio player
    if (this.modalAudioPlayBtn) {
      this.modalAudioPlayBtn.addEventListener('click', () => {
        this.toggleModalAudio();
      });

      this.modalAudio.addEventListener('ended', () => {
        this.isModalAudioPlaying = false;
        this.updateModalAudioPlayIcon();
      });
    }
  }

  open(mediaItem) {
    this.currentMedia = mediaItem;
    this.tags = new Set((mediaItem.tags || []).map(t => t.toLowerCase()));

    // Populate Fields
    document.getElementById('editMediaId').value = mediaItem.id;
    document.getElementById('editMediaType').value = mediaItem.type;
    document.getElementById('editTitleInput').value = mediaItem.title || '';
    document.getElementById('editDescriptionInput').value = mediaItem.description || '';

    // Tech details
    document.getElementById('techFilename').textContent = mediaItem.filename || mediaItem.originalName || 'file';
    document.getElementById('techFileSize').textContent = this.formatBytes(mediaItem.fileSize || 0);
    document.getElementById('techMime').textContent = mediaItem.mimeType || 'unknown';
    document.getElementById('techDate').textContent = new Date(mediaItem.createdAt).toLocaleDateString();

    // Render Preview based on type
    const wallpaperPreview = document.getElementById('wallpaperPreviewBox');
    const audioPreview = document.getElementById('audioPreviewBox');
    const audioTypeCheckerGroup = document.getElementById('audioTypeCheckerGroup');

    if (mediaItem.type === 'wallpaper') {
      wallpaperPreview.style.display = 'block';
      audioPreview.style.display = 'none';
      audioTypeCheckerGroup.style.display = 'none';

      document.getElementById('editImagePreview').src = mediaItem.url;
      document.getElementById('editModalHeaderTitle').textContent = 'Edit Wallpaper Metadata';
      document.getElementById('editModalSub').textContent = 'Customize wallpaper title, tags, and theme notes';
    } else {
      wallpaperPreview.style.display = 'none';
      audioPreview.style.display = 'flex';
      audioTypeCheckerGroup.style.display = 'block';

      // Setup audio
      this.modalAudio.src = mediaItem.url;
      this.isModalAudioPlaying = false;
      this.updateModalAudioPlayIcon();

      document.getElementById('modalAudioTitle').textContent = mediaItem.title;
      const curType = (mediaItem.audioType || 'ringtone').toLowerCase();
      document.getElementById('modalAudioBadge').textContent = curType.toUpperCase();

      // Check the right radio
      if (curType === 'notification') {
        document.getElementById('radioNotification').checked = true;
      } else {
        document.getElementById('radioRingtone').checked = true;
      }

      document.getElementById('editModalHeaderTitle').textContent = 'Edit Audio Tone Metadata';
      document.getElementById('editModalSub').textContent = 'Configure ringtone vs notification type, title, and tags';
    }

    this.renderTags();
    this.modal.classList.add('active');
    if (window.lucide) window.lucide.createIcons();
  }

  close() {
    this.modal.classList.remove('active');
    if (this.modalAudio) {
      this.modalAudio.pause();
      this.isModalAudioPlaying = false;
    }
  }

  toggleModalAudio() {
    if (!this.modalAudio.src) return;
    if (this.isModalAudioPlaying) {
      this.modalAudio.pause();
      this.isModalAudioPlaying = false;
    } else {
      this.modalAudio.play().then(() => {
        this.isModalAudioPlaying = true;
      }).catch(err => console.warn('Modal audio play error:', err));
    }
    this.updateModalAudioPlayIcon();
  }

  updateModalAudioPlayIcon() {
    const icon = document.getElementById('modalPlayIcon');
    if (icon) {
      icon.setAttribute('data-lucide', this.isModalAudioPlaying ? 'pause' : 'play');
      if (window.lucide) window.lucide.createIcons();
    }
  }

  addTagFromInput() {
    const val = this.tagInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (val) {
      this.addTag(val);
      this.tagInput.value = '';
    }
  }

  addTag(tag) {
    if (!tag) return;
    this.tags.add(tag);
    this.renderTags();
  }

  removeTag(tag) {
    this.tags.delete(tag);
    this.renderTags();
  }

  renderTags() {
    // Remove existing chips except the input
    const existingChips = this.tagContainer.querySelectorAll('.tag-item');
    existingChips.forEach(chip => chip.remove());

    this.tags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'tag-item';
      chip.innerHTML = `
        <span>#${tag}</span>
        <button type="button" aria-label="Remove tag"><i data-lucide="x"></i></button>
      `;
      chip.querySelector('button').addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTag(tag);
      });
      this.tagContainer.insertBefore(chip, this.tagInput);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  async save() {
    if (!this.currentMedia) return;

    const title = document.getElementById('editTitleInput').value.trim();
    if (!title) {
      window.showToast('Please enter a title for the media', 'error');
      document.getElementById('editTitleInput').focus();
      return;
    }

    const description = document.getElementById('editDescriptionInput').value.trim();
    const tags = Array.from(this.tags);

    const updatePayload = {
      title,
      description,
      tags
    };

    if (this.currentMedia.type === 'audio') {
      const selectedAudioType = document.querySelector('input[name="editAudioTypeRadio"]:checked')?.value || 'ringtone';
      updatePayload.audioType = selectedAudioType;
    }

    const saveBtn = document.getElementById('saveMetadataBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i data-lucide="loader-2"></i> Saving...`;
    if (window.lucide) window.lucide.createIcons();

    try {
      const response = await fetch(`/api/media/${this.currentMedia.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(window.authManager ? window.authManager.getAuthHeader() : {})
        },
        body: JSON.stringify(updatePayload)
      });

      const result = await response.json();
      if (result.success) {
        window.showToast('Metadata updated successfully!', 'success');
        this.close();
        if (window.app) window.app.loadMediaCatalog();
      } else {
        window.showToast(result.error || 'Failed to update metadata', 'error');
        if (response.status === 401 && window.authManager) {
          window.authManager.openModal('login');
        }
      }
    } catch (err) {
      console.error('Error updating metadata:', err);
      window.showToast('Server connection error', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<i data-lucide="check"></i> Save Metadata`;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

window.metadataEditor = new MetadataEditor();
