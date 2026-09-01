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
    this.renderPresetTags();
    this.modal.classList.add('active');
    this.updateStagedUI();
    if (window.lucide) window.lucide.createIcons();
  }

  closeModal() {
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
          this.stagedFiles.push({
            file: file,
            id: Math.random().toString(36).substring(7),
            name: file.name,
            size: file.size,
            type: isAudio ? 'audio' : 'wallpaper'
          });
        }
      } else {
        window.showToast(`Skipped ${file.name}: unsupported format`, 'error');
      }
    });

    this.updateStagedUI();
  }

  removeStagedFile(id) {
    this.stagedFiles = this.stagedFiles.filter(f => f.id !== id);
    this.updateStagedUI();
  }

  clearStaged() {
    this.stagedFiles = [];
    this.updateStagedUI();
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

      // Render file list rows
      this.stagedList.innerHTML = this.stagedFiles.map(f => `
        <div class="staged-file-row">
          <div class="staged-file-info">
            <i data-lucide="${f.type === 'audio' ? 'music' : 'image'}"></i>
            <span class="staged-file-name" title="${f.name}">${f.name}</span>
            <span class="staged-file-size">${this.formatBytes(f.size)}</span>
          </div>
          <button class="staged-remove-btn" onclick="uploader.removeStagedFile('${f.id}')" aria-label="Remove">
            <i data-lucide="x"></i>
          </button>
        </div>
      `).join('');
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
}

window.uploader = new MediaUploader();
