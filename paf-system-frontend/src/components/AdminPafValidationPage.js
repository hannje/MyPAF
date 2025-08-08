import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import AuthContext from '../context/AuthContext';

const API_BASE_URL = (process.env.REACT_APP_API_URL || 'https://10.72.14.19:3443') + '/api';

function AdminPafValidationPage() {
  const { pafId } = useParams(); // Get pafId from the URL
  const { adminUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [pafDetails, setPafDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState(''); // State for rejection comments

  useEffect(() => {
    const fetchPafToValidate = async () => {
      if (!pafId) {
        setError("PAF ID not found in URL.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError('');
      try {
        const url = `${API_BASE_URL}/pafs/${pafId}`;
        console.log(`AdminPafValidationPage: Fetching PAF from URL: ${url}`);
        
        const response = await axios.get(url, { withCredentials: true });
        console.log("AdminPafValidationPage: PAF data received:", response.data);
        setPafDetails(response.data);
      } catch (err) {
        console.error("AdminPafValidationPage: Error fetching PAF details:", err.response?.data || err.message || err);
        setError(err.response?.data?.message || "Failed to load PAF details for validation.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPafToValidate();
  }, [pafId]);

  const handleValidationAction = async (action, notes) => { // action: 'APPROVE' or 'REJECT'
    const endpointAction = action === 'APPROVE' ? 'validate-licensee' : 'reject-licensee'; // Example endpoint paths
    setActionMessage('');
    setError('');
    setIsLoading(true);
    try {
      const url = `${API_BASE_URL}/pafs/${pafId}/${endpointAction}`;
      console.log(`AdminPafValidationPage: Submitting action '${action}' to ${url}`);

      const payload = { validationNotes: notes || "Action processed by admin." };
      const response = await axios.put(url, payload, { withCredentials: true }); // Using PUT for state change
      
      setActionMessage(response.data.message || `PAF action '${action}' submitted successfully!`);
      // Update local state to reflect change (e.g., show new status, hide buttons)
      setPafDetails(prevDetails => ({ ...prevDetails, ...response.data.paf }));

    } catch (err) {
      console.error(`AdminPafValidationPage: Error submitting PAF action '${action}':`, err.response?.data || err.message || err);
      setError(err.response?.data?.message || `Failed to submit PAF action '${action}'.`);
    } finally {
      setIsLoading(false);
    }
  };


  if (isLoading && !pafDetails) return <div style={{padding: "20px"}}>Loading PAF for validation...</div>;
  if (error && !pafDetails) return <div style={{padding: "20px", color: "red"}}>Error: {error} <Link to="/admin-dashboard">Back to Dashboard</Link></div>;
  if (!pafDetails) return <div style={{padding: "20px"}}>PAF not found. <Link to="/admin-dashboard">Back to Dashboard</Link></div>;

  const canBeValidated = pafDetails.status === 'PENDING_LICENSEE_VALIDATION_US_ONLY'; // Example status

  return (
    <div className="paf-validation-container" style={{padding: "20px"}}>
      <h1>Admin PAF Validation</h1>
      <h2>PAF: {pafDetails.pafName || pafDetails.listName || 'N/A'} (List Owner ID: {pafDetails.listOwnerId || 'N/A'})</h2>
      <Link to="/admin-dashboard">Back to Dashboard</Link>
      
      {actionMessage && <p style={{color: 'green', fontWeight: 'bold', border: '1px solid green', padding: '10px', marginTop: '15px'}}>{actionMessage}</p>}
      
      {/* Display PAF Details Section */}
      <div style={{marginTop: "20px"}}>
        {/* You can reuse a component to display PAF details if you have one */}
        <p><strong>Status:</strong> {pafDetails.status || 'N/A'}</p>
        <p><strong>List Owner Company:</strong> {pafDetails.companyName || 'N/A'}</p>
        <p><strong>Signer:</strong> {pafDetails.signerName} ({pafDetails.signerTitle})</p>
        {/* ... Display other important PAF details ... */}
      </div>

      {/* Admin Action Section */}
      {canBeValidated ? (
        <div style={{marginTop: "20px", borderTop: '2px solid #ccc', paddingTop: '15px'}}>
          <h3>Admin Actions</h3>
          <button 
            onClick={() => handleValidationAction('APPROVE')} 
            disabled={isLoading} 
            style={{marginRight: "10px", backgroundColor: "green", color: "white"}}
          >
            Approve / Validate PAF
          </button>
          
          <hr style={{margin: '20px 0'}} />
          
          <div>
            <textarea
              rows="3"
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              placeholder="Provide reason for rejection (required)..."
              style={{width: '100%', marginBottom: '10px'}}
            />
            <button 
              onClick={() => handleValidationAction('REJECT', rejectionNotes)} 
              disabled={isLoading || !rejectionNotes} // Disable if no notes
              style={{backgroundColor: "darkred", color: "white"}}
            >
              Reject PAF
            </button>
          </div>
          {error && <p style={{color: 'red'}}>Action Error: {error}</p>}
        </div>
      ) : (
        <p style={{marginTop: '20px', fontWeight: 'bold'}}>No actions available for PAF in status: {pafDetails.status}</p>
      )}
    </div>
  );
}

export default AdminPafValidationPage;