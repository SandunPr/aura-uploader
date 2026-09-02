const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');

// Ensure data directory exists
[path.dirname(USERS_FILE)].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Helper: Read / Write JSON storage
function readJSON(file, defaultVal = []) {
  try {
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf8');
      return JSON.parse(data || JSON.stringify(defaultVal));
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
  }
  return defaultVal;
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
    return false;
  }
}

// Password Hashing
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, storedHash) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

// User Operations
function getUsers() {
  return readJSON(USERS_FILE, []);
}

function saveUsers(users) {
  return writeJSON(USERS_FILE, users);
}

function getSessions() {
  return readJSON(SESSIONS_FILE, {});
}

function saveSessions(sessions) {
  return writeJSON(SESSIONS_FILE, sessions);
}

function findUserByEmailOrUsername(identifier) {
  const users = getUsers();
  const lower = identifier.toLowerCase().trim();
  return users.find(u => u.email.toLowerCase() === lower || u.username.toLowerCase() === lower);
}

function findUserById(id) {
  const users = getUsers();
  return users.find(u => u.id === id);
}

function createUser({ username, email, password, role = 'creator' }) {
  const users = getUsers();
  
  if (findUserByEmailOrUsername(email)) {
    throw new Error('An account with this email already exists.');
  }
  if (findUserByEmailOrUsername(username)) {
    throw new Error('This username is already taken.');
  }

  const { salt, hash } = hashPassword(password);
  const newUser = {
    id: uuidv4(),
    username: username.trim(),
    email: email.toLowerCase().trim(),
    salt,
    hash,
    role,
    avatarColor: ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#6366F1'][Math.floor(Math.random() * 6)],
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  // Return user without sensitive hashes
  const { salt: s, hash: h, ...safeUser } = newUser;
  return safeUser;
}

function authenticateUser(identifier, password) {
  const user = findUserByEmailOrUsername(identifier);
  if (!user) {
    throw new Error('Invalid email/username or password.');
  }

  const isValid = verifyPassword(password, user.salt, user.hash);
  if (!isValid) {
    throw new Error('Invalid email/username or password.');
  }

  const { salt, hash, ...safeUser } = user;
  return safeUser;
}

// Session Token Management
function createSession(userId) {
  const sessions = getSessions();
  const token = crypto.randomBytes(32).toString('hex');
  
  sessions[token] = {
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
  };

  saveSessions(sessions);
  return token;
}

function deleteSession(token) {
  const sessions = getSessions();
  if (sessions[token]) {
    delete sessions[token];
    saveSessions(sessions);
    return true;
  }
  return false;
}

function getUserByToken(token) {
  if (!token) return null;
  const sessions = getSessions();
  const session = sessions[token];
  if (!session) return null;

  if (new Date(session.expiresAt) < new Date()) {
    delete sessions[token];
    saveSessions(sessions);
    return null;
  }

  return findUserById(session.userId);
}

// Express Auth Middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  const user = getUserByToken(token);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Please log in to perform this action.'
    });
  }

  const { salt, hash, ...safeUser } = user;
  req.user = safeUser;
  req.token = token;
  next();
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  const user = getUserByToken(token);
  if (user) {
    const { salt, hash, ...safeUser } = user;
    req.user = safeUser;
    req.token = token;
  } else {
    req.user = null;
  }
  next();
}

module.exports = {
  createUser,
  authenticateUser,
  createSession,
  deleteSession,
  getUserByToken,
  requireAuth,
  optionalAuth
};
