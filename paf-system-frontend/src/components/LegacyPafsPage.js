import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import './AdminDashboard.css'; // Reuse the same CSS styles

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://10.72.14.19:3443/api';

function LegacyPafsPage() {
  const { adminUser } = useContext(AuthContext);
  const [legacyPafs, setLegacyPafs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [legacyPafSort, setLegacyPafSort] = useState('NONE');

  useEffect(() => {
    fetchLegacyPafs();
  }, []);

  const fetchLegacyPafs = async () => {
    try {
      setLoading(true);
      setError('');

      console.log("LegacyPafsPage: Fetching legacy PAFs from API:", `${API_BASE_URL}/dashboard/legacy-pafs`);

      const response = await axios.get(`${API_BASE_URL}/api/dashboard/legacy-pafs`, {
        withCredentials: true
      });

      console.log("LegacyPafsPage: Response data for legacy PAFs:", response.data);

      setLegacyPafs(response.data || []);
    } catch (error) {
      console.error('Error fetching legacy PAFs:', error);
      setError('Could not load legacy PAFs. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  // Sort legacy PAFs based on selected sort option
  const sortedLegacyPafs = useMemo(() => {
    if (legacyPafSort === 'LIST_OWNER_ID') {
      return [...legacyPafs].sort((a, b) => {
        const idA = a.list_owner_id || '';
        const idB = b.list_owner_id || '';
        return idA.localeCompare(idB);
      });
    } else if (legacyPafSort === 'COMPANY') {
      return [...legacyPafs].sort((a, b) => {
        const companyA = (a.company || '').toLowerCase();
        const companyB = (b.company || '').toLowerCase();
        return companyA.localeCompare(companyB);
      });
    } else if (legacyPafSort === 'EXPIRES') {
      return [...legacyPafs].sort((a, b) => {
        const dateA = a.expires ? new Date(a.expires) : new Date(0);
        const dateB = b.expires ? new Date(b.expires) : new Date(0);
        return dateA - dateB;
      });
    } else if (legacyPafSort === 'CUSTOM_ID') {
      return [...legacyPafs].sort((a, b) => {
        const customIdA = a.CustomID || '';
        const customIdB = b.CustomID || '';
        return customIdA.localeCompare(customIdB);
      });
    }
    return legacyPafs;
  }, [legacyPafs, legacyPafSort]);

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Legacy PAFs Display</h1>
        <div className="welcome-message">
          Welcome, {adminUser?.email || 'Admin'}
          <br />
          <small>({adminUser?.role || 'ADMIN'})</small>
        </div>
        <Link to="/admin" className="action-button">← Back to Dashboard</Link>
      </div>

      <div className="action-section">
        <div className="action-ribbon">
          <h2>Legacy PAFs from ncoams.paf_cust_info</h2>
          <div className="button-group">
            <button onClick={fetchLegacyPafs} className="action-button btn-export">
              🔄 Refresh
            </button>
          </div>
        </div>

        <div className="filter-controls" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
          <strong>Sort By: </strong>
          <label style={{ marginLeft: '10px' }}>
            <input
              type="radio"
              value="NONE"
              checked={legacyPafSort === 'NONE'}
              onChange={(e) => setLegacyPafSort(e.target.value)}
            />
            <span style={{ marginLeft: '5px' }}>None</span>
          </label>
          <label style={{ marginLeft: '15px' }}>
            <input
              type="radio"
              value="LIST_OWNER_ID"
              checked={legacyPafSort === 'LIST_OWNER_ID'}
              onChange={(e) => setLegacyPafSort(e.target.value)}
            />
            <span style={{ marginLeft: '5px' }}>List Owner ID</span>
          </label>
          <label style={{ marginLeft: '15px' }}>
            <input
              type="radio"
              value="COMPANY"
              checked={legacyPafSort === 'COMPANY'}
              onChange={(e) => setLegacyPafSort(e.target.value)}
            />
            <span style={{ marginLeft: '5px' }}>Company</span>
          </label>
          <label style={{ marginLeft: '15px' }}>
            <input
              type="radio"
              value="EXPIRES"
              checked={legacyPafSort === 'EXPIRES'}
              onChange={(e) => setLegacyPafSort(e.target.value)}
            />
            <span style={{ marginLeft: '5px' }}>Expires</span>
          </label>
          <label style={{ marginLeft: '15px' }}>
            <input
              type="radio"
              value="CUSTOM_ID"
              checked={legacyPafSort === 'CUSTOM_ID'}
              onChange={(e) => setLegacyPafSort(e.target.value)}
            />
            <span style={{ marginLeft: '5px' }}>Custom ID</span>
          </label>
        </div>

        {error && (
          <div className="message dashboard-error" style={{ color: 'red', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading-text">Loading legacy PAFs...</div>
        ) : legacyPafs.length === 0 ? (
          <div className="no-data">No legacy PAFs found in the system.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="paf-table user-table">
              <thead>
                <tr>
                  <th>LicID</th>
                  <th>ListOwnerID</th>
                  <th>Company</th>
                  <th>Contact Name</th>
                  <th>Email</th>
                  <th>List Name</th>
                  <th>Expires</th>
                  <th>City</th>
                  <th>State</th>
                  <th>ZIP</th>
                  <th>Custom ID</th>
               </tr>
              </thead>
              <tbody>
                {sortedLegacyPafs.map((paf) => (
                  <tr key={paf.id}>
                    <td>{paf.licensee_id}</td>
                    <td>{paf.list_owner_id}</td>
                    <td>{paf.company || 'N/A'}</td>
                    <td>{paf.sign_name || 'N/A'}</td>
                    <td>{paf.email || 'N/A'}</td>
                    <td>{paf.list_name || 'N/A'}</td>
                    <td>{paf.expires || 'N/A'}</td>
                    <td>{paf.city || 'N/A'}</td>
                    <td>{paf.state || 'N/A'}</td>
                    <td>{paf.zip || 'N/A'}</td>
                 
                    <td>{paf.CustomID || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '20px', textAlign: 'center', color: '#6c757d' }}>
          <small>
            Total Legacy PAFs: {legacyPafs.length}
          </small>
        </div>
      </div>
    </div>
  );
}

export default LegacyPafsPage;