/// src/components/AdminDashboard.js
import React, { useState, useEffect , useContext, useMemo} from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom'; // Import Link and useNavigate
import './AdminDashboard.css';

import RegisterAdminForm from './RegisterAdminForm';


import apiClient from '../api/apiClient'; // <<< IMPORT THE NEW API CLIENT

import AuthContext from '../context/AuthContext'; // Import AuthContext to get admin's party_id

import PafTableRow from './PafTableRow'; 




const API_BASE_URL = 'https://10.72.14.19:3443/api';
// IMPORTANT: Replace '1' (or whatever value you have) with the actual party_id of
// your Licensee organization from your 'parties' table.
// This ID is used to determine if the admin's organization is the List Owner of a PAF.
const SYSTEM_LICENSEE_PARTY_ID = '2'; // <<<< CONFIGURE THIS!

function AdminDashboard({ currentUser }) {

    const { adminUser } = useContext(AuthContext);
    
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

    const [exporting, setExporting] = useState(false); 
    const [exportMessage, setExportMessage] = useState('');

     const [isLoadingUsers, setIsLoadingUsers] = useState(false);
     const [errorUsers, setErrorUsers] = useState('');

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const datePart = dateString.split('T')[0];
    const parts = datePart.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
        });
      }
    }
    return dateString;
  };

   const [showRegisterAdminForm, setShowRegisterAdminForm] = useState(false);

    const [pafFilter, setPafFilter] = useState('ALL'); // 'ALL', 'ACTIVE', or 'OTHER'



    const navigate = useNavigate(); // For programmatic navigation

    useEffect(() => {
        const fetchSummaryData = async () => {
            setLoadingSummary(true); setSummaryFetchError(''); setError('');
            try {
                const response = await axios.get(`${API_BASE_URL}/pafs/summary`, {
                    withCredentials: true  });

                console.log("ADMIN DASH: Response data for summary:", response.data);

                setSummaryData(response.data);

                const response1 = await apiClient.get('/api/dashboard/users');


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
//                const response = await axios.get(`${API_BASE_URL}/pafs/my-pafs?limit=${PAFS_PER_PAGE}&page=${page}`); // Assuming this endpoint now fetches all pafs with pagination

                console.log("ADMIN DASH: Fetching PAFs from API:", `${API_BASE_URL}/pafs/my-pafs`);

                const response = await axios.get(`${API_BASE_URL}/pafs/my-pafs`, {
                   withCredentials: true });

                console.log("ADMIN DASH: Response data for PAFs:", response.data);
                
                if (response.data && Array.isArray(response.data)) {
                    setAllPafs(response.data);
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

 

    const fetchDashboardUsers = async () => {
        // if (!adminUser || !adminUser.party_id) {
        //   setErrorUsers("Cannot fetch users: Admin party information missing.");
        //   return;
        // }

        setIsLoadingUsers(true);
        setErrorUsers('');
        try {
            // The backend endpoint should now implicitly use the authenticated admin's party_id
            // So, you might not need to send it explicitly if your auth middleware handles it

//               console.log("ADMIN DASH: Fetching users from API:", `${API_BASE_URL}/dashboard/users`);

           const response = await apiClient.get('/api/dashboard/users');

    //        const response = await axios.get(`${API_BASE_URL}/dashboard/users`, {withCredentials: true}); // Assuming this endpoint fetches users for the admin's party_id
                          // headers: { Authorization: `Bearer ${yourAuthToken}` } // Token is usually handled by axios interceptor
//            });

            console.log("ADMIN DASH: Response data for users:", response.data);


        // Ensure response.data is an array before setting state
        if (Array.isArray(response.data)) {
          setUsers(response.data); // <<<< SETTING THE STATE
             setIsLoadingUsers(false);
         
          console.log("AdminDashboard useEffect: users state updated with fetched data."); // <<< LOG 2
        } else {
          console.error("AdminDashboard useEffect: Fetched data is not an array!", response.data);
          setErrorUsers("Received invalid data format for users.");
          setUsers([]); // Set to empty array on invalid format
        }


        } catch (err) {
            console.error("Failed to fetch dashboard users:", err);
            setErrorUsers(err.response?.data?.message || "Failed to fetch users for this scope.");
        } finally {
            setIsLoadingUsers(false);
        }
        };
      


        const fetchUsers = async () => {
 //           setLoadingUsers(true); setUserFetchError(''); setError('');
            try {

                console.log("ADMIN DASH: Fetching users from API:", `${API_BASE_URL}/users`);

                const response = await axios.get(`${API_BASE_URL}/users`,{withCredentials: true});
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
 //       fetchUsers();
        fetchDashboardUsers();

    }, [currentPafsPage]); // Re-fetch PAFs if currentPafsPage changes


    const handleSelfApprovePaf = async (pafIdToApprove) => {
    // The implementation of this function stays here in the main dashboard component
    // because it needs to modify the 'allPafs' state.
    // ... (logic for the axios.put call as defined previously) ...
     if (!window.confirm(`Are you sure you want to self-approve PAF ID: ${pafIdToApprove}?`)) return;
    
    try {
      const url = `https://10.72.14.19:3443/api/pafs/${pafIdToApprove}/validate-licensee`;
      const response = await axios.put(url, { validationNotes: "Self-approved by admin creator." }, { withCredentials: true });
      alert("PAF approved successfully!");
      setAllPafs(prevPafs => prevPafs.map(paf => paf.id === pafIdToApprove ? response.data.paf : paf));
    } catch (error) {
      console.error("Error during PAF self-approval:", error.response?.data || error.message);
      alert(`Error approving PAF: ${error.response?.data?.message || 'Please try again.'}`);
    }
  };

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

        console.log(`ADMIN DASH: Validating PAF ${pafDbId} as Licensee...`);
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


        console.log(`ADMIN DASH: Preparing to validate PAF ${pafDbId} with expected previous status: ${pafCurrentStatus}`);
        const payload = {
            signerName: `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || 'System Admin',
            signerTitle: currentUser.title || 'Administrator', // Assuming admin might have a title field
            signatureMethod: 'SYSTEM_CONFIRMATION', // Or 'TYPED' if you have a modal for input
            signatureData: `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || 'System Admin', // Typed name as data
            user_id: currentUser.userId || currentUser.user_id // Assuming userId is the correct field};
        }
        
        try {
 //           console.log(`ADMIN DASH: Attempting Licensee Validation for PAF IDx: ${pafDbId}`, payload);
 //           console.log("ADMIN DASH: CurrentUser for auth header:", currentUser);

                const apiHeaders = {};
                if (currentUser && currentUser.id) { // Check if currentUser and user_id exist
                    // For mock auth with x-user-id header
                    apiHeaders['x-user-id'] = currentUser.id.toString();
                    console.log("ADMIN DASH: Setting x-user-id header:", currentUser.id.toString());
                } else {
                    console.log("ADMIN DASH: currentUser or currentUser.user_id is undefined. Cannot set x-user-id header.");
                }

// /api/pafs/:pafId/validate-licensee
 //               const response = await axios.get(`${API_BASE_URL}/licensees/validate-usps-id/${pafDbId}`);

                const response = await axios.put(`${API_BASE_URL}/pafs/${pafDbId}/validate-licensee`, null,
                { withCredentials: true }
                );

          //  const response = await axios.post(`${API_BASE_URL}/pafs/${pafDbId}/licensee-validate`, {withCredentials: true} ,payload, {
          //      headers: apiHeaders
                    // If using mock auth with x-user-id header
                    // 'x-user-id': currentUser.user_id
                    // If using real JWT, axios interceptor would add Authorization header
         //       }
         //   );


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

    const formatDatex = (dateString) => {
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

//    console.log("ADMIN DASH: currentUser:", currentUser);

  const filteredPafs = useMemo(() => {
        console.log(`Filtering PAFs with filter: ${pafFilter}`);
        if (pafFilter === 'ACTIVE') {
            // Define what "active" means. Includes validated, or any other final "good" status.
            const activeStatuses = ['LICENSEE_VALIDATED', 'ACTIVE', 'PROCESSING_COMPLETE']; // <<< ADJUST THESE STATUSES
            return allPafs.filter(paf => activeStatuses.includes(paf.status));
        }
        if (pafFilter === 'OTHER') {
            const activeStatuses = ['LICENSEE_VALIDATED', 'ACTIVE', 'PROCESSING_COMPLETE']; // Must match above
            return allPafs.filter(paf => !activeStatuses.includes(paf.status));
        }
        // Default case: 'ALL'
        return allPafs;
    }, [allPafs, pafFilter]); // This memoized value only recalculates when allPafs or pafFilter changes
    // AAAAAA END OF NEW LOGIC AAAAAA




    console.log(
    "AdminDashboard Render LOG: isLoadingUsers:", isLoadingUsers,
    "errorUsers:", errorUsers,
    "users array (length " + users.length + "):", users // Logging the array itself
  ); // <<< THIS IS WHERE LOG 3 GOES

  // --- NEW HANDLER FUNCTION FOR EXPORTS ---
 const handleExport = async (exportType) => { // exportType will be 'users' or 'pafs'
    
     console.log("handleExport called with exportType:", exportType); // <<< LOG THIS
 
    
    setExporting(true);
    setExportMessage(`Generating ${exportType} CSV, please wait...`);



    const endpoint = exportType === 'users' ? '/export/users-csv' : '/export/pafs-csv';
    const url = `${API_BASE_URL}${endpoint}`;
    setTimeout(async () => {
      const endpoint = exportType === 'users' ? '/export/users-csv' : '/export/pafs-csv';
      const url = `${API_BASE_URL}${endpoint}`;

      try {
        console.log(`Exporting: Calling GET ${url}`);
        const response = await axios.get(url, {
          withCredentials: true,
          responseType: 'blob',
        });

        // ... (your existing code to get filename and trigger download) ...
        const contentDisposition = response.headers['content-disposition'];
        let fileName = `${exportType}_export_${new Date().toISOString().slice(0,10)}.csv`;
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/);
            if (fileNameMatch && fileNameMatch.length === 2) fileName = fileNameMatch[1];
        }
        const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
        // --- End of download logic ---

        // Update state with success message
        setExportMessage(`Successfully downloaded to ${fileName}`);
        setExporting(false); // Can set exporting to false here

      } catch (error) {
        console.error(`Error exporting ${exportType}:`, error);
        const errorMessage = error.response?.data?.message || `Failed to export ${exportType}.`;
        setExportMessage(''); // Clear loading message on error
        setExporting(false); // Ensure loading is stopped
        alert(`Export Error: ${errorMessage}`);
      }
      // The `finally` block is removed because we handle state inside try/catch now
      // to have more control over the success message.
    }, 50); // A small delay of 50ms is usually enough for the UI to update.
  };
 
    console.log("AdminDashboard Render: currentUser:", currentUser);
    return (

        
        <div className="admin-dashboard">
            <div className="dashboard-header">
                <h1>Admin Dashboard</h1>

            <div className="welcome-message">
                  <p>
                    Welcome, {adminUser?.firstName || adminUser?.email || 'Admin'}!
                    <br /> {/* Optional: line break for better readability */}
                    <small>(Role: {adminUser?.role}, USPS License ID: {adminUser?.uspsLicenseId || 'N/A'})</small>
                  </p>
                </div>
                
            </div>

             <div className="action-ribbon">
                <h2>Global Actions</h2>
                <div className="button-group">
                    {/* --- Add PAF Button (Create) --- */}
                    <Link to="/pafs/new" className="action-button btn-create"> {/* Added btn-create */}
                        + Initiate New PAF
                    </Link>

                    {/* --- Add User Button (Create) --- */}
                    <Link to="/admin/create-party-user" className="action-button btn-create"> {/* Added btn-create */}
                        + Add New User
                    </Link>

                    {/* --- Add Admin Button (Admin action) --- */}
                    <Link to="/admin/register-admin" className="action-button btn-admin"> {/* Added btn-admin */}
                        + Add New Admin
                    </Link>

                    {/* --- Export Buttons --- */}
                    <button 
                        onClick={() => handleExport('users')}
                        disabled={exporting}
                        className="action-button btn-export" /* Added btn-export */
                    >
                        {exporting ? 'Generating...' : 'Export Users'}
                    </button>
                    <button 
                        onClick={() => handleExport('pafs')}
                        disabled={exporting}
                        className="action-button btn-export" /* Added btn-export */
                    >
                        {exporting ? 'Generating...' : 'Export PAFs'}
                    </button>
                </div>
                {/* --- Export Feedback Message --- */}
                {exportMessage && (
                    <div className="export-feedback">
                        {exportMessage}
                    </div>
                )}
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
                <div className="filter-controls" style={{ margin: '15px 0', padding: '10px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '5px' }}>
                    <strong>Filter PAFs:</strong>
                    <label style={{ marginLeft: '15px', cursor: 'pointer' }}>
                        <input
                            type="radio"
                            name="pafFilter"
                            value="ALL"
                            checked={pafFilter === 'ALL'}
                            onChange={(e) => setPafFilter(e.target.value)}
                        />
                        Display All ({allPafs.length})
                    </label>
                    <label style={{ marginLeft: '15px', cursor: 'pointer' }}>
                        <input
                            type="radio"
                            name="pafFilter"
                            value="ACTIVE"
                            checked={pafFilter === 'ACTIVE'}
                            onChange={(e) => setPafFilter(e.target.value)}
                        />
                        Display Active
                    </label>
                    <label style={{ marginLeft: '15px', cursor: 'pointer' }}>
                        <input
                            type="radio"
                            name="pafFilter"
                            value="OTHER"
                            checked={pafFilter === 'OTHER'}
                            onChange={(e) => setPafFilter(e.target.value)}
                        />
                        Display All Other
                    </label>
                </div>

                {allPafsError && <div className="message error">{allPafsError}</div>}
                {loadingAllPafs ? (
                    <div className="loading-text">Loading PAFs...</div>
                ) : allPafs.length > 0 ? (
                    <>
                        <table className="paf-table user-table">
                            <thead>
                                <tr>
                                    <th>Licensee</th>
                                    <th>PAF ID</th>
                                    <th>CreatorID</th>
                                    <th>AgentID</th>
                                    <th>Jurisdiction</th>
                                    <th>Firm</th>
                                    <th>SIC</th>
                                    <th>Status</th>
                                    <th>Type (I/R/M)</th>
                                    <th>Last Updated / Issued</th>
                                    <th>Expiration</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
            {filteredPafs.length > 0 ? (
              // The map is now very clean and only responsible for passing props
              filteredPafs.map(paf => (
                <PafTableRow 
                  key={paf.id} 
                  paf={paf} 
                  onSelfApprove={handleSelfApprovePaf} 
                  formatDate={formatDate}
                />
              ))
            ) : (
              <tr>
                <td colSpan="5">No PAFs found for your scope.</td>
              </tr>
            )}

                                
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
                {false ? (
                    <div className="loading-text">Loading uxxxsers...</div>
                ) : users && users.length > 0 ? (
                    <table className="paf-table user-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Firm</th>
                                <th>Role</th>
                                <th>Created On</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (

                              //  console.log("AdminDashboard Render: Mapping user:", user);
                                    
                                <tr key={user.id}>
                                    <td>{user.id}</td>
                                   
                                    <td>{`${user.firstName || ''} ${user.lastName || ''}`.trim()}</td>
                                    <td>{user.email}</td>
                                    <td>{user.firm}</td>
                                    <td>{user.role ? user.role.replace(/_/g, ' ') : 'N/A'}</td>
                                    <td>{formatDate(user.createdAt)}</td>
                                    <td className="actions">
                                        <Link to={`/admin/users/edit/${user.id}`}>Edit</Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    !userFetchError && <div className="no-data">No users found in the system.</div>
                )}
           </div>
        </div>
    );


}

export default AdminDashboard;