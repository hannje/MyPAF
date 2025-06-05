// src/components/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom'; // Import Link and useNavigate
import './AdminDashboard.css';

const API_BASE_URL = 'http://localhost:3001/api';
// IMPORTANT: Replace '1' (or whatever value you have) with the actual party_id of
// your Licensee organization from your 'parties' table.
// This ID is used to determine if the admin's organization is the List Owner of a PAF.
const SYSTEM_LICENSEE_PARTY_ID = '2'; // <<<< CONFIGURE THIS!

function AdminDashboard({ currentUser }) {
    const [summaryData, setSummaryData] = useState({
        activePafs: 0,
        pendingValidationUs: 0,
        pendingUspsApprovalForeign: 0,
        rejectedIncomplete: 0,
        renewalDueNext30Days: 0,
    });
    const [allPafs, setAllPafs] = useState([]);
    const [pafPagination, setPafPagination] = useState({
        totalPafs: 0,
        currentPage: 1,
        totalPages: 1
    });
    const [users, setUsers] = useState([]);
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [loadingAllPafs, setLoadingAllPafs] = useState(true);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [error, setError] = useState(''); // General page error
    const [summaryFetchError, setSummaryFetchError] = useState('');
    const [allPafsError, setAllPafsError] = useState('');
    const [userFetchError, setUserFetchError] = useState('');

    const [currentPafsPage, setCurrentPafsPage] = useState(1);
    const PAFS_PER_PAGE = 10; // Or get from backend/config

    const navigate = useNavigate(); // For programmatic navigation

    useEffect(() => {
        const fetchSummaryData = async () => {
            setLoadingSummary(true); setSummaryFetchError(''); setError('');
            try {
                const response = await axios.get(`${API_BASE_URL}/pafs/summary`);
                setSummaryData(response.data);
            } catch (err) {
                let msg = 'Could not load summary data.';
                if (err.response) { msg += ` Server: ${err.response.data.error || err.response.statusText}`; }
                else if (err.request) { msg += ' No response from server.'; }
                else { msg += ` ${err.message}`; }
                setSummaryFetchError(msg);
                setSummaryData({ activePafs: 'N/A', pendingValidationUs: 'N/A', pendingUspsApprovalForeign: 'N/A', rejectedIncomplete: 'N/A', renewalDueNext30Days: 'N/A' });
            } finally {
                setLoadingSummary(false);
            }
        };

        const fetchAllPafs = async (page = 1) => {
            setLoadingAllPafs(true); setAllPafsError(''); setError('');
            try {
                const response = await axios.get(`${API_BASE_URL}/pafs/action-required?limit=${PAFS_PER_PAGE}&page=${page}`); // Assuming this endpoint now fetches all pafs with pagination
                if (response.data && Array.isArray(response.data.pafs)) {
                    setAllPafs(response.data.pafs);
                    setPafPagination({
                        totalPafs: response.data.totalPafs,
                        currentPage: response.data.currentPage,
                        totalPages: response.data.totalPages
                    });
                    setCurrentPafsPage(response.data.currentPage); // Sync current page
                } else {
                    setAllPafs([]);
                    setAllPafsError('Received invalid data format for PAFs list.');
                }
            } catch (err) {
                let msg = 'Could not load PAFs list.';
                if (err.response) { msg += ` Server: ${err.response.data.error || err.response.statusText}`; }
                else if (err.request) { msg += ' No response from server.'; }
                else { msg += ` ${err.message}`; }
                setAllPafsError(msg);
                setAllPafs([]);
            } finally {
                setLoadingAllPafs(false);
            }
        };

        const fetchUsers = async () => {
            setLoadingUsers(true); setUserFetchError(''); setError('');
            try {
                const response = await axios.get(`${API_BASE_URL}/users`);
                if (response.data && Array.isArray(response.data)) {
                    setUsers(response.data);
                } else {
                    setUsers([]);
                    setUserFetchError('Received invalid data format for users.');
                }
            } catch (err) {
                let msg = 'Could not load user list.';
                if (err.response) { msg += ` Server: ${err.response.data.error || err.response.statusText}`; }
                else if (err.request) { msg += ' No response from server.'; }
                else { msg += ` ${err.message}`; }
                setUserFetchError(msg);
                setUsers([]);
            } finally {
                setLoadingUsers(false);
            }
        };

        fetchSummaryData();
        fetchAllPafs(currentPafsPage);
        fetchUsers();
    }, [currentPafsPage]); // Re-fetch PAFs if currentPafsPage changes

    const handlePafPageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pafPagination.totalPages && newPage !== currentPafsPage) {
            setCurrentPafsPage(newPage);
        }
    };

const handleLicenseeValidate = async (pafDbId, pafCurrentStatus) => {
        if (!currentUser || currentUser.role !== 'ADMIN') {
            alert("Insufficient privileges."); // Or handle more gracefully
            return;
        }

        // Basic confirmation
        if (!window.confirm(`Are you sure you want to validate PAF (DB ID: ${pafDbId}) as Licensee? This will change its status.`)) {
            return;
        }

        // Determine expected previous status for validation
        // This logic should mirror the backend's expectation
        let expectedPrevStatus;
        // Assuming jurisdiction is on the paf object, if not, fetch PAF details first
        // For simplicity, we might need to fetch full paf details if jurisdiction isn't in allPafs items
        // Or, the button should only show if status is PENDING_LICENSEE_VALIDATION_US_ONLY for now.
        if (pafCurrentStatus === 'PENDING_LICENSEE_VALIDATION_US_ONLY') { // Simple check for now
             expectedPrevStatus = 'PENDING_LICENSEE_VALIDATION_US_ONLY';
        } else if (pafCurrentStatus === 'PENDING_USPS_APPROVAL_FOREIGN_ONLY'){ // Example for foreign
             expectedPrevStatus = 'PENDING_USPS_APPROVAL_FOREIGN_ONLY';
        } else {
            alert(`PAF is not in a state ready for Licensee Validation. Current status: ${pafCurrentStatus}`);
            return;
        }


        const payload = {
            signerName: `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || 'System Admin',
            signerTitle: currentUser.title || 'Administrator', // Assuming admin might have a title field
            signatureMethod: 'SYSTEM_CONFIRMATION', // Or 'TYPED' if you have a modal for input
            signatureData: `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || 'System Admin', // Typed name as data
            user_id: currentUser.userId || currentUser.user_id // Assuming userId is the correct field};
        }
        
        try {
            console.log(`ADMIN DASH: Attempting Licensee Validation for PAF IDx: ${pafDbId}`, payload);
            console.log("ADMIN DASH: CurrentUser for auth header:", currentUser);

                const apiHeaders = {};
                if (currentUser && currentUser.user_id) { // Check if currentUser and user_id exist
                    // For mock auth with x-user-id header
                    apiHeaders['x-user-id'] = currentUser.user_id.toString();
                    console.log("ADMIN DASH: Setting x-user-id header:", currentUser.user_id.toString());
                } else {
                    console.log("ADMIN DASH: currentUser or currentUser.user_id is undefined. Cannot set x-user-id header.");
                }



            const response = await axios.post(`${API_BASE_URL}/pafs/${pafDbId}/licensee-validate`, payload, {
                headers: apiHeaders
                    // If using mock auth with x-user-id header
                    // 'x-user-id': currentUser.user_id
                    // If using real JWT, axios interceptor would add Authorization header
                }
            );
            alert(response.data.message || `PAF ${pafDbId} validated successfully.`);
            // Re-fetch PAFs to update the list
            // This assumes fetchAllPafs is defined in a way it can be called directly
            // Or trigger a refresh by changing currentPafsPage (if pagination is robust)
 //           if (typeof fetchAllPafs === 'function') { // Check if fetchAllPafs is accessible
 //               fetchAllPafs(currentPafsPage);
 //           } else {
                window.location.reload(); // Simpler refresh for now
 //           }

        } catch (err) {
            console.error("Error during Licensee Validation:", err);
            alert(`Failed to validate PAF: ${err.response?.data?.error || err.message}`);
        }
    };

    const getStatusClass = (status) => {
        if (!status) return 'status-other';
        const lowerStatus = status.toLowerCase();
        if (lowerStatus.includes('pending') || lowerStatus.includes('approval') || lowerStatus.includes('loi')) return 'status-pending';
        if (lowerStatus.includes('rejected') || lowerStatus.includes('incomplete')) return 'status-rejected';
        if (lowerStatus.includes('active') || lowerStatus.includes('validated')) return 'status-active';
        if (lowerStatus.includes('renewal')) return 'status-renewal';
        return 'status-other';
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                 if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
                    return dateString.split('T')[0];
                 }
                 return dateString;
            }
            return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        } catch (e) {
            console.warn("Could not format date:", dateString, e);
            return dateString;
        }
    };

    console.log("ADMIN DASH: currentUser:", currentUser);
 
    return (
        <div className="admin-dashboard">
            <div className="dashboard-header">
                <h1>Admin Dashboard</h1>

            {
  
            currentUser && currentUser.system_usps_license_id && (
            <span className="licensee-id-display">
            Your System's USPS License ID: <strong>{currentUser.system_usps_license_id}</strong>
            </span>
)}

                <Link to="/admin/pafs/new" className="add-paf-btn">+ Add New PAF</Link>
            </div>

            {error && <div className="message error dashboard-error">{error}</div>}

            <div className="summary-cards">
                <div className={`card success ${loadingSummary ? 'loading' : ''}`}>
                    <div className="count">{loadingSummary ? '...' : (summaryData.activePafs !== undefined ? summaryData.activePafs : 'N/A')}</div>
                    <div className="label">Active PAFs</div>
                </div>
                <div className={`card warning ${loadingSummary ? 'loading' : ''}`}>
                    <div className="count">{loadingSummary ? '...' : (summaryData.pendingValidationUs !== undefined ? summaryData.pendingValidationUs : 'N/A')}</div>
                    <div className="label">Pending Validation (US)</div>
                </div>
                <div className={`card info ${loadingSummary ? 'loading' : ''}`}>
                    <div className="count">{loadingSummary ? '...' : (summaryData.pendingUspsApprovalForeign !== undefined ? summaryData.pendingUspsApprovalForeign : 'N/A')}</div>
                    <div className="label">Pending USPS Approval (Foreign)</div>
                </div>
                <div className={`card danger ${loadingSummary ? 'loading' : ''}`}>
                    <div className="count">{loadingSummary ? '...' : (summaryData.rejectedIncomplete !== undefined ? summaryData.rejectedIncomplete : 'N/A')}</div>
                    <div className="label">Rejected / Incomplete</div>
                </div>
                <div className={`card warning-dark ${loadingSummary ? 'loading' : ''}`}>
                    <div className="count">{loadingSummary ? '...' : (summaryData.renewalDueNext30Days !== undefined ? summaryData.renewalDueNext30Days : 'N/A')}</div>
                    <div className="label">Renewal Due (Next 30 Days)</div>
                </div>
            </div>
            {summaryFetchError && <div className="message error dashboard-error" style={{textAlign: 'center'}}>{summaryFetchError}</div>}

            <div className="action-section">
                <h2>All Processing Acknowledgement Forms (PAFs)</h2>
                {allPafsError && <div className="message error">{allPafsError}</div>}
                {loadingAllPafs ? (
                    <div className="loading-text">Loading PAFs...</div>
                ) : allPafs.length > 0 ? (
                    <>
                        <table className="paf-table">
                            <thead>
                                <tr>
                                    <th>PAF ID (Licensee)</th>
                                    <th>List Owner</th>
                                    <th>Jurisdiction</th>
                                    <th>Status</th>
                                    <th>Last Updated / Issued</th>
                                    <th>Expiration</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allPafs.map(paf => (
                                    <tr key={paf.internalDbId}>
                                        <td>{paf.pafId || `DB ID: ${paf.internalDbId}`}</td>
                                        <td>{paf.listOwner || 'N/A'}</td>
                                        <td>{paf.jurisdiction}</td>
                                        <td>
                                            <span className={`status ${getStatusClass(paf.status)}`}>
                                                {paf.status ? paf.status.replace(/_/g, ' ') : 'N/A'}
                                            </span>
                                        </td>
                                        <td>{formatDate(paf.lastUpdated)}</td>
                                        <td>{formatDate(paf.calculated_expiration_date)}</td>
                                        <td className="actions">
                                            <Link to={`/pafs/view/${paf.internalDbId}`}>View</Link>
                                            {paf.status === 'PENDING_LIST_OWNER_SIGNATURE' &&
                                             paf.list_owner_id && // Ensure list_owner_id is returned by API for each paf
                                             paf.list_owner_id.toString() === SYSTEM_LICENSEE_PARTY_ID && (
                                                <button
                                                    onClick={() => navigate(`/pafs/approve/${paf.internalDbId}?isAdminApproving=true`)}
                                                    className="action-button approve-lo-btn"
                                                    title={`Approve as List Owner (Your Org ID: ${SYSTEM_LICENSEE_PARTY_ID}, PAF LO ID: ${paf.list_owner_id})`}
                                                >
                                                    Approve (as LO)
                                                </button>
                                            )}
                                            {paf.status === 'PENDING_LICENSEE_VALIDATION_US_ONLY' && ( // Example for another action
                                                <button
//                                                    onClick={() => alert(`Validate PAF ${paf.internalDbId} - To be implemented`)}
                                                      onClick={() => handleLicenseeValidate(paf.internalDbId, paf.status)}
                                                      className="action-button validate-btn"
                                                >
                                                    Validate (Licensee)
                                                </button>
                                            )}
                                            {/* Add other actions like Edit, Renew based on status and roles */}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="pagination-controls">
                            <button
                                onClick={() => handlePafPageChange(currentPafsPage - 1)}
                                disabled={currentPafsPage <= 1 || loadingAllPafs}
                            >
                                Previous
                            </button>
                            <span> Page {pafPagination.currentPage} of {pafPagination.totalPages} (Total: {pafPagination.totalPafs}) </span>
                            <button
                                onClick={() => handlePafPageChange(currentPafsPage + 1)}
                                disabled={currentPafsPage >= pafPagination.totalPages || loadingAllPafs}
                            >
                                Next
                            </button>
                        </div>
                    </>
                ) : (
                    !allPafsError && <div className="no-data">No PAFs found in the system.</div>
                )}
            </div>

            <div className="action-section user-list-section">
                <h2>System Users</h2>
                {userFetchError && <div className="message error">{userFetchError}</div>}
                {loadingUsers ? (
                    <div className="loading-text">Loading users...</div>
                ) : users && users.length > 0 ? (
                    <table className="paf-table user-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Created On</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.user_id}>
                                    <td>{user.user_id}</td>
                                    <td>{`${user.first_name || ''} ${user.last_name || ''}`.trim()}</td>
                                    <td>{user.email}</td>
                                    <td>{user.role ? user.role.replace(/_/g, ' ') : 'N/A'}</td>
                                    <td>
                                        <span className={`status ${user.is_active ? 'status-active' : 'status-rejected'}`}>
                                            {user.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>{formatDate(user.created_at)}</td>
                                    <td className="actions">
                                        <Link to={`/admin/users/edit/${user.user_id}`}>Edit</Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    !userFetchError && <div className="no-data">No users found in the system.</div>
                )}
                <div className="button-container" style={{marginTop: '20px', textAlign: 'right'}}>
                     <Link to="/admin/register-user" className="add-paf-btn" style={{backgroundColor: '#6c757d'}}>+ Add New User</Link>
                </div>
            </div>
        </div>
    );


}

export default AdminDashboard;