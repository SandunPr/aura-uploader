/**
 * Aura Media Admin — Audio Player Controller
 * Handles audio playback, waveform animations, and global play state
 */

class AudioPlayerManager {
  constructor() {
    this.audioElement = new Audio();
    this.currentMediaId = null;
    this.currentPlayButton = null;
    this.currentCard = null;
    this.isPlaying = false;

    this.initAudioEvents();
  }

  initAudioEvents() {
    this.audioElement.addEventListener('timeupdate', () => {
      this.updateProgress();
    });

    this.audioElement.addEventListener('ended', () => {
      this.stop();
    });

    this.audioElement.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updateUIState();
    });

    this.audioElement.addEventListener('play', () => {
      this.isPlaying = true;
      this.updateUIState();
    });

    this.audioElement.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      this.stop();
      if (window.showToast) {
        window.showToast('Could not play audio file', 'error');
      }
    });
  }

  togglePlay(mediaId, audioUrl, buttonEl, cardEl) {
    if (this.currentMediaId === mediaId) {
      if (this.isPlaying) {
        this.audioElement.pause();
      } else {
        this.audioElement.play().catch(err => console.warn('Play error:', err));
      }
      return;
    }

    // Reset previous
    this.stop();

    // Set new audio
    this.currentMediaId = mediaId;
    this.currentPlayButton = buttonEl;
    this.currentCard = cardEl;
    this.audioElement.src = audioUrl;

    this.audioElement.play().then(() => {
      this.isPlaying = true;
      this.updateUIState();
    }).catch(err => {
      console.warn('Playback error:', err);
    });
  }

  stop() {
    if (this.currentCard) {
      this.currentCard.classList.remove('playing');
    }
    if (this.currentPlayButton) {
      this.currentPlayButton.classList.remove('playing');
      const icon = this.currentPlayButton.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', 'play');
        if (window.lucide) window.lucide.createIcons();
      }
    }
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this.currentMediaId = null;
    this.isPlaying = false;
  }

  updateUIState() {
    if (!this.currentPlayButton || !this.currentCard) return;

    const icon = this.currentPlayButton.querySelector('i');

    if (this.isPlaying) {
      this.currentCard.classList.add('playing');
      this.currentPlayButton.classList.add('playing');
      if (icon) icon.setAttribute('data-lucide', 'pause');
    } else {
      this.currentCard.classList.remove('playing');
      this.currentPlayButton.classList.remove('playing');
      if (icon) icon.setAttribute('data-lucide', 'play');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  updateProgress() {
    if (!this.currentCard) return;
    const timeDisplay = this.currentCard.querySelector('.audio-time-stamp');
    if (timeDisplay && !isNaN(this.audioElement.duration)) {
      const cur = this.formatTime(this.audioElement.currentTime);
      const total = this.formatTime(this.audioElement.duration);
      timeDisplay.textContent = `${cur} / ${total}`;
    }
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}

window.audioPlayer = new AudioPlayerManager();
