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
    // typeCast: function (field, next) { // Optional: To handle TINYINT(1) as boolean
    //     if (field.type === 'TINY' && field.length === 1) {
    //         return (field.string() === '1'); // '1' = true, '0' = false
    //     }
    //     return next();
    // }
});

// --- Helper Function to Hash Passwords ---
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
}

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
                department, role, is_active, created_at, updated_at
                ${newPartyId ? ', associated_party_id' : ''}
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP ${newPartyId ? ', ?' : ''})
        `;
        // Adjust userValues if you add associated_party_id to users table
        const userValues = [
            firstName, lastName, email, hashedPassword, phoneNumber || null,
            department || null, role, isActive === true || isActive === 'true' // Ensure boolean
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
        pafType, jurisdiction, isMultipleLists, notes
    } = req.body;

    if (!listOwnerId || !licenseeId || !pafType || !jurisdiction) {
        return res.status(400).json({ error: 'Required PAF information is missing (List Owner, Licensee, Type, Jurisdiction).' });
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
                current_status, is_multiple_lists, date_issued, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
        const pafValues = [
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
                p.created_at
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


app.get('/api/pafs/action-requiredworks', async (req, res) => {
    const requestedPage = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.limit) || 25; // How many items per page

    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log(`PAF FETCH (JS Paginate): Connection obtained.`);

        // SQL without LIMIT and OFFSET
        const pafsSql_NoLimit = `
            SELECT
                p.paf_id AS internalDbId,
                p.licensee_assigned_paf_id AS pafId,
                p.list_owner_id,
                lo_party.company_name AS listOwner, 
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
                p.created_at
            FROM pafs p
            JOIN parties lo_party ON p.list_owner_id = lo_party.party_id -- Added JOIN back
            ORDER BY
                lastUpdatedSortable DESC;
            -- NO LIMIT OR OFFSET IN SQL
        `;

        console.log("PAF FETCH (JS Paginate): Executing Full PAFs list SQL:", pafsSql_NoLimit);
        const [allPafsFromDb] = await connection.execute(pafsSql_NoLimit); // No parameters here
        console.log("PAF FETCH (JS Paginate): Full PAFs list query executed, total raw results:", allPafsFromDb.length);

        const totalPafs = allPafsFromDb.length;
        const totalPages = Math.ceil(totalPafs / itemsPerPage);
        const startIndex = (requestedPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedPafsData = allPafsFromDb.slice(startIndex, endIndex);

        // Transform only the paginated data
        const transformedPafs = paginatedPafsData.map(paf => ({
            ...paf,
            // listOwner: paf.listOwner, // Already joined
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
        const [users] = await connection.execute(
            'SELECT user_id, first_name, last_name, email, role, is_active, created_at, department, phone_number FROM users ORDER BY last_name, first_name'
        );
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


app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        const [users] = await connection.execute(
            'SELECT user_id, email, password_hash, role, first_name, last_name, is_active FROM users WHERE email = ?',
            [email]
        );

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
            role: user.role
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
                        p.list_owner_signature_date, p.licensee_signature_date, p.effective_date, p.calculated_expiration_date
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
                p.updated_at
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


// ... (your app.listen and other routes should be below this) ...
    // ... (your app.listen and other routes) ...
// ... (your app.listen and other routes) ... 

// --- Start the server ---
app.listen(PORT, () => {
    console.log(`Node.js API server running on http://localhost:${PORT}`);
});