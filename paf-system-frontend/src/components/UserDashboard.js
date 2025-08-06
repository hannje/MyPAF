// src/components/UserDashboard.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
//import { Link } from 'react-router-dom'; // For navigation
import { Link, useNavigate } from 'react-router-dom'; // useNavigate for programmatic navigation
import './UserDashboard.css';

const API_BASE_URL = 'https://10.72.14.19:3443/api';


function UserDashboard({ currentUser }) { // currentUser is passed as a prop from App.js
    const [myPafs, setMyPafs] = useState([]);
    const [pafPagination, setPafPagination] = useState({ totalPafs: 0, currentPage: 1, totalPages: 1 });
    const [currentPage, setCurrentPage] = useState(1);
    const PAFS_PER_PAGE = 10;

    const [loadingPafs, setLoadingPafs] = useState(true);
    const [error, setError] = useState('');

    const navigate = useNavigate();

    useEffect(() => {
        const fetchMyPafs = async (page = 1) => {

            console.log("USER DASH: currentUser object:", JSON.stringify(currentUser, null, 2));
            if (!currentUser || (!currentUser.id )) {
                setError("User information not available to fetch PAFs. Please log in again.");
                setLoadingPafs(false);
                setMyPafs([]); // Clear any existing pafs
                setPafPagination({ totalPafs: 0, currentPage: 1, totalPages: 0 });
                return;
            }

            setLoadingPafs(true);
            setError('');

            // Prepare query parameters
            // The backend's mock authenticateUser will use testUserId or x-user-id for now.
            // When real auth is in place, the backend gets user from token/session.
            // The frontend can still send party_id if known, for clarity or if backend needs it.
            let queryParams = `?limit=${PAFS_PER_PAGE}&page=${page}`;
            // For testing the mock auth in backend:
            // queryParams += `&testUserId=${currentUser.user_id}`;


            try {
//                console.log(`USER DASH: Attempting to fetch user PAFs. API: ${API_BASE_URL}/pafs/my-pafs${queryParams}`);
                // For testing mock auth with header:
                 const headers = { 'x-user-id': currentUser.id };

                 console.log("USER DASHBOARD: currentUser for PAF fetch:", JSON.stringify(currentUser, null, 2));

                  const response = await axios.get(`${API_BASE_URL}/pafs/my-pafs`, {
                   withCredentials: true });

//                const response = await axios.get(`${API_BASE_URL}/user/pafs${queryParams}`);


 //               console.log("USER DASH: User PAFs API Response:", response.data);
                if (response.data && Array.isArray(response.data)) { // Check if response.data itself is the array
                    
 //                   console.log("USER DASH: Response data is an array of PAFs.",response.data);
                    setMyPafs(response.data);
                    // You'd need a separate way to get totalPafs, currentPage, totalPages if not in the response
                    setPafPagination({ totalPafs: response.data.length, currentPage: 1, totalPages: 1 }); // Simple pagination
                }
               else if (response.data ) {
                    setMyPafs(response.data);
  //                  setPafPagination({
  //                      totalPafs: response.data.length,
  //                      currentPage: response.data.currentPage,
  //                      totalPages: response.data.totalPages
  //                  });
                } 
                 
                else 
                {
                    setMyPafs([]);
                    setPafPagination({ totalPafs: 0, currentPage: 1, totalPages: 0 });
                    setError("Received invalid data format for your PAFs.");
                }
            } catch (err) {
                console.error("USER DASH: Error fetching user PAFs:", err);
                let msg = 'Could not load your PAFs.';
                if (err.response) { msg += ` Server: ${err.response.data.error || err.response.statusText}`; }
                else if (err.request) { msg += ' No response from server.'; }
                else { msg += ` ${err.message}`; }
                setError(msg);
                setMyPafs([]);
                setPafPagination({ totalPafs: 0, currentPage: 1, totalPages: 0 });
            } finally {
                setLoadingPafs(false);
            }
        };

        fetchMyPafs(currentPage);
    }, [currentUser, currentPage]); // Re-fetch if currentUser or currentPage changes

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pafPagination.totalPages && newPage !== currentPage) {
            setCurrentPage(newPage);
        }
    };


    const getStatusClass = (status) => { /* ... same as AdminDashboard ... */
        if (!status) return 'status-other';
        const lowerStatus = status.toLowerCase();
        if (lowerStatus.includes('pending') || lowerStatus.includes('approval') || lowerStatus.includes('loi')) return 'status-pending';
        if (lowerStatus.includes('rejected') || lowerStatus.includes('incomplete')) return 'status-rejected';
        if (lowerStatus.includes('active') || lowerStatus.includes('validated')) return 'status-active';
        if (lowerStatus.includes('renewal')) return 'status-renewal';
        return 'status-other';
    };
    const formatDate = (dateString) => { /* ... same as AdminDashboard ... */
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString.split('T')[0] || dateString;
            return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        } catch (e) { return dateString; }
    };

    if (!currentUser) {
        // This case should ideally be handled by ProtectedRoute redirecting to login
        return <div className="user-dashboard-container"><p>User not authenticated. Please <Link to="/login">login</Link>.</p></div>;
    }

    return (
        <div className="user-dashboard-container">
            <div className="dashboard-header">
                <h1>My PAF Dashboard</h1>
                <p>Welcome, {currentUser.first_name || currentUser.email}!
                           (Role: {currentUser.role}, User ID: {currentUser.id || 'N/A'})

                </p>
            </div>

            {error && <div className="message error">{error}</div>}
<div className="button-container" style={{ marginTop: '15px' }}>
          {/*
            VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV
            HERE IS THE <Link> COMPONENT FOR THE "INITIATE NEW PAF" BUTTON/LINK
            VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV
          */}
          <Link to="/pafs/new" className="action-button create-paf-button" style={{
            display: 'inline-block',
            padding: '10px 15px',
            backgroundColor: '#007bff', // Example primary button color
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
            marginRight: '10px'
          }}>
            + Initiate New PAF
          </Link>

          <Link 
            to={`/profile/edit`} // <<< New route for editing the logged-in user's profile
            className="action-button edit-profile-button" 
style={{
            display: 'inline-block',
            padding: '10px 15px',
            backgroundColor: '#6600ff', // Example primary button color
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
            marginRight: '10px'
          }}>          
            Edit My Profile
          </Link>


          {/*
            AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
            END OF THE <Link> COMPONENT
            AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
          */}

          {/* You could add other links/buttons here, for example: */}
          {/*
          <Link to="/pafs/my-list" className="action-button view-pafs-button" style={{
            display: 'inline-block',
            padding: '10px 15px',
            backgroundColor: '#6c757d', // Example secondary button color
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px'
          }}>
            View My PAFs
          </Link>
          */}
        </div>
            <div className="paf-list-section">
                <h2>My Associated PAFs</h2>
                {loadingPafs ? (
                    <div className="loading-text">Loading your PAFs...</div>
                ) : myPafs.length > 0 ? (
                    <>
                        <table className="paf-table">
                            <thead>
                                <tr>
                                    <th>PAF ID (Licensee)</th>
                                    <th>CreatorID</th>
                                    <th>AgentID</th>
                                    <th>Firm</th>
                                    <th>Status</th>
                                    <th>Date Issued / Last Update</th>
                                    <th>Expiration</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                            {myPafs.map(paf => {
                                // Condition for showing the "Approve PAF" button
                                const canApproveAsListOwner =
                                    paf.status === 'PENDING_LIST_OWNER_APPROVAL' &&
                                    paf.createdByUserId && // PAF must have a list_owner_id
                                    paf.createdByUserId === currentUser.id;

                                const canApproveAsAgent =
                                    paf.status === 'PENDING_AGENT_APPROVAL' &&
                                    paf.agentId === currentUser.id;

                                    

                               console.log("USER DASH: paf:", paf,canApproveAsAgent);
                               console.log("USER DASH: currentUser:", currentUser);
 
                                return (
                                    <tr key={paf.internalDbId}>
                                        <td>{paf.licenseeId || `DB ID: ${paf.id}`}</td>
                                        <td>{paf.listOwnerId}</td>
                                        <td>{paf.agentId}</td>
                                        <td>{paf.companyName}</td>
                                        <td>
                                            <span className={`status ${getStatusClass(paf.status)}`}>
                                                {paf.status ? paf.status.replace(/_/g, ' ') : 'N/A'}
                                            </span>
                                        </td>
                                        <td>{formatDate(paf.updatedAt || paf.date_issued)}</td>
                                        {/* <td>{formatDate(paf.calculated_expiration_date)}</td> */}
  
                                         <td>{formatDate(paf.updatedAt || paf.date_issued)}</td>
  
                                        <td className="actions">
                                            <Link to={`/pafs/view/${paf.id}`}>View Details</Link>
                                            {canApproveAsListOwner && (
                                                <button
                                                    onClick={() => navigate(`/pafs/approve/${paf.id}`)}
                                                    className="action-button approve-lo-btn"
                                                    style={{marginLeft: '10px'}}
                                                    title={`Approve PAF as List Owner (Your ID: ${currentUser.id})`}
                                                >
                                                    Approve PAF
                                                </button>
                                            )}
                                           {canApproveAsAgent && (
                                                <button
                                                    onClick={() => navigate(`/pafs/agent-approve/${paf.id}`)}
                                                    className="action-button approve-lo-btn"
                                                    style={{marginLeft: '10px'}}
                                                    title={`Approve PAF as Agent (Your ID: ${currentUser.id})`}
                                                >
                                                    Approve as Agent
                                                </button>
                                            )}


                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                        {/* Pagination Controls */}
                        {pafPagination.totalPages > 1 && (
                            <div className="pagination-controls">
                                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1 || loadingPafs}>Previous</button>
                                <span> Page {pafPagination.currentPage} of {pafPagination.totalPages} (Total: {pafPagination.totalPafs}) </span>
                                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= pafPagination.totalPages || loadingPafs}>Next</button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="no-data">You do not have any PAFs associated with your account yet.</div>
                )}
            </div>
        </div>
    );
}

export default UserDashboard;