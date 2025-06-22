const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// Pre-defined users (mock data)
const users = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin'
  },
  {
    id: 2,
    username: 'john_doe',
    email: 'john@example.com',
    password: 'password123',
    role: 'user'
  },
  {
    id: 3,
    username: 'jane_smith',
    email: 'jane@example.com',
    password: 'password456',
    role: 'user'
  },
  {
    id: 4,
    username: 'manager',
    email: 'manager@example.com',
    password: 'manager123',
    role: 'manager'
  }
];

// Function to generate JWT token
const generateToken = (user) => {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours expiration
  };
  
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
};

// Login endpoint
app.post('/api/login', (req, res) => {
  // Check if req.body exists
  if (!req.body) {
    return res.status(400).json({
      success: false,
      message: 'Request body is required'
    });
  }

  const { username, email, password } = req.body;

  // Basic validation - accept either username or email
  if ((!username && !email) || !password) {
    return res.status(400).json({
      success: false,
      message: 'Either username or email, and password are required'
    });
  }

  // Find user by username or email
  let user;
  if (username) {
    user = users.find(u => u.username === username);
  } else if (email) {
    user = users.find(u => u.email === email);
  }

  // Check if user exists and password matches
  if (!user || user.password !== password) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Generate JWT token
  const token = generateToken(user);

  // Return user data (excluding password)
  const { password: _, ...userWithoutPassword } = user;
  
  res.json({
    success: true,
    message: 'Login successful',
    user: userWithoutPassword,
    token: token
  });
});

// Login with email endpoint
app.post('/api/login/email', (req, res) => {
  // Check if req.body exists
  if (!req.body) {
    return res.status(400).json({
      success: false,
      message: 'Request body is required'
    });
  }

  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  // Find user by email
  const user = users.find(u => u.email === email);

  // Check if user exists and password matches
  if (!user || user.password !== password) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  // Generate JWT token
  const token = generateToken(user);

  // Return user data (excluding password)
  const { password: _, ...userWithoutPassword } = user;
  
  res.json({
    success: true,
    message: 'Login successful',
    user: userWithoutPassword,
    token: token
  });
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Protected route example - Get current user profile
app.get('/api/profile', verifyToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const { password, ...userWithoutPassword } = user;
  
  res.json({
    success: true,
    user: userWithoutPassword
  });
});

// Verify token endpoint
app.post('/api/verify-token', (req, res) => {
  // Check if req.body exists
  if (!req.body) {
    return res.status(400).json({
      success: false,
      message: 'Request body is required'
    });
  }

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Token is required'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({
      success: true,
      message: 'Token is valid',
      user: decoded
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
});

// Get all users (for testing purposes)
app.get('/api/users', (req, res) => {
  const usersWithoutPasswords = users.map(user => {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  });
  
  res.json({
    success: true,
    users: usersWithoutPasswords
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Users service is running',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Users Service API',
    endpoints: {
      login: 'POST /api/login',
      loginWithEmail: 'POST /api/login/email',
      profile: 'GET /api/profile (requires auth)',
      verifyToken: 'POST /api/verify-token',
      users: 'GET /api/users',
      health: 'GET /api/health'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Users service running on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`- POST /api/login (username/password)`);
  console.log(`- POST /api/login/email (email/password)`);
  console.log(`- GET /api/profile (requires auth)`);
  console.log(`- POST /api/verify-token`);
  console.log(`- GET /api/users`);
  console.log(`- GET /api/health`);
});

module.exports = app;
