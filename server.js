// server.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your-very-secure-secret'; // Use env var in production

// Enable CORS for frontend (Live Server, etc.)
app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5580']
}));

app.use(express.json()); // Parse JSON bodies

// In-memory "database"
let users = [
  { id: 1, username: 'admin', password: '2020', role: 'admin' },
  { id: 2, username: 'alice', password: '2020', role: 'user' }
];

// Pre-hash demo passwords
users = users.map(u => {
  if (!u.password.startsWith('$2a$')) {
    u.password = bcrypt.hashSync(u.username === 'admin' ? 'admin123' : 'user123', 10);
  }
  return u;
});

// ========================
// ROUTES
// ========================

// POST /api/register
app.post('/api/register', async (req, res) => {
  const { username, password, role = 'user' } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (users.find(u => u.username === username)) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = {
    id: users.length + 1,
    username,
    password: hashedPassword,
    role // For demo only; in production, role should not come from client
  };

  users.push(newUser);

  res.status(201).json({
    message: 'User registered successfully',
    username: newUser.username,
    role: newUser.role
  });
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  const user = users.find(u => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET_KEY,
    { expiresIn: '1h' }
  );

  res.json({
    token,
    user: { username: user.username, role: user.role }
  });
});

// GET /api/profile (protected)
app.get('/api/profile', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/admin/dashboard (admin-only)
app.get('/api/admin/dashboard', authenticateToken, authorizeRole('admin'), (req, res) => {
  res.json({
    message: 'Welcome to admin dashboard!',
    data: 'Secret admin info'
  });
});

// GET /api/content/guest (public)
app.get('/api/content/guest', (req, res) => {
  res.json({
    message: 'Public content for all visitors'
  });
});

// ========================
// MIDDLEWARE
// ========================

// Authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// Authorize role
function authorizeRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    next();
  };
}

// ========================
// START SERVER
// ========================

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log('Try logging in with:');
  console.log('Admin: username=admin, password=admin123');
  console.log('User: username=alice, password=user123');
});