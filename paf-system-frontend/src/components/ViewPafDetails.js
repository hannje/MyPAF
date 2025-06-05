// src/components/ViewPafDetails.js
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ViewPafDetails.css'; // We'll create this CSS file

const API_BASE_URL = 'http://localhost:3001/api';
// IMPORTANT: Replace '1' with your actual Licensee's party_id from the 'parties' table
const SYSTEM_LICENSEE_PARTY_ID = '1';

function ViewPafDetails({ currentUser }) { // Assuming currentUser might be passed for role-based actions
    const { pafDbId } = useParams();
    const navigate = useNavigate();
    const [pafDetail, setPafDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchPafDetail = async () => {
            if (!pafDbId) {
                setError("PAF ID not provided.");
                setLoading(false);
                return;
            }
            setLoading(true);
            setError('');
            try {
                console.log(`VIEW PAF: Attempting to fetch details for PAF ID: ${pafDbId}`);
                const response = await axios.get(`${API_BASE_URL}/pafs/details/${pafDbId}`);
                console.log("VIEW PAF: API Response:", response.data);
                setPafDetail(response.data);
            } catch (err) {
                console.error(`VIEW PAF: Error fetching PAF details for ID ${pafDbId}:`, err);
                if (err.response) {
                    setError(`Could not load PAF details: ${err.response.data.error || err.response.statusText} (Status: ${err.response.status})`);
                } else if (err.request) {
                    setError('No response from server. Is the API running?');
                } else {
                    setError(`Error fetching PAF details: ${err.message}`);
                }
                setPafDetail(null);
            } finally {
                setLoading(false);
            }
        };
        fetchPafDetail();
    }, [pafDbId]);

    const formatDate = (dateString, includeTime = false) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
                   return dateString.split('T')[0];
                }
                return dateString;
            }
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            if (includeTime) {
                options.hour = '2-digit';
                options.minute = '2-digit';
            }
            return date.toLocaleDateString(undefined, options);
        } catch (e) {
            return dateString;
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


    if (loading) {
        return <div className="loading-container view-paf-loading">Loading PAF Details...</div>;
    }
    if (error) {
        return <div className="error-container view-paf-error"><p>{error}</p><Link to="/admin-dashboard">Back to Dashboard</Link></div>;
    }
    if (!pafDetail) {
        return <div className="error-container view-paf-error"><p>PAF details not found.</p><Link to="/admin-dashboard">Back to Dashboard</Link></div>;
    }

    // Determine if admin can approve as List Owner
    const canAdminApproveAsLO = pafDetail.status === 'PENDING_LIST_OWNER_SIGNATURE' &&
                               pafDetail.list_owner_id &&
                               pafDetail.list_owner_id.toString() === SYSTEM_LICENSEE_PARTY_ID &&
                               currentUser && currentUser.role === 'ADMIN';


    return (
        <div className="view-paf-details-container">
            <div className="paf-header">
                <h1>PAF Details (Internal ID: {pafDetail.internalDbId})</h1>
                <Link to="/admin-dashboard" className="back-to-dashboard-link">« Back to Admin Dashboard</Link>
            </div>

            <div className="paf-section paf-core-info">
                <h2>Core Information</h2>
                <div className="info-grid">
                    <div><strong>Licensee Assigned PAF ID:</strong> {pafDetail.pafIdDisplay || 'Pending Assignment'}</div>
                    <div><strong>Current Status:</strong> <span className={`status-badge ${getStatusClass(pafDetail.status)}`}>{pafDetail.status ? pafDetail.status.replace(/_/g, ' ') : 'N/A'}</span></div>
                    <div><strong>PAF Type:</strong> {pafDetail.pafType ? pafDetail.pafType.replace(/_/g, ' ') : 'N/A'}</div>
                    <div><strong>Jurisdiction:</strong> {pafDetail.jurisdiction || 'N/A'}</div>
                    <div><strong>Covers Multiple Lists:</strong> {pafDetail.isMultipleLists ? 'Yes' : 'No'}</div>
                    <div><strong>Date Initiated/Issued:</strong> {formatDate(pafDetail.date_issued)}</div>
                    <div><strong>Effective Date:</strong> {formatDate(pafDetail.effective_date)}</div>
                    <div><strong>Calculated Expiration:</strong> {formatDate(pafDetail.calculated_expiration_date)}</div>
                    <div><strong>Internal DB ID:</strong> {pafDetail.internalDbId}</div>
                </div>
            </div>

            <div className="paf-section paf-parties-info">
                <h2>Party Information</h2>
                <div className="info-grid">
                    <div><strong>List Owner:</strong> {pafDetail.listOwnerName || 'N/A'} (ID: {pafDetail.list_owner_id})</div>
                    <div><strong>LO Address:</strong> {`${pafDetail.listOwnerAddress1 || ''}, ${pafDetail.listOwnerCity || ''}, ${pafDetail.listOwnerState || ''} ${pafDetail.listOwnerZip || ''}`}</div>
                    <div><strong>LO NAICS:</strong> {pafDetail.listOwnerNaics || 'N/A'}</div>
                    <div><strong>Processing Licensee:</strong> {pafDetail.licenseeName || 'N/A'} (ID: {pafDetail.licensee_id})</div>
                    {pafDetail.listAdminName && <div><strong>List Administrator:</strong> {pafDetail.listAdminName} (ID: {pafDetail.list_administrator_id || 'N/A'})</div>}
                </div>
                {pafDetail.brokers && pafDetail.brokers.length > 0 && (
                    <div className="party-subsection">
                        <h4>Associated Broker(s)/Agent(s):</h4>
                        <ul>
                            {pafDetail.brokers.map(broker => (
                                <li key={broker.party_id}>{broker.company_name} (ID: {broker.party_id}, NAICS: {broker.naics_code || 'N/A'})</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="paf-section paf-signature-info">
                <h2>Signature & Approval Details</h2>
                <div className="info-grid">
                    <div><strong>List Owner Signer:</strong> {pafDetail.list_owner_signer_name || 'N/A'}</div>
                    <div><strong>LO Signer Title:</strong> {pafDetail.list_owner_signer_title || 'N/A'}</div>
                    <div><strong>LO Signature Date:</strong> {formatDate(pafDetail.list_owner_signature_date)}</div>
                    <div><strong>LO Signature Method:</strong> {pafDetail.list_owner_signature_method || 'N/A'}</div>
                    {/* Consider how/if to display list_owner_signature_data (e.g., link to image if applicable) */}
                    <div><strong>Licensee Signature Date:</strong> {formatDate(pafDetail.licensee_signature_date)}</div>
                    <div><strong>USPS Approval Date (Foreign):</strong> {formatDate(pafDetail.usps_approval_date)}</div>
                </div>
            </div>

            {pafDetail.notes && (
                <div className="paf-section paf-notes-info">
                    <h2>Internal Notes</h2>
                    <pre>{pafDetail.notes}</pre>
                </div>
            )}

            <div className="paf-section paf-status-history">
                <h2>Status History</h2>
                {pafDetail.statusHistory && pafDetail.statusHistory.length > 0 ? (
                    <table>
                        <thead>
                            <tr>
                                <th>Date & Time</th>
                                <th>Status</th>
                                <th>Notes</th>
                                {/* <th>Changed By (User ID)</th> */}
                            </tr>
                        </thead>
                        <tbody>
                            {pafDetail.statusHistory.map((history, index) => (
                                <tr key={index}>
                                    <td>{formatDate(history.changed_at, true)}</td>
                                    <td>{history.status ? history.status.replace(/_/g, ' ') : 'N/A'}</td>
                                    <td>{history.notes || 'N/A'}</td>
                                    {/* <td>{history.changed_by_user_id || 'System'}</td> */}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p>No status history found for this PAF.</p>
                )}
            </div>

            <div className="paf-actions-footer">
                {canAdminApproveAsLO && (
                    <button
                        onClick={() => navigate(`/pafs/approve/${pafDetail.internalDbId}?isAdminApproving=true`)}
                        className="action-button approve-lo-btn"
                    >
                        Approve as List Owner (Admin)
                    </button>
                )}
                {/* TODO: Add other actions based on PAF status and user role */}
                {/* e.g., Button for Licensee to Validate/Sign */}
                {pafDetail.status === 'PENDING_LICENSEE_VALIDATION_US_ONLY' && currentUser?.role === 'ADMIN' && (
                     <button onClick={() => alert('Implement Licensee Validation')} className="action-button">Validate (Licensee)</button>
                )}
            </div>

        </div>
    );
}

export default ViewPafDetails;