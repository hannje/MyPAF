import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import AuthContext from '../context/AuthContext';

//const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://10.72.14.19:3443';

function AgentApprovalPage() {
  const { pafId } = useParams();
  const { adminUser: loggedInUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [pafDetails, setPafDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Form state
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [dateSigned, setDateSigned] = useState('');

  // Pre-fill signer name/title from logged-in user profile
  useEffect(() => {
    if (loggedInUser) {
      setSignerName(`${loggedInUser.firstName || ''} ${loggedInUser.lastName || ''}`.trim());
      // Assuming agent might have a title on their user record, otherwise they type it
      // setSignerTitle(loggedInUser.title || '');
    }
  }, [loggedInUser]);

  // Fetch PAF details on load
  useEffect(() => {
    // ... (logic to fetch PAF details from GET /api/pafs/:pafId, same as in ViewPafDetails.js) ...
    const fetchPaf = async () => {
        setIsLoading(true); setError('');
        try {
            const response = await axios.get(`${API_BASE_URL}/api/pafs/${pafId}`, { withCredentials: true });
            setPafDetails(response.data);
        } catch (err) { setError(err.response?.data?.message || "Failed to load PAF."); }
        finally { setIsLoading(false); }
    };
    if (pafId) fetchPaf();
  }, [pafId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true); setError(''); setMessage('');
    try {
      const url = `${API_BASE_URL}/api/pafs/${pafId}/agent-approve`;
      const payload = {
        signerName: signerName,
        signerTitle: signerTitle,
        signatureData: signerName, // Using typed name as signature
        dateSigned: dateSigned,
      };
      const response = await axios.put(url, payload, { withCredentials: true });
      setMessage(response.data.message || "PAF Approved! The List Owner will now be notified.");
      setPafDetails(response.data.paf); // Update with new status
    } catch (err) {
      setError(err.response?.data?.message || "Failed to approve PAF.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !pafDetails) return <div>Loading...</div>;
  if (error && !pafDetails) return <div style={{color: 'red'}}>Error: {error}</div>;
  if (!pafDetails) return <div>PAF not found.</div>;
  
  const canBeApproved = pafDetails.status === 'PENDING_AGENT_APPROVAL';

  return (
    <div className="form-container">
      <h2>Agent/Broker PAF Approval</h2>
      <p><strong>List Name:</strong> {pafDetails.listName}</p>
      <p><strong>Company:</strong> {pafDetails.companyName}</p>
      <p><strong>Status:</strong> {pafDetails.status}</p>

      {canBeApproved ? (
        <form onSubmit={handleSubmit} className="form" style={{marginTop: '20px'}}>
          <p>Please review the PAF details and provide your signature to approve.</p>
          <fieldset>
            <legend>Your Signature Details</legend>
            <div className="form-group">
              <label>Signer Name:</label>
              <input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Signer Title:</label>
              <input type="text" value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Date Signed:</label>
              <input type="date" value={dateSigned} onChange={(e) => setDateSigned(e.target.value)} required />
            </div>
          </fieldset>
          <button type="submit" className="submit-button" disabled={isLoading}>
            {isLoading ? 'Submitting...' : 'Approve and Submit'}
          </button>
        </form>
      ) : (
        <p style={{fontWeight: 'bold', marginTop: '20px'}}>No action required at this time.</p>
      )}

      {message && <p className="success-message">{message}</p>}
      {error && !message && <p className="error-message">{error}</p>}
      <Link to={loggedInUser?.role === 'ADMIN' ? "/admin-dashboard" : "/user-dashboard"} style={{display: 'block', marginTop: '20px'}}>
          Back to Dashboard
      </Link>
    </div>
  );
}

export default AgentApprovalPage;