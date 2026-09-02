/**
 * Aura Media Admin — Media Uploader Controller
 * Handles drag-and-drop, multi-file selection, staging queue, and upload progress
 */

class MediaUploader {
  constructor() {
    this.stagedFiles = [];
    this.presetTags = new Set(['aura']);
    this.modal = document.getElementById('uploadModal');
    this.dropzone = document.getElementById('modalDropzone');
    this.fileInput = document.getElementById('modalFileInput');
    this.heroFileInput = document.getElementById('heroFileInput');
    this.heroDropzone = document.getElementById('quickDropzone');
    this.stagedContainer = document.getElementById('stagedContainer');
    this.stagedList = document.getElementById('stagedList');
    this.stagedCount = document.getElementById('stagedCount');
    this.startUploadBtn = document.getElementById('startUploadBtn');
    this.uploadBtnCount = document.getElementById('uploadBtnCount');
    this.presetGroup = document.getElementById('uploadPresetGroup');
    this.presetTagContainer = document.getElementById('presetTagContainer');
    this.presetTagsInput = document.getElementById('presetTagsInput');
    this.progressBox = document.getElementById('uploadProgressBox');
    this.progressBarFill = document.getElementById('progressBarFill');
    this.progressStatusText = document.getElementById('progressStatusText');
    this.progressPercentText = document.getElementById('progressPercentText');

    // Audio preview player for staged audio drafts
    this.previewAudio = new Audio();
    this.currentPlayingDraftId = null;

    this.initEvents();
  }

  initEvents() {
    // Open Modal button
    document.getElementById('openUploadBtn').addEventListener('click', () => this.openModal());
    const emptyBtn = document.getElementById('emptyUploadBtn');
    if (emptyBtn) emptyBtn.addEventListener('click', () => this.openModal());

    // Close Modal buttons
    document.getElementById('closeUploadModalBtn').addEventListener('click', () => this.closeModal());
    document.getElementById('cancelUploadModalBtn').addEventListener('click', () => this.closeModal());

    // Clear staged files
    document.getElementById('clearStagedBtn').addEventListener('click', () => this.clearStaged());

    // Hero Browse button & file input
    document.getElementById('quickBrowseBtn').addEventListener('click', () => {
      this.heroFileInput.click();
    });

    this.heroFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.addFiles(Array.from(e.target.files));
        this.openModal();
        e.target.value = '';
      }
    });

    // Modal Dropzone browse click
    this.dropzone.addEventListener('click', () => {
      this.fileInput.click();
    });

    this.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.addFiles(Array.from(e.target.files));
        e.target.value = '';
      }
    });

    // Drag and drop setup for hero dropzone
    this.setupDragDrop(this.heroDropzone, (files) => {
      this.addFiles(files);
      this.openModal();
    });

    // Drag and drop setup for modal dropzone
    this.setupDragDrop(this.dropzone, (files) => {
      this.addFiles(files);
    });

    // Whole window drag and drop highlight
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());

    // Audio preview events
    this.previewAudio.addEventListener('ended', () => {
      this.currentPlayingDraftId = null;
      this.updateDraftAudioButtons();
    });

    this.previewAudio.addEventListener('pause', () => {
      this.updateDraftAudioButtons();
    });

    // Upload Preset Tag handling
    this.presetTagsInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const tag = this.presetTagsInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (tag) {
          this.presetTags.add(tag);
          this.presetTagsInput.value = '';
          this.renderPresetTags();
        }
      }
    });

    // Start upload trigger
    this.startUploadBtn.addEventListener('click', () => this.uploadAll());
  }

  setupDragDrop(element, callback) {
    if (!element) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      element.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        element.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      element.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        element.classList.remove('dragover');
      });
    });

    element.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        callback(Array.from(e.dataTransfer.files));
      }
    });
  }

  openModal() {
    if (!window.authManager || !window.authManager.isLoggedIn()) {
      window.showToast('Please sign in or create an account to upload media.', 'info');
      if (window.authManager) window.authManager.openModal('login');
      return;
    }

    this.renderPresetTags();
    this.modal.classList.add('active');
    this.updateStagedUI();
    if (window.lucide) window.lucide.createIcons();
  }

  closeModal() {
    this.stopDraftAudio();
    this.modal.classList.remove('active');
    this.progressBox.style.display = 'none';
    this.progressBarFill.style.width = '0%';
  }

  addFiles(files) {
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
    
    files.forEach(file => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      const isImage = file.type.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext);
      const isAudio = file.type.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(ext);

      if (isImage || isAudio) {
        // Prevent duplicate file names in current batch
        const exists = this.stagedFiles.some(f => f.name === file.name && f.size === file.size);
        if (!exists) {
          const previewUrl = URL.createObjectURL(file);
          this.stagedFiles.push({
            file: file,
            id: Math.random().toString(36).substring(7),
            name: file.name,
            size: file.size,
            type: isAudio ? 'audio' : 'wallpaper',
            previewUrl: previewUrl
          });
        }
      } else {
        window.showToast(`Skipped ${file.name}: unsupported format`, 'error');
      }
    });

    this.updateStagedUI();
  }

  removeStagedFile(id) {
    if (this.currentPlayingDraftId === id) {
      this.stopDraftAudio();
    }
    const item = this.stagedFiles.find(f => f.id === id);
    if (item && item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
    this.stagedFiles = this.stagedFiles.filter(f => f.id !== id);
    this.updateStagedUI();
  }

  clearStaged() {
    this.stopDraftAudio();
    this.stagedFiles.forEach(f => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    this.stagedFiles = [];
    this.updateStagedUI();
  }

  toggleDraftAudio(id) {
    const item = this.stagedFiles.find(f => f.id === id);
    if (!item || item.type !== 'audio' || !item.previewUrl) return;

    // Pause global library audio player if playing
    if (window.audioPlayer && window.audioPlayer.isPlaying) {
      window.audioPlayer.stop();
    }

    if (this.currentPlayingDraftId === id && !this.previewAudio.paused) {
      this.previewAudio.pause();
      this.currentPlayingDraftId = null;
      this.updateDraftAudioButtons();
      return;
    }

    this.previewAudio.src = item.previewUrl;
    this.currentPlayingDraftId = id;
    this.previewAudio.play().then(() => {
      this.updateDraftAudioButtons();
    }).catch(err => {
      console.warn('Draft audio play error:', err);
    });
    this.updateDraftAudioButtons();
  }

  stopDraftAudio() {
    if (this.previewAudio) {
      this.previewAudio.pause();
      this.previewAudio.currentTime = 0;
    }
    this.currentPlayingDraftId = null;
    this.updateDraftAudioButtons();
  }

  updateDraftAudioButtons() {
    this.stagedFiles.forEach(f => {
      if (f.type === 'audio') {
        const btn = document.getElementById(`draftPlayBtn-${f.id}`);
        if (btn) {
          const isThisPlaying = this.currentPlayingDraftId === f.id && !this.previewAudio.paused;
          btn.innerHTML = `<i data-lucide="${isThisPlaying ? 'pause' : 'play'}"></i>`;
          btn.title = isThisPlaying ? 'Pause Draft Audio' : 'Play Draft Audio';
          if (isThisPlaying) {
            btn.classList.add('playing');
          } else {
            btn.classList.remove('playing');
          }
        }
      }
    });
    if (window.lucide) window.lucide.createIcons();
  }

  updateStagedUI() {
    const count = this.stagedFiles.length;
    this.stagedCount.textContent = count;
    this.uploadBtnCount.textContent = count;

    if (count > 0) {
      this.stagedContainer.style.display = 'flex';
      this.presetGroup.style.display = 'block';
      this.startUploadBtn.disabled = false;

      // Check if any audio files staged
      const hasAudio = this.stagedFiles.some(f => f.type === 'audio');
      const audioPreset = document.getElementById('presetAudioTypeGroup');
      if (audioPreset) {
        audioPreset.style.display = hasAudio ? 'block' : 'none';
      }

      // Render draft file list rows with rich preview
      this.stagedList.innerHTML = this.stagedFiles.map(f => {
        const isAudio = f.type === 'audio';
        const isPlaying = isAudio && this.currentPlayingDraftId === f.id && !this.previewAudio.paused;

        return `
        <div class="staged-file-row ${isAudio ? 'draft-audio-row' : 'draft-wallpaper-row'}">
          <div class="staged-file-left">
            ${isAudio 
              ? `<button type="button" class="btn-draft-play ${isPlaying ? 'playing' : ''}" id="draftPlayBtn-${f.id}" onclick="uploader.toggleDraftAudio('${f.id}')" title="${isPlaying ? 'Pause Draft Audio' : 'Play Draft Audio'}">
                   <i data-lucide="${isPlaying ? 'pause' : 'play'}"></i>
                 </button>`
              : `<img class="draft-wallpaper-thumb" src="${f.previewUrl}" alt="${this.escapeHtml(f.name)}" loading="lazy">`
            }
            <div class="staged-file-meta">
              <div class="staged-name-badge-row">
                <span class="staged-file-name" title="${this.escapeHtml(f.name)}">${this.escapeHtml(f.name)}</span>
                <span class="draft-badge ${f.type}">${isAudio ? 'Draft Audio' : 'Draft Wallpaper'}</span>
              </div>
              <div class="staged-sub-meta">
                <span class="staged-file-size">${this.formatBytes(f.size)}</span>
                ${isAudio 
                  ? `<span class="draft-audio-hint">&bull; Click play to test audio tone</span>` 
                  : `<span class="draft-img-hint">&bull; Wallpaper preview ready</span>`
                }
              </div>
            </div>
          </div>
          <button class="staged-remove-btn" onclick="uploader.removeStagedFile('${f.id}')" title="Remove draft file" aria-label="Remove">
            <i data-lucide="x"></i>
          </button>
        </div>
      `;
      }).join('');
    } else {
      this.stagedContainer.style.display = 'none';
      this.presetGroup.style.display = 'none';
      this.startUploadBtn.disabled = true;
      this.stagedList.innerHTML = '';
    }

    if (window.lucide) window.lucide.createIcons();
  }

  renderPresetTags() {
    const existing = this.presetTagContainer.querySelectorAll('.tag-item');
    existing.forEach(el => el.remove());

    this.presetTags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'tag-item';
      chip.innerHTML = `
        <span>#${tag}</span>
        <button type="button" aria-label="Remove tag"><i data-lucide="x"></i></button>
      `;
      chip.querySelector('button').addEventListener('click', (e) => {
        e.stopPropagation();
        this.presetTags.delete(tag);
        this.renderPresetTags();
      });
      this.presetTagContainer.insertBefore(chip, this.presetTagsInput);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  async uploadAll() {
    if (this.stagedFiles.length === 0) return;

    this.stopDraftAudio();

    const formData = new FormData();
    this.stagedFiles.forEach(item => {
      formData.append('files', item.file);
    });

    const defaultAudioType = document.querySelector('input[name="presetAudioType"]:checked')?.value || 'ringtone';
    formData.append('defaultAudioType', defaultAudioType);
    formData.append('tags', Array.from(this.presetTags).join(','));

    // UI state
    this.startUploadBtn.disabled = true;
    this.progressBox.style.display = 'flex';
    this.progressBarFill.style.width = '20%';
    this.progressPercentText.textContent = '20%';
    this.progressStatusText.textContent = `Uploading ${this.stagedFiles.length} file(s) to Aura server...`;

    try {
      // Simulate smooth progress
      let currentProgress = 25;
      const progressTimer = setInterval(() => {
        if (currentProgress < 90) {
          currentProgress += 15;
          this.progressBarFill.style.width = `${currentProgress}%`;
          this.progressPercentText.textContent = `${currentProgress}%`;
        }
      }, 150);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: window.authManager ? window.authManager.getAuthHeader() : {},
        body: formData
      });

      clearInterval(progressTimer);
      const result = await response.json();

      if (result.success) {
        this.progressBarFill.style.width = '100%';
        this.progressPercentText.textContent = '100%';
        this.progressStatusText.textContent = 'Upload complete!';

        window.showToast(`Successfully uploaded ${result.uploadedCount} item(s)!`, 'success');
        
        setTimeout(() => {
          this.clearStaged();
          this.closeModal();
          if (window.app) window.app.loadMediaCatalog();
        }, 600);
      } else {
        window.showToast(result.error || 'Upload failed', 'error');
        this.progressBox.style.display = 'none';
        this.startUploadBtn.disabled = false;
      }
    } catch (err) {
      console.error('Upload failed:', err);
      window.showToast('Server upload error. Please check connection.', 'error');
      this.progressBox.style.display = 'none';
      this.startUploadBtn.disabled = false;
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

window.uploader = new MediaUploader();
