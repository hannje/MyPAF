import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
// import apiService from '../services/apiService'; // Or your API utility
 
function CreateAdminForm() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [uspsLicenseId, setUspsLicenseId] = useState('');
  const [licenseeName, setLicenseeName] = useState(''); // Optional: For new party creation
  const [role, setRole] = useState('SYSTEM_ADMIN'); // Default role, could be a select dropdown

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    setIsLoading(true);

    if (!username || !email || !password || !uspsLicenseId) {
      setError('Username, Email, Password, and USPS License ID are required.');
      setIsLoading(false);
      return;
    }

    const adminData = {
      username,
      email,
      password,
      uspsLicenseId: uspsLicenseId.trim(),
      licenseeName: licenseeName.trim() || undefined, // Send only if provided
      role,
    };

    try {
      // Replace with your actual API call logic
      // Example using fetch:
      const response = await fetch('/api/admins/create-admin', { // Your actual API endpoint
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add Authorization header if needed:
          // 'Authorization': `Bearer ${yourAuthToken}`
        },
        body: JSON.stringify(adminData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      setMessage(`Admin "${data.admin.username}" created successfully!`);
      // Optionally clear the form
      setUsername('');
      setEmail('');
      setPassword('');
      setUspsLicenseId('');
      setLicenseeName('');
      // Optionally redirect or update a list of admins
    } catch (err) {
      console.error('Failed to create admin:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2>Create New System Admin</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="username">Username:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="uspsLicenseId">USPS License ID:</label>
          <input
            type="text"
            id="uspsLicenseId"
            value={uspsLicenseId}
            onChange={(e) => setUspsLicenseId(e.target.value)}
            placeholder="Enter USPS License ID"
            required
          />
        </div>
        <div>
          <label htmlFor="licenseeName">Licensee Name (if new Licensee ID):</label>
          <input
            type="text"
            id="licenseeName"
            value={licenseeName}
            onChange={(e) => setLicenseeName(e.target.value)}
            placeholder="Optional: Name for a new Licensee"
          />
        </div>
        <div>
          <label htmlFor="role">Role:</label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="SYSTEM_ADMIN">System Admin</option>
            {/* Add other roles if applicable */}
            {/* <option value="LICENSEE_ADMIN">Licensee Admin</option> */}
          </select>
        </div>

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Admin'}
        </button>
      </form>

      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

export default CreateAdminForm;