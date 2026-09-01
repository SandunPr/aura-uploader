const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const WALLPAPERS_DIR = path.join(UPLOADS_DIR, 'wallpapers');
const AUDIOS_DIR = path.join(UPLOADS_DIR, 'audios');
const DATA_FILE = path.join(__dirname, 'data', 'media.json');

// Ensure directories
[UPLOADS_DIR, WALLPAPERS_DIR, AUDIOS_DIR, path.dirname(DATA_FILE)].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Helper to write minimal valid WAV file
function createToneWav(durationSeconds, freq, sampleRate = 44100, isChime = false) {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * 2; // 16-bit mono
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20);  // PCM format
  buffer.writeUInt16LE(1, 22);  // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32);  // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    if (isChime) {
      // Harmonic chime envelope
      const env = Math.exp(-3.5 * (t % (durationSeconds / 3)));
      sample = Math.sin(2 * Math.PI * freq * t) * 0.6 +
               Math.sin(2 * Math.PI * (freq * 1.5) * t) * 0.3 +
               Math.sin(2 * Math.PI * (freq * 2.0) * t) * 0.1;
      sample *= env;
    } else {
      // Pleasant marimba / melody
      const noteIdx = Math.floor(t * 3) % 4;
      const notes = [freq, freq * 1.25, freq * 1.5, freq * 1.875];
      const curFreq = notes[noteIdx];
      const subT = t % (1/3);
      const env = Math.exp(-5 * subT);
      sample = Math.sin(2 * Math.PI * curFreq * t) * env;
    }

    const intSample = Math.max(-32767, Math.min(32767, Math.floor(sample * 28000)));
    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  return buffer;
}

// Generate aesthetic SVG wallpapers
const wallpapersData = [
  {
    title: 'Cyberpunk Neon Horizon',
    desc: 'Futuristic retrowave cityscape with vibrant neon grid and sunset gradients.',
    tags: ['cyberpunk', 'neon', 'retrowave', 'city', 'aesthetic', '4k', 'dark'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
      <defs>
        <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#090514"/>
          <stop offset="50%" stop-color="#2d124d"/>
          <stop offset="75%" stop-color="#801974"/>
          <stop offset="100%" stop-color="#ff598f"/>
        </linearGradient>
        <linearGradient id="sun" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffe600"/>
          <stop offset="100%" stop-color="#ff007f"/>
        </linearGradient>
        <linearGradient id="gridGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#00ffff" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.2"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1920" fill="url(#sky)"/>
      <circle cx="540" cy="980" r="280" fill="url(#sun)"/>
      <rect x="0" y="1050" width="1080" height="870" fill="#0c0721"/>
      <g stroke="#00f3ff" stroke-width="3" opacity="0.6">
        <line x1="540" y1="1050" x2="-400" y2="1920"/>
        <line x1="540" y1="1050" x2="0" y2="1920"/>
        <line x1="540" y1="1050" x2="300" y2="1920"/>
        <line x1="540" y1="1050" x2="540" y2="1920"/>
        <line x1="540" y1="1050" x2="780" y2="1920"/>
        <line x1="540" y1="1050" x2="1080" y2="1920"/>
        <line x1="540" y1="1050" x2="1480" y2="1920"/>
        <line x1="0" y1="1120" x2="1080" y2="1120"/>
        <line x1="0" y1="1220" x2="1080" y2="1220"/>
        <line x1="0" y1="1350" x2="1080" y2="1350"/>
        <line x1="0" y1="1520" x2="1080" y2="1520"/>
        <line x1="0" y1="1740" x2="1080" y2="1740"/>
      </g>
      <polygon points="120,1050 200,880 260,950 340,780 440,1050" fill="#070312"/>
      <polygon points="620,1050 720,840 820,960 920,720 1020,1050" fill="#070312"/>
      <text x="540" y="400" font-family="'Outfit', sans-serif" font-size="64" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="8">AURA SYNTH</text>
    </svg>`
  },
  {
    title: 'Emerald Forest Mist',
    desc: 'Calm morning mist rolling through majestic mountain pine valleys in deep emerald green.',
    tags: ['nature', 'forest', 'mountains', 'minimal', 'calm', 'green', 'wallpaper'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
      <defs>
        <linearGradient id="mistSky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0f2027"/>
          <stop offset="50%" stop-color="#203a43"/>
          <stop offset="100%" stop-color="#2c5364"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1920" fill="url(#mistSky)"/>
      <circle cx="800" cy="400" r="160" fill="#f5f7fa" opacity="0.85" filter="drop-shadow(0 0 25px rgba(255,255,255,0.6))"/>
      <polygon points="0,1100 250,750 500,1100" fill="#1b3b36" opacity="0.7"/>
      <polygon points="400,1100 700,680 1000,1100" fill="#1b3b36" opacity="0.6"/>
      <polygon points="-100,1400 300,900 700,1400" fill="#0e241f"/>
      <polygon points="500,1450 850,920 1200,1450" fill="#081b16"/>
      <rect x="0" y="1300" width="1080" height="620" fill="#040e0b"/>
      <text x="540" y="1700" font-family="'Outfit', sans-serif" font-size="42" font-weight="300" fill="#a7f3d0" text-anchor="middle" letter-spacing="12">SANCTUARY</text>
    </svg>`
  },
  {
    title: 'Fluid Chroma Wave 3D',
    desc: 'Lush 3D fluid iridescent ribbon with smooth violet and electric sapphire ribbons.',
    tags: ['abstract', '3d', 'purple', 'modern', 'amoled', 'fluid', 'trending'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0a051b"/>
          <stop offset="100%" stop-color="#180b38"/>
        </linearGradient>
        <linearGradient id="ribbon1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#4f46e5"/>
          <stop offset="50%" stop-color="#9333ea"/>
          <stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
        <linearGradient id="ribbon2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#06b6d4"/>
          <stop offset="100%" stop-color="#3b82f6"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1920" fill="url(#bg)"/>
      <path d="M -100 600 C 400 300, 600 1200, 1180 900 L 1180 1400 C 600 1700, 400 900, -100 1200 Z" fill="url(#ribbon1)" opacity="0.85"/>
      <path d="M -50 900 C 500 700, 700 1600, 1150 1300 L 1150 1800 C 700 2000, 500 1200, -50 1500 Z" fill="url(#ribbon2)" opacity="0.9"/>
      <circle cx="300" cy="450" r="8" fill="#ffffff" opacity="0.7"/>
      <circle cx="800" cy="1550" r="12" fill="#ffffff" opacity="0.5"/>
      <circle cx="900" cy="300" r="6" fill="#38bdf8" opacity="0.8"/>
    </svg>`
  },
  {
    title: 'Midnight Lunar Oasis',
    desc: 'Deep space lunar landscape with stardust cosmic particles and glowing celestial sphere.',
    tags: ['space', 'moon', 'minimal', 'night', 'stars', 'galaxy', 'wallpaper'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
      <rect width="1080" height="1920" fill="#020617"/>
      <circle cx="540" cy="650" r="220" fill="#e2e8f0" filter="drop-shadow(0 0 50px rgba(226, 232, 240, 0.4))"/>
      <circle cx="620" cy="580" r="190" fill="#020617"/>
      <circle cx="180" cy="240" r="3" fill="#ffffff" opacity="0.8"/>
      <circle cx="880" cy="180" r="2.5" fill="#ffffff" opacity="0.9"/>
      <circle cx="750" cy="420" r="2" fill="#93c5fd" opacity="0.6"/>
      <circle cx="340" cy="850" r="3" fill="#ffffff" opacity="0.7"/>
      <circle cx="920" cy="950" r="2" fill="#ffffff" opacity="0.5"/>
      <path d="M 0 1400 Q 270 1250 540 1350 T 1080 1300 L 1080 1920 L 0 1920 Z" fill="#0f172a"/>
      <path d="M 0 1550 Q 300 1450 600 1520 T 1080 1480 L 1080 1920 L 0 1920 Z" fill="#1e293b"/>
      <text x="540" y="1750" font-family="'Outfit', sans-serif" font-size="36" font-weight="600" fill="#94a3b8" text-anchor="middle" letter-spacing="10">ECLIPSE</text>
    </svg>`
  }
];

// Generate starter audios
const audioTones = [
  {
    title: 'Aura Crystal Breeze',
    desc: 'Gentle crystal acoustic chime notification tone for messages and alerts.',
    audioType: 'notification',
    tags: ['notification', 'chime', 'crystal', 'alert', 'soft', 'clean'],
    duration: 1.8,
    freq: 587.33, // D5
    isChime: true
  },
  {
    title: 'Zenith Marimba Ringtone',
    desc: 'Upbeat melodic marimba progression with rhythmic acoustic timbre.',
    audioType: 'ringtone',
    tags: ['ringtone', 'marimba', 'melody', 'upbeat', 'call', 'popular'],
    duration: 4.0,
    freq: 440.0, // A4
    isChime: false
  },
  {
    title: 'Subtle Glass Ping',
    desc: 'Minimal crisp glass ping notification designed for distraction-free alerts.',
    audioType: 'notification',
    tags: ['notification', 'minimal', 'glass', 'short', 'ping', 'modern'],
    duration: 1.2,
    freq: 880.0, // A5
    isChime: true
  },
  {
    title: 'Cosmic Pulse Anthem',
    desc: 'Electronic synth arpeggio ringtone with warm resonant harmonics.',
    audioType: 'ringtone',
    tags: ['ringtone', 'synth', 'electronic', 'ambient', 'loop', 'modern'],
    duration: 4.5,
    freq: 523.25, // C5
    isChime: false
  }
];

const mediaItems = [];

// Seed Wallpapers
wallpapersData.forEach((w, index) => {
  const filename = `seed_wallpaper_${index + 1}.svg`;
  const filePath = path.join(WALLPAPERS_DIR, filename);
  fs.writeFileSync(filePath, w.svg, 'utf8');
  const stats = fs.statSync(filePath);

  mediaItems.push({
    id: uuidv4(),
    title: w.title,
    description: w.desc,
    type: 'wallpaper',
    originalName: `${w.title.toLowerCase().replace(/\s+/g, '_')}.svg`,
    filename: filename,
    mimeType: 'image/svg+xml',
    fileSize: stats.size,
    url: `/uploads/wallpapers/${filename}`,
    tags: w.tags,
    createdAt: new Date(Date.now() - (4 - index) * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - (4 - index) * 3600000).toISOString()
  });
});

// Seed Audios
audioTones.forEach((a, index) => {
  const filename = `seed_audio_${index + 1}.wav`;
  const filePath = path.join(AUDIOS_DIR, filename);
  const wavBuffer = createToneWav(a.duration, a.freq, 44100, a.isChime);
  fs.writeFileSync(filePath, wavBuffer);
  const stats = fs.statSync(filePath);

  mediaItems.push({
    id: uuidv4(),
    title: a.title,
    description: a.desc,
    type: 'audio',
    audioType: a.audioType, // 'ringtone' | 'notification'
    originalName: `${a.title.toLowerCase().replace(/\s+/g, '_')}.wav`,
    filename: filename,
    mimeType: 'audio/wav',
    fileSize: stats.size,
    url: `/uploads/audios/${filename}`,
    tags: a.tags,
    createdAt: new Date(Date.now() - (3 - index) * 2800000).toISOString(),
    updatedAt: new Date(Date.now() - (3 - index) * 2800000).toISOString()
  });
});

fs.writeFileSync(DATA_FILE, JSON.stringify(mediaItems, null, 2), 'utf8');
console.log(`✅ Seeded ${mediaItems.length} starter assets (${wallpapersData.length} wallpapers, ${audioTones.length} audios)`);
