import React, { useState,useEffect } from 'react'; // Removed useContext for now, assuming backend uses session for creator ID
import axios from 'axios';
import './RegisterUserForm.css'; // Or your shared form CSS

const API_BASE_URL = 'https://10.72.14.19:3443';

function RegisterUserForm({ onUserCreationSuccess }) {
  // User's own details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('USER');

  const [brokerListAdminRole, setBrokerListAdminRole] = useState(''); // Default to empty
  
  const [sic, setSic] = useState('');
  const [naicsCodes, setNaicsCodes] = useState([]);
  const [isLoadingNaics, setIsLoadingNaics] = useState(true);

useEffect(() => {
    const fetchNaicsCodes = async () => {
      setIsLoadingNaics(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/data/naics-codes`);
        if (Array.isArray(response.data)) {
          setNaicsCodes(response.data);
        }
      } catch (error) {
        console.error("RegisterUserForm: Failed to fetch NAICS codes:", error);
      } finally {
        setIsLoadingNaics(false);
      }
    };
    fetchNaicsCodes();
  }, []); // Runs once on mount


  // Company/Address details for THIS user
  // This implies each user can have their own company name and address,
  // even if they are created by an admin of a main licensee.
  // If these should default to the admin's licensee info, that's a display/logic choice.
  const [companyName, setCompanyName] = useState(''); // This could be 'licensee_name' on their user record
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setStateVal] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    setIsLoading(true);

    // Basic validation
    if (!firstName || !lastName || !email || !password || !role) {
      setError('First Name, Last Name, Email, Password, and Role are required.');
      setIsLoading(false);
      return;
    }
    // Add validation for companyName if it's required for new users

    const newUserData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password: password,
      role: role,
      brokerListAdmin: brokerListAdminRole, 

      sic: sic,


      // Company/Address details for this specific user
      // These will be stored on their own record in the users table.
      // The backend 'users' table needs columns like 'licensee_name' (for companyName),
      // 'street_address', 'city', 'state', 'zip_code', 'phone_number'.
      licenseeName: companyName.trim() || null, // Using 'licenseeName' key to match table schema
      streetAddress: streetAddress.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      zipCode: zipCode.trim() || null,
      phoneNumber: phoneNumber.trim() || null,
      adminID:1
      // created_by_admin_id will be set by the backend based on the logged-in admin's session
    };

    try {



      console.log('RegisterUserForm: Submittingxxx to /api/users/create-by-admin with data:', newUserData);
     
      const url = new URL('/api/users/create-by-admin', API_BASE_URL);
      console.log('API URL:', url.toString());
        
     // const response = await axios.post(`${API_BASE_URL}/api/users/create-by-admin`,newUserData,{
      const response = await axios.post(url,newUserData,{
        withCredentials: true});


      const userDisplayName = `${response.data.user.firstName || ''} ${response.data.user.lastName || ''}`.trim() || response.data.user.email;
      setMessage(`User "${userDisplayName}" created successfully!`);

      // Clear form
      setFirstName(''); setLastName(''); setEmail(''); setPassword(''); setRole('USER');
      setCompanyName(''); setStreetAddress(''); setCity(''); setStateVal(''); setZipCode(''); setPhoneNumber('');

      if (onUserCreationSuccess) {
        onUserCreationSuccess(response.data.user);
      }
    } catch (err) {
      // ... (error handling as before) ...
      console.log('RegisterUserForm: User creation error:', err.response?.data?.message || err.message || err);
      console.error('User creation error:', err.response?.data?.message || err.message || err);
      setError(
        (err.response && err.response.data && err.response.data.message) ||
        err.message ||
        'Failed to create user. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h2>Create New User</h2>
      <p><em>This user will be associated with your administrator account. Fill in their details below.</em></p>
      <form onSubmit={handleSubmit} className="form">
        <fieldset style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '15px' }}>
          <legend>User Account Details</legend>
          <div className="form-group">
            <label htmlFor="create-user-firstName">First Name:</label>
            <input type="text" id="create-user-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="create-user-lastName">Last Name:</label>
            <input type="text" id="create-user-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="create-user-email">Email (for login):</label>
            <input type="email" id="create-user-email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="create-user-password">Password:</label>
            <input type="password" id="create-user-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
  
  
          <div className="form-group">
            <label>Type (Required):</label>
            <div className="radio-group">
              <label style={{ marginRight: '20px', cursor: 'pointer' }}>
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
         <div className="form-group">
            <label htmlFor="user-sic">NAICS Code (Required):</label>
            <select
              id="user-sic"
              value={sic}
              onChange={(e) => setSic(e.target.value)}
              disabled={isLoadingNaics}
              required
            >
              <option value="">
                {isLoadingNaics ? 'Loading NAICS codes...' : 'Select a NAICS Code'}
              </option>
              {naicsCodes.map(naics => (
                <option key={naics.code} value={naics.code}>
                  {naics.label}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <fieldset style={{ border: '1px solid #ddd', padding: '15px' }}>
          <legend>User's Company & Address Information (Optional)</legend>
          <p style={{fontSize: '0.9em', color: '#555'}}>
            Provide these if this user has distinct company/address details.
            Otherwise, they are associated with your main Licensee scope.
            The `usps_license_id` for this user will be inherited from you (the creating admin).
          </p>
          <div className="form-group">
            <label htmlFor="create-user-companyName">Company Name (if different):</label>
            <input type="text" id="create-user-companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="create-user-streetAddress">Street Address:</label>
            <input type="text" id="create-user-streetAddress" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="create-user-city">City:</label>
            <input type="text" id="create-user-city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="create-user-state">State:</label>
            <input type="text" id="create-user-state" value={state} onChange={(e) => setStateVal(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="create-user-zipCode">Zip Code:</label>
            <input type="text" id="create-user-zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="create-user-phoneNumber">Phone Number:</label>
            <input type="tel" id="create-user-phoneNumber" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
          </div>
        </fieldset>

        <button type="submit" className="submit-button" disabled={isLoading} style={{ marginTop: '20px' }}>
          {isLoading ? 'Creating User...' : 'Create User'}
        </button>
      </form>
      {message && <p className="success-message" style={{ color: 'green', marginTop: '10px' }}>{message}</p>}
      {error && <p className="error-message" style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
    </div>
  );
}

export default RegisterUserForm;