import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import {  useNavigate } from 'react-router-dom'; // useNavigate for programmatic navigation




function PafTableRow({ paf, onSelfApprove,formatDate }) { // Receive the paf object and the handler function as props
  const { adminUser } = useContext(AuthContext); // Get the logged-in admin user

  // The logic for this specific row is now contained within this component
  const isAdminTheCreator = adminUser && paf.createdByUserId === adminUser.id;

    const navigate = useNavigate();


 // --- NEW LOGIC TO DETERMINE DISPLAY STATUS ---
  let displayStatus = paf.status; // Start with the status from the database


  let expirationClass = ''; // Default to no special class

//  console.log(`PafTableRow: Initial displayStatus`, paf,isAdminTheCreator); // Debug log

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to the beginning of today for a clean date comparison

  // Define statuses that are considered "expirable"
  const expirableStatuses = ['ACTIVE', 'LICENSEE_VALIDATED', 'PROCESSING_COMPLETE']; // <<< ADJUST THIS LIST

  if (paf.expiration && expirableStatuses.includes(paf.status)) {
    // Create date object from expirationDate, ensuring no timezone shift
    const expirationDate = new Date(paf.expiration); // Treat as UTC date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    thirtyDaysFromNow.setHours(0, 0, 0, 0);

    console.log("PafTableRow: Checking expiration date", expirationDate); // Debug log
    
    if (expirationDate < today) {
      console.log(`PafTableRow: PAF has expired`, paf); // Debug log
      displayStatus = 'EXPIRED'; // Override the status for display
    }
    else if (expirationDate <= thirtyDaysFromNow) {
      // VVVVVV NEW LOGIC FOR EXPIRING SOON VVVVVV
      expirationClass = 'date-expiring-soon'; // Class for dates expiring soon
    }
  }
  // --- END OF NEW LOGIC ---


console.log(`PafTableRow: adminuser`, adminUser); // Debug log

console.log(`PafTableRow: paf`, paf); // Debug log
  // Helper function to determine the CSS class based on status
   const getStatusClass = (status) => {
    if (!status) return 'status-other';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('agent')) return 'status-agent-approval'; 
    if (lowerStatus.includes('expired')) return 'status-expired'; // <<< NEW CLASS
    if (lowerStatus.includes('pending')) return 'status-pending';
    if (lowerStatus.includes('rejected')) return 'status-rejected';
    if (lowerStatus.includes('active') || lowerStatus.includes('validated')) return 'status-active';
    return 'status-other';
  };
  const statusClassName = getStatusClass(displayStatus);





  console.log(`PafTableRow: Rendering row for PAF`,paf); // Debug log
  return (
    <tr key={paf.id}>
      <td>{paf.licenseeId}</td>
      <td>{paf.fullPafId? paf.fullPafId: paf.listOwnerId}</td>

      <td>{paf.createdByUserId}</td>
      <td>{paf.agentId}</td>
    
      <td>{paf.jurisdiction}</td>
      <td>{paf.companyName}</td>
      <td>{paf.listOwnerSic}</td>

   <td>
        <span className={`status-badge ${statusClassName}`}>
          {displayStatus.replace(/_/g, ' ')}
        </span>
      </td>     
      
      <td>{paf.pafType}</td>

      
      <td>{paf.createdAt ? new Date(paf.createdAt).toLocaleDateString() : 'N/A'}</td>

      <td className={expirationClass}>{paf.expiration ? new Date(paf.expiration).toLocaleDateString() : 'N/A'}</td>

      <td className="actions">
        <Link to={`/pafs/view/${paf.id}`}>View Details</Link>
        
        {/* --- The conditional logic is now cleanly inside this component --- */}
        {(paf.status === 'PENDING_LIST_OWNER_APPROVAL' ||paf.status === 'PENDING_LIST_OWNER_SIGNATURE') && isAdminTheCreator && (
          <button 

          onClick={() => navigate(`/pafs/approve/${paf.id}`)}
                     
           >
            Approve PAF
          </button>
        )}

        {/* --- You can also move the logic for the other button here --- */}
        {paf.status === 'PENDING_LICENSEE_VALIDATION_US_ONLY' && paf.licenseeId === adminUser.uspsLicenseId && (
         <Link
            to={`/admin/pafs/validate/${paf.id}`} // <<<< Link to the new page
            style={{ marginLeft: '10px', display: 'inline-block', padding: '5px 10px', backgroundColor: '#ffc107', color: 'black', textDecoration: 'none', borderRadius: '3px' }}
          >
            Validate (Licensee)
          </Link>        )}

        {paf.status === 'PENDING_AGENT_APPROVAL' && adminUser?.id === paf.agentId && (
          <Link
            to={`/pafs/agent-approve/${paf.id}`}
            style={{ marginLeft: '10px', backgroundColor: '#007bff', color: 'white', padding: '5px 10px', textDecoration: 'none', borderRadius: '3px' }}
          >
            Agent Approve
          </Link>
        )}



      </td>
    </tr>
  );
}

export default PafTableRow;