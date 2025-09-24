// app.js - Express app without server start (for testing)
require('dotenv').config();

const envFile = process.env.NODE_ENV === 'development' ? '.env.development' :
                process.env.NODE_ENV === 'test' ? '.env.test' : '.env';

require('dotenv-expand').expand(require('dotenv').config({ path: `./${envFile}` }));

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const session = require('express-session');
const path = require('path');

// Only import logger in non-test environment
let logActivity;
if (process.env.NODE_ENV !== 'test') {
  logActivity = require('./services/logger');
} else {
  logActivity = () => {}; // Mock function for testing
}

const app = express();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'paf_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create database pool
let pool;
if (process.env.NODE_ENV !== 'test') {
  pool = mysql.createPool(dbConfig);
} else {
  // Mock pool for testing
  pool = {
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn(),
    end: jest.fn()
  };
}

// Middleware
app.use(cors({
  origin: ['https://localhost:3000', 'http://localhost:3000', 'https://10.72.14.19:3000'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static files
app.use('/signatures', express.static(path.join(__dirname, 'public', 'signatures')));
app.use('/data', express.static(path.join(__dirname, 'data')));

// Authentication middleware
const ensureAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  } else {
    return res.status(401).json({ message: 'Access denied. Please log in.' });
  }
};

const authenticateAdmin = (req, res, next) => {
  if (req.session && req.session.userId && req.session.userRole === 'ADMIN') {
    return next();
  } else {
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
};

const authenticateUser = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  } else {
    return res.status(401).json({ message: 'Access denied. Please log in.' });
  }
};

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'PAF Management System Backend',
    version: '1.0.0'
  });
});

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userRole = user.role;
    req.session.partyId = user.party_id;

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword
    });

    if (logActivity) {
      logActivity('login', `User ${user.email} logged in successfully`);
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/auth/session-status', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        email: req.session.userEmail,
        role: req.session.userRole,
        party_id: req.session.partyId
      }
    });
  } else {
    res.status(401).json({ authenticated: false, message: 'Not authenticated' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ message: 'Could not log out' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout successful' });
  });
});

// User management routes
app.get('/api/dashboard/users', async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, email, role, party_id, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

app.post('/api/users/create-by-admin', authenticateAdmin, async (req, res) => {
  try {
    const { email, password, role, party_id } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      'INSERT INTO users (email, password, role, party_id) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, role || 'USER', party_id]
    );

    res.status(201).json({
      message: 'User created successfully',
      userId: result.insertId
    });

    if (logActivity) {
      logActivity('user_created', `Admin created user: ${email}`);
    }
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ message: 'User with this email already exists' });
    } else {
      res.status(500).json({ message: 'Error creating user' });
    }
  }
});

// PAF management routes
app.get('/api/pafs/my-pafs', ensureAuthenticated, async (req, res) => {
  try {
    const [pafs] = await pool.execute(
      'SELECT * FROM pafs WHERE user_id = ? ORDER BY created_at DESC',
      [req.session.userId]
    );
    res.json(pafs);
  } catch (error) {
    console.error('Error fetching PAFs:', error);
    res.status(500).json({ message: 'Error fetching PAFs' });
  }
});

app.post('/api/pafs', ensureAuthenticated, async (req, res) => {
  try {
    const { company_name, address, city, state, zip } = req.body;

    if (!company_name) {
      return res.status(400).json({ message: 'Company name is required' });
    }

    const [result] = await pool.execute(
      'INSERT INTO pafs (user_id, company_name, address, city, state, zip, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.session.userId, company_name, address, city, state, zip, 'Draft']
    );

    res.status(201).json({
      message: 'PAF created successfully',
      pafId: result.insertId
    });

    if (logActivity) {
      logActivity('paf_created', `PAF created for company: ${company_name}`);
    }
  } catch (error) {
    console.error('Error creating PAF:', error);
    res.status(500).json({ message: 'Error creating PAF' });
  }
});

app.get('/api/pafs/summary', ensureAuthenticated, async (req, res) => {
  try {
    const [summary] = await pool.execute(`
      SELECT
        COUNT(CASE WHEN status = 'Active' THEN 1 END) as activePafs,
        COUNT(CASE WHEN status = 'Pending Validation' THEN 1 END) as pendingValidationUs,
        COUNT(CASE WHEN status = 'Pending USPS Approval' THEN 1 END) as pendingUspsApprovalForeign,
        COUNT(CASE WHEN status = 'Rejected' THEN 1 END) as rejectedIncomplete,
        COUNT(CASE WHEN status = 'Renewal Due' THEN 1 END) as renewalDueNext30Days
      FROM pafs WHERE user_id = ?
    `, [req.session.userId]);

    res.json(summary[0] || {
      activePafs: 0,
      pendingValidationUs: 0,
      pendingUspsApprovalForeign: 0,
      rejectedIncomplete: 0,
      renewalDueNext30Days: 0
    });
  } catch (error) {
    console.error('Error fetching PAF summary:', error);
    res.status(500).json({ message: 'Error fetching PAF summary' });
  }
});

// Data routes
app.get('/api/data/naics-codes', (req, res) => {
  // Return mock NAICS codes for testing
  if (process.env.NODE_ENV === 'test') {
    return res.json([
      { code: '111110', title: 'Soybean Farming' },
      { code: '111120', title: 'Oilseed (except Soybean) Farming' }
    ]);
  }

  // In production, read from CSV file
  const fs = require('fs');
  const csv = require('csv-parser');
  const results = [];

  fs.createReadStream(path.join(__dirname, 'data', 'naics_codes.csv'))
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      res.json(results);
    })
    .on('error', (error) => {
      console.error('Error reading NAICS codes:', error);
      res.status(500).json({ message: 'Error reading NAICS codes' });
    });
});

app.get('/api/parties', async (req, res) => {
  try {
    const [parties] = await pool.execute('SELECT * FROM parties ORDER BY name');
    res.json(parties);
  } catch (error) {
    console.error('Error fetching parties:', error);
    res.status(500).json({ message: 'Error fetching parties' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

module.exports = { app, pool };