import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import AuthContext from '../context/AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://10.72.14.19:3443';

function EditUserForm() {
   const { userId: userIdFromParams } = useParams(); 
  const navigate = useNavigate();
//  const { adminUser } = useContext(AuthContext);

  const { adminUser: loggedInUser } = useContext(AuthContext); // Renamed for clarity

   const isSelfEdit = !userIdFromParams;
  const userIdToEdit = isSelfEdit ? loggedInUser?.id : userIdFromParams;


  const [formData, setFormData] = useState(null); // Will hold all user form fields
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [signatureFile, setSignatureFile] = useState(null); // State for the selected file
  const [isUploading, setIsUploading] = useState(false);





  // Fetch user data on component mount
  useEffect(() => {
    const fetchUser = async () => {

          console.log("EditUserForm: userId from useParams() is:", userIdToEdit); 

      if (!userIdToEdit) {
        // This can happen briefly before loggedInUser is populated from context
        // or if an admin navigates to the edit page without a userId
        console.log("EditUserForm: Waiting for user ID...");
        return;
      }

      setIsLoading(true);
      setError('');
      try {
        const url = `${API_BASE_URL}/api/users/${userIdToEdit}`;
        console.log(`EditUserForm: Fetching user data from ${url}`);
        const response = await axios.get(url, { withCredentials: true });
        console.log("EditUserForm: User data received:", response.data);
        setFormData(response.data); // Set the entire user object to state
      } catch (err) {
        console.error("EditUserForm: Error fetching user:", err.response?.data || err.message);
        setError(err.response?.data?.message || "Failed to load user data.");
      } finally {
        setIsLoading(false);
      }
    };
    if (userIdToEdit) {
      fetchUser();
    }
  }, [userIdToEdit]);

  // Generic handler for form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

const handleResetPassword = async () => {
    const newPassword = prompt("Please enter the new password for this user.\n(Minimum 8 characters)");

    if (!newPassword) {
      alert("Password reset cancelled.");
      return;
    }
    if (newPassword.length < 8) {
      alert("Password must be at least 8 characters long.");
      return;
    }
    if (!window.confirm("Are you sure you want to reset this user's password? This action cannot be undone.")) {
        return;
    }

 // 4. SET LOADING STATE
  setIsLoading(true);
  setError('');
  setMessage('');

  try {
    // 5. API CALL
    const url = `${API_BASE_URL}/api/users/${userIdToEdit}/reset-password`;
    console.log(`EditUserForm: Submitting password reset to ${url}`); // <<< THIS LOG SHOULD APPEAR

    const response = await axios.post(url, 
      { newPassword: newPassword },
      { withCredentials: true }
    );
    
    // ... success handling ...

  } catch (err) {
    // ... error handling ...
  } finally {
    setIsLoading(false);
  }


}

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      const url = `${API_BASE_URL}/api/users/${userIdToEdit}`;
      console.log(`EditUserForm: Submitting updates to ${url}`);
      
      const response = await axios.put(url, formData, { withCredentials: true });
      
      setMessage(response.data.message || 'User updated successfully!');
      // Optionally navigate back to the dashboard after a short delay
      setTimeout(() => navigate('/admin-dashboard'), 2000);

    } catch (err) {
      console.error("EditUserForm: Error updating user:", err.response?.data || err.message);
      setError(err.response?.data?.message || "Failed to update user.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !formData) return <div style={{padding: '20px'}}>Loading user for editing...</div>;
  if (error) return <div style={{padding: '20px', color: 'red'}}>Error: {error} <Link to="/admin-dashboard">Back to Dashboard</Link></div>;
  if (!formData) return <div style={{padding: '20px'}}>No user data to display.</div>;


 const handleFileChange = (event) => {
    setSignatureFile(event.target.files[0]); // Get the first selected file
  };

  const handleSignatureUpload = async () => {
    if (!signatureFile) {
      alert("Please select an image file first.");
      return;
    }

    setIsUploading(true);
    setError(''); // Clear previous errors

    // We use FormData to send files
    const formDataPayload = new FormData();
    formDataPayload.append('signatureImage', signatureFile); // 'signatureImage' MUST match the name in upload.single()

    try {
      const url = `${API_BASE_URL}/api/users/${userIdToEdit}/upload-signature`;
      console.log(`EditUserForm: Uploading signature to ${url}`);

      const response = await axios.post(url, formDataPayload, {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data', // Axios usually sets this automatically with FormData
        },
      });

      // Update the main form data state with the new filename from the server
      setFormData(prevData => ({
        ...prevData,
        signatureFile: response.data.fileName
      }));
      setSignatureFile(null); // Clear the file input state
      alert(response.data.message || "Signature uploaded successfully!");

    } catch (err) {
      console.error("EditUserForm: Error uploading signature:", err.response?.data || err.message);
      setError(err.response?.data?.message || "Failed to upload signature.");
    } finally {
      setIsUploading(false);
    }
  }; 






  return (
    <div className="form-container">
      <h2>Edit User: {formData.firstName} {formData.lastName} (ID: {formData.id})</h2>
      <Link to="/admin-dashboard">Back to Dashboard</Link>
      
            <div style={{ margin: "20px 0", padding: "15px", border: "1px solid #c00", backgroundColor: "#f8d7da", borderRadius: "5px" }}>
        <h4>Reset Password</h4>
        <p>This will immediately change the user's password. The user will be notified via email.</p>
        <button 
            onClick={handleResetPassword} 
            disabled={isLoading}
            style={{ backgroundColor: "#dc3545", color: "white", border: "none", padding: "10px 15px", cursor: "pointer" }}
        >
            Reset User's Password
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="form" style={{marginTop: '20px'}}>
        {/* We can use the same fieldsets as the creation forms */}
        <fieldset>
          <legend>User Account Details</legend>
          <div className="form-group">
            <label>First Name:</label>
            <input type="text" name="firstName" value={formData.firstName || ''} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Last Name:</label>
            <input type="text" name="lastName" value={formData.lastName || ''} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Email:</label>
            <input type="email" name="email" value={formData.email || ''} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Role:</label>
            <select name="role" value={formData.role || ''} onChange={handleChange} required>
              <option value="USER">User</option>
              <option value="PAF_OPERATOR">PAF Operator</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label>Type:</label>
            <select name="brokerListAdmin" value={formData.brokerListAdmin || ''} onChange={handleChange} required>
                <option value="">Select Type</option>
                <option value="broker">Broker</option>
                <option value="listadmin">List Administrator</option>
            </select>
          </div>
          <p><small>Password cannot be changed from this form.</small></p>
        </fieldset> 

 <fieldset style={{ border: '1px solid #ddd', padding: '15px', marginTop: '20px' }}>
        <legend>Signature Image</legend>
        
        {/* Display the current signature if it exists */}
        {formData.signatureFile && (
          <div className="current-signature">
            <p>Current Signature on File:</p>
            <img 
              src={`${API_BASE_URL}/signatures/${formData.signatureFile}`} 
              alt="User's signature"
              style={{ maxWidth: '300px', border: '1px solid #ccc', padding: '5px' }}
            />
          </div>
        )}

        <div className="form-group" style={{marginTop: '15px'}}>
          <label htmlFor="signature-upload">Upload New Signature (Optional):</label>
          <input 
            type="file" 
            id="signature-upload"
            accept="image/png, image/jpeg, image/gif" // Restrict to image types
            onChange={handleFileChange}
          />
        </div>
        <button 
          type="button" // Important: type="button" to not submit the main form
          onClick={handleSignatureUpload}
          disabled={!signatureFile || isUploading}
        >
          {isUploading ? 'Uploading...' : 'Upload Signature File'}
        </button>
      </fieldset>




        <fieldset>
          <legend>User's Company & Address Information</legend>
          <div className="form-group">
            <label>Company Name:</label>
            <input type="text" name="licenseeName" value={formData.licenseeName || ''} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>NAICS Code (SIC):</label>
            {/* For simplicity, this is a text input. For a dropdown, you'd need the NAICS fetch logic here too. */}
            <input type="text" name="sic" value={formData.sic || ''} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Street Address:</label>
            <input type="text" name="streetAddress" value={formData.streetAddress || ''} onChange={handleChange} />
          </div>
          {/* ... other address inputs (city, state, zipCode, phoneNumber) with name attribute matching formData keys ... */}
        </fieldset>
        
        <fieldset>
            <legend>System IDs (Read-Only)</legend>
            <p><strong>USPS ID:</strong> {formData.uspsId || 'N/A'}</p>
            <p><strong>USPS License ID (Scope):</strong> {formData.uspsLicenseId || 'N/A'}</p>
            <p><strong>Created By Admin ID:</strong> {formData.createdByAdminId || 'N/A'}</p>
        </fieldset>

        <button type="submit" className="submit-button" disabled={isLoading} style={{ marginTop: '20px' }}>
          {isLoading ? 'Saving Changes...' : 'Save Changes'}
        </button>
      </form>
      {message && <p className="success-message" style={{ color: 'green', marginTop: '10px' }}>{message}</p>}
      {error && !message && <p className="error-message" style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
    </div>
  );
}

export default EditUserForm;