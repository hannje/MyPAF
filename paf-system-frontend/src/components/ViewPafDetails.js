// mypafreact/paf-system-frontend/src/components/ViewPafDetails.js
import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthContext from '../context/AuthContext'; // To get loggedInUser for context or potential checks
import './ViewPafDetails.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://10.72.14.19:3443';

function ViewPafDetails() {
  const { pafDbId } = useParams(); // Gets 'pafDbId' from the URL if your route is /pafs/view/:pafDbId
                                 // If your route is /pafs/:id, then it would be { id }
  const { adminUser: loggedInUser } = useContext(AuthContext); // Get logged in user

  const [pafDetails, setPafDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const navigate = useNavigate(); 

  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [showHistory, setShowHistory] = useState(false); // To toggle visibility

const [isRenewing, setIsRenewing] = useState(false); // New state for renewal action
const [isExporting, setIsExporting] = useState(false); // New state for export action


  useEffect(() => {
    const fetchPaf = async () => {

         console.log(`ViewPafDetails: pafDbId from useParams is: '${pafDbId}'`); // <<< LOG THIS
 
      if (!pafDbId) { // Or !id from useParams()
        setIsLoading(false);
        setError("PAF ID not found in URL.");
        return;
      }
      setIsLoading(true);
      setError('');
      try {
        console.log(`ViewPafDetails: Fetching PAF with ID: ${pafDbId}`);
        const response = await axios.get(`${API_BASE_URL}/api/pafs/${pafDbId}`, {
          withCredentials: true, // For session cookie
        });
        console.log("ViewPafDetails: PAF data received:", response.data);
        setPafDetails(response.data);
      } catch (err) {
        console.error("ViewPafDetails: Error fetching PAF details:", err.response?.data || err.message || err);
        setError(err.response?.data?.message || "Failed to load PAF details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaf();
  }, [pafDbId]); // Re-fetch if pafDbId changes

  if (isLoading) return <div style={{padding: "20px"}}>Loading PAF details...</div>;
  if (error) return <div style={{padding: "20px", color: "red"}}>Error: {error} <Link to={loggedInUser?.role === 'ADMIN' ? "/admin-dashboard" : "/user-dashboard"} className="back-to-dashboard-link">Go to Dashboard</Link></div>;
  if (!pafDetails) return <div style={{padding: "20px"}}>PAF not found. <Link to={loggedInUser?.role === 'ADMIN' ? "/admin-dashboard" : "/user-dashboard"} className="back-to-dashboard-link">Go to Dashboard</Link></div>;



   const handleRenewPaf = async () => {
    const newDate = prompt("Please enter the new 'Date Signed' for this renewal (YYYY-MM-DD):");
    if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      alert("Invalid date format. Please use YYYY-MM-DD.");
      return;
    }

    setIsRenewing(true);
    try {
      const url = `${API_BASE_URL}/api/pafs/${pafDbId}/renew`;
      const response = await axios.put(url, { newSignedDate: newDate }, { withCredentials: true });
      
      alert(response.data.message || "PAF renewed successfully!");
      setPafDetails(response.data.paf); // Update the page with the renewed PAF data

    } catch (error) {
      console.error("Error renewing PAF:", error.response?.data || error.message);
      alert(`Error: ${error.response?.data?.message || "Failed to renew PAF."}`);
    } finally {
      setIsRenewing(false);
    }
  };
  
  // Helper to display names
  const formatUserName = (firstName, lastName, email) => {
    if (firstName && lastName) return `${firstName} ${lastName} (${email})`;
    return email || 'N/A';
  }

 const handleFetchHistory = async () => {
    // If history is already shown, hide it. Otherwise, fetch it.
    if (showHistory) {
      setShowHistory(false);
      return;
    }

    setIsLoadingHistory(true);
    setHistoryError('');
    try {
      const url = `${API_BASE_URL}/api/pafs/${pafDbId}/history`;
      console.log(`ViewPafDetails: Fetching PAF history from ${url}`);
      
      const response = await axios.get(url, { withCredentials: true });
      
      console.log("ViewPafDetails: History data received:", response.data);
      setHistory(response.data);
      setShowHistory(true); // Show the history section after fetching

    } catch (err) {
      console.error("ViewPafDetails: Error fetching history:", err.response?.data || err.message);
      setHistoryError(err.response?.data?.message || "Failed to load history.");
      setShowHistory(true); // Still show the history section to display the error
    } finally {
      setIsLoadingHistory(false);
    }
  };
 


const handleGeneratePdf = () => {
    setIsGeneratingPdf(true);
    console.log(`ViewPafDetails: Requesting PDF for PAF ID: ${pafDbId}`);
    
    // We use window.open for direct download. The browser will handle sending
    // the necessary session cookie automatically for this request.
    const pdfUrl = `${API_BASE_URL}/api/pafs/${pafDbId}/download-pdf`;
    
    window.open(pdfUrl, '_blank');
    
    // We can't easily know when the download is finished, so just reset the button state after a short delay.
    setTimeout(() => {
        setIsGeneratingPdf(false);
    }, 3000); // Reset after 3 seconds
  };


  const handleRenewPafz = () => {
    if (!pafDetails) {
      alert("PAF data not loaded yet. Please wait.");
      return;
    }
    console.log("ViewPafDetails: Renewing PAF. Passing this data to creation form:", pafDetails);
    
    // Use navigate to go to the creation form page, and pass the pafDetails
    // object in the navigation state.
    navigate('/pafs/new', { state: { initialPafData: pafDetails } });
  };

  const handleExportPaf = async () => {
    setIsExporting(true);
    try {
      console.log(`ViewPafDetails: Exporting PAF with ID: ${pafDbId}`);
      const response = await axios.get(`${API_BASE_URL}/api/pafs/:pafId/migrate-sql`, {}, {
        withCredentials: true,                            
        responseType: 'blob'
      });
      
      // Create a download link for the exported file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `PAF_${pafDetails.fullPafId || pafDbId}_export.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      console.log("ViewPafDetails: PAF exported successfully");
    } catch (err) {
      console.error("ViewPafDetails: Error exporting PAF:", err.response?.data || err.message);
      alert(`Error: ${err.response?.data?.message || "Failed to export PAF."}`);
    } finally {
      setIsExporting(false);
    }
  };

 // Helper to display PAF Type
  const getPafTypeDescription = (type) => {
    switch(type) {
      case 'I': return 'Initial';
      case 'M': return 'Modified';
      case 'R': return 'Renewed';
      default: return 'Unknown';
    }
  };


  return (
    <div className="paf-details-container" style={{padding: "20px"}}>

     <div className="action-buttons-section">
 
    <h3>Actions</h3>
        <button className="action-button pdf-button" onClick={handleGeneratePdf} disabled={isGeneratingPdf}>
            {isGeneratingPdf ? 'Generating PDF...' : 'Download as PDF'}
        </button>
     
        <button className="action-button modify-button" onClick={handleRenewPafz}>
          Modify PAF
        </button>

        <button className="action-button renew-button" onClick={handleRenewPaf} disabled={isRenewing}>
          {isRenewing ? 'Renewing...' : 'Renew PAF'}
        </button>
 
         <button className="action-button history-button" onClick={handleFetchHistory} disabled={isLoadingHistory}>
          {isLoadingHistory ? 'Loading History...' : (showHistory ? 'Hide History' : 'Show PAF History')}
        </button>

        {pafDetails?.status === 'LICENSEE_VALIDATED' && (
          <button className="action-button export-button" onClick={handleExportPaf} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export PAF'}
          </button>
        )}
   
 
 
      {showHistory && (
        <section className="history-section" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fdfdfd', border: '1px solid #eee' }}>
          <h3>PAF Status History</h3>
          {isLoadingHistory && <p>Loading...</p>}
          {historyError && <p style={{color: 'red'}}>{historyError}</p>}
          {!isLoadingHistory && !historyError && (
            history.length > 0 ? (
              <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', backgroundColor: '#333', color: 'white', padding: '1rem', borderRadius: '5px' }}>
                {/* Dump the JSON data directly into a <pre> tag */}
                {JSON.stringify(history, null, 2)}
              </pre>
            ) : (
              <p>No history records found for this PAF.</p>
            )
          )}
        </section>
      )}
     

     
      </div>



      <h1>PAF Details: {pafDetails.fullPafId || 'N/A'} (ID: {pafDetails.listOwnerId || 'N/A'})</h1>
      <Link to={loggedInUser?.role === 'ADMIN' ? "/admin-dashboard" : "/user-dashboard"} className="back-to-dashboard-link">Back to Dashboard</Link>
      
      <div style={{marginTop: "20px"}}>
        {/* Display all the PAF details from pafDetails object */}
        <p><strong>Status:</strong> {pafDetails.status || 'N/A'}</p>
        <p><strong>List Name:</strong> {pafDetails.listName || 'N/A'}</p>
        <p><strong>Frequency:</strong> {pafDetails.frequency || 'N/A'}</p>
        {pafDetails.customId && (
          <p><strong>Custom ID:</strong> {pafDetails.customId}</p>
        )}

        <h3>List Owner Information</h3>
        <p><strong>Company:</strong> {pafDetails.companyName || 'N/A'}</p>
        <p><strong>USPS License ID (Scope):</strong> {pafDetails.pafLicenseeUspsId || 'N/A'}</p>
        <p><strong>Licensee Company (Scope):</strong> {pafDetails.pafLicenseeCompanyName || 'N/A'}</p>
        <p><strong>Street:</strong> {pafDetails.streetAddress || 'N/A'}</p>
        {/* ... Add all other fields from pafDetails ... */}
        <p><strong>Signer:</strong> {pafDetails.signerName} ({pafDetails.signerTitle})</p>
        <p><strong>Date Signed:</strong> {pafDetails.dateSigned ? new Date(pafDetails.dateSigned).toLocaleDateString() : 'N/A'}</p>

        <h3>Administrative Details</h3>
        <p><strong>PAF Record ID (DB):</strong> {pafDetails.id}</p>
        <p><strong>Created By:</strong> {formatUserName(pafDetails.creatorFirstName, pafDetails.creatorLastName, pafDetails.creatorEmail)}</p>
        <p><strong>Licensee Admin Contact:</strong> {formatUserName(pafDetails.licenseeFirstName, pafDetails.licenseeLastName, pafDetails.licenseeEmail)}</p>
        {pafDetails.agentId && (
            <p><strong>Agent:</strong> {formatUserName(pafDetails.agentFirstName, pafDetails.agentLastName, pafDetails.agentEmail)}
               {pafDetails.agentSignedDate && ` (Signed: ${new Date(pafDetails.agentSignedDate).toLocaleDateString()})`}
            </p>
        )}
        <p><strong>PAF Created On:</strong> {pafDetails.createdAt ? new Date(pafDetails.createdAt).toLocaleString() : 'N/A'}</p>
        <p><strong>Last Updated:</strong> {pafDetails.updatedAt ? new Date(pafDetails.updatedAt).toLocaleString() : 'N/A'}</p>
        <p><strong>PAF Type:</strong> {getPafTypeDescription(pafDetails.pafType)} ({pafDetails.pafType})</p>
         
        {pafDetails.notes && <div><strong>Notes:</strong><pre>{pafDetails.notes}</pre></div>}
      </div>
    </div>
  );
}

export default ViewPafDetails;