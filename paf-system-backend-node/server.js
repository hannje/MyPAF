// paf-system-backend-node/server.js

require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const mysql = require('mysql2/promise'); // Using the promise-based version
const bcrypt = require('bcryptjs');
const cors = require('cors');



const app = express();
const PORT = process.env.PORT || 3001; // Use environment variable or default

// --- Middleware ---
app.use(cors({
    origin: 'http://localhost:3000' // Allow requests from your React frontend
}));
app.use(express.json()); // To parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies (optional, but can be useful)


// --- Database Connection Pool (Recommended) ---
const dbPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'your_db_user', // Replace in .env
    password: process.env.DB_PASSWORD || 'your_db_password', // Replace in .env
    database: process.env.DB_NAME || 'paf_management_db', // Replace in .env
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  
});

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
                    u.user_id, u.email, u.role, u.first_name, u.last_name, u.associated_party_id, u.licensee_party_id,
                    lp.usps_license_id AS system_usps_license_id -- Get it here
                 FROM users u
                 LEFT JOIN parties lp ON u.licensee_party_id = lp.party_id AND lp.party_type = 'LICENSEE'
                 WHERE u.user_id = ?`,
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

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'API is running successfully!' });
});

// User Creation (Potentially with Associated Party)
app.post('/api/users/create-with-party', async (req, res) => {



    const {
        // User fields
        firstName, lastName, email, phoneNumber, department, role, password, confirmPassword, isActive = true,
        // Party fields
        createAssociatedParty, companyName, addressLine1, city, state, zipCode, country = 'USA', partyType, naicsCode
    } = req.body;

      // The new user will operate under the same Licensee as the creating Admin
    const userLicenseePartyId = req.user.licensee_party_id; // Get from authenticated Admin

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

        const userSql = `
            INSERT INTO users (
                first_name, last_name, email, password_hash, phone_number,
                department, role, is_active,
                licensee_party_id,          -- The Licensee this user account is under
                associated_party_id,        -- The specific party this user might represent (can be null or same as licensee_party_id)
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;

        // Adjust userValues if you add associated_party_id to users table
        const userValues = [
            firstName, lastName, email, hashedPassword, phoneNumber || null,
            department || null, role, isActive === true || isActive === 'true', // Ensure boolean
             userLicenseePartyId,          // Set from creating admin's licensee
            newPartyIdForUserAssociation  // Can be null
            ];
        if (newPartyId) {
            userValues.push(newPartyId); // Add partyId if linking user directly to party
        }

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
app.post('/api/pafs/create', async (req, res) => {
    const {
        listOwnerId, licenseeId, brokerAgentId, listAdministratorId,
        pafType, jurisdiction, isMultipleLists, notes,processingFrequencyCode 
    } = req.body;

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

        let initialStatus = jurisdiction === 'FOREIGN' ? 'PENDING_LOI_FOREIGN_ONLY' : 'PENDING_LIST_OWNER_SIGNATURE';
        const dateIssued = new Date();

                const pafSql = `
            INSERT INTO pafs (
                list_owner_id, licensee_id, list_administrator_id, paf_type, jurisdiction,
                current_status, is_multiple_lists, date_issued,
                processing_frequency_code, -- <<<< NEW COLUMN
                 created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
        const pafValues = [
            listOwnerId, licenseeId, listAdministratorId || null, pafType, jurisdiction,
            initialStatus, isMultipleLists || false, dateIssued,
            processingFrequencyCode
        ];

        const pafSqlx = `
            INSERT INTO pafs (
                list_owner_id, licensee_id, list_administrator_id, paf_type, jurisdiction,
                current_status, is_multiple_lists, date_issued, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
        const pafValuesx = [
            listOwnerId, licenseeId, listAdministratorId || null, pafType, jurisdiction,
            initialStatus, isMultipleLists || false, dateIssued
        ];
 
        const [pafResult] = await connection.execute(pafSql, pafValues);
        const newPafId = pafResult.insertId;

        if (brokerAgentId) {
            const [brokerCheck] = await connection.execute('SELECT party_id FROM parties WHERE party_id = ? AND party_type = ?', [brokerAgentId, 'BROKER_AGENT']);
            if (brokerCheck.length === 0) throw new Error (`Broker with ID ${brokerAgentId} not found.`);
            await connection.execute(
                'INSERT INTO paf_brokers (paf_id, broker_party_id) VALUES (?, ?)',
                [newPafId, brokerAgentId]
            );
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

app.get('/api/pafs/summary', async (req, res) => {
    // TODO: Add authentication & authorization
    let connection;
    try {
        connection = await dbPool.getConnection();

        // Query for Active PAFs count
        const [activePafsResult] = await connection.execute(
            "SELECT COUNT(*) as count FROM pafs WHERE current_status = 'ACTIVE_VALIDATED'"
        );
        const activePafsCount = activePafsResult[0].count || 0;

        // TODO: Add queries for other summary counts here
        // Example for Pending Validation US:
         const [pendingValidationUsResult] = await connection.execute(
             "SELECT COUNT(*) as count FROM pafs WHERE current_status = 'PENDING_LIST_OWNER_SIGNATURE'"
         );
         const pendingValidationUsCount = pendingValidationUsResult[0].count || 0;

         const [pendingUspsApprovalForeign] = await connection.execute(
            "SELECT COUNT(*) as count FROM pafs WHERE current_status = 'PENDING_USPS_APPROVAL_FOREIGN_ONLY'"
        );
        const pendingUspsApprovalForeignCount = pendingUspsApprovalForeign[0].count || 0;
 
        const [rejectedIncomplete] = await connection.execute(
            "SELECT COUNT(*) as count FROM pafs WHERE current_status = 'REJECTED_INCOMPLETE'"
        );
        const rejectedIncompleteCount = rejectedIncomplete[0].count || 0;

        const [renewalDueNext30Days] = await connection.execute(
            "SELECT COUNT(*) as count FROM pafs WHERE current_status = 'RENEWAL_DUE' AND DATEDIFF(calculated_expiration_date, CURDATE()) <= 30"
        );
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

// In server.js (paf-system-backend-node)

// ... (keep existing imports, dbPool, app setup, other routes) ...

// In server.js (paf-system-backend-node)

// ... (keep existing imports, dbPool, app setup, other routes) ...

// Let's rename this conceptually to fetch "pafs" and add pagination later
// For now, it will fetch all, ordered by most recent.
// You might want to rename the route to /api/pafs if this is its primary purpose now.

// In server.js (paf-system-backend-node)

// ... (keep existing imports, dbPool, app setup, other routes) ...

// This endpoint fetches all PAFs and enriches them with List Owner company names
// You might rename this route to /api/pafs or /api/pafs/all
// In server.js - /api/pafs/action-required (or your /api/pafs/all route)

// In server.js - /api/pafs/action-required

// In server.js - /api/pafs/action-required (Option 1: Paginate in Node.js)

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
                p.current_status AS status,
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
            JOIN parties lo_party ON p.list_owner_id = lo_party.party_id -- CORRECTLY ADDED JOIN
            ORDER BY
                lastUpdatedSortable DESC;
            -- NO LIMIT OR OFFSET IN SQL
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

app.get('/api/users', async (req, res) => {
    // TODO: Add authentication & authorization to ensure only admins can access this
    let connection;
    try {
        connection = await dbPool.getConnection();
//        const [users] = await connection.execute(
//            'SELECT user_id, first_name, last_name, email, role, is_active, created_at, department, phone_number FROM users ORDER BY last_name, first_name'
//        );

        const [users] = await connection.execute(`
            SELECT
                u.user_id, u.first_name, u.last_name, u.email, u.role, u.is_active,
                u.created_at, u.department, u.phone_number,
                u.associated_party_id, -- The party the user represents (e.g., a List Owner)
                u.licensee_party_id,   -- The Licensee Party the user account is under
                lp.company_name AS licensee_company_name, -- Name of the Licensee Party
                lp.usps_license_id AS system_usps_license_id -- USPS ID of the Licensee Party
            FROM users u
            LEFT JOIN parties lp ON u.licensee_party_id = lp.party_id AND lp.party_type = 'LICENSEE'
            ORDER BY u.last_name, u.first_name
        `);


// We don't send password_hash to the client
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users. An internal error occurred.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

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


// --- User Login API Endpoint ---
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log("LOGIN API: Attempting login for email:", email);

        // SQL query to fetch user details AND the usps_license_id of the Licensee party they belong to
        const sql = `
            SELECT
                u.user_id,
                u.email,
                u.password_hash,
                u.role,
                u.first_name,
                u.last_name,
                u.is_active,
                u.associated_party_id,     -- The specific party this user might primarily represent (e.g., a List Owner client)
                u.licensee_party_id,       -- The party_id of the NCOALink Licensee org this user account is under
                licensee_party.company_name AS licensee_company_name, -- Name of the Licensee org
                licensee_party.usps_license_id AS system_usps_license_id -- The 4-letter USPS ID of that Licensee org
            FROM users u
            LEFT JOIN parties licensee_party
                ON u.licensee_party_id = licensee_party.party_id AND licensee_party.party_type = 'LICENSEE'
            WHERE u.email = ?;
        `;

        console.log("LOGIN API: Executing SQL for user:", email);
        const [users] = await connection.execute(sql, [email]);

        if (users.length === 0) {
            console.log("LOGIN API: User not found for email:", email);
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const user = users[0];
        console.log("LOGIN API: User found in DB:", user.email, "Role:", user.role);

        if (!user.is_active) {
            console.log("LOGIN API: User account inactive:", user.email);
            return res.status(403).json({ error: 'Account is inactive. Please contact administrator.' });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordMatch) {
            console.log("LOGIN API: Password mismatch for user:", user.email);
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Login successful
        console.log("LOGIN API: Login successful for user:", user.email);

        // Prepare user object to send to client (exclude password_hash)
        const { password_hash, ...userToSend } = user;
        // userToSend now includes:
        // - user_id, email, role, first_name, last_name, is_active
        // - associated_party_id
        // - licensee_party_id
        // - licensee_company_name (name of their Licensee org)
        // - system_usps_license_id (the 4-letter ID of their Licensee org)

        // TODO: Implement token generation (e.g., JWT) for secure session management
        // Example for JWT:
        // const tokenPayload = {
        //     userId: userToSend.user_id,
        //     email: userToSend.email,
        //     role: userToSend.role,
        //     associatedPartyId: userToSend.associated_party_id,
        //     licenseePartyId: userToSend.licensee_party_id,
        //     systemUspsLicenseId: userToSend.system_usps_license_id
        // };
        // const token = jwt.sign(tokenPayload, YOUR_JWT_SECRET, { expiresIn: '1h' }); // Expires in 1 hour
       console.log("LOGIN API usertosend:", userToSend);

        console.log("LOGIN API: User object being sent to client:", JSON.stringify(userToSend, null, 2));

        res.json({
            message: 'Login successful!',
            user: userToSend
            // token: token // Uncomment if sending JWT
        });

    } catch (error) {
        console.error('LOGIN API Error:', error);
        res.status(500).json({ error: 'Login failed due to an internal server error.', details: error.message });
    } finally {
        if (connection) {
            console.log("LOGIN API: Releasing DB connection.");
            connection.release();
        }
    }
});

// ... (rest of your server.js, including other routes and app.listen)
app.post('/api/auth/loginold', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
//        const [users] = await connection.execute(
 //           'SELECT user_id, email, password_hash, role, first_name, last_name, is_active, associated_party_id FROM users WHERE email = ?',
 //           [email]
 //       );
        const sql = `
            SELECT
                u.user_id, u.email, u.password_hash, u.role,
                u.first_name, u.last_name, u.is_active,
                u.associated_party_id,     -- The party this user might primarily represent
                u.licensee_party_id,       -- The Licensee org this user account is under
                licensee_party.usps_license_id AS system_usps_license_id -- The USPS ID of that Licensee org
            FROM users u
            LEFT JOIN parties licensee_party ON u.licensee_party_id = licensee_party.party_id AND licensee_party.party_type = 'LICENSEE'
            WHERE u.email = ?
        `;
        const [users] = await connection.execute(sql, [email]);

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid user or password.' }); // User not found
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is inactive. Please contact administrator.' }); // Forbidden
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordMatch) {
 //           return res.status(401).json({ error: 'Invalid email or password.' }); // Incorrect password
        }

        // --- Login Successful ---
        // In a real app, generate a token (e.g., JWT) or create a session
        // const tokenPayload = { userId: user.user_id, email: user.email, role: user.role };
        // const token = jwt.sign(tokenPayload, YOUR_JWT_SECRET, { expiresIn: '1h' });

        // For now, just send back user info (excluding password hash)
        const userToSend = {
            userId: user.user_id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            associatedPartyId: user.associated_party_id

        };

        res.json({
            message: 'Login successful!',
            user: userToSend,
            // token: token // Send the token if using JWT
        });

    } catch (error) {
        console.error('Login API Error:', error);
        res.status(500).json({ error: 'Login failed. An internal error occurred.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// In server.js (paf-system-backend-node)

// ... (keep existing imports, dbPool, app setup, other routes) ...

// TODO: Add authentication middleware to protect this route and get req.user
// For example, if using JWT:
// const authenticateToken = require('./middleware/authenticateToken'); // You'd create this
// app.get('/api/user/pafs', authenticateToken, async (req, res) => {

    app.get('/api/user/pafs', async (req, res) => { // MOCK: No auth for now, but you'd add it
        // In a real app, you'd get userId from the authenticated session/token
        // const userId = req.user.userId; // Example if using JWT and authenticateToken middleware
        // const userAssociatedPartyId = req.user.associatedPartyId; // If available
    
        // MOCKING: Let's assume we pass a userId as a query param for testing without auth
        const userIdForQuery = req.query.userId; // e.g., /api/user/pafs?userId=2
        const userAssociatedPartyIdForQuery = req.query.partyId; // e.g., /api/user/pafs?userId=2&partyId=10
    
        console.log(`USER PAFS FETCH: User req` ,req.query);

    
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

        // 1. Fetch current PAF to ensure it's in the correct status (e.g., PENDING_LIST_OWNER_SIGNATURE)
        const [currentPafs] = await connection.execute("SELECT current_status, jurisdiction FROM pafs WHERE paf_id = ?", [pafDbId]);
        if (currentPafs.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "PAF not found." });
        }
        const currentPaf = currentPafs[0];
        if (currentPaf.current_status !== 'PENDING_LIST_OWNER_SIGNATURE') {
            await connection.rollback();
            return res.status(400).json({ error: `PAF is not currently pending List Owner signature. Current status: ${currentPaf.current_status}` });
        }

        const signatureDate = new Date();
        let nextStatus = '';

        // Determine next status based on jurisdiction (simplified)
        if (currentPaf.jurisdiction === 'FOREIGN') {
            // Assuming LOI was already handled or is next step before USPS approval
            nextStatus = 'PENDING_USPS_APPROVAL_FOREIGN_ONLY'; // Or PENDING_LICENSEE_SIGNATURE if that's next
        } else { // US
            nextStatus = 'PENDING_LICENSEE_VALIDATION_US_ONLY'; // Or PENDING_LICENSEE_SIGNATURE
        }

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
                current_status = ?,
                list_owner_signer_name = ?,    -- New column
                list_owner_signer_title = ?,   -- New column
                list_owner_signature_method = ?, -- New column
                list_owner_signature_data = ?, -- New column (TEXT type recommended for base64/paths)
                updated_at = CURRENT_TIMESTAMP
            WHERE paf_id = ?;
        `;
        await connection.execute(updatePafSql, [
            signatureDate, nextStatus, signerName, signerTitle,
            signatureMethod, signatureData, // Store the signature data
            pafDbId
        ]);

        // 3. Add to paf_status_history
        const historyNotes = `List Owner approved. Signer: ${signerName}, Title: ${signerTitle}, Method: ${signatureMethod}. RTD Acknowledged.`;
        await connection.execute(
            'INSERT INTO paf_status_history (paf_id, status, notes, changed_at) VALUES (?, ?, ?, ?)',
            [pafDbId, nextStatus, historyNotes, signatureDate]
        );

        await connection.commit();
        res.json({ message: `PAF ID ${pafDbId} approved successfully by List Owner. Status updated to ${nextStatus}.` });

    } catch (error) {
        console.error(`Error approving PAF ${pafDbId}:`, error);
        if (connection) await connection.rollback();
        res.status(500).json({ error: 'Failed to approve PAF.', details: error.message });
    } finally {
        if (connection) connection.release();
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

        // 1. Fetch current PAF to ensure it's in the correct status (e.g., PENDING_LIST_OWNER_SIGNATURE)
        const [currentPafs] = await connection.execute("SELECT current_status, jurisdiction FROM pafs WHERE paf_id = ?", [pafDbId]);
        if (currentPafs.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "PAF not found." });
        }
        const currentPaf = currentPafs[0];
        if (currentPaf.current_status !== 'PENDING_LIST_OWNER_SIGNATURE') {
            await connection.rollback();
            return res.status(400).json({ error: `PAF is not currently pending List Owner signature. Current status: ${currentPaf.current_status}` });
        }

        const signatureDate = new Date();
        let nextStatus = '';

        // Determine next status based on jurisdiction (simplified)
        if (currentPaf.jurisdiction === 'FOREIGN') {
            // Assuming LOI was already handled or is next step before USPS approval
            nextStatus = 'PENDING_USPS_APPROVAL_FOREIGN_ONLY'; // Or PENDING_LICENSEE_SIGNATURE if that's next
        } else { // US
            nextStatus = 'PENDING_LICENSEE_VALIDATION_US_ONLY'; // Or PENDING_LICENSEE_SIGNATURE
        }

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
                current_status = ?,
                list_owner_signer_name = ?,    -- New column
                list_owner_signer_title = ?,   -- New column
                list_owner_signature_method = ?, -- New column
                list_owner_signature_data = ?, -- New column (TEXT type recommended for base64/paths)
                updated_at = CURRENT_TIMESTAMP
            WHERE paf_id = ?;
        `;
        await connection.execute(updatePafSql, [
            signatureDate, nextStatus, signerName, signerTitle,
            signatureMethod, signatureData, // Store the signature data
            pafDbId
        ]);

        // 3. Add to paf_status_history
        const historyNotes = `List Owner approved. Signer: ${signerName}, Title: ${signerTitle}, Method: ${signatureMethod}. RTD Acknowledged.`;
        await connection.execute(
            'INSERT INTO paf_status_history (paf_id, status, notes, changed_at) VALUES (?, ?, ?, ?)',
            [pafDbId, nextStatus, historyNotes, signatureDate]
        );

        await connection.commit();
        res.json({ message: `PAF ID ${pafDbId} approved successfully by List Owner. Status updated to ${nextStatus}.` });

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

// Fetch PAFs for a specific user (User Dashboard)
app.get('/api/user/pafs', authenticateUser, async (req, res) => { // Protected
    if (!req.user) { // Should be caught by authenticateUser if it enforces auth
        return res.status(401).json({ error: 'Unauthorized: User context required.' });
    }
    const userAssociatedPartyId = req.user.associated_party_id;
    // const partyIdFromQuery = req.query.partyId; // Can be used if frontend sends it for some reason
    // const effectivePartyId = userAssociatedPartyId || partyIdFromQuery;
      console.log(`USER PAFS FETCH: User req` ,req);
  
    if (!userAssociatedPartyId) {
        console.log(`USER PAFS FETCH: User ${req.user.email} has no associated party ID.`);
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

// --- API Endpoint to Fetch PAF Details Specifically for the Approval Page ---
app.get('/api/pafs/:pafDbId/for-approval', authenticateUser, async (req, res) => {
    const { pafDbId } = req.params;

    // The authenticateUser middleware might set req.user.
    // For this specific approval link, direct authentication might not always be present
    // if it's a unique link sent to an external List Owner.
    // However, if an internal admin is using it, they would be authenticated.
    // For now, the middleware is a mock and we proceed.

    if (!pafDbId || isNaN(parseInt(pafDbId))) {
        return res.status(400).json({ error: 'Valid PAF Database ID is required.' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log(`PAF APPROVAL FETCH: Connection obtained for PAF ID: ${pafDbId}`);

        const pafDetailSql = `
            SELECT
                p.paf_id AS internalDbId,
                p.licensee_assigned_paf_id AS pafIdDisplay, -- The one assigned by licensee, might be null initially
                p.current_status AS status,
                p.date_issued,
                p.jurisdiction,
                p.list_owner_id, -- For checking if admin can approve as LO
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
                p.paf_type AS pafType,
                p.is_multiple_lists AS isMultipleLists,
                p.created_at,
                p.updated_at
                -- We don't fetch signature details here, as this page is FOR providing them
            FROM pafs p
            JOIN parties lo_party ON p.list_owner_id = lo_party.party_id
            JOIN parties li_party ON p.licensee_id = li_party.party_id
            LEFT JOIN parties la_party ON p.list_administrator_id = la_party.party_id
            WHERE p.paf_id = ?;
        `;

        console.log("PAF APPROVAL FETCH: Executing PAF detail SQL for ID:", pafDbId);
        const [pafRows] = await connection.execute(pafDetailSql, [pafDbId]);

        if (pafRows.length === 0) {
            console.log(`PAF APPROVAL FETCH: PAF not found for ID: ${pafDbId}`);
            return res.status(404).json({ error: 'PAF not found. The approval link may be invalid or the PAF has been removed.' });
        }
        const pafDetail = pafRows[0];
        console.log("PAF APPROVAL FETCH: PAF detail query executed successfully.");

        // Fetch associated brokers separately (cleaner than GROUP_CONCAT for multiple details)
        const brokersSql = `
            SELECT b_party.party_id, b_party.company_name, b_party.naics_code
            FROM paf_brokers pb
            JOIN parties b_party ON pb.broker_party_id = b_party.party_id
            WHERE pb.paf_id = ?;
        `;
        console.log("PAF APPROVAL FETCH: Executing brokers SQL for PAF ID:", pafDbId);
        const [brokerRows] = await connection.execute(brokersSql, [pafDbId]);
        pafDetail.brokers = brokerRows; // Add list of broker objects
        console.log("PAF APPROVAL FETCH: Brokers query executed successfully, count:", brokerRows.length);


        // Optionally, you could check pafDetail.status here and if it's not 'PENDING_LIST_OWNER_SIGNATURE',
        // you might return a specific message or different data.
        // For example:
        // if (pafDetail.status !== 'PENDING_LIST_OWNER_SIGNATURE') {
        //     return res.status(400).json({
        //         error: `This PAF is not currently awaiting approval. Current status: ${pafDetail.status.replace(/_/g, ' ')}`,
        //         paf: pafDetail // Still send details for context
        //     });
        // }

        res.json(pafDetail);

    } catch (error) {
        console.error(`FULL ERROR fetching PAF ${pafDbId} for approval:`, error);
        res.status(500).json({ error: 'Failed to fetch PAF details for approval. An internal server error occurred.', details: error.message });
    } finally {
        if (connection) {
            console.log(`PAF APPROVAL FETCH: Releasing connection for PAF ID: ${pafDbId}`);
            connection.release();
        }
    }
});

// In server.js (paf-system-backend-node)

// REMOVE or DO NOT USE this global constant if the Platform ID comes from the user:
// const SYSTEM_LICENSEE_PLATFORM_ID = 'ABCD'; // No longer using a global one

app.post('/api/pafs/:pafDbId/licensee-validate', authenticateUser, async (req, res) => {
    const { pafDbId } = req.params;
    const {
        signerName, // Name of the admin/licensee rep validating
        signerTitle,  // Title of the admin/licensee rep
        signatureMethod = 'SYSTEM_CONFIRMATION',
        signatureData,
        licenseeUniqueIdPart // Optional 6-char unique ID part from admin
    } = req.body;

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
                updated_at = CURRENT_TIMESTAMP
            WHERE paf_id = ?;`;
        await connection.execute(updatePafSql, [
            validationDate, signerName, signerTitle, signatureMethod,
            signatureData || signerName, nextStatus, effectiveDateToSet,
            finalLicenseeAssignedPafId,
            pafDbId
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


app.post('/api/pafs/:pafDbId/licensee-validatexx', authenticateUser, async (req, res) => {
    const { pafDbId } = req.params;
    const {
        signerName, // Name of the admin/licensee rep validating
        signerTitle,  // Title of the admin/licensee rep
        // We might assume a 'SYSTEM_CONFIRMATION' method or allow typed name
        signatureMethod = 'SYSTEM_CONFIRMATION', // Default method
        signatureData // Could be the typed name if method is 'TYPED'
    } = req.body;

    // Ensure the logged-in user is an Admin (or appropriate role for Licensee validation)
 //   if (!req.user || req.user.role !== 'ADMIN') { // Adjust role if needed
 //       return res.status(403).json({ error: 'Forbidden: Insufficient privileges for Licensee validation.' });
 //   }

    if (!pafDbId || isNaN(parseInt(pafDbId))) {
        return res.status(400).json({ error: 'Valid PAF Database ID is required.' });
    }
    if (!signerName || !signerTitle) {
        // For 'SYSTEM_CONFIRMATION', signerName/Title might come from req.user
        // For this example, let's make them required from the body for explicitness
        return res.status(400).json({ error: 'Signer name and title are required for Licensee validation.' });
    }


    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        // 1. Fetch current PAF to ensure it's in the correct status
        const [currentPafs] = await connection.execute(
            "SELECT current_status, jurisdiction, licensee_id, paf_type FROM pafs WHERE paf_id = ?",
            [pafDbId]
        );
        if (currentPafs.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "PAF not found for validation." });
        }
        const currentPaf = currentPafs[0];

        // Check if this system (Licensee) is actually the licensee on the PAF
        // This requires knowing your system's party_id as a Licensee
        // const SYSTEM_LICENSEE_PARTY_ID_FROM_CONFIG = '1'; // Get this from config or .env
        // if (currentPaf.licensee_id.toString() !== SYSTEM_LICENSEE_PARTY_ID_FROM_CONFIG) {
        //     await connection.rollback();
        //     return res.status(403).json({ error: "Forbidden: Your organization is not the designated licensee for this PAF." });
        // }


        // Determine the appropriate status to transition to
        let expectedPreviousStatus;
        let nextStatus;

        if (currentPaf.jurisdiction === 'FOREIGN') {
            // Assuming after LO approval (or LOI), it goes to USPS approval, then Licensee validates to make it active
            expectedPreviousStatus = 'PENDING_USPS_APPROVAL_FOREIGN_ONLY'; // Or whatever status precedes Licensee validation for Foreign
            nextStatus = 'ACTIVE_VALIDATED'; // Or a specific "FOREIGN_ACTIVE" status
        } else { // US
            expectedPreviousStatus = 'PENDING_LICENSEE_VALIDATION_US_ONLY';
            nextStatus = 'ACTIVE_VALIDATED';
        }

 //       if (currentPaf.status !== expectedPreviousStatus) {
 //           await connection.rollback();
 //           return res.status(400).json({ error: `PAF is not in the correct state for Licensee validation. Expected: ${expectedPreviousStatus.replace(/_/g, ' ')}, Current: ${currentPaf.status.replace(/_/g, ' ')}` });
 //       }

        const validationDate = new Date();
        const effectiveDateToSet = currentPaf.effective_date || validationDate; // Use existing effective date or set to now

        // Assign a Licensee PAF ID if it doesn't have one yet (simplified generation)
        let licenseeAssignedPafId = currentPaf.licensee_assigned_paf_id;
        if (!licenseeAssignedPafId) {
            // Simple PAF ID generation: L + LicenseeID + PAFType(first 3 chars) + YearMonth + InternalDbId
            // This is a very basic example, refer to the PAF Guide for official structure if needed.
            // The official PAF ID structure is: PlatformID(4) + NAICS(6) + Freq(2) + Unique(6)
            // For simplicity here, we'll do something different as NAICS isn't directly on the Licensee.
            const licenseePart = currentPaf.licensee_id.toString().padStart(3, '0');
            const pafTypePart = currentPaf.paf_type.substring(0, 3).toUpperCase();
            const datePart = `${validationDate.getFullYear().toString().slice(-2)}${(validationDate.getMonth() + 1).toString().padStart(2, '0')}`;
            licenseeAssignedPafId = `L${licenseePart}${pafTypePart}${datePart}${pafDbId.toString().padStart(4,'0')}`;
        }


        // 2. Update the PAF table
        const updatePafSql = `
            UPDATE pafs
            SET
                licensee_signature_date = ?,
                licensee_signer_name = ?,
                licensee_signer_title = ?,
                licensee_signature_method = ?,
                licensee_signature_data = ?,
                current_status = ?,
                effective_date = ?,          -- Set or confirm effective date
                licensee_assigned_paf_id = ?, -- Assign/confirm Licensee PAF ID
                updated_at = CURRENT_TIMESTAMP
            WHERE paf_id = ?;
        `;
        await connection.execute(updatePafSql, [
            validationDate,
            signerName,
            signerTitle,
            signatureMethod,
            signatureData || signerName, // If method is confirmation, data could be signer name
            nextStatus,
            effectiveDateToSet,
            licenseeAssignedPafId,
            pafDbId
        ]);

 //       console.log(`PAF APPROVAL: req`,req);

        // 3. Add to paf_status_history
        const historyNotes = `Licensee validated. Validator: ${signerName} (${signerTitle}). Method: ${signatureMethod}. PAF ID set/confirmed: ${licenseeAssignedPafId}.`;
        await connection.execute(
            'INSERT INTO paf_status_history (paf_id, status, notes, changed_at, changed_by_user_id) VALUES (?, ?, ?, ?, ?)',
            [pafDbId, nextStatus, historyNotes, validationDate, req.body.user_id]
        );

        await connection.commit();
        res.json({
            message: `PAF ID ${pafDbId} validated successfully by Licensee. Status: ${nextStatus.replace(/_/g, ' ')}. Assigned PAF ID: ${licenseeAssignedPafId}`,
            licenseeAssignedPafId: licenseeAssignedPafId,
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
// ... (your app.listen and other routes should be below this) ...
    // ... (your app.listen and other routes) ...
// ... (your app.listen and other routes) ... 

// --- Start the server ---
app.listen(PORT, () => {
    console.log(`Node.js API server running on http://localhost:${PORT}`);
});