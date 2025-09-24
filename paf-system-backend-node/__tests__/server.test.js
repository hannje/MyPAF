const request = require('supertest');
const bcrypt = require('bcryptjs');

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'test_db';
process.env.SESSION_SECRET = 'test-secret';

// Mock bcrypt for testing
jest.mock('bcryptjs');

// Import app after setting environment
const { app, pool } = require('../app');

describe('PAF Backend API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default bcrypt mock
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('$2b$10$hashedpassword');
  });

  describe('Health Check Endpoints', () => {
    test('GET /api/health - should return server status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service', 'PAF Management System Backend');
    });
  });

  describe('Authentication Endpoints', () => {
    test('POST /api/auth/login - should handle login with valid credentials', async () => {
      const mockUser = {
        id: 1,
        email: 'admin@example.com',
        password: '$2b$10$hashedpassword',
        role: 'ADMIN',
        party_id: 1
      };

      pool.execute.mockResolvedValueOnce([[mockUser]]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('admin@example.com');
      expect(response.body).toHaveProperty('message', 'Login successful');
    });

    test('POST /api/auth/login - should reject invalid credentials', async () => {
      pool.execute.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });

    test('POST /api/auth/login - should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: '',
          password: ''
        })
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Email and password are required');
    });

    test('GET /api/auth/session-status - should return session info for authenticated user', async () => {
      const agent = request.agent(app);

      // Mock successful login first
      const mockUser = {
        id: 1,
        email: 'admin@example.com',
        role: 'ADMIN',
        party_id: 1
      };

      pool.execute.mockResolvedValueOnce([[{
        ...mockUser,
        password: '$2b$10$hashedpassword'
      }]]);

      // Login first
      await agent
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'password123'
        });

      // Check session status
      const response = await agent
        .get('/api/auth/session-status')
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('admin@example.com');
    });

    test('POST /api/auth/logout - should clear session', async () => {
      const agent = request.agent(app);

      const response = await agent
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Logout successful');
    });
  });

  describe('User Management Endpoints', () => {
    test('GET /api/dashboard/users - should return users list', async () => {
      const mockUsers = [
        { id: 1, email: 'user1@example.com', role: 'USER' },
        { id: 2, email: 'user2@example.com', role: 'USER' }
      ];

      pool.execute.mockResolvedValueOnce([mockUsers]);

      const response = await request(app)
        .get('/api/dashboard/users')
        .expect(200);

      expect(Array.isArray(response.body)).toBeTruthy();
      expect(response.body.length).toBe(2);
      expect(response.body[0].email).toBe('user1@example.com');
    });

    test('POST /api/users/create-by-admin - should create new user (with auth)', async () => {
      const agent = request.agent(app);

      // Mock admin login
      const mockAdmin = {
        id: 1,
        email: 'admin@example.com',
        password: '$2b$10$hashedpassword',
        role: 'ADMIN',
        party_id: 1
      };

      pool.execute
        .mockResolvedValueOnce([[mockAdmin]]) // Login
        .mockResolvedValueOnce([{ insertId: 2 }]); // User creation

      // Login as admin
      await agent
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'password123'
        });

      // Create user
      const response = await agent
        .post('/api/users/create-by-admin')
        .send({
          email: 'newuser@example.com',
          password: 'password123',
          role: 'USER',
          party_id: 1
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'User created successfully');
      expect(response.body).toHaveProperty('userId', 2);
    });
  });

  describe('PAF Management Endpoints', () => {
    test('GET /api/pafs/my-pafs - should require authentication', async () => {
      const response = await request(app)
        .get('/api/pafs/my-pafs')
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Access denied. Please log in.');
    });

    test('GET /api/pafs/my-pafs - should return PAFs for authenticated user', async () => {
      const agent = request.agent(app);

      // Mock user login
      const mockUser = {
        id: 1,
        email: 'user@example.com',
        password: '$2b$10$hashedpassword',
        role: 'USER',
        party_id: 1
      };

      const mockPafs = [
        { id: 1, company_name: 'Test Company', status: 'Draft' },
        { id: 2, company_name: 'Another Company', status: 'Approved' }
      ];

      pool.execute
        .mockResolvedValueOnce([[mockUser]]) // Login
        .mockResolvedValueOnce([mockPafs]); // PAFs fetch

      // Login first
      await agent
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'password123'
        });

      // Get PAFs
      const response = await agent
        .get('/api/pafs/my-pafs')
        .expect(200);

      expect(Array.isArray(response.body)).toBeTruthy();
      expect(response.body.length).toBe(2);
      expect(response.body[0].company_name).toBe('Test Company');
    });

    test('POST /api/pafs - should create new PAF for authenticated user', async () => {
      const agent = request.agent(app);

      // Mock user login
      const mockUser = {
        id: 1,
        email: 'user@example.com',
        password: '$2b$10$hashedpassword',
        role: 'USER',
        party_id: 1
      };

      pool.execute
        .mockResolvedValueOnce([[mockUser]]) // Login
        .mockResolvedValueOnce([{ insertId: 1 }]); // PAF creation

      // Login first
      await agent
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'password123'
        });

      // Create PAF
      const pafData = {
        company_name: 'New Test Company',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zip: '12345'
      };

      const response = await agent
        .post('/api/pafs')
        .send(pafData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'PAF created successfully');
      expect(response.body).toHaveProperty('pafId', 1);
    });

    test('GET /api/pafs/summary - should return PAF statistics for authenticated user', async () => {
      const agent = request.agent(app);

      // Mock user login
      const mockUser = {
        id: 1,
        email: 'user@example.com',
        password: '$2b$10$hashedpassword',
        role: 'USER',
        party_id: 1
      };

      const mockSummary = [{
        activePafs: 5,
        pendingValidationUs: 2,
        pendingUspsApprovalForeign: 1,
        rejectedIncomplete: 0,
        renewalDueNext30Days: 3
      }];

      pool.execute
        .mockResolvedValueOnce([[mockUser]]) // Login
        .mockResolvedValueOnce([mockSummary]); // Summary fetch

      // Login first
      await agent
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'password123'
        });

      // Get summary
      const response = await agent
        .get('/api/pafs/summary')
        .expect(200);

      expect(response.body).toHaveProperty('activePafs', 5);
      expect(response.body).toHaveProperty('pendingValidationUs', 2);
    });
  });

  describe('Data Endpoints', () => {
    test('GET /api/data/naics-codes - should return NAICS codes', async () => {
      const response = await request(app)
        .get('/api/data/naics-codes')
        .expect(200);

      expect(Array.isArray(response.body)).toBeTruthy();
      // Note: This endpoint reads from CSV file, so response depends on file content
    });

    test('GET /api/parties - should return parties list', async () => {
      const mockParties = [
        { id: 1, name: 'Company A' },
        { id: 2, name: 'Company B' }
      ];

      pool.execute.mockResolvedValueOnce([mockParties]);

      const response = await request(app)
        .get('/api/parties')
        .expect(200);

      expect(Array.isArray(response.body)).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      pool.execute.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/dashboard/users')
        .expect(500);

      expect(response.body).toHaveProperty('message');
    });

    test('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(500); // Express error handler returns 500 for JSON parse errors
    });

    test('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .expect(404);
    });
  });

  describe('Security', () => {
    test('should have CORS headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // CORS headers are set based on request origin
      expect(response.headers).toHaveProperty('access-control-allow-credentials', 'true');
    });

    test('should require authentication for protected endpoints', async () => {
      const protectedEndpoints = [
        '/api/pafs/my-pafs',
        '/api/pafs/summary'
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .expect(401);

        expect(response.body).toHaveProperty('message');
      }
    });

    test('should sanitize user input', async () => {
      // Setup mock to return no users (invalid credentials)
      pool.execute.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: '<script>alert("xss")</script>',
          password: 'password'
        })
        .expect(401);

      expect(response.body.message).not.toContain('<script>');
    });
  });
});