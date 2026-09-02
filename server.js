const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const {
  createUser,
  authenticateUser,
  createSession,
  deleteSession,
  requireAuth,
  optionalAuth
} = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Directories
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const WALLPAPERS_DIR = path.join(UPLOADS_DIR, 'wallpapers');
const AUDIOS_DIR = path.join(UPLOADS_DIR, 'audios');
const DATA_FILE = path.join(__dirname, 'data', 'media.json');

// Ensure directories exist
[UPLOADS_DIR, WALLPAPERS_DIR, AUDIOS_DIR, path.dirname(DATA_FILE)].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Helper: Read / Write Media Database
function getMediaDB() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data || '[]');
    }
  } catch (err) {
    console.error('Error reading media DB:', err);
  }
  return [];
}

function saveMediaDB(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving media DB:', err);
    return false;
  }
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, WALLPAPERS_DIR);
    } else if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/ogg' || file.mimetype === 'video/ogg') {
      cb(null, AUDIOS_DIR);
    } else {
      // Check file extension as fallback
      const ext = path.extname(file.originalname).toLowerCase();
      if (['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma', '.opus'].includes(ext)) {
        cb(null, AUDIOS_DIR);
      } else {
        cb(null, WALLPAPERS_DIR);
      }
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, uniqueSuffix + '-' + safeName);
  }
});

const fileFilter = (req, file, cb) => {
  const isImage = file.mimetype.startsWith('image/');
  const isAudio = file.mimetype.startsWith('audio/') || file.mimetype === 'application/ogg';
  const ext = path.extname(file.originalname).toLowerCase();
  const validAudioExt = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma', '.opus'].includes(ext);
  const validImageExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp'].includes(ext);

  if (isImage || isAudio || validAudioExt || validImageExt) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file format. Please upload standard audio or image files.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB per file
});

// Format clean title from filename
function formatTitleFromFilename(filename) {
  const nameWithoutExt = path.parse(filename).name;
  return nameWithoutExt
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

// -------------------------------------------------------------
// AUTHENTICATION ENDPOINTS
// -------------------------------------------------------------

// POST /api/auth/register - Register a new creator/user
app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: 'Username, email, and password are required.' });
  }

  if (username.trim().length < 3) {
    return res.status(400).json({ success: false, error: 'Username must be at least 3 characters long.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
  }

  try {
    const user = createUser({ username, email, password });
    const token = createSession(user.id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/auth/login - Authenticate user & issue session token
app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: 'Please provide email/username and password.' });
  }

  try {
    const user = authenticateUser(identifier, password);
    const token = createSession(user.id);

    res.json({
      success: true,
      message: 'Logged in successfully!',
      token,
      user
    });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

// POST /api/auth/logout - Terminate session
app.post('/api/auth/logout', requireAuth, (req, res) => {
  deleteSession(req.token);
  res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

// GET /api/auth/me - Validate current session & fetch profile
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// -------------------------------------------------------------
// REST API ENDPOINTS (MEDIA & STATS)
// -------------------------------------------------------------

// GET /api/media - Fetch media items with search, filters & user scoping
app.get('/api/media', optionalAuth, (req, res) => {
  let db = getMediaDB();
  const { type, audioType, search, tag, sort, scope } = req.query;

  // Scope: 'my' (Personal admin panel) vs 'all'
  if (scope === 'my') {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Log in to view your personal studio.' });
    }
    db = db.filter(item => item.userId === req.user.id);
  }

  // Filter by media category (wallpaper vs audio)
  if (type && type !== 'all') {
    db = db.filter(item => item.type === type);
  }

  // Filter by audio subtype (ringtone vs notification)
  if (audioType && audioType !== 'all') {
    db = db.filter(item => item.audioType === audioType);
  }

  // Tag filter
  if (tag) {
    const searchTag = tag.toLowerCase().trim();
    db = db.filter(item => item.tags && item.tags.some(t => t.toLowerCase() === searchTag));
  }

  // Search filter (title, description, tags, author)
  if (search) {
    const q = search.toLowerCase().trim();
    db = db.filter(item => {
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchDesc = (item.description || '').toLowerCase().includes(q);
      const matchTags = (item.tags || []).some(t => t.toLowerCase().includes(q));
      const matchFilename = (item.originalName || '').toLowerCase().includes(q);
      const matchAuthor = (item.author || '').toLowerCase().includes(q);
      return matchTitle || matchDesc || matchTags || matchFilename || matchAuthor;
    });
  }

  // Sorting
  if (sort === 'oldest') {
    db.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (sort === 'title_asc') {
    db.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  } else if (sort === 'title_desc') {
    db.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
  } else {
    // Default newest first
    db.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  res.json({
    success: true,
    count: db.length,
    data: db
  });
});

// GET /api/media/stats - Summary statistics (Global or Personal)
app.get('/api/media/stats', optionalAuth, (req, res) => {
  let db = getMediaDB();
  const { scope } = req.query;

  if (scope === 'my' && req.user) {
    db = db.filter(item => item.userId === req.user.id);
  }

  const wallpapersCount = db.filter(item => item.type === 'wallpaper').length;
  const audiosCount = db.filter(item => item.type === 'audio').length;
  const ringtonesCount = db.filter(item => item.type === 'audio' && item.audioType === 'ringtone').length;
  const notificationsCount = db.filter(item => item.type === 'audio' && item.audioType === 'notification').length;
  const totalSize = db.reduce((acc, curr) => acc + (curr.fileSize || 0), 0);

  // Collect top tags
  const tagCounts = {};
  db.forEach(item => {
    (item.tags || []).forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });
  const popularTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  res.json({
    success: true,
    total: db.length,
    wallpapers: wallpapersCount,
    audios: audiosCount,
    ringtones: ringtonesCount,
    notifications: notificationsCount,
    totalSizeBytes: totalSize,
    popularTags
  });
});

// GET /api/media/:id - Fetch single media item
app.get('/api/media/:id', (req, res) => {
  const db = getMediaDB();
  const item = db.find(m => m.id === req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Media not found' });
  }
  res.json({ success: true, data: item });
});

// POST /api/upload - Handle single or multiple file uploads (Protected)
app.post('/api/upload', requireAuth, upload.array('files', 50), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, error: 'No files provided' });
  }

  const db = getMediaDB();
  const newItems = [];
  const defaultAudioType = req.body.defaultAudioType || 'ringtone'; // 'ringtone' or 'notification'
  const customTags = req.body.tags ? req.body.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const customDescription = req.body.description || '';

  req.files.forEach(file => {
    const isAudio = file.destination.includes('audios') || file.mimetype.startsWith('audio/');
    const mediaType = isAudio ? 'audio' : 'wallpaper';
    const subPath = mediaType === 'wallpaper' ? 'wallpapers' : 'audios';
    const relativeUrl = `/uploads/${subPath}/${file.filename}`;

    const title = formatTitleFromFilename(file.originalname);
    const id = uuidv4();

    // Default tags based on type and filename words
    const autoTags = new Set(customTags);
    if (mediaType === 'wallpaper') {
      autoTags.add('wallpaper');
      autoTags.add('aesthetic');
    } else {
      autoTags.add(defaultAudioType === 'notification' ? 'notification' : 'ringtone');
      autoTags.add('sound');
    }

    // Extract keywords from title
    title.split(/\s+/).forEach(word => {
      if (word.length > 3) autoTags.add(word.toLowerCase());
    });

    const mediaRecord = {
      id,
      userId: req.user.id,
      author: req.user.username,
      title: req.body.title && req.files.length === 1 ? req.body.title : title,
      description: customDescription,
      type: mediaType, // 'wallpaper' | 'audio'
      originalName: file.originalname,
      filename: file.filename,
      mimeType: file.mimetype,
      fileSize: file.size,
      url: relativeUrl,
      tags: Array.from(autoTags),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (mediaType === 'audio') {
      mediaRecord.audioType = defaultAudioType; // 'ringtone' | 'notification'
    }

    newItems.push(mediaRecord);
    db.unshift(mediaRecord);
  });

  saveMediaDB(db);

  res.status(201).json({
    success: true,
    message: `Successfully uploaded ${newItems.length} file(s)`,
    uploadedCount: newItems.length,
    data: newItems
  });
});

// PUT /api/media/:id - Update metadata (Protected & Ownership-Enforced)
app.put('/api/media/:id', requireAuth, (req, res) => {
  const db = getMediaDB();
  const index = db.findIndex(m => m.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Media not found' });
  }

  const current = db[index];

  // Ownership verification: user can edit their own media or if admin
  if (current.userId && current.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Permission denied: You can only edit your own media.' });
  }

  // If item had no owner, assign to editing user
  if (!current.userId) {
    current.userId = req.user.id;
    current.author = req.user.username;
  }

  const { title, description, tags, audioType } = req.body;

  if (title !== undefined) current.title = title.trim() || current.title;
  if (description !== undefined) current.description = description.trim();
  
  if (tags !== undefined) {
    if (Array.isArray(tags)) {
      current.tags = tags.map(t => t.trim().toLowerCase()).filter(Boolean);
    } else if (typeof tags === 'string') {
      current.tags = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    }
  }

  // Audio specific checker (Ringtone vs Notification)
  if (current.type === 'audio' && audioType) {
    if (['ringtone', 'notification'].includes(audioType.toLowerCase())) {
      current.audioType = audioType.toLowerCase();
    }
  }

  current.updatedAt = new Date().toISOString();
  db[index] = current;
  saveMediaDB(db);

  res.json({
    success: true,
    message: 'Metadata updated successfully',
    data: current
  });
});

// DELETE /api/media/:id - Delete single media (Protected & Ownership-Enforced)
app.delete('/api/media/:id', requireAuth, (req, res) => {
  const db = getMediaDB();
  const index = db.findIndex(m => m.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Media not found' });
  }

  const current = db[index];

  // Ownership verification
  if (current.userId && current.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Permission denied: You can only delete your own media.' });
  }

  const [removed] = db.splice(index, 1);

  // Attempt to delete physical file
  const subFolder = removed.type === 'wallpaper' ? 'wallpapers' : 'audios';
  const filePath = path.join(UPLOADS_DIR, subFolder, removed.filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.warn(`Could not delete file ${filePath}:`, err.message);
    }
  }

  saveMediaDB(db);

  res.json({
    success: true,
    message: 'Media deleted successfully',
    data: removed
  });
});

// POST /api/media/bulk-delete - Bulk delete (Protected & Ownership-Enforced)
app.post('/api/media/bulk-delete', requireAuth, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, error: 'Provide an array of IDs to delete' });
  }

  const db = getMediaDB();
  const idSet = new Set(ids);
  const remaining = [];
  let deletedCount = 0;

  db.forEach(item => {
    if (idSet.has(item.id)) {
      // Check ownership
      if (item.userId && item.userId !== req.user.id && req.user.role !== 'admin') {
        remaining.push(item);
        return;
      }

      deletedCount++;
      const subFolder = item.type === 'wallpaper' ? 'wallpapers' : 'audios';
      const filePath = path.join(UPLOADS_DIR, subFolder, item.filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.warn(`Could not delete file ${filePath}:`, err.message);
        }
      }
    } else {
      remaining.push(item);
    }
  });

  saveMediaDB(remaining);

  res.json({
    success: true,
    message: `Successfully deleted ${deletedCount} item(s)`,
    deletedCount
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`===========================================`);
  console.log(`  🌟 Aura Media Admin Server Running!`);
  console.log(`  🔗 Portal URL: http://localhost:${PORT}`);
  console.log(`===========================================`);
});

