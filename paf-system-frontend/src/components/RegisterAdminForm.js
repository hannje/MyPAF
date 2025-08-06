import React, { useState } from 'react';
import axios from 'axios';
import './RegisterUserForm.css'; // Or your chosen CSS file (e.g., AuthForm.css)

// Assuming API_BASE_URL is defined or axios is configured globally
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://10.72.14.19:3443';

function RegisterAdminForm({ onAdminRegistrationSuccess }) { // Optional success callback
  // Admin User's Personal Details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('ADMIN'); // Default or make it a selectable field if needed

  // Licensee Information to be stored on this Admin's User Record
  const [uspsLicenseId, setUspsLicenseId] = useState('');
  const [licenseeName, setLicenseeName] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setStateVal] = useState(''); // Renamed to avoid conflict if 'state' is used for component state
  const [zipCode, setZipCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // UI State
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [brokerListAdminRole, setBrokerListAdminRole] = useState(''); // Default to empty

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    setIsLoading(true);

    // Basic validation
    if (!firstName || !lastName || !email || !password || !uspsLicenseId || !licenseeName || !role) {
      setError('First Name, Last Name, Email, Password, Role, USPS License ID, and Licensee Name are required.');
      setIsLoading(false);
      return;
    }

    const adminData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password: password, // Not trimmed
      role: role,
      brokerListAdmin: brokerListAdminRole, //

      // Licensee information to be stored on this admin's record
      uspsLicenseId: uspsLicenseId.trim(),
      licenseeName: licenseeName.trim(),
      streetAddress: streetAddress.trim() || null, // Send null if empty for optional fields
      city: city.trim() || null,
      state: state.trim() || null,
      zipCode: zipCode.trim() || null,
      phoneNumber: phoneNumber.trim() || null,
      // created_by_admin_id would be set by the backend based on the logged-in super-admin, if applicable
    };

    try {
      console.log('RegisterAdminForm: Submitting to /api/admins/register-admin with data:', adminData);
      // This endpoint now needs to handle creating a user with all these fields
      const response = await axios.post(`${API_BASE_URL}/api/admins/register-admin`, adminData);

      const adminDisplayName = `${response.data.admin.firstName || ''} ${response.data.admin.lastName || ''}`.trim() || response.data.admin.email;
      setMessage(`System Admin "${adminDisplayName}" created successfully!`);

      // Clear form on success
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setRole('ADMIN');
      setUspsLicenseId('');
      setLicenseeName('');
      setStreetAddress('');
      setCity('');
      setStateVal('');
      setZipCode('');
      setPhoneNumber('');

      if (onAdminRegistrationSuccess) {
        onAdminRegistrationSuccess(response.data.admin);
      }
    } catch (err) {
      console.error('Admin registration error:', err.response?.data?.message || err.message || err);
      setError(
        (err.response && err.response.data && err.response.data.message) ||
        err.message ||
        'Failed to create admin. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Using class names that hopefully match your RegisterUserForm.css or a shared AuthForm.css
  return (
    <div className="form-container"> {/* Or "auth-form-container" */}
      <h2>Create New System Admin & Associated Licensee Profile</h2>
      <form onSubmit={handleSubmit} className="form"> {/* Or "auth-form" */}
        <fieldset style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '15px' }}>
          <legend>Admin User Account Details</legend>
          <div className="form-group">
            <label htmlFor="admin-firstName">First Name:</label>
            <input type="text" id="admin-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="admin-lastName">Last Name:</label>
            <input type="text" id="admin-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="admin-email">Email (for login):</label>
            <input type="email" id="admin-email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="admin-password">Password:</label>
            <input type="password" id="admin-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="admin-role">Role:</label>
            <select id="admin-role" value={role} onChange={(e) => setRole(e.target.value)} required>
              <option value="ADMIN">ADMIN</option>
              {/* Add other admin-level roles if you have them, e.g., 'SUPER_ADMIN' */}
            </select>
          </div>

          <div className="form-group">
            <label>Type (Required):</label>
            <div className="radio-group" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <label style={{ cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="brokerListAdminRole"
                  value="broker"
                  checked={brokerListAdminRole === 'broker'}
                  onChange={(e) => setBrokerListAdminRole(e.target.value)}
                  required
                />
                Broker
              </label>
              <label style={{ cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="brokerListAdminRole"
                  value="listadmin"
                  checked={brokerListAdminRole === 'listadmin'}
                  onChange={(e) => setBrokerListAdminRole(e.target.value)}
                  required
                />
                List Administrator
              </label>
            </div>
          </div>

        </fieldset>

        <fieldset style={{ border: '1px solid #ddd', padding: '15px' }}>
          <legend>Licensee Information (associated with this Admin)</legend>
          <div className="form-group">
            <label htmlFor="admin-uspsLicenseId">USPS License ID (Required):</label>
            <input type="text" id="admin-uspsLicenseId" value={uspsLicenseId} onChange={(e) => setUspsLicenseId(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="admin-licenseeName">Licensee Name (Company Name - Required):</label>
            <input type="text" id="admin-licenseeName" value={licenseeName} onChange={(e) => setLicenseeName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="admin-streetAddress">Street Address:</label>
            <input type="text" id="admin-streetAddress" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="admin-city">City:</label>
            <input type="text" id="admin-city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="admin-state">State (e.g., CA):</label>
            <input type="text" id="admin-state" value={state} onChange={(e) => setStateVal(e.target.value)} maxLength="50" placeholder="e.g., California or CA" />
          </div>
          <div className="form-group">
            <label htmlFor="admin-zipCode">Zip Code:</label>
            <input type="text" id="admin-zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="admin-phoneNumber">Phone Number:</label>
            <input type="tel" id="admin-phoneNumber" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
          </div>
        </fieldset>

        <button type="submit" className="submit-button" disabled={isLoading} style={{ marginTop: '20px' }}>
          {isLoading ? 'Creating Admin...' : 'Create System Admin'}
        </button>
      </form>
      {message && <p className="success-message" style={{ color: 'green', marginTop: '10px' }}>{message}</p>}
      {error && <p className="error-message" style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
    </div>
  );
}

export default RegisterAdminForm;