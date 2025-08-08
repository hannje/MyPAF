// paf-system-backend-node/server.js
// Updated with userID and USPS ID generation improvements

require('dotenv').config(); // Load environment variables from .env file

// Enhanced logging with timestamps
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

function getTimestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

console.log = function(...args) {
    originalConsoleLog(`[${getTimestamp()}]`, ...args);
};

console.error = function(...args) {
    originalConsoleError(`[${getTimestamp()}] ERROR:`, ...args);
};
const express = require('express');
const mysql = require('mysql2/promise'); // Using the promise-based version
const bcrypt = require('bcryptjs');
const cors = require('cors');

const { sendEmail } = require('./services/emailService'); 

const https = require('https'); // <<< 1. REQUIRE the 'https' module

const http = require('http'); // <<< 1. REQUIRE the 'http' module


const fs2 = require('fs');      // <<< 2. REQUIRE the 'fs' module

const fs1 = require('fs'); // <<< Import the main fs 
const fs = require('fs').promises; // Node.js File System module
const path = require('path'); // Node.js Path module
const csv = require('csv-parser'); // The library we just installed

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { Parser } = require('json2csv'); // <<< Import the Parser from json2csv


//const { Parser } = require('json2csv'); 

const session = require('express-session');

const { v4: uuidv4 } = require('uuid'); // For generating unique list_owner_id

const app = express();
const PORT = process.env.PORT || 3001; // Use environment variable or default

const HTTP_PORT = process.env.PORT || 3001;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443; // A common port for local HTTPS

const allowedOrigins = [
  'http://localhost:3002',       // For accessing frontend from the dev machine itself
  'http://10.72.14.19:3002' ,    // For accessing frontend from other machines on your network (replace with your dev machine's actual current network IP if it changes)
  'https://10.72.14.19:3002'      // <<< THIS IS THE CRITICAL ADDITION
];


// --- Middleware ---
//app.use(cors({
//    origin: 'https://10.72.14.19:3002', // Allow requests from your React frontend
// // //
//
//
//    credentials: true, // Allow cookies to be sent with requests     
//    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods   
//}));


app.use(cors({
  origin: function (origin, callback) {
    // 'origin' is the value of the "Origin" header from the browser
    console.log(`CORS Middleware: Request received from Origin: ${origin}`); // <<< LOG 1

    // Check if the incoming origin is in our whitelist
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      // If there's no origin (like a server-to-server request or some tools) OR if the origin is in our list...
      console.log(`CORS Middleware: Origin '${origin}' is ALLOWED.`); // <<< LOG 2
      callback(null, true); // ...allow the request.
    } else {
      // If the origin is not in our list...
      console.error(`CORS Middleware: Origin '${origin}' is NOT ALLOWED.`); // <<< LOG 3
      callback(new Error('This origin is not allowed by CORS.')); // ...block the request.
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));



app.use(express.json()); // To parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies (optional, but can be useful)

// Express Session Middleware (ensure this is configured BEFORE your routes)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your_very_strong_session_secret_key_here_change_this',
    resave: false,
    saveUninitialized: false, // Important: only save sessions that have been modified (e.g., by adding user data)
    cookie: {
      secure: true, // Set to true if using HTTPS in production
      httpOnly: true, // Prevents client-side JS from accessing the cookie
      maxAge: 1000 * 60 * 60 * 24, // Example: 1 day (in milliseconds)
      sameSite: 'none' // Helps prevent CSRF; use 'none' with secure:true if cross-domain
    }
    // store: new RedisStore({ client: redisClient }), // Optional: for a persistent session store like Redis
  })
);

// --- Sanity Check Middleware for Session (Temporary for Debugging) ---
app.use((req, res, next) => {
  console.log(`Request to ${req.method} ${req.originalUrl} - Session ID: ${req.sessionID}`);
  if (req.session) {
    console.log('Current req.session.user:', req.session.user);
    // console.log('Full req.session object:', JSON.stringify(req.session)); // Can be verbose
  } else {
    console.log('req.session is undefined');
  }
  next();
});

// VVVVVV ADD THIS MIDDLEWARE VVVVVV
// Serve static files from the 'public' directory
app.use('/static', express.static(path.join(__dirname, 'public')));
// AAAAAA END OF NEW MIDDLEWARE AAAAAA



// --- Database Connection Pool (Recommended) ---
const dbPool = mysql.createPool({
    host: process.env.DB_HOST || '10.72.14.19',
    user: process.env.DB_USER || 'your_db_user', // Replace in .env
    password: process.env.DB_PASSWORD || 'your_db_password', // Replace in .env
    database: process.env.DB_NAME || 'paf_management_db', // Replace in .env
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  
});

const ensureAuthenticated = (req, res, next) => { // Make sure this is defined
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: 'Unauthorized: You must be logged in.' });
  }
  next();
};

// --- AUTHENTICATION MIDDLEWARE ---
const authenticateAdmin = (req, res, next) => {
  console.log('Middleware authenticateAdmin: Checking session...'); // Log when middleware is hit

  if (!req.session || !req.session.user) {
    console.log('Middleware authenticateAdmin: No session or user in session. Denying access.');
    return res.status(401).json({ message: 'Unauthorized: You must be logged in to access this resource.' });
  }

  // We have a session user, now check their role
  if (req.session.user.role !== 'ADMIN') {
    console.log(`Middleware authenticateAdmin: Access Denied. User role is "${req.session.user.role}", not 'ADMIN'.`);
    return res.status(403).json({ message: 'Forbidden: You do not have administrative privileges to access this resource.' });
  }

  // If we reach here, the user is in session and has the 'ADMIN' role
  console.log(`Middleware authenticateAdmin: Access GRANTED for admin user: ${req.session.user.email} (ID: ${req.session.user.id})`);
  
  // OPTIONAL: Attach user to req directly if you prefer req.admin over req.session.user in route handlers
  // req.admin = req.session.user; // This makes it consistent with how I wrote some previous examples.
                                  // If you do this, your route handlers can use req.admin.id etc.
                                  // Otherwise, they continue to use req.session.user.id.
                                  // For now, let's assume route handlers will use req.session.user directly.

  next(); // Proceed to
    };



// --- Helper Function to Hash Passwords ---
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
}

const authenticateUser = async (req, res, next) => {
    // FOR TESTING WITHOUT REAL AUTH: Read user ID from header or query param
    // In production, REMOVE THIS and implement proper token/session validation.
    const testUserId = req.headers['x-user-id'] || req.query.testUserId;
    console.log("AUTH MIDDLEWARE: Received testUserId:", testUserId, "from header:", req.headers['x-user-id']); // Log what's received

    if (testUserId) {
        let connection;
        try {
            connection = await dbPool.getConnection();
            const [users] = await connection.execute(
                `SELECT
                    u.id, u.email, u.role, u.first_name, u.last_name, 
                    u.usps_license_id 
                                     FROM users u
                 WHERE u.id = ?`,
                 [testUserId]
            );
            if (users.length > 0) {
                req.user = users[0]; // Attach user object to request
                console.log("AUTH MIDDLEWARE (MOCK): Authenticated user:", req.user.email, "Role:", req.user.role, "PartyID:", req.user.associated_party_id);
                next();
            } else {
                console.log("AUTH MIDDLEWARE (MOCK): User ID not found:", testUserId);
                return res.status(401).json({ error: 'Unauthorized: Mock user ID not found.' });
            }
        } catch (error) {
            console.error("AUTH MIDDLEWARE (MOCK) Error:", error);
            return res.status(500).json({ error: "Mock authentication error." });
        } finally {
            if (connection) connection.release();
        }
    } else {
        // If you want to enforce auth even for dev, uncomment the error line.
        // For now, allowing some routes to pass through if no testUserId is provided,
        // but they should check req.user.
        console.warn("AUTH MIDDLEWARE (MOCK): No testUserId provided. Route might proceed without user context.");
        // return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
        next();
    }
};

// --- API Routes ---


app.get('/api/users/agents', ensureAuthenticated, async (req, res) => {
  
  console.log(`Backend /api/users/agents: Request to fetch agent list.`);

   const creatingAdminId = req.session.user.id; // This is the ID of the admin creating the user

  const creatingAdminLic = req.session.user.uspsLicenseId; // This is the ID of the admin creating the user

  console.log('Backend: /api/users/agents creatingAdminId:', creatingAdminId, creatingAdminLic);
 


  let connection;
  try {
    connection = await dbPool.getConnection();

    // Query for users with a role of 'AGENT' or 'BROKER'.
    // Adjust the role names in the IN (...) clause to match what you use.
    // We select id, first_name, and last_name to build the dropdown options.
    const query = `
      SELECT id, first_name, last_name 
      FROM users 
      WHERE usps_license_id = ? 
      ORDER BY last_name ASC, first_name ASC;
    `;
    const [agentUsers] = await connection.execute(query, [creatingAdminLic]);

    console.log(`Backend /api/users/agents: Fetched ${agentUsers.length} potential agents for licensee ID: ${creatingAdminLic}`);

    // Format the data for the frontend dropdown
    const formattedAgents = agentUsers.map(user => ({
      id: user.id,
      userId: formatUserId(user.id), // Add userID for frontend reference
      // Create a display name for the dropdown label
      name: `${user.first_name || ''} ${user.last_name || ''} (UserID: ${formatUserId(user.id)})`.trim()
    }));


    console.log(`Backend /api/users/agents: Found ${formattedAgents}`);
    res.json(formattedAgents);

  } catch (error) {
    console.error('Error fetching agent users:', error);
    res.status(500).json({ message: 'Failed to fetch agent list.' });
  } finally {
    if (connection) connection.release();
  }
});




// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'API is running successfully!' });
});

// mypafreact/paf-system-backend-node/server.js
// ... (express, cors, bcrypt, mysql, session imports and setup) ...

// const { authenticateAdmin } = require('./middleware/authMiddleware'); // Your auth middleware if this route is protected

// POST /api/admins/register-admin
// Creates a new admin user and stores their associated licensee information directly in the users table.
app.post('/api/admins/register-admin', /* authenticateAdmin, */ async (req, res) => { // Add authenticateAdmin if needed
  const {
    firstName,
    lastName,
    email,
    password,
    role = 'ADMIN', // Default role for this registration form
    brokerListAdmin, // <<< RECEIVE THE NEW FIELD   
    uspsLicenseId,
    licenseeName,
    streetAddress,
    city,
    state,
    zipCode,
    phoneNumber
  } = req.body;

  // Get the ID of the admin creating this new admin (if applicable and auth middleware is used)
  // const creatingAdminId = req.admin ? req.admin.id : null;
  // For now, let's assume created_by_admin_id might be null if not passed or for initial admins
  // If this form is ALWAYS used by a logged-in superadmin, creatingAdminId should be derived from their session.
  // For simplicity in this snippet, we'll assume it might be passed or default to null.
  // A more robust solution would get creatingAdminId from req.session.user.id if an admin is creating another admin.

  // --- Input Validation ---
  if (!firstName || !lastName || !email || !password || !uspsLicenseId || !licenseeName || !role) {
    return res.status(400).json({ message: 'First Name, Last Name, Email, Password, Role, USPS License ID, and Licensee Name are required.' });
  }
  // Add more specific validations (email format, password strength, etc.) as needed.

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    // --- Check for existing email or USPS License ID (if they must be unique) ---
    const checkQuery = 'SELECT id FROM users WHERE email = ? OR usps_license_id = ?';
    const [existingUsers] = await connection.execute(checkQuery, [email.trim(), uspsLicenseId.trim()]);

    if (existingUsers.length > 0) {
      await connection.rollback();
      let conflictField = "unknown";
      if (existingUsers.some(u => u.email === email.trim())) {
        conflictField = "Email";
      } else if (existingUsers.some(u => u.usps_license_id === uspsLicenseId.trim())) {
        conflictField = "USPS License ID";
      }
      return res.status(409).json({ message: `${conflictField} already exists.` });
    }

    // --- Hash Password ---
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // --- Insert New Admin User with Licensee Info ---
    const insertQuery = `
      INSERT INTO users (
        first_name, last_name, email, password, role,broker_list_admin,
        usps_license_id, licensee_name, street_address, city, state, zip_code, phone_number,
        created_by_admin_id, -- This would be the ID of the admin creating this user, or NULL
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW());
    `;

    // Determine created_by_admin_id. If an admin is logged in and creating this user, use their ID.
    // This assumes your session stores user details including their 'id'.
    const creatorId = (req.session && req.session.user && req.session.user.id) ? req.session.user.id : null;


    const [result] = await connection.execute(insertQuery, [
      firstName.trim(),
      lastName.trim(),
      email.trim(),
      hashedPassword,
      role,
      brokerListAdmin,
      uspsLicenseId.trim(),
      licenseeName.trim(),
      streetAddress ? streetAddress.trim() : null,
      city ? city.trim() : null,
      state ? state.trim() : null,
      zipCode ? zipCode.trim() : null,
      phoneNumber ? phoneNumber.trim() : null,
      creatorId // Assigning the creator's ID
    ]);

    const newAdminId = result.insertId;
    await connection.commit();

    // Fetch and return the newly created admin (excluding password)
    const [newAdminRows] = await connection.execute(
      'SELECT id, first_name, last_name, email, role,broker_list_admin, usps_license_id, licensee_name, street_address, city, state, zip_code, phone_number, created_by_admin_id, created_at, updated_at FROM users WHERE id = ?',
      [newAdminId]
    );

    if (newAdminRows.length === 0) {
        // Should not happen if insert was successful, but good to check
        return res.status(500).json({ message: "Failed to retrieve newly created admin."});
    }
    
    const newAdminData = newAdminRows[0];
    
    // Generate userID using the same format as PAF IDs
    const generatedUserId = formatUserId(newAdminId);
    newAdminData.userId = generatedUserId; // Add userID to the response
    
    res.status(201).json({ message: 'Admin created successfully', admin: newAdminData });

  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { console.error('Rollback error', e); }
    }
    console.error('Error during admin registration (/api/admins/register-admin):', error);
    if (error.code === 'ER_DUP_ENTRY') { // MySQL specific error code for unique constraint
      return res.status(409).json({ message: 'Duplicate entry. Email or USPS License ID might already be registered.', details: error.sqlMessage });
    }
    res.status(500).json({ message: 'Server error during admin registration.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});



// --- NEW ENDPOINT: GET /api/data/naics-codes ---
app.get('/api/data/naics-codes', (req, res) => {
  const results = [];
  const csvFilePath = path.join(__dirname, 'data', 'naics_codes.csv'); // Constructs correct path

  console.log(`Backend /api/data/naics-codes: Reading from file: ${csvFilePath}`);

  // Check if file exists before trying to read
  if (!fs1.existsSync(csvFilePath)) { 
    console.error(`Backend /api/data/naics-codes: ERROR - CSV file not found at path: ${csvFilePath}`);
    return res.status(500).json({ message: 'NAICS data source not found on server.' });
  }

  fs1.createReadStream(csvFilePath)
    .pipe(csv()) // Pipe the file stream through the csv-parser
    .on('data', (data) => {
      // Assuming headers are 'code' and 'description'
      // Only add to results if data has a valid code and description
      if (data.code && data.description) {
        results.push({
          code: data.code,
          // Create a display label for the dropdown
          label: `${data.code} - ${data.description}`
        });
      }
    })
    .on('end', () => {
      console.log(`Backend /api/data/naics-codes: Successfully parsed ${results.length} NAICS codes.`);
      // Send the array of objects as a JSON response
      res.json(results);
    })
    .on('error', (error) => {
      console.error('Backend /api/data/naics-codes: Error reading CSV file:', error);
      res.status(500).json({ message: 'Error processing NAICS data on server.' });
    });
});

// ... (your other routes and app.listen) ...


// server.js (snippet for the /api/admins/register-admin endpoint)


// User Creation (Potentially with Associated Party)
app.post('/api/users/create-with-partyxx', async (req, res) => {

    console.log("USER CREATION ROUTE CALLED",req.body);

    const {
        // User fields
        firstName, lastName, email, phoneNumber, department, role, password, confirmPassword, isActive = true,
        // Party fields
        createAssociatedParty, companyName, addressLine1, city, state, zipCode, country = 'USA', partyType, naicsCode
    } = req.body;

      // The new user will operate under the same Licensee as the creating Admin
    
    console.log("USER",req.user);
    console.log("AADMIN",req.admin);
 
    const userLicenseePartyId = req.body.licensee_party_id; // Get from authenticated Admin

    // User Validation
    if (!firstName || !lastName || !email || !role || !password || !confirmPassword) {
        return res.status(400).json({ error: 'All required user fields must be filled.' });
    }
    if (password !== confirmPassword) {
        return res.status(400).json({ error: 'User passwords do not match.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'User password must be at least 8 characters long.' });
    }
 
    if (!userLicenseePartyId) { // Admin creating user must themselves be linked to a Licensee
        console.error("CRITICAL: Admin user creating account does not have a licensee_party_id.", req.user);
        return res.status(500).json({ error: "System configuration error: Admin not linked to a Licensee." });
    }
    // Party Validation (if applicable)
    if (createAssociatedParty) {
        if (!companyName || !addressLine1 || !city || !state || !zipCode || !partyType) {
            return res.status(400).json({ error: 'All required company/party fields must be filled if creating an associated party.' });
        }
        if ((partyType === 'LIST_OWNER' || partyType === 'BROKER_AGENT') && !naicsCode) {
             return res.status(400).json({ error: 'NAICS code is required for List Owners and Brokers/Agents when creating a party.' });
        }
    }

    let connection;
    try {
        const hashedPassword = await hashPassword(password);
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        const [existingUsers] = await connection.execute('SELECT user_id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            await connection.rollback();
            return res.status(409).json({ error: 'User email address already registered.' });
        }

        let newPartyId = null;
        if (createAssociatedParty) {
            const partySql = `
                INSERT INTO parties (
                    party_type, company_name, address_line1, city, state, zip_code, country, naics_code,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `;
            const partyValues = [
                partyType, companyName, addressLine1, city, state, zipCode, country,
                (partyType === 'LIST_OWNER' || partyType === 'BROKER_AGENT') ? naicsCode : null
            ];
            const [partyResult] = await connection.execute(partySql, partyValues);
            newPartyId = partyResult.insertId;
        }
        console.log("after patites inser:NEW PARTY ID", newPartyId);
        const userSql = `
            INSERT INTO users (
                first_name, last_name, email, password_hash, phone_number,
                department, role, is_active,
                licensee_party_id,          
                associated_party_id,        
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;

        // Adjust userValues if you add associated_party_id to users table
        const userValues = [
            firstName, lastName, email, hashedPassword, phoneNumber || null,
            department || null, role, isActive === true || isActive === 'true', // Ensure boolean
             userLicenseePartyId,          // Set from creating admin's licensee
            newPartyId  // Can be null
            ];
       
        console.log("USER VALUES",userValues);

        const [userResult] = await connection.execute(userSql, userValues);
        const newUserId = userResult.insertId;

        await connection.commit();

        let successMessage = `User ${firstName} ${lastName} (ID: ${newUserId}) created successfully!`;
        if (newPartyId) {
            successMessage += ` Associated Party ${companyName} (ID: ${newPartyId}) also created.`;
        }

        res.status(201).json({
            message: successMessage,
            userId: newUserId,
            partyId: newPartyId
        });

    } catch (error) {
        console.error('Database Error creating user/party:', error);
        if (connection) {
            await connection.rollback();
        }
        res.status(500).json({ error: 'Failed to process registration. An internal error occurred: ' + error.message });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});




// PAF Creation (Initiation by Admin)
app.post('/api/pafsxxx/create', async (req, res) => {
    const {
        listOwnerId, licenseeId, brokerAgentId, listAdministratorId,
        pafType, isMultipleLists, notes,processingFrequencyCode ,jurisdiction
    } = req.body;

    console.log("PAF CREATION REQUEST BODY:", req.body);

    if (!listOwnerId || !licenseeId || !pafType || !jurisdiction) {
        return res.status(400).json({ error: 'Required PAF information is missing (List Owner, Licensee, Type, Jurisdiction).' });
    }
    if (processingFrequencyCode) { // Validate if provided
        const freqNum = parseInt(processingFrequencyCode);
        if (isNaN(freqNum) || ((freqNum < 1 || freqNum > 52) && freqNum !== 99) || processingFrequencyCode.length !== 2) {
            return res.status(400).json({ error: 'Invalid Processing Frequency Code. Must be 01-52 or 99.' });
        }
    } else {
        // Decide on a default or make it required. Let's make it required for now.
         return res.status(400).json({ error: 'Processing Frequency Code (01-52 or 99) is required.' });
    }



    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        // Verify party IDs (simplified - in real app, more robust checks or ensure dropdowns are accurate)
        const [ownerCheck] = await connection.execute('SELECT party_id FROM parties WHERE party_id = ? AND party_type = ?', [listOwnerId, 'LIST_OWNER']);
        if (ownerCheck.length === 0) throw new Error(`List Owner with ID ${listOwnerId} not found.`);

        let initialStatus = jurisdiction === 'FOREIGN' ? 'PENDING_LOI_FOREIGN_ONLY' : 'PENDING_LIST_OWNER_APPROVAL';
        const dateIssued = new Date();

        const pafSql = `
            INSERT INTO pafs (
                list_owner_id, licensee_id, list_administrator_id, paf_type, jurisdiction,
                current_status, is_multiple_lists, date_issued,
                processing_frequency_code, 
                 created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
        const pafValues = [
            listOwnerId, licenseeId, listAdministratorId || null, pafType, jurisdiction,
            initialStatus, isMultipleLists || false, dateIssued,
            processingFrequencyCode
        ];

  
        console.log("PAF SQL:", pafSql);
        console.log("PAF VALUES:", pafValues);

        const [pafResult] = await connection.execute(pafSql, pafValues);
        const newPafId = pafResult.insertId;

        console.log("paf result",pafResult);


        if (brokerAgentId) {
            const [brokerCheck] = await connection.execute('SELECT party_id FROM parties WHERE party_id = ? AND party_type = ?', [brokerAgentId, 'BROKER_AGENT']);
            if (brokerCheck.length === 0) throw new Error (`Broker with ID ${brokerAgentId} not found.`);
            await connection.execute(
                'INSERT INTO paf_brokers (paf_id, broker_party_id) VALUES (?, ?)',
                [newPafId, brokerAgentId]
            );
        }
        else// see if list admin is here
        {
            if(listAdministratorId)
            {
               const [brokerCheck] = await connection.execute('SELECT party_id FROM parties WHERE party_id = ?', [listAdministratorId]);
            if (brokerCheck.length === 0) throw new Error (`Broker with ID ${brokerAgentId} not found.`);
            await connection.execute(
                'INSERT INTO paf_brokers (paf_id, broker_party_id) VALUES (?, ?)',
                [newPafId, listAdministratorId]
            );


            }


        }

        await connection.execute(
            'INSERT INTO paf_status_history (paf_id, status, notes, changed_at) VALUES (?, ?, ?, ?)',
            [newPafId, initialStatus, `PAF initiated. Notes: ${notes || 'N/A'}`, dateIssued]
        );

        await connection.commit();

        res.status(201).json({
            message: `PAF (DB ID: ${newPafId}) initiated successfully. Status: ${initialStatus}.`,
            paf: { paf_id: newPafId, current_status: initialStatus, date_issued: dateIssued.toISOString().slice(0,10) }
        });

    } catch (error) {
        console.error('Error creating PAF:', error);
        if (connection) await connection.rollback();
        res.status(500).json({ error: 'Failed to initiate PAF: ' + error.message });
    } finally {
        if (connection) connection.release();
    }
});


// --- Admin Dashboard API Endpoints (Currently Mocked) ---
// ... (keep existing imports, dbPool, app setup, other routes) ...

app.get('/api/pafs/summary', ensureAuthenticated, async (req, res) => {
    // TODO: Add authentication & authorization
    let connection;
    try {

    //  console.log("PAF SUMMARY REQUEST RECEIVED",req.session.user);

     const uspsID = req.session.user.uspsLicenseId; // Assuming the user session has this field

      console.log("USPS ID for PAF Summary:", uspsID);


      connection = await dbPool.getConnection();

      // Query for Active PAFs count
        const [activePafsResult] = await connection.execute(
            `SELECT COUNT(*) as count FROM pafs WHERE status = 'LICENSEE_VALIDATED' and licensee_id= ?`,
            [uspsID] // Use the USPS License ID from the session
        );
        const activePafsCount = activePafsResult[0].count || 0;

        // TODO: Add queries for other summary counts here
        // Example for Pending Validation US:
         const [pendingValidationUsResult] = await connection.execute(
             "SELECT COUNT(*) as count FROM pafs WHERE(status = 'PENDING_LIST_OWNER_APPROVAL' or status = 'PENDING_LICENSEE_VALIDATION_US_ONLY' or status = 'PENDING_AGENT_APPROVAL') and licensee_id= ?",
             [uspsID] // Use the USPS License ID from the session
         );
         const pendingValidationUsCount = pendingValidationUsResult[0].count || 0;

         const [pendingUspsApprovalForeign] = await connection.execute(
            "SELECT COUNT(*) as count FROM pafs WHERE status = 'PENDING_USPS_APPROVAL_FOREIGN_ONLY'"
        );
        const pendingUspsApprovalForeignCount = pendingUspsApprovalForeign[0].count || 0;
 
        const [rejectedIncomplete] = await connection.execute(
            "SELECT COUNT(*) as count FROM pafs WHERE status = 'REJECTED_INCOMPLETE'"
        );
        const rejectedIncompleteCount = rejectedIncomplete[0].count || 0;

        const [renewalDueNext30Days] = await connection.execute(
            "SELECT COUNT(*) as count FROM pafs WHERE status = 'LICENSEE_VALIDATED' and DATE(expiration) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)");
        const renewalDueNext30DaysCount = renewalDueNext30Days[0].count || 0;


        // For now, we'll return the real active count and keep others mocked for simplicity
        // You would replace these with actual counts from your DB queries
        res.json({
            activePafs: activePafsCount, // REAL DATA
            pendingValidationUs: pendingValidationUsCount,     // MOCK - Replace with pendingValidationUsCount
            pendingUspsApprovalForeign: pendingUspsApprovalForeignCount, // MOCK
            rejectedIncomplete: rejectedIncompleteCount,         // MOCK
            renewalDueNext30Days: renewalDueNext30DaysCount,    // MOCK - This one requires date logic in SQL
        });

    } catch (error) {
        console.error('Error fetching PAFs summary:', error);
        res.status(500).json({ error: 'Failed to fetch PAFs summary. An internal error occurred.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});



app.get('/api/pafs/action-required', async (req, res) => {
    const requestedPage = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.limit) || 25; // How many items per page

    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log(`PAF FETCH (JS Paginate): Connection obtained. Requested Page: ${requestedPage}, Items/Page: ${itemsPerPage}`);

        // SQL without LIMIT and OFFSET, but WITH the JOIN to parties
        const pafsSql_NoLimit_WithJoin = `
            SELECT
                p.paf_id AS internalDbId,
                p.licensee_assigned_paf_id AS pafId,
                p.list_owner_id,
                lo_party.company_name AS listOwner, -- This needs the JOIN
                p.jurisdiction,
                p.status AS status,
                p.date_issued,
                p.list_owner_signature_date,
                p.licensee_signature_date,
                p.usps_approval_date,
                p.effective_date,
                p.calculated_expiration_date,
                GREATEST(p.created_at, IFNULL(p.updated_at, p.created_at)) AS lastUpdatedSortable,
                p.updated_at,
                p.created_at,
                p.processing_frequency_code S
            FROM pafs p
        `;

        console.log("PAF FETCH (JS Paginate): Executing Full PAFs list SQL (with JOIN):", pafsSql_NoLimit_WithJoin);
        // No parameters needed for this specific SQL query as LIMIT/OFFSET are removed
        const [allPafsFromDb] = await connection.execute(pafsSql_NoLimit_WithJoin);
        console.log("PAF FETCH (JS Paginate): Full PAFs list query executed, total raw results:", allPafsFromDb.length);

        const totalPafs = allPafsFromDb.length;
        const totalPages = Math.ceil(totalPafs / itemsPerPage);
        const startIndex = (requestedPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;

        // Slice the results *after* fetching all of them
        const paginatedPafsData = allPafsFromDb.slice(startIndex, endIndex);
        console.log(`PAF FETCH (JS Paginate): Sliced for page ${requestedPage}. Start: ${startIndex}, End: ${endIndex}, Count: ${paginatedPafsData.length}`);


        // Transform only the paginated data
        const transformedPafs = paginatedPafsData.map(paf => ({
            ...paf,
            // listOwner is already included from the JOIN in allPafsFromDb
            lastUpdated: paf.updated_at ? new Date(paf.updated_at).toLocaleDateString()
                         : (paf.date_issued ? new Date(paf.date_issued).toLocaleDateString()
                         : (paf.created_at ? new Date(paf.created_at).toLocaleDateString() : 'N/A')),
        }));

        res.json({
            pafs: transformedPafs,
            totalPafs: totalPafs,
            currentPage: requestedPage,
            totalPages: totalPages
        });

    } catch (error) {
        console.error('FULL ERROR in /api/pafs/action-required (JS Paginate):', error);
        res.status(500).json({ error: 'Failed to fetch PAFs (JS Paginate).', details: error.message });
    } finally {
        if (connection) {
            console.log("PAF FETCH (JS Paginate): Releasing connection.");
            connection.release();
        }
    }
});

// In server.js (paf-system-backend-node)

// ... (keep existing imports, dbPool, app setup, other routes) ...

// server.js (snippet for fetching users for the admin dashboard)

// This middleware would get the admin's details from a JWT or session
// For simplicity, let's assume it adds `req.admin` which contains `req.admin.party_id`
// const { authenticateAdmin } = require('./middleware/authMiddleware'); // Your auth middleware


// mypafreact/paf-system-backend-node/server.js

// ... (express, cors, bcrypt, mysql, session imports and setup as previously done) ...
// Ensure app.use(session(...)) is configured and called BEFORE this route.
// Ensure app.use(cors({ origin: '...', credentials: true })) is configured.

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  console.log(`Backend /api/auth/login: Attempting login for ${email}`);

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();

    // Fetch all relevant user details, including licensee info if present on this user record
    const findUserQuery = `
      SELECT 
        id, email, password, role, 
        first_name, last_name, 
        usps_license_id, licensee_name, 
        street_address, city, state, zip_code, phone_number,
        created_by_admin_id 
      FROM users 
      WHERE email = ?`;
    const [rows] = await connection.execute(findUserQuery, [email.trim()]);

    if (rows.length === 0) {
      console.log(`Backend /api/auth/login: No user found for email - ${email}`);
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const userFromDb = rows[0];

    // Compare provided password with the stored hashed password
    const isMatch = await bcrypt.compare(password, userFromDb.password);

    if (!isMatch) {
      console.log(`Backend /api/auth/login: Password mismatch for email - ${email}`);
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // --- Password matches - Setup Session ---
    // Construct the user object to store in the session and send to the client.
    // This object will be used by AuthContext on the frontend.
    const sessionUser = {
      id: userFromDb.id, // User's own ID
      email: userFromDb.email,
      role: userFromDb.role,
      firstName: userFromDb.first_name,
      lastName: userFromDb.last_name,

      // Licensee specific information associated with THIS user account
      // (primarily for ADMIN users representing a licensee)
      uspsLicenseId: userFromDb.usps_license_id, // This is key for their organizational scope
      licenseeName: userFromDb.licensee_name,
      // Include other licensee details if needed by the frontend immediately after login
      // streetAddress: userFromDb.street_address,
      // city: userFromDb.city,
      // state: userFromDb.state,
      // zipCode: userFromDb.zip_code,
      // phoneNumber: userFromDb.phone_number,

      // createdByAdminId might be useful for context, but less so for the admin themselves
      // createdByAdminId: userFromDb.created_by_admin_id
    };

    // Attach the constructed user object to the session
    req.session.user = sessionUser;

  
    // Explicitly save the session before sending the response
    req.session.save((err) => {
      if (err) {
        console.error('Backend /api/auth/login: Failed to save session:', err);
        // It's possible the session user object is too large for the store if it's MemoryStore
        // and you've added many large fields, but with the current selection it should be fine.
        return res.status(500).json({ message: 'Login failed due to a server error (session save).' });
      }

      console.log("Backend req.session.user",req.session.user);

      console.log(`Backend /api/auth/login: Session saved successfully for user: ${sessionUser.email}, Role: ${sessionUser.role}, User ID: ${sessionUser.id}, USPS License ID: ${sessionUser.uspsLicenseId}`);
      
      // The session cookie will be automatically sent back to the browser by express-session.
      // Send back the user object for the frontend to update its state immediately.
      return res.status(200).json({
        message: 'Login successful',
        user: sessionUser // This 'user' object is what AuthContext will store
      });
    });

  } catch (error) {
    console.error('Backend /api/auth/login: General error:', error);
    // Avoid sending detailed error messages to the client in production for security
    res.status(500).json({ message: 'An internal server error occurred during login.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Remember to also have your /api/auth/session-status and /api/auth/logout endpoints
// that work with req.session.user in a similar fashion.

// mypafreact/paf-system-backend-node/server.js

// ... (express, cors, bcrypt, mysql, session imports and setup as previously done) ...
// Ensure app.use(session(...)) and app.use(cors(...)) are configured correctly and before this route.

// mypafreact/paf-system-backend-node/server.js (snippet for user creation by admin)

function formatUniqueIdForUspsId(id) {
  // DEPRECATED: This function is no longer used for USPS ID generation.
  // USPS ID generation now uses the formatted userID (PAF_PREFIX + padded ID) directly.
  // The spec says bytes 11-16 are the UNIQUE ID (6 bytes).
  // We will pad the user's auto-incremented ID to 6 digits.
  return String(id).padStart(6, '0');
}



app.post('/api/users/create-by-admin', authenticateAdmin, async (req, res) => {

    console.log('Backend: /api/users/create-by-admin body.',req.body);
//    console.log('Backend: /api/users/create-by-admin session.',req.session);
//    console.log('Backend: /api/users/create-by-admin heaaders.',req.headers);

 // const creatingAdminId = req.body.adminID; // From authenticated admin's session
  const creatingAdminId = req.session.user.id; // This is the ID of the admin creating the user

  const creatingAdminLic = req.session.user.uspsLicenseId; // This is the ID of the admin creating the user

  console.log('Backend: /api/users/create-by-admin creatingAdminId:', creatingAdminId, creatingAdminLic);
  // Ensure the admin is authenticated and has the right role

  const {
    firstName, lastName, email, password, role,brokerListAdmin,
    // New fields for the user's own company/address info
    licenseeName,sic, // This will be stored as this user's 'company name'
    streetAddress, city, state, zipCode, phoneNumber
  } = req.body;

  console.log('Backend: /api/users/create-by-admin request body:', req.body);

  // ... (validation for required fields like firstName, lastName, email, password, role) ...

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    console.log('Backend: /api/users/create-by-admin - Connection obtained, starting transaction.');

    // ... (check if email already exists) ...

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Backend: /api/users/create-by-admin - Password hashed successfully.');


    // The users table now has columns for these details directly.
    // A regular user will NOT have their own usps_license_id in most cases.
    // That field is primarily for ADMIN users who represent a Licensee entity.
    // Their 'licenseeName' field is their specific company name if applicable.
    const insertUserQuery = `
      INSERT INTO users (
        first_name, last_name, email, password, role,broker_list_admin,
        licensee_name, street_address, city, state, zip_code, phone_number, 
        created_by_admin_id, SIC,usps_license_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,  NOW(), NOW()); 
    `;
    // Note: usps_license_id is explicitly set to NULL here for a regular user.
    // If a user *could* have their own, you'd pass it from the form.

    
    console.log('Backend: /api/users/create-by-admin - Preparing to insert new user with query:', insertUserQuery);
    
    const userParms = [
      firstName.trim(), 
      lastName.trim(), 
      email.trim(), 
      hashedPassword, 
      role,
      brokerListAdmin,
      licenseeName ? licenseeName.trim() : null,
      streetAddress ? streetAddress.trim() : null,
      city ? city.trim() : null,
      state ? state.trim() : null,
      zipCode ? zipCode.trim() : null,
      phoneNumber ? phoneNumber.trim() : null,
      creatingAdminId,
      sic,
      creatingAdminLic,

    ];

    console.log('Backend: /api/users/create-by-admin - User parameters prepared:', userParms);
    // Execute the insert query with the provided user details

    const [newUserResult] = await connection.execute(insertUserQuery, userParms);
    const newUserId = newUserResult.insertId;

    console.log(`Backend: /api/users/create-by-admin - New user created with ID: ${newUserId}`);

    // Generate userID using PAF_PREFIX format first
    const generatedUserId = formatUserId(newUserId);
    console.log(`Backend: Generated userID for new user: ${generatedUserId}`);

    const platformId = (creatingAdminLic || '    ').padEnd(4, ' '); // Bytes 1-4: From creating admin's scope
    const naicsCode = (sic || '      ').padEnd(6, ' '); // Bytes 5-10: Use the NAICS code provided in the form for this user
    const uniqueId = generatedUserId.padEnd(6, ' '); // Bytes 11-16: Based on the NEW user's userID (not raw database ID)

    const generatedUspsId = `${platformId}${naicsCode}${uniqueId}`.substring(0, 16);
    console.log(`Generated USPS ID for new user ${newUserId}: "${generatedUspsId}"`);

    // --- Step 3: Update the new user record with the generated usps_id ---
    const updateQuery = 'UPDATE users SET uspsID = ? WHERE id = ?';
    await connection.execute(updateQuery, [generatedUspsId, newUserId]);


    
    await connection.commit();






    // ... (fetch and return created user, make sure to fetch the new fields too) ...
    const [newUserRows] = await connection.execute(
        'SELECT id, first_name, last_name, email, role,broker_list_admin, licensee_name, street_address, city, state, zip_code, phone_number, created_by_admin_id, usps_license_id, created_at FROM users WHERE id = ?',
        [newUserId]
    );
    
    // generatedUserId was already created above during USPS ID generation
    const userData = newUserRows[0];
    userData.userId = generatedUserId; // Add userID to the response
    
    res.status(201).json({ message: 'User created successfully', user: userData });

 //   console.log(`Backend: /api/users/create-by-admin - User creation successful, user: ${newUserRows}`);

    if (true) { // Ensure user was actually created and data fetched

      console.log("SENDINGEMAIL",req.body);

      const subject = 'Welcome to the PAF System!';
      const textBody = `Hello ${req.body.firstName || ''},\n\nYour account has been created in the PAF System by \n\nYou can log in with your email and the password provided to you (or a temporary one).\n\nThank you,\nThe PAF System Team`;
      // You might want a more elaborate HTML email too
      const htmlBody = `<p>Hello ${req.body.firstName || ''},</p><p>Your account has been created in the PAF System by </p><p>You can log in with your email and the password provided to you (or a temporary one).</p><p>Thank you,<br/>The PAF System Team</p>`;
      
      console.log(`Backend: /api/users/create-by-admin - Sending welcome email to ${req.body.email}`);

      sendEmail(req.body.email, subject, textBody, htmlBody)
        .then(() => console.log(`Welcome email successfully sent to ${req.body.email}`))
        .catch(emailError => console.error(`Failed to send welcome email to ${req.body.email}:`, emailError));
      // Not waiting for email to send before responding to API request to keep it snappy.
      // Email sending is "fire and forget" here. For critical emails, you might handle errors differently.
    
      console.log(`Backend: /api/users/create-by-admin - Welcome email sent to new user: ${req.body.email}`);  
    }

  } catch (error) {

    console.error('Backend: /api/users/create-by-admin - Error creating user:', error);
    // ... (error handling) ...
  } finally {
    if (connection) connection.release();
  }
});



app.get('/api/dashboard/users', async (req, res) => {

  console.log('Backend: /api/dashboard/users endpointxxxxxx hit.',req.session); // <<< LOG 1

 
  // 1. Check for an active session and a logged-in user
  if (!req.session || !req.session.user || !req.session.user.id) {
    console.log('Backend: /api/dashboard/users - No valid session or user ID found.');
    return res.status(401).json({ message: 'Not authenticated or user session is invalid.' });
  }

  // 2. Ensure the logged-in user is an ADMIN
  if (req.session.user.role !== 'ADMIN') {
    console.log(`Backend: /api/dashboard/users - Access denied. User role is "${req.session.user.role}", not ADMIN.`);
    return res.status(403).json({ message: 'Access denied. Admin role required.' });
  }

  // 3. Get the ID of the logged-in admin from their session
  const loggedInAdminId = req.session.user.id;
  console.log(`Backend: /api/dashboard/users - Authenticated admin. Fetching users created by admin_id: ${loggedInAdminId}`);

   const adminUspsLicenseId = req.session.user.uspsLicenseId;

   console.log(`Backend: /api/dashboard/users - Admin's USPS License ID: ${adminUspsLicenseId}`);

  let connection;
  try {
    connection = await dbPool.getConnection();

    // 4. SQL Query to fetch users CREATED BY this admin
    // We also fetch the licensee details from the creating admin's record
    // to display alongside the users they manage, as users might not have these directly.
    const query1 = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.role, u.created_at,u.licensee_name
        u.created_by_admin_id,
        admin_creator.usps_license_id AS creator_usps_license_id,  -- License ID of the creating admin's scope
        admin_creator.licensee_name AS creator_licensee_name      -- Licensee Name of the creating admin's scope
      FROM users u
      LEFT JOIN users admin_creator ON u.created_by_admin_id = admin_creator.id -- Join to get creator's licensee info
      WHERE u.created_by_admin_id = ? 
      ORDER BY u.last_name ASC, u.first_name ASC;
    `;

 const query = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.role, u.created_at,
        u.usps_license_id, -- The user's own USPS License ID (will be populated for admins)
        u.licensee_name,   -- The user's own company name
        u.created_by_admin_id,
        creator.email as creator_email -- Email of the creating admin
      FROM users u
      LEFT JOIN users creator ON u.created_by_admin_id = creator.id
      WHERE 
        -- Condition 1: Include other admins in the same licensee group
        u.usps_license_id = ?
        OR 
        -- Condition 2: Include users created by any admin within that licensee group
        u.created_by_admin_id IN (SELECT id FROM users WHERE usps_license_id = ? AND role = 'ADMIN')
      ORDER BY u.role DESC, u.last_name ASC, u.first_name ASC;
    `;

    // Note: This query fetches users whose created_by_admin_id matches the loggedInAdminId.
    // It does NOT include the admin themselves in this list unless they somehow created themselves.
    // You might want a separate query or logic if admins should also see other admins of the same USPS License ID.

    const [usersCreatedByAdmin] = await connection.execute(query, [adminUspsLicenseId,adminUspsLicenseId]);

    // Map to camelCase and desired frontend structure if necessary
    const formattedUsers = usersCreatedByAdmin.map(user => ({
        id: user.id,
        userId: formatUserId(user.id), // Add userID for frontend reference
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at, // Ensure this is JS Date compatible or format here
         firm: user.licensee_name
    }));

    console.log(`Backend: /api/dashboard/users - Found ${formattedUsers.length} users created by admin_id ${loggedInAdminId}`);
    res.json(formattedUsers);

  } catch (error) {
    console.error('Error fetching users for dashboard (/api/dashboard/users):', error);
    res.status(500).json({ message: 'Failed to fetch users.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ... (rest of your server.js, including login, session-status, logout, other user/admin creation routes) ...







// In server.js (paf-system-backend-node)

// ... (keep existing imports, dbPool, app setup, other routes) ...

app.get('/api/parties', async (req, res) => {
    const partyTypeFilter = req.query.type; // e.g., ?type=LIST_OWNER or ?type=BROKER_AGENT
    // TODO: Add authentication & authorization

    let connection;
    try {
        connection = await dbPool.getConnection();
        let sql = 'SELECT party_id, company_name, party_type, naics_code FROM parties';
        const queryParams = [];

        if (partyTypeFilter) {
            sql += ' WHERE party_type = ?';
            queryParams.push(partyTypeFilter.toUpperCase()); // Ensure consistent casing
        }
        sql += ' ORDER BY company_name';

        const [parties] = await connection.execute(sql, queryParams);
        res.json(parties);

    } catch (error) {
        console.error(`Error fetching parties (type: ${partyTypeFilter || 'all'}):`, error);
        res.status(500).json({ error: 'Failed to fetch parties. An internal error occurred.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// In server.js (paf-system-backend-node)

// Ensure these are at the top of your file if not already

// const jwt =require('jsonwebtoken'); // Uncomment if you implement JWT
// const YOUR_JWT_SECRET = process.env.JWT_SECRET || 'your_strong_jwt_secret_for_dev_only';

// Assuming 'app' and 'dbPool' are already defined
// const app = express();
// const dbPool = mysql.createPool({ ... });

// ... (other routes and middleware) ...


// mypafreact/paf-system-backend-node/server.js

// ... (express, cors, bcrypt, mysql, session imports and setup as previously done) ...


// mypafreact/paf-system-backend-node/server.js
app.get('/api/auth/session-status', (req, res) => {
  if (req.session && req.session.user) {
    console.log('Backend /api/auth/session-status: Active session found for user:', req.session.user);
    return res.status(200).json({ user: req.session.user });
  } else {
    console.log('Backend /api/auth/session-status: No active session.');
    return res.status(401).json({ message: 'Not authenticated', user: null }); // Or just 200 with user: null
  }
});

// mypafreact/paf-system-backend-node/server.js
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error (session destruction):', err);
      return res.status(500).json({ message: 'Could not log out, please try again.' });
    }
    res.clearCookie('connect.sid'); // Default express-session cookie name, adjust if you changed it
    console.log('Backend Logout: Session destroyed.');
    return res.status(200).json({ message: 'Logged out successfully' });
  });
});




app.get('/api/pafs/my-scope', ensureAuthenticated, async (req, res) => {
  const loggedInUser = req.session.user; // User object from session
  console.log(`Backend /api/pafs/my-scope: Called by user ID ${loggedInUser.id}, Role: ${loggedInUser.role}, USPS License ID: ${loggedInUser.uspsLicenseId}`);

  let connection;
  try {
    connection = await pool.getConnection();
    let query = '';
    let queryParams = [];

    if (loggedInUser.role === 'ADMIN') {
      // Admin sees all PAFs under their usps_license_id scope.
      // This includes PAFs created by themselves OR by users they manage (users whose created_by_admin_id points to this admin,
      // and those users' PAFs should have had their licensee_usps_id set to this admin's usps_license_id).
      if (!loggedInUser.uspsLicenseId) {
        console.log("Backend /api/pafs/my-scope: Admin user does not have a USPS License ID. Returning empty list for admin.");
        return res.json([]); // Or handle as an error/specific case
      }
      query = `
        SELECT 
          p.id, p.paf_name, p.status, p.created_at, p.licensee_usps_id,
          u_creator.id as creator_id, 
          u_creator.first_name as creator_first_name, 
          u_creator.last_name as creator_last_name,
          u_creator.email as creator_email
        FROM pafs p
        JOIN users u_creator ON p.created_by_user_id = u_creator.id
        WHERE p.licensee_usps_id = ? 
        ORDER BY p.created_at DESC;
      `;
      queryParams = [loggedInUser.uspsLicenseId];
      console.log(`Backend /api/pafs/my-scope: Admin query for usps_license_id: ${loggedInUser.uspsLicenseId}`);
    } else {
      // Regular user sees only PAFs they created.
      query = `
        SELECT 
          p.id, p.paf_name, p.status, p.created_at, p.licensee_usps_id,
          u_creator.id as creator_id,  -- This will be the loggedInUser.id
          u_creator.first_name as creator_first_name, 
          u_creator.last_name as creator_last_name,
          u_creator.email as creator_email
        FROM pafs p
        JOIN users u_creator ON p.created_by_user_id = u_creator.id -- Join to get creator details (optional here)
        WHERE p.created_by_user_id = ?
        ORDER BY p.created_at DESC;
      `;
      queryParams = [loggedInUser.id];
      console.log(`Backend /api/pafs/my-scope: User query for created_by_user_id: ${loggedInUser.id}`);
    }

    const [pafsFromDb] = await connection.execute(query, queryParams);

    // Map to camelCase for frontend consistency if your DB columns are snake_case
    const formattedPafs = pafsFromDb.map(paf => ({
      id: paf.id,
      pafName: paf.paf_name,
      status: paf.status,
      createdAt: paf.created_at,
      licenseeUspsId: paf.licensee_usps_id,
      creator: { // Nest creator info
          id: paf.creator_id,
          firstName: paf.creator_first_name,
          lastName: paf.creator_last_name,
          email: paf.creator_email
      }
      // ... other fields you want to send ...
    }));

    console.log(`Backend /api/pafs/my-scope: Found ${formattedPafs.length} PAFs.`);
    res.json(formattedPafs);

  } catch (error) {
    console.error('Error fetching PAFs (/api/pafs/my-scope):', error);
    res.status(500).json({ message: 'Failed to fetch PAFs.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// In server.js (paf-system-backend-node)

// ... (keep existing imports, dbPool, app setup, other routes) ...
// POST /api/pafs - Create a new PAF

function formatPafListOwnerId(id) {
  const pafPrefix = process.env.PAF_PREFIX || 'AN';
  const paddedId = String(id).padStart(4, '0'); // 4-digit padded ID
  return `${pafPrefix}${paddedId}`; // Example: "AN0001", "AN0123"
}

function formatUserId(id) {
  const pafPrefix = process.env.PAF_PREFIX || 'AN';
  const paddedId = String(id).padStart(6, '0'); // 6-digit padded ID for users
  return `${pafPrefix}${paddedId}`; // Example: "AN000001", "AN000123"
}

app.post('/api/pafs', ensureAuthenticated, async (req, res) => {
  const loggedInUser = req.session.user;
  const { /* ... all the form fields from req.body ... */
    listOwnerSic, companyName, parentCompany, alternateCompanyName,
    streetAddress, city, state, zipCode, zip4, telephone, faxNumber, urbanization,
    listOwnerCrid, mailerId,
    signerName, signerTitle, signerEmail, dateSigned,
    listName, frequency, notes, customId,
    agentId, agentSignedDate,jurisdiction
  } = req.body;

  console.log(`Backend /api/pafs: Create PAF request by user ID ${loggedInUser.id}`);

  // --- Basic Validation --- (as before)
  if (!companyName || !listName) {
    return res.status(400).json({ message: 'Company Name and List Name are required.' });
  }



  // --- Determine created_by_user_id and licensee_id --- (as before)
  const createdByUserId = loggedInUser.id;
  
  
  
  let licenseeIdForPaf;
  
  licenseeIdForPaf = req.session.user.uspsLicenseId; // Default to the logged-in user's USPS License ID

  console.log("req.session.user",req.session.user);

  console.log(`Backend /api/pafs: Licensee ID for PAF determined as: ${licenseeIdForPaf}`);
  // If the logged-in user is an ADMIN, we use their ID directly.

    // determine if agent associated withthis PAF
    let initialStatus = 'PENDING_LIST_OWNER_APPROVAL'; // The default status
    let agentUser = null; // To hold the agent's details if found


  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    // if agantID not null, then we need to check if the agent exists

      if (agentId) {
      console.log(`Backend /api/pafs: Agent ID ${agentId} was provided. Validating agent...`);
      // 1. Fetch the agent's user record to get their email and verify they exist
      const [agentRows] = await connection.execute('SELECT id, email, first_name, last_name, role FROM users WHERE id = ?', [agentId]);
      
      if (agentRows.length === 0) {
        // If an invalid agentId was sent, reject the request
        await connection.rollback();
        return res.status(400).json({ message: `Invalid Agent ID: User with ID ${agentId} not found.` });
      }

      //found an agent- save him
      agentUser = agentRows[0];
      // Optional: Check if the user's role is actually 'AGENT' or 'BROKER'
      // if (agentUser.role !== 'AGENT' && agentUser.role !== 'BROKER') { ... }

      // 2. Set the new initial status
      initialStatus = 'PENDING_AGENT_APPROVAL';
      console.log(`Backend /api/pafs: Setting initial status to ${initialStatus}`);

    }




    // --- Step 1: Insert PAF record WITHOUT list_owner_id initially ---
    // Build INSERT dynamically based on whether date_signed is provided
    let insertColumns, insertValues, insertParams;
    
    if (dateSigned) {
      // Include date_signed when provided
      insertColumns = `
        licensee_id, created_by_user_id,
        list_owner_sic, company_name, parent_company, alternate_company_name,
        street_address, city, state, zip_code, zip4, telephone, fax_number, urbanization,
        list_owner_crid, mailer_id,
        signer_name, signer_title, signer_email, date_signed,
        list_name, frequency, notes, CustomID,
        agent_id, agent_signed_date,
        status,jurisdiction,paf_type,
         created_at, updated_at`;
      insertValues = `?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()`;
      insertParams = [
        licenseeIdForPaf, createdByUserId,
        listOwnerSic || null, companyName, parentCompany || null, alternateCompanyName || null,
        streetAddress || null, city || null, state || null, zipCode || null, zip4 || null,
        telephone || null, faxNumber || null, urbanization || null,
        listOwnerCrid || null, mailerId || null,
        signerName || null, signerTitle || null, signerEmail || null, dateSigned,
        listName, frequency || null, notes || null, customId || null,
        agentId || null, agentSignedDate || null,
        initialStatus, jurisdiction, 'I'
      ];
    } else {
      // Exclude date_signed when not provided
      insertColumns = `
        licensee_id, created_by_user_id,
        list_owner_sic, company_name, parent_company, alternate_company_name,
        street_address, city, state, zip_code, zip4, telephone, fax_number, urbanization,
        list_owner_crid, mailer_id,
        signer_name, signer_title, signer_email,
        list_name, frequency, notes, CustomID,
        agent_id, agent_signed_date,
        status,jurisdiction,paf_type,
         created_at, updated_at`;
      insertValues = `?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()`;
      insertParams = [
        licenseeIdForPaf, createdByUserId,
        listOwnerSic || null, companyName, parentCompany || null, alternateCompanyName || null,
        streetAddress || null, city || null, state || null, zipCode || null, zip4 || null,
        telephone || null, faxNumber || null, urbanization || null,
        listOwnerCrid || null, mailerId || null,
        signerName || null, signerTitle || null, signerEmail || null,
        listName, frequency || null, notes || null, customId || null,
        agentId || null, agentSignedDate || null,
        initialStatus, jurisdiction, 'I'
      ];
    }

    const insertPafQuery = `INSERT INTO pafs (${insertColumns}) VALUES (${insertValues});`;
    const [result] = await connection.execute(insertPafQuery, insertParams);

    const newPafRecordId = result.insertId; // This is the auto-incremented 'id'

    // --- Step 2: Generate the 6-digit list_owner_id from the newPafRecordId ---
    const generatedListOwnerId = formatPafListOwnerId(newPafRecordId);

    // --- Step 3: Update the PAF record with the generated list_owner_id ---
    const updateQuery = 'UPDATE pafs SET list_owner_id = ? WHERE id = ?';
    await connection.execute(updateQuery, [generatedListOwnerId, newPafRecordId]);

    await connection.commit();

    // --- Step 4: Fetch the complete PAF record to return ---
    const [pafRows] = await connection.execute('SELECT * FROM pafs WHERE id = ?', [newPafRecordId]);
    if (pafRows.length === 0) throw new Error("Failed to retrieve newly created PAF after update.");
    
    // Map to camelCase for frontend
    const createdPaf = {};
    for (const key in pafRows[0]) {
        const camelCaseKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
        createdPaf[camelCaseKey] = pafRows[0][key];
    }

    // If an agent was found, send them the notification email
    if (agentUser) {
      const subject = `Action Required: A new PAF has been assigned to you for approval`;
      const textBody = `Hello ${agentUser.first_name || 'Agent/Broker'},\n\n` +
                     `A new PAF for the list "${req.body.listName}" (Company: ${req.body.companyName}) has been created and assigned to you.\n\n` +
                     `Please log in to the PAF System to review and approve it.\n\n` +
                     `Thank you,\nThe PAF System`;
      const htmlBody = `<p>Hello ${agentUser.first_name || 'Agent/Broker'},</p>` +
                     `<p>A new PAF for the list "<b>${req.body.listName}</b>" (Company: <b>${req.body.companyName}</b>) has been created and assigned to you.</p>` +
                     `<p>Please log in to the PAF System to review and approve it.</p>` +
                     `<p>Thank you,<br/>The PAF System</p>`;
      
      // Send email asynchronously (fire and forget)
      sendEmail(agentUser.email, subject, textBody, htmlBody)
        .then(() => console.log(`Approval notification sent to agent ${agentUser.email} for new PAF ${newPafRecordId}`))
        .catch(emailError => console.error(`Failed to send approval notification to agent ${agentUser.email}:`, emailError));
    }



    res.status(201).json({ message: 'PAF created successfully', paf: createdPaf });

  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch (e) { console.error('Rollback error', e); } }
    console.error('Error creating PAF (/api/pafs):', error);
    res.status(500).json({ message: 'Server error during PAF creation.' });
  } finally {
    if (connection) connection.release();
  }
});

    app.get('/api/user/pafsfetch', async (req, res) => { // MOCK: No auth for now, but you'd add it
        // In a real app, you'd get userId from the authenticated session/token
        // const userId = req.user.userId; // Example if using JWT and authenticateToken middleware
        // const userAssociatedPartyId = req.user.associatedPartyId; // If available
    
        // MOCKING: Let's assume we pass a userId as a query param for testing without auth
        const userIdForQuery = req.query.userId; // e.g., /api/user/pafs?userId=2
        const userAssociatedPartyIdForQuery = req.query.partyId; // e.g., /api/user/pafs?userId=2&partyId=10
    
        console.log(`USER PAFS FETCH: User req` ,req.query);
//       console.log(`USER PAFS FETCH: User req headers` ,req.headers);user/p
//      console.log(`USER PAFS FETCH: User req headers` ,req.headers);

    
        if (!userIdForQuery && !userAssociatedPartyIdForQuery) {
             return res.status(400).json({ error: "User context (userId or partyId) is required for this request." });
        }
    
        let connection;
        try {
            connection = await dbPool.getConnection();
            let pafsQuery;
            let queryParams = [];
    
            // THIS IS A SIMPLIFIED LOGIC FOR DEMONSTRATION.
            // Real association logic might be more complex based on user roles and party links.
            // You'd likely have the user's associated party_id from their user record
            // or their role to determine how to query.
    
            // Scenario 1: User is directly associated with a Party (e.g., represents a List Owner)
            if (userAssociatedPartyIdForQuery) {
                pafsQuery = `
                    SELECT
                        p.paf_id AS internalDbId, p.licensee_assigned_paf_id AS pafId,
                        lo_party.company_name AS listOwner,
                        p.jurisdiction, p.current_status AS status, p.date_issued AS lastUpdated,
                        p.list_owner_signature_date, p.list_owner_id, p.licensee_signature_date, p.effective_date, p.calculated_expiration_date
                    FROM pafs p
                    JOIN parties lo_party ON p.list_owner_id = lo_party.party_id
                    WHERE p.list_owner_id = ?  -- Assuming user is directly linked to the list owner party
                       OR p.list_administrator_id = ?
                       OR EXISTS (SELECT 1 FROM paf_brokers pb WHERE pb.paf_id = p.paf_id AND pb.broker_party_id = ?)
                    ORDER BY p.date_issued DESC, p.paf_id DESC
                    LIMIT 20; 
                `;
                // This query assumes the partyId passed is the one to check against list_owner, list_admin, or broker.
                // A more robust solution would get the logged-in user's actual associated party_id from their user record.
                queryParams = [userAssociatedPartyIdForQuery, userAssociatedPartyIdForQuery, userAssociatedPartyIdForQuery];
            } else {
                // Fallback or different logic if only userId is available (less common for PAF association)
                // This part would need significant thought based on your data model.
                // For now, let's return an empty array if no partyId is directly associated for simplicity.
                console.warn("Querying user PAFs without a direct partyId association - returning empty for mock.");
                return res.json([]);
            }
    
    
            const [pafsData] = await connection.execute(pafsQuery, queryParams);
            res.json(pafsData);
    
        } catch (error) {
            console.error('Error fetching user-specific PAFs:', error);
            res.status(500).json({ error: 'Failed to fetch PAFs. An internal error occurred.' });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    });
    
// In server.js (paf-system-backend-node)
app.post('/api/pafs/:pafDbId/approve', async (req, res) => {
    const { pafDbId } = req.params;
    const {
        signerName,       // Printed name of the signer
        signerTitle,      // Title of the signer
        signatureMethod,  // 'type', 'draw', 'upload'
        signatureData,    // Typed name, base64 image data, or reference to uploaded file
        rtdAcknowledged   // Boolean
    } = req.body;

    console.log(`Backend /api/pafs/${pafDbId}/approve: Approving PAF with ID ${pafDbId} by List Owner`, req.body);


    if (!signerName || !signerTitle || signatureMethod === undefined || !rtdAcknowledged) {
        return res.status(400).json({ error: 'Missing required approval information (signer, title, signature method, RTD acknowledgment).' });
    }
    if (signatureMethod === 'type' && !signatureData) {
         return res.status(400).json({ error: 'Typed signature name is required.' });
    }
    // Add more validation for signatureData based on method if needed

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

 //       console.log(`Backend /api/pafs/${pafDbId}/approve: Approving PAF with ID ${pafDbId} by List Owner`, req.body);  
   
 
      // 1. Fetch current PAF to ensure it's in the correct status (e.g., PENDING_LIST_OWNER_APPROVAL)
        const [currentPafs] = await connection.execute("SELECT * FROM pafs WHERE id = ?", [pafDbId]);
        if (currentPafs.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "PAF not found." });
        }
        const currentPaf = currentPafs[0];
        if (currentPaf.status !== 'PENDING_LIST_OWNER_APPROVAL') {
            await connection.rollback();
            return res.status(400).json({ error: `PAF is not currently pending List Owner signature. Current status: ${currentPaf.current_status}` });
        }

        const signatureDate = new Date();
        let nextStatus = '';

    let sigdata = signatureData;
    let signatureDbPath = null;
    if (signatureMethod === 'draw' && signatureData) {

      console.log(`Backend /api/pafs/${pafDbId}/approve: Signature method is 'draw'. Processing base64 signature data.`);
      
      // Parse base64 data URL (e.g., "data:image/png;base64,iVBOR...")
      const matches = signatureData.match(/^data:(.+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new Error('Invalid signature data format.');
      }

    

      console.log(`Backend /api/pafs/${pafDbId}/approve: Signature data parsed successfully.`);

      const imageBuffer = Buffer.from(matches[2], 'base64');
      const fileName = `${uuidv4()}.png`;
      const directoryPath = path.join(__dirname, 'public', 'signatures');
      const filePath = path.join(directoryPath, fileName);
      
      // The path to store in the database is the web-accessible URL path
      signatureDbPath = `/signatures/${fileName}`;



      console.log(`Signature image file: ${filePath}`);

      // Ensure directory exists and write the file
//      await fs.mkdir(directoryPath, { recursive: true });

      console.log(`Signature path: ${directoryPath}`);

      await fs.writeFile(filePath, imageBuffer);

      console.log(`Signature image saved to: ${filePath}`);

      sigdata = filePath;
    } else {
        // Handle typed signatures or other methods if needed
        signatureDbPath = `typed:${signerName}`;
    }


        // Determine next status based on jurisdiction (simplified)
        if (currentPaf.jurisdiction === 'FOREIGN') {
            // Assuming LOI was already handled or is next step before USPS approval
            nextStatus = 'PENDING_USPS_APPROVAL_FOREIGN_ONLY'; // Or PENDING_LICENSEE_SIGNATURE if that's next
        } else { // US
            nextStatus = 'PENDING_LICENSEE_VALIDATION_US_ONLY'; // Or PENDING_LICENSEE_SIGNATURE
        }

        console.log(`Backend /api/pafs/${pafDbId}/approve: Next status determined as ${nextStatus}`);

        console.log("sigdata",sigdata);
        // 2. Update the PAF table
        // TODO: Store signatureData appropriately.
        // If 'draw', signatureData is base64 - store in a TEXT field or as a file.
        // If 'upload', signatureData might be a file path after handling upload - store path.
        // For 'type', signatureData is the typed name.
        // Add columns to `pafs` table: list_owner_signer_name, list_owner_signer_title, list_owner_signature_method, list_owner_signature_data
        const updatePafSql = `
            UPDATE pafs
            SET
                list_owner_signature_date = ?,
                status = ?,
                list_owner_signer_name = ?,    -- New column
                list_owner_signer_title = ?,   -- New column
                list_owner_signature_method = ?, -- New column
                list_owner_signature_data = ?, -- New column (TEXT type recommended for base64/paths)
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?;
        `;
        await connection.execute(updatePafSql, [
            signatureDate, nextStatus, signerName, signerTitle,
            signatureMethod, sigdata, // Store the signature data
            pafDbId
        ]);

        // 3. Add to paf_status_history
        const historyNotes = `List Owner approved. Signer: ${signerName}, Title: ${signerTitle}, Method: ${signatureMethod}. RTD Acknowledged.`;
        await connection.execute(
            'INSERT INTO paf_status_history (paf_id, status, notes, changed_at) VALUES (?, ?, ?, ?)',
            [Number(pafDbId), nextStatus, historyNotes, signatureDate]
        );

        await connection.commit();
        res.json({ message: `PAF ID ${pafDbId} approved successfully by List Owner. Status updated to ${nextStatus}.` });

  // --- 6. Send Email Notification to the Admin ---

  console.log("Backend /api/pafs/${pafDbId}/approve: Sending email- currentpaf",currentPaf);

    const licenseeAdminId = currentPaf.licensee_id;
    if (licenseeAdminId) {
      const [adminUserRows] = await connection.execute('SELECT email, first_name FROM users WHERE usps_license_id = ? AND role = \'ADMIN\'', [licenseeAdminId]);
      
      if (adminUserRows.length > 0) {
        const adminToNotify = adminUserRows[0];
        
        const subject = `PAF Ready for Licensee Validation - ID: ${currentPaf.list_owner_id}`;
        const textBody = `Hello ${adminToNotify.first_name || 'Admin'},\n\n` +
                       `A PAF (List Owner ID: ${currentPaf.list_owner_id}, List Name: ${currentPaf.list_name}) has been approved by the list owner contact and is now ready for your validation.\n\n` +
                       `Please log in to the PAF System to review and process it.\n\n` +
                       `Thank you.`;
        const htmlBody = `<p>Hello ${adminToNotify.first_name || 'Admin'},</p>` +
                       `<p>A PAF (List Owner ID: <strong>${currentPaf.list_owner_id}</strong>, List Name: <em>${currentPaf.list_name}</em>) has been approved by the list owner contact and is now ready for your validation.</p>` +
                       `<p>Please log in to the PAF System to review and process it.</p>` +
                       `<p>Thank you.</p>`;
        
        // Call the email service (fire and forget)
        sendEmail(adminToNotify.email, subject, textBody, htmlBody)
          .then(() => console.log(`Notification email for PAF ${currentPaf} sent successfully to admin ${adminToNotify.email}.`))
          .catch(emailError => console.error(`Failed to send notification email for PAF ${currentPaf} to admin ${adminToNotify.email}:`, emailError));
      } else {
        console.warn(`Could not find admin with ID ${licenseeAdminId} to notify for PAF ${currentPaf}.`);
      }
    } else {
      console.warn(`PAF ${currentPaf} does not have a licensee_id. Cannot send notification.`);
    }



    } catch (error) {
        console.error(`Error approving PAF ${pafDbId}:`, error);
        if (connection) await connection.rollback();
        res.status(500).json({ error: 'Failed to approve PAF.', details: error.message });
    } finally {
        if (connection) connection.release();
    }
});


// In server.js (paf-system-backend-node)

// ... (keep existing imports, dbPool, app setup, other routes) ...

// --- API Endpoint to Fetch Details of a Specific PAF ---
app.get('/api/pafs/details/:pafDbId', async (req, res) => {
    const { pafDbId } = req.params;
    // TODO: Add authentication & authorization if this data is sensitive

    if (!pafDbId || isNaN(parseInt(pafDbId))) {
        return res.status(400).json({ error: 'Valid PAF ID is required.' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log(`PAF DETAIL FETCH: Connection obtained for PAF ID: ${pafDbId}`);

        // Query to get PAF details, joining with parties for names, and also history
        const pafDetailSql = `
            SELECT
                p.paf_id AS internalDbId,
                p.licensee_assigned_paf_id AS pafIdDisplay,
                p.list_owner_id,
                lo_party.company_name AS listOwnerName,
                lo_party.address_line1 AS listOwnerAddress1,
                lo_party.city AS listOwnerCity,
                lo_party.state AS listOwnerState,
                lo_party.zip_code AS listOwnerZip,
                lo_party.naics_code AS listOwnerNaics,
                p.licensee_id,
                li_party.company_name AS licenseeName,
                p.list_administrator_id,
                la_party.company_name AS listAdminName,
                (SELECT GROUP_CONCAT(b_party.company_name SEPARATOR ', ')
                    FROM paf_brokers pb
                    JOIN parties b_party ON pb.broker_party_id = b_party.party_id
                    WHERE pb.paf_id = p.paf_id) AS brokerNamesConcatenated,
                p.paf_type AS pafType,
                p.jurisdiction,
                p.current_status AS status,
                p.is_multiple_lists AS isMultipleLists,
                p.date_issued,
                p.list_owner_signature_date,
                p.list_owner_signer_name,
                p.list_owner_signer_title,
                p.list_owner_signature_method,
                -- p.list_owner_signature_data, -- Decide if you want to send this potentially large data
                p.licensee_signature_date,
                -- Add licensee signer details if you have them
                p.usps_approval_date,
                p.effective_date,
                p.calculated_expiration_date,
                p.created_at,
                p.updated_at,
                p.processing_frequency_code 
                
            FROM pafs p
            JOIN parties lo_party ON p.list_owner_id = lo_party.party_id
            JOIN parties li_party ON p.licensee_id = li_party.party_id
            LEFT JOIN parties la_party ON p.list_administrator_id = la_party.party_id
            WHERE p.paf_id = ?;
        `;

        console.log("PAF DETAIL FETCH: Executing PAF detail SQL for ID:", pafDbId);
        const [pafRows] = await connection.execute(pafDetailSql, [pafDbId]);

        if (pafRows.length === 0) {
            console.log(`PAF DETAIL FETCH: PAF not found for ID: ${pafDbId}`);
            return res.status(404).json({ error: 'PAF not found.' });
        }
        const pafDetail = pafRows[0];
        console.log("PAF DETAIL FETCH: PAF detail query executed successfully.");

        // Fetch status history for this PAF
        const historySql = `
            SELECT status, notes, changed_at, changed_by_user_id -- (you might join users table for changed_by name)
            FROM paf_status_history
            WHERE paf_id = ?
            ORDER BY changed_at DESC;
        `;
        console.log("PAF DETAIL FETCH: Executing status history SQL for PAF ID:", pafDbId);
        const [historyRows] = await connection.execute(historySql, [pafDbId]);
        console.log("PAF DETAIL FETCH: Status history query executed successfully, count:", historyRows.length);

        pafDetail.statusHistory = historyRows; // Add history to the PAF detail object

        // Fetch associated brokers separately if GROUP_CONCAT is problematic or you need more broker details
        const brokersSql = `
            SELECT b_party.party_id, b_party.company_name, b_party.naics_code
            FROM paf_brokers pb
            JOIN parties b_party ON pb.broker_party_id = b_party.party_id
            WHERE pb.paf_id = ?;
        `;
        console.log("PAF DETAIL FETCH: Executing brokers SQL for PAF ID:", pafDbId);
        const [brokerRows] = await connection.execute(brokersSql, [pafDbId]);
        console.log("PAF DETAIL FETCH: Brokers query executed successfully, count:", brokerRows.length);

        pafDetail.brokers = brokerRows; // Add list of broker objects

        res.json(pafDetail);

    } catch (error) {
        console.error(`FULL ERROR fetching detail for PAF ID ${pafDbId}:`, error);
        res.status(500).json({ error: 'Failed to fetch PAF details. An internal server error occurred.', details: error.message });
    } finally {
        if (connection) {
            console.log(`PAF DETAIL FETCH: Releasing connection for PAF ID: ${pafDbId}`);
            connection.release();
        }
    }
});


// mypafreact/paf-system-backend-node/server.js
// ... (imports, ensureAuthenticated middleware as defined before) ...

app.get('/api/pafs/my-pafs', ensureAuthenticated, async (req, res) => {
  const loggedInUser = req.session.user;
  console.log(`Backend /api/pafs/my-pafs: Called by user ID ${loggedInUser.id}, Role: ${loggedInUser.role}`);

  console.log(`Backend /api/pafs/my-pafs: User details`, loggedInUser);
  let connection;
  try {
    connection = await dbPool.getConnection();
    let query = '';
    let queryParams = [];

    if (loggedInUser.role === 'ADMIN') {
      // Admin sees all PAFs associated with their licensee_id (which is their own user.id in the pafs table context)
      // This means any PAF where pafs.licensee_id = loggedInUser.id
      query = `
        SELECT 
          p.*, -- Select all columns from pafs table
          u_creator.first_name AS creator_first_name, 
          u_creator.last_name AS creator_last_name,
          u_creator.email AS creator_email,
          u_licensee.licensee_name AS paf_licensee_name, -- Name of the licensee associated with the PAF
          u_licensee.usps_license_id AS paf_licensee_usps_id -- USPS ID of the licensee for the PAF
        FROM pafs p
        JOIN users u_creator ON p.created_by_user_id = u_creator.id
        LEFT JOIN users u_licensee ON p.licensee_id = u_licensee.id -- To get licensee name/USPS ID
        WHERE p.licensee_id = ? 
        ORDER BY p.created_at DESC;
      `;
      queryParams = [loggedInUser.uspsLicenseId]; // Admin's own user.id is the licensee_id for their scope
      console.log(`Backend /api/pafs/my-pafs: Admin query for licensee_id: ${loggedInUser.id}`);

    } else { // Regular user
      // Regular user sees only PAFs they personally created
      query = `
        SELECT 
          p.*, 
          u_creator.first_name AS creator_first_name, -- This will be the loggedInUser's name
          u_creator.last_name AS creator_last_name,
          u_creator.email AS creator_email,
          u_licensee.licensee_name AS paf_licensee_name,
          u_licensee.usps_license_id AS paf_licensee_usps_id
        FROM pafs p
        JOIN users u_creator ON p.created_by_user_id = u_creator.id
        LEFT JOIN users u_licensee ON p.licensee_id = u_licensee.id
        WHERE p.created_by_user_id = ? or p.agent_id = ? 
        ORDER BY p.created_at DESC;
      `;
      queryParams = [loggedInUser.id,loggedInUser.id];
      console.log(`Backend /api/pafs/my-pafs: User query for created_by_user_id: ${loggedInUser.id,loggedInUser.id }`);
    }

    const [pafsFromDb] = await connection.execute(query, queryParams);

    // Map to camelCase for frontend consistency
    const formattedPafs = pafsFromDb.map(paf => {
        const mappedPaf = {};
        for (const key in paf) {
            const camelCaseKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
            mappedPaf[camelCaseKey] = paf[key];
        }
        // Structure creator and licensee info if you prefer nested objects
        // For now, keeping it flat as per the SELECT aliases
        return mappedPaf;
    });

    console.log(`Backend /api/pafs/my-pafs: Found ${formattedPafs.length} PAFs.`);
    res.json(formattedPafs);

  } catch (error) {
    console.error('Error fetching user PAFs (/api/pafs/my-pafs):', error);
    res.status(500).json({ message: 'Failed to fetch PAFs.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Fetch PAFs for a specific user (User Dashboard)
app.get('/api/user/pafs', authenticateUser, async (req, res) => { // Protected
    if (!req.user) { // Should be caught by authenticateUser if it enforces auth
        return res.status(401).json({ error: 'Unauthorized: User context required.' });
    }
    const userAssociatedPartyId = req.user.id;
    // const partyIdFromQuery = req.query.partyId; // Can be used if frontend sends it for some reason
    // const effectivePartyId = userAssociatedPartyId || partyIdFromQuery;
      console.log(`USER PAFS FETCH: User req` ,req.user);
  
    if (!userAssociatedPartyId) {
        console.log(`USER PAFS FETCH: User ${req.user.email} ID.`);
        return res.json({ pafs: [], totalPafs: 0, currentPage: 1, totalPages: 0 });
    }

    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const pafsQuery = `
            SELECT p.paf_id AS internalDbId, p.licensee_assigned_paf_id AS pafId,
                   lo_party.company_name AS listOwner, p.list_owner_id, /* Important for approve button */
                   p.jurisdiction, p.current_status AS status, p.date_issued,
                   p.calculated_expiration_date,
                   GREATEST(p.created_at, IFNULL(p.updated_at, p.created_at)) AS lastUpdatedSortable,
                   p.updated_at, p.created_at
            FROM pafs p
            JOIN parties lo_party ON p.list_owner_id = lo_party.party_id
            LEFT JOIN paf_brokers pb ON p.paf_id = pb.paf_id
            WHERE p.list_owner_id = ? OR p.list_administrator_id = ? OR pb.broker_party_id = ?
            GROUP BY p.paf_id
            ORDER BY lastUpdatedSortable DESC LIMIT ? OFFSET ?;`;
        const queryParams = [userAssociatedPartyId, userAssociatedPartyId, userAssociatedPartyId, limit, offset];
        const [pafsData] = await connection.execute(pafsQuery, queryParams);

        const countSql = `SELECT COUNT(DISTINCT p.paf_id) as totalPafs FROM pafs p LEFT JOIN paf_brokers pb ON p.paf_id = pb.paf_id WHERE p.list_owner_id = ? OR p.list_administrator_id = ? OR pb.broker_party_id = ?;`;
        const countParams = [userAssociatedPartyId, userAssociatedPartyId, userAssociatedPartyId];
        const [[{ totalPafs }]] = await connection.execute(countSql, countParams);

        const transformedPafs = pafsData.map(paf => ({ /* ... transform ... */
            ...paf,
            lastUpdated: paf.updated_at ? new Date(paf.updated_at).toLocaleDateString() : (paf.date_issued ? new Date(paf.date_issued).toLocaleDateString() : (paf.created_at ? new Date(paf.created_at).toLocaleDateString() : 'N/A')),
        }));
        res.json({ pafs: transformedPafs, totalPafs, currentPage: page, totalPages: Math.ceil(totalPafs / limit) });
    } catch (error) { /* ... error handling ... */
        console.error(`Error fetching user PAFs for partyId ${userAssociatedPartyId}:`, error);
        res.status(500).json({ error: 'Failed to fetch user PAFs.' });
    } finally { if (connection) connection.release(); }
});



// mypafreact/paf-system-backend-node/server.js
// ... (imports, ensureAuthenticated middleware, pool setup, other routes) ...

app.get('/api/pafs/:id', ensureAuthenticated, async (req, res) => {
  const loggedInUser = req.session.user; // For authorization checks
  const pafIdToFetch = parseInt(req.params.id, 10); // Get PAF ID from URL parameter and parse as integer

  console.log(`Backend /api/pafs/${pafIdToFetch}: Request by user ID ${loggedInUser}`);
 
  if (isNaN(pafIdToFetch)) {
    return res.status(400).json({ message: 'Invalid PAF ID format.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();

    // Query to fetch the specific PAF and include relevant related user details
    // We join with users table for creator, licensee admin, and agent details
    const query = `
      SELECT 
        p.*, -- Select all columns from pafs table
        u_creator.first_name AS creator_first_name, 
        u_creator.last_name AS creator_last_name,
        u_creator.email AS creator_email,

        u_licensee.first_name AS licensee_first_name,
        u_licensee.last_name AS licensee_last_name,
        u_licensee.email AS licensee_email,
        u_licensee.licensee_name AS paf_licensee_company_name, -- The company name from the licensee admin's user record
        u_licensee.usps_license_id AS paf_licensee_usps_id,    -- The USPS ID from the licensee admin's user record

        u_agent.first_name AS agent_first_name,
        u_agent.last_name AS agent_last_name,
        u_agent.email AS agent_email
      FROM pafs p
      JOIN users u_creator ON p.created_by_user_id = u_creator.id
      LEFT JOIN users u_licensee ON p.licensee_id = u_licensee.id 
      LEFT JOIN users u_agent ON p.agent_id = u_agent.id
      WHERE p.id = ?;
    `;

    const [pafsFromDb] = await connection.execute(query, [pafIdToFetch]);

    if (pafsFromDb.length === 0) {
      console.log(`Backend /api/pafs/${pafIdToFetch}: PAF not found.`);
      return res.status(404).json({ message: 'PAF not found.' });
    }

    const pafDetail = pafsFromDb[0];

    
    // --- Authorization Check (Crucial!) ---
    // An admin can see any PAF under their licensee_id (which is their own user.id for this PAF).
    // A regular user can only see PAFs they created OR PAFs linked to their creating admin's scope.
    let authorized = false;
    if (loggedInUser.role === 'ADMIN') {
      // Admin can see if the PAF's licensee_id matches their own user.id
   
        authorized = true;
     
    } else { // Regular user
      // User can see if they created it OR if it belongs to their admin's scope
      if (pafDetail.created_by_user_id === loggedInUser.id) {
        authorized = true;
      } else if (pafDetail.licensee_id === loggedInUser.created_by_admin_id) {
        // Check if PAF's licensee scope matches the user's creating admin
        authorized = true;
      }
      else if (pafDetail.agent_id === loggedInUser.id)
      {
        authorized = true; // If the user is an agent, they can view PAFs they are associated with
      }
    }

    if (!authorized) {

      console.log(`Backend /api/pafs/${pafIdToFetch}: User ID ${loggedInUser.id} (Role: ${loggedInUser.role}) not authorized to view this PAF.`);
      return res.status(403).json({ message: 'Forbidden: You are not authorized to view this PAF.' });
    }

    // Map to camelCase for frontend consistency
    const formattedPafDetail = {};
    for (const key in pafDetail) {
        const camelCaseKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
        formattedPafDetail[camelCaseKey] = pafDetail[key];
    }
    // You might want to structure related user details into nested objects
    // e.g., creator: { firstName: ..., lastName: ... }, licenseeAdmin: { ... }, agent: { ... }


    console.log(`Backend /api/pafs/${pafIdToFetch}: PAF details fetched successfully.`);
    res.json(formattedPafDetail);

  } catch (error) {
    console.error(`Error fetching PAF details for ID ${pafIdToFetch} (/api/pafs/:id):`, error);
    res.status(500).json({ message: 'Failed to fetch PAF details.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});



// In server.js (paf-system-backend-node)

// REMOVE or DO NOT USE this global constant if the Platform ID comes from the user:
// const SYSTEM_LICENSEE_PLATFORM_ID = 'ABCD'; // No longer using a global one

// mypafreact/paf-system-backend-node/server.js
// ... (express, cors, mysql, session imports and setup) ...
// Ensure app.use(session(...)) and app.use(cors(...)) are configured correctly.
// No specific authentication like ensureAuthenticated or authenticateAdmin is strictly needed
// for this validation endpoint if it's just checking for existence, but you could add it
// if you only want logged-in users/admins to be able to perform this check.


// mypafreact/paf-system-backend-node/server.js
// ... (express, cors, mysql, session imports and setup) ...
// Ensure your authenticateAdmin middleware is defined and working

//const authenticateAdmin = (req, res, next) => { /* ... as defined before ... */ };

// PUT /api/pafs/:pafId/validate-licensee - Admin validates/approves a PAF
app.put('/api/pafs/:pafId/validate-licensee', authenticateAdmin, async (req, res) => {
 
 // console.log(`Backend /api/pafs/${pafIdToValidate}/validate-licensee: Request by admin ID ${loggedInAdmin.id}`);
 // console.log(`Backend /api/pafs/${pafIdToValidate}/validate-licensee: Payload:`, req.body);

 
    const pafIdToValidate = parseInt(req.params.pafId, 10);
  const loggedInAdmin = req.session.user; // Admin performing the action

  // Optional: Get notes or other data from request body
  const { validationNotes, approvalDate } = req.body; // e.g., approvalDate might be sent by client or set here

 

  if (isNaN(pafIdToValidate)) {
    return res.status(400).json({ message: 'Invalid PAF ID format.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    // 1. Fetch the PAF to ensure it exists and check its current status and licensee scope
    const [pafRows] = await connection.execute('SELECT * FROM pafs WHERE id = ?', [pafIdToValidate]);
    if (pafRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: `PAF with ID ${pafIdToValidate} not found.` });
    }
    const pafToValidate = pafRows[0];

    console.log(`Backend .../validate-licensee: PAF to validate`, pafToValidate);
    console.log(`Backend .../validate-licensee: Admin performing validation`, loggedInAdmin);


    const pafCreator = pafToValidate.created_by_user_id;
    const adminID = loggedInAdmin.id; 

    console.log(`Backend .../validate-licensee: PAF Creator ID: ${pafCreator}, Admin ID: ${adminID}`);

    // Authorization: Ensure this admin is responsible for this PAF's licensee scope
    // The pafToValidate.licensee_id should match the loggedInAdmin.id
    // (This assumes an admin's own user.id is stored as the licensee_id on the PAFs they oversee)
    if (pafToValidate.licensee_id !== loggedInAdmin.uspsLicenseId) {
      await connection.rollback();
      console.log(`Backend .../validate-licensee: Admin ID ${loggedInAdmin.id} not authorized for PAF ID ${pafIdToValidate} which has licensee_id ${pafToValidate.licensee_id}`);
      return res.status(403).json({ message: 'Forbidden: You are not authorized to validate this PAF.' });
    }

    // 2. Check if the PAF is in the correct state for this action
    // The frontend might also check this, but backend should always validate.
    if (pafToValidate.status !== 'PENDING_LICENSEE_VALIDATION_US_ONLY' && (pafCreator != adminID)) {
      await connection.rollback();
      return res.status(400).json({ message: `PAF is not in the correct state for licensee validation. Current status: ${pafToValidate.status}` });
    }

    // --- NEW LOGIC: Calculate Expiration Date ---
    const approvalDate = new Date(); // Get current date
    const expirationDate = new Date(approvalDate);
    expirationDate.setFullYear(expirationDate.getFullYear() + 1); // Set it to one year in the future

    // Format to YYYY-MM-DD for MySQL DATE column
    const expirationDateForDb = expirationDate.toISOString().split('T')[0];
    console.log(`Backend .../validate-licensee: Calculated expiration date: ${expirationDateForDb}`);
    // --- END OF NEW LOGIC ---

   // --- 1. Construct the full_paf_id based on the standard PAF ID definition ---
    const platformId = (pafToValidate.licensee_id || '    ').padEnd(4, ' ');      // Bytes 1-4: Your 4-char Platform ID from .env
    const naicsCode = (pafToValidate.list_owner_sic || '      ').padEnd(6, ' ');      // Bytes 5-10: 6-digit NAICS code
    const frequency = (pafToValidate.frequency || '99').padStart(2, '0');              // Bytes 11-12: 2-digit frequency
    const uniqueId = (pafToValidate.list_owner_id || '      ').padEnd(6, ' ');        // Bytes 13-18: Your 6-char unique ID (list_owner_id)

    const fullPafId = `${platformId}${naicsCode}${frequency}${uniqueId}`.substring(0, 18); // Assemble and ensure it's exactly 18 chars

    console.log(`Backend .../validate-licensee: Generated full_paf_id: "${fullPafId}"`);
    console.log(`(Breakdown: Platform='${platformId}', NAICS='${naicsCode}', Freq='${frequency}', UniqueID='${uniqueId}')`);






    // 3. Update the PAF status and potentially other fields
    const newStatus = 'LICENSEE_VALIDATED'; // Or 'PENDING_NCOA_PROCESSING', 'ACTIVE', etc.
    const validatedAt = new Date(); // Timestamp of validation

    const updateQuery = `
      UPDATE pafs 
      SET 
        status = ?, 
        -- licensee_validation_notes = ?, -- If you add a column for this
        -- licensee_validated_by_user_id = ?, -- Audit who validated it
        -- licensee_validated_at = ?, -- Audit timestamp
        updated_at = NOW(),
        expiration = ?,
        full_paf_id = ? -- <<< Set the new expiration date
 
      WHERE id = ?;
    `;

    console.log(`Backend  -sql statement:`, updateQuery); 
    // For this example, just updating status. Add other fields as needed.
    await connection.execute(updateQuery, [
      newStatus,
      // validationNotes || null, // Example if you add notes
      // loggedInAdmin.id,       // Example for audit
      // validatedAt,            // Example for audit
      expirationDate,
      fullPafId, // Set the new full_paf_id
      
      pafIdToValidate
    ]);

    // 4. OPTIONAL: Add a record to `paf_status_history`
    // Ensure paf_status_history table exists and its paf_id references pafs.id correctly

    // You might want to include more details in the history record

    const historyNotes = `Licensee validation completed by admin: ${loggedInAdmin.email}. Notes: ${validationNotes || 'N/A'}`;


    console.log(`Backend .../validate-licensee: Adding history record for PAF ID `,pafIdToValidate,newStatus,historyNotes,loggedInAdmin);


    const historyQuery = `
      INSERT INTO paf_status_history (paf_id, status,  changed_by_user_id,notes, changed_at) 
      VALUES (?, ?, ?,?,  NOW());
    `;
    await connection.execute(historyQuery, [
      pafIdToValidate,
      newStatus,
      loggedInAdmin.id,
      historyNotes,
      
    ]);

    await connection.commit();

    // 5. Fetch the updated PAF to return it
    const [updatedPafRows] = await connection.execute('SELECT * FROM pafs WHERE id = ?', [pafIdToValidate]);
    
    // Map to camelCase
    const updatedPaf = {};
    for (const key in updatedPafRows[0]) {
        const camelCaseKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
        updatedPaf[camelCaseKey] = updatedPafRows[0][key];
    }

    console.log(`Backend .../validate-licensee: PAF ID ${pafIdToValidate} status updated to ${newStatus} by admin ID ${loggedInAdmin.id}`);
    res.status(200).json({ message: 'PAF licensee validation successful.', paf: updatedPaf });

  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch (e) { console.error('Rollback error', e); } }
    console.error(`Error validating PAF ID ${pafIdToValidate} by licensee:`, error);
    res.status(500).json({ message: 'Server error during PAF licensee validation.' });
  } finally {
    if (connection) connection.release();
  }
});






app.get('/api/licensees/validate-usps-id/:uspsLicenseId', async (req, res) => {
  const { uspsLicenseId } = req.params;

  console.log("Backend /api/licensees/validate-usps-id",req.params);

  console.log(`Backend /api/licensees/validate-usps-id: Validating USPS License ID: '${uspsLicenseId}'`);

  if (!uspsLicenseId || uspsLicenseId.trim() === '') {
    return res.status(400).json({ message: 'USPS License ID is required.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();

    // Query to check if this usps_license_id exists in the users table
    // We are interested if any user (typically an ADMIN) has this usps_license_id.
    const query = 'SELECT id, email, first_name, last_name, licensee_name FROM users WHERE usps_license_id = ?';
    const [usersWithLicenseId] = await connection.execute(query, [uspsLicenseId.trim()]);

    if (usersWithLicenseId.length > 0) {
      // USPS License ID already exists and is associated with one or more users.
      // You might return details of the first user found, or just an existence flag.
      console.log(`Backend /api/licensees/validate-usps-id: USPS License ID '${uspsLicenseId}' FOUND, associated with user ID: ${usersWithLicenseId[0].id}`);
      return res.status(200).json({
        exists: true,
        message: `USPS License ID '${uspsLicenseId}' is already registered.`,
        // Optionally, return some non-sensitive details of the associated admin/licensee
        associatedUser: {
            userId: usersWithLicenseId[0].id,
            email: usersWithLicenseId[0].email,
            firstName: usersWithLicenseId[0].first_name,
            lastName: usersWithLicenseId[0].last_name,
            licenseeName: usersWithLicenseId[0].licensee_name
        }
      });
    } else {
      // USPS License ID does not exist in the users table.
      console.log(`Backend /api/licensees/validate-usps-id: USPS License ID '${uspsLicenseId}' NOT FOUND.`);
      return res.status(200).json({ // Send 200 OK with exists: false
        exists: false,
        message: `USPS License ID '${uspsLicenseId}' is available.`
      });
    }

  } catch (error) {
    console.error(`Error validating USPS License ID '${uspsLicenseId}':`, error);
    res.status(500).json({ message: 'Server error during USPS License ID validation.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ... (your other routes: /api/auth/login, /api/pafs/*, etc.) ...
// ... (app.listen) ...


app.post('/api/pafs/:pafDbId/licensee-validate', authenticateUser, async (req, res) => {
    
     const { pafDbId } = req.params;
    const {
        signerName, // Name of the admin/licensee rep validating
        signerTitle,  // Title of the admin/licensee rep
        signatureMethod = 'SYSTEM_CONFIRMATION',
        signatureData,
        licenseeUniqueIdPart // Optional 6-char unique ID part from admin
    } = req.body;

    console.log(`LICENSEE VALIDATE: Validating PAF with ID ${pafDbId} by Licensee Admin`, req.body);
    console.log(`LICENSEE VALIDATE: User details`, req.session.user);

    if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    // CRITICAL: Get the 4-character Licensee Platform ID from the authenticated user
    const userLicenseePlatformId = req.user.system_usps_license_id; // Assuming this field on req.user holds the 4-char PLATFORM ID

    if (!userLicenseePlatformId || userLicenseePlatformId.length !== 4) {
        console.error("LICENSEE VALIDATE: Admin user is missing a valid 4-character Licensee Platform ID.", req.user);
        return res.status(500).json({ error: 'System configuration error: Admin user not linked to a valid Licensee Platform ID.' });
    }


    if (!pafDbId || isNaN(parseInt(pafDbId))) { /* ... bad request ... */ }
    if (!signerName || !signerTitle) { /* ... bad request ... */ }
    if (licenseeUniqueIdPart && licenseeUniqueIdPart.length !== 6) { /* ... bad request ... */ }

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        const [currentPafs] = await connection.execute(
            `SELECT p.current_status, p.jurisdiction, p.licensee_id, p.paf_type,
                    p.list_owner_id, p.processing_frequency_code,
                    lo_party.naics_code AS list_owner_naics
             FROM pafs p
             JOIN parties lo_party ON p.list_owner_id = lo_party.party_id
             WHERE p.paf_id = ?`,
            [pafDbId]
        );
        if (currentPafs.length === 0) { /* ... PAF not found, rollback ... */
            await connection.rollback();
            return res.status(404).json({ error: "PAF not found." });
        }
        const currentPaf = currentPafs[0];

        console.log(`LICENSEE VALIDATE: Current PAF status: ${currentPaf.current_status}, Jurisdiction: ${currentPaf.jurisdiction}, Licensee ID: ${currentPaf.licensee_id}`);
        // ... (Status check logic: expectedPreviousStatus, nextStatus) ...
        let expectedPreviousStatus;
        let nextStatus;
        if (currentPaf.jurisdiction === 'FOREIGN') {
            expectedPreviousStatus = 'PENDING_USPS_APPROVAL_FOREIGN_ONLY';
            nextStatus = 'ACTIVE_VALIDATED';
        } else { // US
            expectedPreviousStatus = 'PENDING_LICENSEE_VALIDATION_US_ONLY';
            nextStatus = 'ACTIVE_VALIDATED';
            console.log('US',expectedPreviousStatus, nextStatus);
        }
        if (currentPaf.current_status !== expectedPreviousStatus) {
            await connection.rollback();
            return res.status(400).json({ error: `PAF not in correct state. Expected: ${expectedPreviousStatus}, Current: ${currentPaf.status}` });
        }

        const validationDate = new Date();
        const effectiveDateToSet = currentPaf.effective_date || validationDate;

        const expirationDate = new Date(effectiveDateToSet);
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);
// Now, expirationDate is one year from approvalDate


        // --- Construct the Full Licensee Assigned PAF ID ---
        // const platformId = SYSTEM_LICENSEE_PLATFORM_ID; // Using user's platform ID now
        const platformIdToUse = userLicenseePlatformId; // This is the 4-char platform ID from the user
        const listOwnerNaics = currentPaf.list_owner_naics ? currentPaf.list_owner_naics.padEnd(6, ' ') : '      ';
        const freqCode = currentPaf.processing_frequency_code ? currentPaf.processing_frequency_code.padStart(2, '0') : '99';

        let uniquePartToUse = licenseeUniqueIdPart;
        if (!uniquePartToUse) {
            const timestampSuffix = Date.now().toString().slice(-4);
            const randomChars = Math.random().toString(36).substring(2, 4).toUpperCase();
            uniquePartToUse = (timestampSuffix + randomChars).padEnd(6, 'X').substring(0,6);
        }
        uniquePartToUse = uniquePartToUse.padEnd(6, ' ').substring(0,6);

        console.log(`LICENSEE VALIDATE: Platform ID: ${platformIdToUse}, List Owner NAICS: ${listOwnerNaics}, Frequency Code: ${freqCode}, Unique Part: ${uniquePartToUse}`);
        const finalLicenseeAssignedPafId = `${platformIdToUse}${listOwnerNaics}${freqCode}${uniquePartToUse}`;
        if (finalLicenseeAssignedPafId.length !== 18) {
             console.error("CRITICAL: Generated PAF ID is not 18 characters:", finalLicenseeAssignedPafId);
             await connection.rollback();
             return res.status(500).json({ error: "Internal error: Failed to generate valid PAF ID."});
        }
        console.log(`LICENSEE VALIDATE: Constructed PAF ID: ${finalLicenseeAssignedPafId} (Platform: ${platformIdToUse}, NAICS: ${listOwnerNaics}, Freq: ${freqCode}, Unique: ${uniquePartToUse})`);

        const updatePafSql = `
            UPDATE pafs SET
                licensee_signature_date = ?, licensee_signer_name = ?, licensee_signer_title = ?,
                licensee_signature_method = ?, licensee_signature_data = ?,
                current_status = ?, effective_date = ?, licensee_assigned_paf_id = ?,
                updated_at = CURRENT_TIMESTAMP, calculated_expiration_date = ?
            WHERE paf_id = ?;`;
        await connection.execute(updatePafSql, [
            validationDate, signerName, signerTitle, signatureMethod,
            signatureData || signerName, nextStatus, effectiveDateToSet,
            finalLicenseeAssignedPafId,expirationDate, pafDbId
        ]);

        const historyNotes = `Licensee validated. Validator: ${signerName} (${signerTitle}). PAF ID set: ${finalLicenseeAssignedPafId}.`;
        await connection.execute(
            'INSERT INTO paf_status_history (paf_id, status, notes, changed_at, changed_by_user_id) VALUES (?, ?, ?, ?, ?)',
            [pafDbId, nextStatus, historyNotes, validationDate, req.user.user_id]
        );

        await connection.commit();
        res.json({
            message: `PAF ID ${pafDbId} validated. Assigned PAF ID: ${finalLicenseeAssignedPafId}. Status: ${nextStatus.replace(/_/g, ' ')}.`,
            licenseeAssignedPafId: finalLicenseeAssignedPafId,
            newStatus: nextStatus
        });

    } catch (error) {
        console.error(`Error validating PAF ${pafDbId} by Licensee:`, error);
        if (connection) await connection.rollback();
        res.status(500).json({ error: 'Failed to validate PAF as Licensee.', details: error.message });
    } finally {
        if (connection) connection.release();
    }
});


// mypafreact/paf-system-backend-node/server.js
// ... (imports: pdf-lib, fs, path, etc.) ...
// ensureAuthenticated middleware as defined before

app.get('/api/pafs/:pafId/download-pdf', ensureAuthenticated, async (req, res) => {
  const pafIdToFetch = parseInt(req.params.pafId, 10);
  console.log(`Backend PDF Generation: Request for PAF ID ${pafIdToFetch}`);

  if (isNaN(pafIdToFetch)) {
    return res.status(400).json({ message: 'Invalid PAF ID.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();

    // 1. Fetch the PAF data and related user data (same as before)
    // Querying for pafData, licenseeData, and agentData separately is fine
    const [pafRows] = await connection.execute('SELECT * FROM pafs WHERE id = ?', [pafIdToFetch]);
    if (pafRows.length === 0) return res.status(404).json({ message: 'PAF not found.' });
    const pafData = pafRows[0];

    // Authorization check (as before)
    // ...

    // Fetch licensee details
    let licenseeData = null;
    if (pafData.licensee_id) {
        const [licenseeRows] = await connection.execute('SELECT * FROM users WHERE licensee_rep = ? and usps_license_id = ?', ['Y',pafData.licensee_id]);
        if (licenseeRows.length > 0) licenseeData = licenseeRows[0];
    }
    console.log("Backend PDF Generation: Licensee Data",licenseeData);
    // Fetch agent details
    let agentData = null;
    if (pafData.agent_id) {
        const [agentRows] = await connection.execute('SELECT * FROM users WHERE id = ?', [pafData.agent_id]);
        if (agentRows.length > 0) agentData = agentRows[0];
    }

    console.log("Backend PDF Generation: Agent Data",agentData);


    // 2. Load the existing PDF template from your /data directory
    const templatePath = path.join(__dirname, 'data', 'PAF_FORM.pdf');
    const existingPdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // 3. Get the form from the document
    const form = pdfDoc.getForm();
    const pages = pdfDoc.getPages();
    const firstPage = pages[0]; // Or whichever page you need
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold); // 


    
    // --- Helper function for safely setting text fields ---
    const fillTextField = (fieldName, text) => {
      try {
        const field = form.getTextField(fieldName);
        // Only fill if text is not null/undefined. Convert numbers to strings.
        if (text !== null && text !== undefined) {
          field.setText(String(text));
        }
      } catch (e) {
        console.warn(`PDF Gen Warning: Could not find or fill form field named '${fieldName}'.`);
      }
    };
    
    // Helper to format dates correctly
    const formatDateForPdf = (dateString) => {
        if (!dateString) return '';
        try {
            // Create date in UTC to avoid timezone shifts
            const date = new Date(dateString + 'T00:00:00Z');
            return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: '2-digit', day: '2-digit', year: 'numeric' });
        } catch (e) {
            return dateString; // Fallback
        }
    };

    console.log("Backend PDF Generati",pafData);

    // 4. Fill in the form fields using the names you defined in your template
    // --- LIST OWNER Section ---
    //fillTextField('Text1', pafData.company_name);
    //fillTextField('Text2', pafData.street_address);
    //fillTextField('Text3', pafData.city);
  
    firstPage.drawText(pafData.company_name || '', {
      x: 40,         // Your calculated X coordinate
      y: 650,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });
 
    firstPage.drawText(pafData.street_address || '', {
      x: 40,         // Your calculated X coordinate
      y: 624,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });

    firstPage.drawText(pafData.urbanization || '', {
      x: 493,         // Your calculated X coordinate
      y: 624,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });

    firstPage.drawText(pafData.city || '', {
      x: 40,         // Your calculated X coordinate
      y: 596,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });

    firstPage.drawText(pafData.state || '', {
      x: 435,         // Your calculated X coordinate
      y: 596,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });
    firstPage.drawText(pafData.zip_code || '', {
      x: 500,         // Your calculated X coordinate
      y: 596,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });

    firstPage.drawText(pafData.telephone || '', {
      x: 40,         // Your calculated X coordinate
      y: 565,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });

    firstPage.drawText(pafData.list_owner_sic || '', {
      x: 154,         // Your calculated X coordinate
      y: 565,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });
 

    firstPage.drawText(pafData.signer_name || '', {
      x: 40,         // Your calculated X coordinate
      y: 470,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });
 
    firstPage.drawText(pafData.signer_title || '', {
      x: 365,         // Your calculated X coordinate
      y: 470,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });
 


    
    firstPage.drawText(licenseeData.licensee_name || '', {
      x: 40,         // Your calculated X coordinate
      y: 356,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });
 
    const licname = licenseeData.first_name + ' ' + licenseeData.last_name;
    firstPage.drawText(licname || '', {
      x: 40,         // Your calculated X coordinate
      y: 326,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });



    if(agentData)
    {
    if(agentData.broker_list_admin =='listadmin')
  {
    firstPage.drawText( 'X', {
      x: 135,         // Your calculated X coordinate
      y: 245,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });
  }
  else if(agentData.broker_list_admin =='broker')
    {
      firstPage.drawText( 'X', {
        x: 25,         // Your calculated X coordinate
        y: 245,  // Your calculated Y coordinate (example conversion from top)
        font: font,
        size: 10,
        color: rgb(0, 0, 0) // Black
      });
    }
  
    firstPage.drawText(agentData.licensee_name || '', {
      x: 40,         // Your calculated X coordinate
      y: 222,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });
 
    firstPage.drawText(agentData.street_address || '', {
      x: 40,         // Your calculated X coordinate
      y: 192,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });
 
    firstPage.drawText(agentData.urbanization || '', {
      x: 323,         // Your calculated X coordinate
      y: 192,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });
 

    const cityline = agentData.city + ', ' + agentData.state + ' ' + agentData.zip_code;
    firstPage.drawText(cityline || '', {
      x: 410,         // Your calculated X coordinate
      y: 192,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });
 

    const bname = agentData.first_name + ' ' + agentData.last_name;

    firstPage.drawText(bname || '', {
      x: 40,         // Your calculated X coordinate
      y: 163,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });

    firstPage.drawText(agentData.title || '', {
      x: 323,         // Your calculated X coordinate
      y: 163,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });
 

    const dateString = pafData.agent_signed_date.toISOString().split('T')[0];

    firstPage.drawText(dateString || '', {
      x: 323,         // Your calculated X coordinate
      y: 133,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });
 


    firstPage.drawText(agentData.phone_number || '', {
      x: 40,         // Your calculated X coordinate
      y: 103,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });

    firstPage.drawText(agentData.SIC || '', {
      x: 163,         // Your calculated X coordinate
      y: 103,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    });


  }

    firstPage.drawText(pafData.full_paf_id || '', {
      x: 72,         // Your calculated X coordinate
      y: 44,  // Your calculated Y coordinate (example conversion from top)
      font: font,
      size: 10,
      color: rgb(0, 0, 0) // Black
    }); 


    
    form.flatten();

    // 5. Serialize the PDF to bytes
    const pdfBytes = await pdfDoc.save();

    // 6. Send the PDF as a response for download
    res.setHeader('Content-Length', pdfBytes.length);
    res.setHeader('Content-Type', 'application/pdf');

    res.setHeader('Content-Disposition', `inline; filename="PAF_${pafData.list_owner_id}.pdf"`);

    //    res.setHeader('Content-Disposition', `attachment; filename="PAF_${pafData.list_owner_id}.pdf"`);
    
    res.end(pdfBytes);

  } catch (error) {
    console.error(`Error generating PDF for PAF ID ${pafIdToFetch}:`, error);
    res.status(500).json({ message: 'Failed to generate PDF.' });
  } finally {
    if (connection) connection.release();
  }
});


app.get('/api/pafs/:pafId/download-pdfxxx', ensureAuthenticated, async (req, res) => {
  const pafIdToFetch = parseInt(req.params.pafId, 10);
  const loggedInUser = req.session.user;
  console.log(`Backend PDF Generation: Request for PAF ID ${pafIdToFetch} by User ID ${loggedInUser.id}`);

  if (isNaN(pafIdToFetch)) {
    return res.status(400).json({ message: 'Invalid PAF ID.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();

    // --- Query 1: Fetch the main PAF data ---
    console.log(`PDF Gen: Fetching main PAF record for ID: ${pafIdToFetch}`);
    const [pafRows] = await connection.execute('SELECT * FROM pafs WHERE id = ?', [pafIdToFetch]);

    if (pafRows.length === 0) {
      return res.status(404).json({ message: 'PAF not found.' });
    }
    const pafData = pafRows[0]; // This is the main object with all PAF fields
    
    // --- Authorization Check (still important) ---
    // (Your existing authorization logic here, comparing loggedInUser.id, loggedInUser.role, etc. with pafData.licensee_id, pafData.created_by_user_id)
    // ...

    // --- Query 2: Fetch Licensee Admin User Details (if licensee_id exists) ---
    let licenseeData = null; // Default to null
    if (pafData.licensee_id) {
        console.log(`PDF Gen: Fetching Licensee Admin user details for user ID: ${pafData.licensee_id}`);
        // Select only the columns you need from the users table for the licensee
        const licenseeQuery = 'SELECT licensee_name, first_name, last_name, phone_number FROM users WHERE id = ?';
        const [licenseeRows] = await connection.execute(licenseeQuery, [pafData.licensee_id]);
        if (licenseeRows.length > 0) {
            licenseeData = licenseeRows[0];
        } else {
            console.warn(`PDF Gen: Licensee Admin with ID ${pafData.licensee_id} not found in users table.`);
        }
    }

    // --- Query 3: Fetch Agent User Details (if agent_id exists) ---
    let agentData = null; // Default to null
    if (pafData.agent_id) {
        console.log(`PDF Gen: Fetching Agent user details for user ID: ${pafData.agent_id}`);
        // Select only the columns you need from the users table for the agent
        const agentQuery = 'SELECT licensee_name, first_name, last_name, street_address, city, state, zip_code, phone_number FROM users WHERE id = ?';
        const [agentRows] = await connection.execute(agentQuery, [pafData.agent_id]);
        if (agentRows.length > 0) {
            agentData = agentRows[0];
        } else {
            console.warn(`PDF Gen: Agent with ID ${pafData.agent_id} not found in users table.`);
        }
    }

    // --- PDF Generation Logic (Now use data from all three objects) ---
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 10;
    
    const drawText = (text, x, y, size = fontSize) => {
      page.drawText(text || '', { x, y, font, size, color: rgb(0, 0, 0) });
    };

    // --- Populate PDF with data from pafData, licenseeData, and agentData ---
    
    // List Owner Section (from pafData)
    drawText(pafData.company_name, 72, height - 125);
    drawText(pafData.street_address, 72, height - 150);
    // ... and so on for all fields from pafData ...
    drawText(pafData.signer_name, 72, height - 300);
    drawText(pafData.signer_title, 350, height - 300);
    drawText(pafData.date_signed ? new Date(pafData.date_signed).toLocaleDateString() : '', 500, height - 325);

    // Licensee Section (from licenseeData, with fallbacks)
    drawText(licenseeData?.licensee_name || '', 72, height - 375);
    drawText(`${licenseeData?.first_name || ''} ${licenseeData?.last_name || ''}`, 72, height - 400);
    drawText(licenseeData?.telephone || '', 72, height - 450);

    // Broker/Agent Section (from agentData, with fallbacks)
    if (agentData) { // Only draw if agentData was successfully fetched
        // Check a box for BROKER/AGENT here
        drawText(agentData.licensee_name || agentData.first_name + ' ' + agentData.last_name, 72, height - 520); // Agent company name or person name
        drawText(agentData.street_address || '', 72, height - 545);
        drawText(`${agentData.city || ''}, ${agentData.state || ''} ${agentData.zip_code || ''}`, 72, height - 570); // Combined city/state/zip
        drawText(agentData.telephone || '', 72, height - 595);
    }
    
    // --- Serialize and Send PDF ---
    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Length', pdfBytes.length);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PAF_${pafData.id}_${pafData.list_owner_id}.pdf"`);
    res.end(pdfBytes);

  } catch (error) {
    console.error(`Error generating PDF for PAF ID ${pafIdToFetch}:`, error);
    res.status(500).json({ message: 'Failed to generate PDF.' });
  } finally {
    if (connection) connection.release();
  }
});

// --- NEW ENDPOINT: GET /api/pafs/:pafId/download-pdf ---
app.get('/api/pafs/:pafId/xxxdownload-pdf', ensureAuthenticated, async (req, res) => {
  const pafIdToFetch = parseInt(req.params.pafId, 10);
  const loggedInUser = req.session.user;
  console.log(`Backend PDF Generation: Request for PAF ID ${pafIdToFetch} by User ID ${loggedInUser.id}`);

  if (isNaN(pafIdToFetch)) {
    return res.status(400).json({ message: 'Invalid PAF ID.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();

    // 1. Fetch all necessary data for the PAF in one go
    // This query is similar to the one for the view details page
    const query = `
      SELECT 
        p.*, -- Get all fields from the pafs table
        u_licensee.licensee_name AS licensee_company_name,
        u_licensee.first_name AS licensee_first_name,
        u_licensee.last_name AS licensee_last_name,
        u_licensee.telephone AS licensee_telephone,
        u_agent.licensee_name AS agent_company_name, -- Assuming agent info is on their user record
        u_agent.first_name AS agent_first_name,
        u_agent.last_name AS agent_last_name,
        u_agent.street_address AS agent_address,
        u_agent.city AS agent_city,
        u_agent.state AS agent_state,
        u_agent.zip_code AS agent_zip_code,
        u_agent.telephone AS agent_telephone
      FROM pafs p
      LEFT JOIN users u_licensee ON p.licensee_id = u_licensee.id
      LEFT JOIN users u_agent ON p.agent_id = u_agent.id
      WHERE p.id = ?;
    `;
    const [pafRows] = await connection.execute(query, [pafIdToFetch]);

    if (pafRows.length === 0) {
      return res.status(404).json({ message: 'PAF not found.' });
    }
    const pafData = pafRows[0];
    
    // Authorization Check (similar to view details)
    if (loggedInUser.role !== 'ADMIN' || pafData.licensee_id !== loggedInUser.id) {
       // A more complex check might be needed if non-admins can access
       // For now, only the responsible admin can generate the PDF
       if (loggedInUser.id !== pafData.created_by_user_id && loggedInUser.created_by_admin_id !== pafData.licensee_id) {
           return res.status(403).json({ message: 'Forbidden: You are not authorized to access this PAF.' });
       }
    }


    // 2. Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage(); // Adds a standard US Letter page
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 10;
    
    // Helper function for drawing text
    const drawText = (text, x, y, size = fontSize) => {
      page.drawText(text || '', { x, y, font, size, color: rgb(0, 0, 0) });
    };

    // 3. Populate the PDF with data from pafData
    // IMPORTANT: These (x, y) coordinates are ESTIMATES. You will need to fine-tune them
    // to match the layout of your form. (0, 0) is the bottom-left corner.
    
    // --- LIST OWNER Section ---
    drawText(pafData.company_name, 72, height - 125);
    drawText(pafData.street_address, 72, height - 150);
    drawText(pafData.city, 72, height - 175);
    drawText(pafData.state, 350, height - 175);
    drawText(`${pafData.zip_code || ''} - ${pafData.zip4 || ''}`, 450, height - 175);
    drawText(pafData.telephone, 72, height - 200);
    drawText(pafData.list_owner_sic, 250, height - 200); // NAICS
    drawText(pafData.mailer_id, 350, height - 200);      // USPS Mailer ID
    drawText(pafData.list_owner_crid, 450, height - 200); // CRID
    drawText(pafData.signer_email, 500, height - 200);   // Email
    drawText(pafData.parent_company, 72, height - 225);
    drawText(pafData.alternate_company_name, 72, height - 250);
    // ... signature section
    drawText(pafData.signer_name, 72, height - 300);
    drawText(pafData.signer_title, 350, height - 300);
    // Signature would be blank here, to be physically signed
    drawText(pafData.date_signed ? new Date(pafData.date_signed).toLocaleDateString() : '', 500, height - 325);


    // --- LICENSEE Section ---
    drawText(pafData.licensee_company_name, 72, height - 375); // Fetched from users table
    drawText(`${pafData.licensee_first_name || ''} ${pafData.licensee_last_name || ''}`, 72, height - 400);
    // Signature line is blank
    drawText(pafData.licensee_telephone, 72, height - 450);
    // Date would be the date the licensee approved it, if you store that
    // drawText(pafData.licensee_validated_at ? new Date(pafData.licensee_validated_at).toLocaleDateString() : '', 500, height - 425);


    // --- BROKER/AGENT Section ---
    if (pafData.agent_id) {
        // Here you would check a box or indicate Broker/Agent is used
        drawText(pafData.agent_company_name, 72, height - 520);
        drawText(pafData.agent_address, 72, height - 545);
        // ... and so on for all agent fields
    }


    // 4. Serialize the PDF to bytes
    const pdfBytes = await pdfDoc.save();

    // 5. Send the PDF as a response for download
    res.setHeader('Content-Length', pdfBytes.length);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PAF_${pafData.id}_${pafData.list_owner_id}.pdf"`);
    res.end(pdfBytes);

  } catch (error) {
    console.error(`Error generating PDF for PAF ID ${pafIdToFetch}:`, error);
    res.status(500).json({ message: 'Failed to generate PDF.' });
  } finally {
    if (connection) connection.release();
  }
});


// mypafreact/paf-system-backend-node/server.js
// ... (imports, middleware definitions like authenticateAdmin) ...

app.get('/api/users/:userId', ensureAuthenticated, async (req, res) => {
  const userIdToFetch = parseInt(req.params.userId, 10);
  const loggedInAdmin = req.session.user;

  console.log(`Backend GET /api/users/${userIdToFetch}: Request by admin ID ${loggedInAdmin.id}`);

  if (isNaN(userIdToFetch)) {
    return res.status(400).json({ message: 'Invalid User ID format.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();

    // Fetch the user's data
    const [userRows] = await connection.execute('SELECT * FROM users WHERE id = ?', [userIdToFetch]);

    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const userToEdit = userRows[0];
    
    // Authorization: Ensure the admin has the right to view/edit this user.
    // An admin can edit users they created.
    // A super-admin might be able to edit anyone, but this logic assumes scope by creator.
    if (userToEdit.created_by_admin_id !== loggedInAdmin.id) {
        // Also check if the user to edit is the admin themselves (admins can edit their own profile)
        if (userToEdit.id !== loggedInAdmin.id) {
            return res.status(403).json({ message: 'Forbidden: You are not authorized to edit this user.' });
        }
    }

    // Don't send the password hash to the frontend
    delete userToEdit.password;

    // Map to camelCase if frontend expects it
    const formattedUser = {};
    for (const key in userToEdit) {
        const camelCaseKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
        formattedUser[camelCaseKey] = userToEdit[key];
    }
    
    // Generate userID using the same format as PAF IDs
    formattedUser.userId = formatUserId(userToEdit.id);

    res.json(formattedUser);

  } catch (error) {
    console.error(`Error fetching user ${userIdToFetch} for editing:`, error);
    res.status(500).json({ message: 'Server error while fetching user data.' });
  } finally {
    if (connection) connection.release();
  }
});


app.put('/api/users/:userId', ensureAuthenticated, async (req, res) => {
  const userIdToUpdate = parseInt(req.params.userId, 10);
  const loggedInAdmin = req.session.user;
  const updatedData = req.body;

  console.log(`Backend PUT /api/users/${userIdToUpdate}: Request by admin ID ${loggedInAdmin.id}`);
  console.log(`Backend PUT /api/users/${userIdToUpdate}: Update payload:`, updatedData);

  if (isNaN(userIdToUpdate)) {
    return res.status(400).json({ message: 'Invalid User ID format.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    // 1. Fetch user to verify existence and perform authorization check
    const [userRows] = await connection.execute('SELECT id, created_by_admin_id FROM users WHERE id = ?', [userIdToUpdate]);
    if (userRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'User not found.' });
    }
    const userToUpdate = userRows[0];
    
    // Authorization Check (same as GET)
    if (userToUpdate.created_by_admin_id !== loggedInAdmin.id && userToUpdate.id !== loggedInAdmin.id) {
      await connection.rollback();
      return res.status(403).json({ message: 'Forbidden: You are not authorized to edit this user.' });
    }

    // 2. Prepare and execute the UPDATE query
    // We will not update the password, usps_id, or created_by_admin_id here.
    // Password changes should have a separate, dedicated endpoint/flow.
    const updateQuery = `
      UPDATE users SET
        first_name = ?, last_name = ?, email = ?, role = ?, broker_list_admin = ?,
        licensee_name = ?, sic = ?, street_address = ?, city = ?, state = ?, 
        zip_code = ?, phone_number = ?,
        updated_at = NOW()
      WHERE id = ?;
    `;
    await connection.execute(updateQuery, [
      updatedData.firstName, updatedData.lastName, updatedData.email, updatedData.role, updatedData.brokerListAdmin,
      updatedData.licenseeName, updatedData.SIC, updatedData.streetAddress, updatedData.city, updatedData.state,
      updatedData.zipCode, updatedData.phoneNumber,
      userIdToUpdate
    ]);

    await connection.commit();

    // Fetch the fully updated user record to send back
    const [updatedUserRows] = await connection.execute('SELECT * FROM users WHERE id = ?', [userIdToUpdate]);
    delete updatedUserRows[0].password; // Remove password before sending

    // Map to camelCase if needed
    const formattedUser = {};
    for (const key in updatedUserRows[0]) {
        const camelCaseKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
        formattedUser[camelCaseKey] = updatedUserRows[0][key];
    }

    res.status(200).json({ message: 'User updated successfully', user: formattedUser });

  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch(e) { /* ignore */ } }
    console.error(`Error updating user ${userIdToUpdate}:`, error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Update failed: Email already exists for another user.' });
    }
    res.status(500).json({ message: 'Server error while updating user.' });
  } finally {
    if (connection) connection.release();
  }
});


app.post('/api/users/:userId/reset-password', authenticateAdmin, async (req, res) => {
  const userIdToUpdate = parseInt(req.params.userId, 10);
  const { newPassword } = req.body; // Expecting the new password in the request body
  const loggedInAdmin = req.session.user;

  console.log(`Backend /api/users/${userIdToUpdate}/reset-password: Request by admin ID ${loggedInAdmin.id}`);

  // --- Validation ---
  if (isNaN(userIdToUpdate)) {
    return res.status(400).json({ message: 'Invalid User ID format.' });
  }
  if (!newPassword || newPassword.length < 8) { // Example: enforce minimum password length
    return res.status(400).json({ message: 'New password is required and must be at least 8 characters long.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    // 1. Fetch user to verify they exist and perform authorization check
    const [userRows] = await connection.execute('SELECT id, email, created_by_admin_id FROM users WHERE id = ?', [userIdToUpdate]);
    if (userRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'User not found.' });
    }
    const userToUpdate = userRows[0];
    
    // 2. Authorization Check: Ensure admin has permission to reset this user's password
    // An admin can reset passwords for users they created, or for themselves.
    if (userToUpdate.created_by_admin_id !== loggedInAdmin.id && userToUpdate.id !== loggedInAdmin.id) {
      await connection.rollback();
      return res.status(403).json({ message: 'Forbidden: You are not authorized to reset this user\'s password.' });
    }

    // 3. Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 4. Update the user's password in the database
    const updateQuery = 'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?;';
    await connection.execute(updateQuery, [hashedPassword, userIdToUpdate]);

    await connection.commit();

    // --- Optional: Send an email notification to the user ---
    const subject = 'Your Password Has Been Reset';
    const textBody = `Hello ${userToUpdate.first_name || userToUpdate.email},\n\nYour password for the PAF System was recently reset by an administrator.\n\nIf you did not request this change, please contact your administrator immediately.\n\nThank you,\nThe PAF System Team`;
    sendEmail(userToUpdate.email, subject, textBody, textBody) // Using textBody for both for simplicity
        .then(() => console.log(`Password reset notification sent to ${userToUpdate.email}`))
        .catch(emailError => console.error(`Failed to send password reset notification to ${userToUpdate.email}:`, emailError));


    console.log(`Backend .../reset-password: Password for user ID ${userIdToUpdate} has been successfully reset by admin ID ${loggedInAdmin.id}`);
    res.status(200).json({ message: `Password for user ${userToUpdate.email} has been reset successfully.` });

  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch(e) { /* ignore */ } }
    console.error(`Error resetting password for user ${userIdToUpdate}:`, error);
    res.status(500).json({ message: 'Server error while resetting password.' });
  } finally {
    if (connection) connection.release();
  }
});

// mypafreact/paf-system-backend-node/server.js
// ... (other routes) ...

// --- NEW ENDPOINT: GET /api/export/pafs-csv ---
app.get('/api/export/pafs-csv', authenticateAdmin, async (req, res) => {
 
  const loggedInAdmin = req.session.user;
  console.log(`Backend /api/export/pafs-csv: `,loggedInAdmin);


  const licenseeIdScope = loggedInAdmin.id; // Admin's own user ID is the licensee_id for their scope

  const uspsLic = loggedInAdmin.uspsLicenseId;

  let connection;
  try {
    connection = await dbPool.getConnection();

    // Fetch all PAFs for this admin's scope (similar to the dashboard PAF list query, but without pagination)
    const query = `
      SELECT p.* FROM pafs p WHERE p.licensee_id = ? ORDER BY p.id ASC;
    `;
    const [pafs] = await connection.execute(query, [uspsLic]);

    if (pafs.length === 0) {
      return res.status(404).json({ message: 'No PAFs found for your scope to export.' });
    }

    // json2csv will automatically use the column names as headers if not specified.
    // Or you can define them explicitly for order and naming.
    const json2csvParser = new Parser(); // Using default headers from object keys
    const csv = json2csvParser.parse(pafs);

    const fileName = `pafs_export_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    res.status(200).send(csv);

  } catch (error) {
    console.error('Error exporting PAFs to CSV:', error);
    res.status(500).json({ message: 'Failed to export PAFs.' });
  } finally {
    if (connection) connection.release();
  }
});

// mypafreact/paf-system-backend-node/server.js
// ... (imports: express, cors, mysql, session, authenticateAdmin) ...

// ... (your existing routes) ...

// --- NEW ENDPOINT: GET /api/export/users-csv ---
app.get('/api/export/users-csv', authenticateAdmin, async (req, res) => {
  const loggedInAdmin = req.session.user;
  console.log(`Backend /api/export/users-csv: Request by admin ID ${loggedInAdmin.id}`);

  if (!loggedInAdmin.uspsLicenseId) {
    return res.status(400).json({ message: "Admin must be associated with a USPS License ID to export users." });
  }

  const adminUspsLicenseId = loggedInAdmin.uspsLicenseId;
  let connection;
  try {
    connection = await dbPool.getConnection();

    // Use the same query logic as the AdminDashboard user list to get all users in scope
    const query = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.role, u.broker_list_admin,
        u.usps_license_id, u.licensee_name, u.street_address, u.city, u.state, u.zip_code, u.phone_number,
        u.created_by_admin_id, u.created_at
      FROM users u
      LEFT JOIN users creator_admin ON u.created_by_admin_id = creator_admin.id
      WHERE 
        u.usps_license_id = ? OR creator_admin.usps_license_id = ?
      ORDER BY u.id ASC;
    `;
    const [users] = await connection.execute(query, [adminUspsLicenseId, adminUspsLicenseId]);

    if (users.length === 0) {
      return res.status(404).json({ message: 'No users found for your scope to export.' });
    }

    // Define the fields and headers for the CSV
    const fields = ['id', 'first_name', 'last_name', 'email', 'role', 'broker_list_admin', 'usps_license_id', 'licensee_name', 'street_address', 'city', 'state', 'zip_code', 'phone_number', 'created_by_admin_id', 'created_at'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(users);

    // Set headers to trigger browser download
    const fileName = `users_export_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    res.status(200).send(csv);

  } catch (error) {
    console.error('Error exporting users to CSV:', error);
    res.status(500).json({ message: 'Failed to export users.' });
  } finally {
    if (connection) connection.release();
  }
});

// mypafreact/paf-system-backend-node/server.js
// ... (imports, middleware definitions like ensureAuthenticated) ...

app.put('/api/pafs/:pafId', ensureAuthenticated, async (req, res) => {
  const pafIdToUpdate = parseInt(req.params.pafId, 10);
  const loggedInUser = req.session.user;
  const updatedData = req.body; // All the fields from the form

  console.log(`Backend PUT /api/pafs/${pafIdToUpdate}: Request by user ID ${loggedInUser.id}`);
  console.log(`Backend PUT /api/pafs/${pafIdToUpdate}: Update payload:`, updatedData,pafIdToUpdate);

  if (isNaN(pafIdToUpdate)) {
    return res.status(400).json({ message: 'Invalid PAF ID format.' });
  }

  // --- Basic Validation ---
  if (!updatedData.companyName || !updatedData.listName || !updatedData.signerName || !updatedData.signerTitle ) {
    return res.status(400).json({ message: 'Company Name, List Name, Signer Name and Signer Title, are required.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    // 1. Fetch PAF to verify existence and authorization
    const [pafRows] = await connection.execute('SELECT id,status, licensee_id, created_by_user_id FROM pafs WHERE id = ?', [pafIdToUpdate]);
    if (pafRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'PAF not found.' });
    }
    const pafToUpdate = pafRows[0];
    console.log(`Backend PUT /api/pafs/${pafIdToUpdate}: Fetched PAF for update:`, pafToUpdate);

    // 2. Authorization Check (e.g., only creator or licensee admin can edit)
    if (loggedInUser.role !== 'ADMIN' && pafToUpdate.created_by_user_id !== loggedInUser.id) {
        await connection.rollback();
        return res.status(403).json({ message: 'Forbidden: You are not authorized to edit this PAF.' });
    }
    if (loggedInUser.role === 'ADMIN' && pafToUpdate.licensee_id !== loggedInUser.id) {
        // Also check if admin is creator, if so allow edit
        if(pafToUpdate.created_by_user_id !== loggedInUser.id){
            await connection.rollback();
            return res.status(403).json({ message: 'Forbidden: You are not authorized to edit this PAF.' });
        }
    }

    //  calculate expired off date signed 

    const date = new Date(updatedData.dateSigned);

    date.setFullYear(date.getFullYear() + 1);

// Format back to 'YYYY-MM-DD'
//    const newexp = date.toISOString().split('T')[0];

//    console.log("new expired",newexp);  // Output: '2026-07-16'

    // 3. Prepare and execute the UPDATE query
    // The list_owner_id is NOT updated. It's carried forward.
    const updateQuery = `
      UPDATE pafs SET
        list_owner_sic = ?, company_name = ?, parent_company = ?, alternate_company_name = ?,
        street_address = ?, city = ?, state = ?, zip_code = ?, zip4 = ?,
        telephone = ?, fax_number = ?, urbanization = ?, list_owner_crid = ?, mailer_id = ?,
        signer_name = ?, signer_title = ?, signer_email = ?, 
        list_name = ?, frequency = ?, jurisdiction = ?, notes = ?,
        agent_id = ?, agent_signed_date = ?,paf_type = 'M',
        updated_at = NOW()
      WHERE id = ?;
    `;
    await connection.execute(updateQuery, [
      updatedData.listOwnerSic || null, updatedData.companyName, updatedData.parentCompany || null, updatedData.alternateCompanyName || null,
      updatedData.streetAddress || null, updatedData.city || null, updatedData.state || null, updatedData.zipCode || null, updatedData.zip4 || null,
      updatedData.telephone || null, updatedData.faxNumber || null, updatedData.urbanization || null, updatedData.listOwnerCrid || null, updatedData.mailerId || null,
      updatedData.signerName, updatedData.signerTitle, updatedData.signerEmail || null, 
      updatedData.listName, updatedData.frequency || null, updatedData.jurisdiction, updatedData.notes || null,
      updatedData.agentId || null, updatedData.agentSignedDate || null,
      pafIdToUpdate
    ]);

    // Optional: Add an entry to paf_status_history noting the modification
    const historyNotes = `PAF details modified by user: ${loggedInUser.email}.`;
    const historyQuery = `INSERT INTO paf_status_history (paf_id, status, notes, changed_by_user_id, changed_at) VALUES (?, ?, ?, ?, NOW());`;
    
    console.log(`Adding history entry for PAF ${pafIdToUpdate}:`, historyNotes);

    console.log("parms", pafIdToUpdate, pafToUpdate.status, historyNotes, loggedInUser.id);
    
    await connection.execute(historyQuery, [pafIdToUpdate, pafToUpdate.status, historyNotes, loggedInUser.id]); // Use the existing status

    await connection.commit();

    // 4. Fetch the fully updated record to return
    const [updatedPafRows] = await connection.execute('SELECT * FROM pafs WHERE id = ?', [pafIdToUpdate]);
    
    // Map to camelCase
    const updatedPaf = {};
    for (const key in updatedPafRows[0]) {
        const camelCaseKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
        updatedPaf[camelCaseKey] = updatedPafRows[0][key];
    }
    
    res.status(200).json({ message: 'PAF updated successfully', paf: updatedPaf });

  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch(e) { /* ignore */ } }
    console.error(`Error updating PAF ${pafIdToUpdate}:`, error);
    res.status(500).json({ message: 'Server error while updating PAF.' });
  } finally {
    if (connection) connection.release();
  }
});



// mypafreact/paf-system-backend-node/server.js
// ... (imports, middleware definitions like ensureAuthenticated) ...

app.get('/api/pafs/:pafId/history', ensureAuthenticated, async (req, res) => {
  const pafIdToFetch = parseInt(req.params.pafId, 10);
  const loggedInUser = req.session.user;

  console.log(`Backend /api/pafs/${pafIdToFetch}/history: Request by user ID ${loggedInUser.id}`);

  if (isNaN(pafIdToFetch)) {
    return res.status(400).json({ message: 'Invalid PAF ID format.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();

    // First, fetch the main PAF to perform an authorization check
    const [pafRows] = await connection.execute('SELECT id, licensee_id, created_by_user_id FROM pafs WHERE id = ?', [pafIdToFetch]);
    if (pafRows.length === 0) {
      return res.status(404).json({ message: 'PAF not found.' });
    }
    const pafToAuth = pafRows[0];

    console.log(`Backend /api/pafs/${pafIdToFetch}/history: Fetched PAF for authorization check:`, pafToAuth);
    
    // Authorization Check (same as view/edit logic) - ensure user can see this PAF's history
    let authorized = false;
    if (loggedInUser.role === 'ADMIN' && pafToAuth.licensee_id === loggedInUser.id) authorized = true;
    if (pafToAuth.created_by_user_id === loggedInUser.id) authorized = true;
    if (loggedInUser.role !== 'ADMIN' && pafToAuth.licensee_id === loggedInUser.created_by_admin_id) authorized = true;
    
    if (!authorized) {
      return res.status(403).json({ message: 'Forbidden: You are not authorized to view this PAF\'s history.' });
    }

    // Now, fetch the history for this PAF ID
    const historyQuery = `
      SELECT 
        h.*, -- Select all columns from history table
        u.first_name, u.last_name, u.email -- Get details of the user who made the change
      FROM paf_status_history h
      LEFT JOIN users u ON h.changed_by_user_id = u.id
      WHERE h.paf_id = ?
      ORDER BY h.changed_at DESC; -- Show most recent history first
    `;
    const [historyRows] = await connection.execute(historyQuery, [pafIdToFetch]);
    
    // Map to camelCase for frontend consistency
    const formattedHistory = historyRows.map(row => {
        const mappedRow = {};
        for (const key in row) {
            const camelCaseKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
            mappedRow[camelCaseKey] = row[key];
        }
        return mappedRow;
    });

    console.log(`Backend /api/pafs/${pafIdToFetch}/history: Found ${formattedHistory.length} history records.`);
    res.json(formattedHistory);

  } catch (error) {
    console.error(`Error fetching history for PAF ID ${pafIdToFetch}:`, error);
    res.status(500).json({ message: 'Failed to fetch PAF history.' });
  } finally {
    if (connection) connection.release();
  }
});
// ... (your app.listen and other routes should be below this) ...
    // ... (your app.listen and other routes) ...
// ... (your app.listen and other routes) ... 
app.put('/api/pafs/:pafId/renew', ensureAuthenticated, async (req, res) => {
  const pafIdToRenew = parseInt(req.params.pafId, 10);
  const { newSignedDate } = req.body; // Expecting the new date from the frontend
  const loggedInUser = req.session.user;

  console.log(`Backend /api/pafs/${pafIdToRenew}/renew: Request by user ID ${loggedInUser.id}`);

  if (isNaN(pafIdToRenew) || !newSignedDate) {
    return res.status(400).json({ message: 'Invalid PAF ID or missing new signed date.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    // 1. Fetch PAF to verify existence and authorization
    const [pafRows] = await connection.execute('SELECT id, licensee_id, created_by_user_id, status FROM pafs WHERE id = ?', [pafIdToRenew]);
    if (pafRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'PAF not found.' });
    }
    const pafToRenew = pafRows[0];

    // 2. Authorization Check (ensure user has rights to this PAF)
    // ... (your existing authorization logic here) ...

    // 3. Update the PAF record
    const updateQuery = `
      UPDATE pafs SET
        paf_type = 'R', -- Set paf_type to 'R' for Renewed
        date_signed = ?,
        status = 'PENDING_LICENSEE_VALIDATION_US_ONLY', -- Reset status for re-validation
        updated_at = NOW()
      WHERE id = ?;
    `;
    await connection.execute(updateQuery, [newSignedDate, pafIdToRenew]);

    // 4. Add a history record
    const historyNotes = `PAF renewed by user: ${loggedInUser.email}. New signed date: ${newSignedDate}.`;
    const historyQuery = `INSERT INTO paf_status_history (paf_id, status, notes, changed_by_user_id, changed_at) VALUES (?, ?, ?, ?, NOW());`;
    await connection.execute(historyQuery, [pafIdToRenew, 'PENDING_LICENSEE_VALIDATION_US_ONLY', historyNotes, loggedInUser.id]);

    await connection.commit();

    // 5. Fetch and return the updated PAF
    const [updatedPafRows] = await connection.execute('SELECT * FROM pafs WHERE id = ?', [pafIdToRenew]);
    // ... (map to camelCase) ...
    res.status(200).json({ message: 'PAF renewed successfully.', paf: updatedPafRows[0] });

  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch(e) {} }
    console.error(`Error renewing PAF ${pafIdToRenew}:`, error);
    res.status(500).json({ message: 'Server error while renewing PAF.' });
  } finally {
    if (connection) connection.release();
  }
});

app.put('/api/pafs/:pafId/agent-approve', ensureAuthenticated, async (req, res) => {
  const pafIdToApprove = parseInt(req.params.pafId, 10);
  const loggedInUser = req.session.user; // The agent performing the approval
  const { signerName, signerTitle, signatureData, dateSigned } = req.body;

  console.log(`Backend /api/pafs/${pafIdToApprove}/agent-approve: Request by user ID ${loggedInUser.id}`);

  if (isNaN(pafIdToApprove) || !signerName || !signerTitle || !dateSigned) {
    return res.status(400).json({ message: 'Invalid request. PAF ID, Signer Name, Title, and Date are required.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    // 1. Fetch PAF to verify status and agent assignment
    const [pafRows] = await connection.execute('SELECT * FROM pafs WHERE id = ?', [pafIdToApprove]);
    if (pafRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'PAF not found.' });
    }
    const pafToApprove = pafRows[0];

    // 2. Authorization: Is the logged-in user the assigned agent for this PAF?
    if (pafToApprove.agent_id !== loggedInUser.id) {
      await connection.rollback();
      return res.status(403).json({ message: 'Forbidden: You are not the assigned agent for this PAF.' });
    }

    // 3. Status Check: Is the PAF awaiting agent approval?
    if (pafToApprove.status !== 'PENDING_AGENT_APPROVAL') {
      await connection.rollback();
      return res.status(400).json({ message: `PAF is not in the correct state for agent approval. Current status: ${pafToApprove.status}` });
    }

    // 4. Update the PAF record with agent's signature and new status
    const newStatus = 'PENDING_LIST_OWNER_APPROVAL'; // <<< Next step in the workflow
    const updateQuery = `
      UPDATE pafs SET
        status = ?,
        agent_signer_name = ?,
        agent_signer_title = ?,
        agent_signature_data = ?,
        agent_signed_date = ?,
        updated_at = NOW()
      WHERE id = ?;
    `;
    await connection.execute(updateQuery, [
      newStatus, signerName, signerTitle, signatureData, dateSigned, pafIdToApprove
    ]);

    // 5. Add a history record
    const historyNotes = `Agent/Broker approved by ${signerName} (${signerTitle}).`;
    const historyQuery = `INSERT INTO paf_status_history (paf_id, status, notes, changed_by_user_id, changed_at) VALUES (?, ?, ?, ?, NOW());`;
    await connection.execute(historyQuery, [pafIdToApprove, newStatus, historyNotes, loggedInUser.id]);

    await connection.commit();

    // 6. Fetch and return the updated PAF
    const [updatedPafRows] = await connection.execute('SELECT * FROM pafs WHERE id = ?', [pafIdToApprove]);
    // ... (map to camelCase if needed) ...
    res.status(200).json({ message: 'PAF approved by agent successfully.', paf: updatedPafRows[0] });

  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch(e) {} }
    console.error(`Error during agent approval for PAF ${pafIdToApprove}:`, error);
    res.status(500).json({ message: 'Server error during agent approval.' });
  } finally {
    if (connection) connection.release();
  }
});


// Helper function to format strings for SQL: escape quotes and pad/truncate to a fixed length
const formatSqlChar = (str, length) => {
  if (str === null || str === undefined) {
    return 'NULL';
  }
  let sanitized = String(str).replace(/'/g, "''"); // Escape single quotes
  if (sanitized.length > length) {
    sanitized = sanitized.substring(0, length); // Truncate if too long
  }
  return `'${sanitized}'`; // Enclose in single quotes
};

// Helper function to format dates into MMDDYYYY string
const formatDateToMMDDYYYY = (dateString) => {
    if (!dateString) return 'NULL';
    try {
        const date = new Date(dateString + 'T00:00:00Z'); // Treat as UTC date
        if (isNaN(date.getTime())) return 'NULL';
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `'${month}${day}${year}'`;
    } catch (e) {
        return 'NULL';
    }
};

// Helper function to format numbers (like phone/fax)
const formatSqlNumericChar = (str, length) => {
    if (str === null || str === undefined) {
        return 'NULL';
    }
    // Remove all non-digit characters
    let digitsOnly = String(str).replace(/\D/g, '');
    if (digitsOnly.length > length) {
        digitsOnly = digitsOnly.substring(0, length); // Truncate
    }
    return `'${digitsOnly}'`;
};


// --- NEW ENDPOINT: GET /api/pafs/:pafId/migrate-sql ---
app.get('/api/pafs/:pafId/migrate-sql', authenticateAdmin, async (req, res) => {
  const pafIdToMigrate = parseInt(req.params.pafId, 10);
  console.log(`Backend /api/pafs/${pafIdToMigrate}/migrate-sql: Request by admin ID ${req.session.user.id}`);

  if (isNaN(pafIdToMigrate)) {
    return res.status(400).json({ message: 'Invalid PAF ID format.' });
  }

  let connection;
  try {
    connection = await dbPool.getConnection();

    // Fetch the PAF data, including related licensee and agent info
    const query = `
      SELECT 
        p.*,
        u_licensee.usps_license_id AS licensee_platform_id,
        u_agent.id AS agent_user_id,
        u_agent.usps_id AS agent_usps_id,
        u_agent.sic AS agent_sic
      FROM pafs p
      LEFT JOIN users u_licensee ON p.licensee_id = u_licensee.id
      LEFT JOIN users u_agent ON p.agent_id = u_agent.id
      WHERE p.id = ?;
    `;
    const [pafRows] = await connection.execute(query, [pafIdToMigrate]);

    if (pafRows.length === 0) {
      return res.status(404).json({ message: 'PAF not found.' });
    }
    const pafData = pafRows[0];
    
    // --- Construct the SQL INSERT Statement ---
    // Mapping your current 'pafs' table fields to the target table fields
    const targetTableName = 'your_target_paf_table_name'; // <<< REPLACE THIS

    const sqlStatement = `
INSERT INTO ${targetTableName} (
  licensee_id, list_owner_sic, freq_proc, list_owner_id, company, 
  address, city, state, zip, zip4, telephone, sign_name, 
  sign_title, sign_customer_date, paf_type, list_name, postal_id, 
  parent_company, alt_company, broker_id, sign_broker_date, 
  fax, email, urbanization, list_owner_crid
) VALUES (
  ${formatSqlChar(pafData.licensee_platform_id, 4)}, -- licensee_id (maps from admin's usps_license_id which I assume is the 4-char platform ID)
  ${formatSqlChar(pafData.list_owner_sic, 6)}, -- list_owner_sic
  ${formatSqlChar(pafData.frequency, 2)}, -- freq_proc
  ${formatSqlChar(pafData.list_owner_id, 6)}, -- list_owner_id (your 6-char formatted ID)
  ${formatSqlChar(pafData.company_name, 50)}, -- company
  ${formatSqlChar(pafData.street_address, 50)}, -- address
  ${formatSqlChar(pafData.city, 28)}, -- city
  ${formatSqlChar(pafData.state, 2)}, -- state
  ${formatSqlChar(pafData.zip_code, 9)}, -- zip
  ${formatSqlChar(pafData.zip4, 4)}, -- zip4
  ${formatSqlNumericChar(pafData.telephone, 10)}, -- telephone (digits only)
  ${formatSqlChar(pafData.signer_name, 50)}, -- sign_name
  ${formatSqlChar(pafData.signer_title, 50)}, -- sign_title
  ${formatDateToMMDDYYYY(pafData.date_signed)}, -- sign_customer_date
  ${formatSqlChar(pafData.paf_type, 1)}, -- paf_type
  ${formatSqlChar(pafData.list_name, 32)}, -- list_name
  ${formatSqlChar(pafData.mailer_id, 15)}, -- postal_id (mapping to mailer_id)
  ${formatSqlChar(pafData.parent_company, 50)}, -- parent_company
  ${formatSqlChar(pafData.alternate_company_name, 50)}, -- alt_company
  ${formatSqlChar(pafData.agent_id, 6)}, -- broker_id (mapping to agent_id, which is a user.id - you may need to format this differently)
  ${formatDateToMMDDYYYY(pafData.agent_signed_date)}, -- sign_broker_date
  ${formatSqlNumericChar(pafData.fax_number, 10)}, -- fax (digits only)
  ${formatSqlChar(pafData.signer_email, 50)}, -- email (mapping to signer_email)
  ${formatSqlChar(pafData.urbanization, 30)}, -- urbanization
  ${formatSqlChar(pafData.list_owner_crid, 45)} -- list_owner_crid
);
    `.trim().replace(/\s+/g, ' '); // Clean up newlines and extra spaces for a single line output

    // Send the generated SQL as a plain text response
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(sqlStatement);

  } catch (error) {
    console.error(`Error generating migration SQL for PAF ID ${pafIdToMigrate}:`, error);
    res.status(500).json({ message: 'Failed to generate migration SQL.' });
  } finally {
    if (connection) connection.release();
  }
});


// --- Start the server ---
//app.listen(PORT, () => {
//    console.log(`Node.js API server running on http://10.72.14.19:${PORT}`);
//});

try {
  const options = {
    key: fs2.readFileSync(path.join(__dirname, 'certs', 'key.pem')),
    cert: fs2.readFileSync(path.join(__dirname, 'certs', 'cert.pem'))
  };

  https.createServer(options, app).listen(HTTPS_PORT, () => {
    console.log(`✅ PAF System Backend is running securely on port ${HTTPS_PORT}.`);
    console.log(`   Access via: https://localhost:${HTTPS_PORT} or https://10.72.14.19:${HTTPS_PORT}`);
  });

} catch (error) {
  console.error("❌ Could not start HTTPS server. Error reading certificate files from './certs/' directory.", error.message);
  console.log("   Falling back to HTTP for development.");
  // Fallback to HTTP if certs are not found
  app.listen(HTTP_PORT, () => {
    console.log(`⚠️ PAF System Backend is running on insecure HTTP on port ${HTTP_PORT}.`);
  });
}


const httpServer = http.createServer(app);
httpServer.listen(HTTP_PORT, () => {
  console.log(`⚠️ PAF System Backend (Node) is running on insecure HTTP on port ${HTTP_PORT}.`);
});

