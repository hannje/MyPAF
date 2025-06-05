import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './CreatePafform.css';

const API_BASE_URL = 'http://localhost:3001/api';

function CreatePafForm() {
    const [formData, setFormData] = useState({
        listOwnerId: '',
        licenseeId: '2', // Example: Assuming Licensee party_id 1 is your org
        brokerAgentId: '',
        listAdministratorId: '',
        pafType: 'SERVICE_PROVIDER',
        jurisdiction: 'US',
        isMultipleLists: false,
        processingFrequencyCode: '01', // <<<< NEW: Default to '01' 
        notes: ''
    });

    const [listOwners, setListOwners] = useState([]);
    // const [brokers, setBrokers] = useState([]); // For future implementation
    // const [listAdmins, setListAdmins] = useState([]); // For future implementation
    const [loadingParties, setLoadingParties] = useState(true);

    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchListOwners = async () => {
            setLoadingParties(true);
            setError(''); // Clear general errors before fetching
            try {
                console.log("Attempting to fetch List Owners from API...");
                const response = await axios.get(`${API_BASE_URL}/parties?type=LIST_OWNER`);
                console.log("List Owners API Response:", response.data);
                setListOwners(response.data || []); // Ensure it's an array
            } catch (err) {
                console.error("Failed to fetch List Owners:", err);
                setError("Could not load List Owners for selection. Please ensure parties are added to the system.");
                setListOwners([]); // Set to empty array on error
            } finally {
                setLoadingParties(false);
            }
        };
        // TODO: Fetch brokers and listAdmins similarly if needed for other dropdowns
        fetchListOwners();
    }, []); // Empty dependency array: fetch once on component mount

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');
        setIsLoading(true);

        if (!formData.listOwnerId) {
            setError('Please select a List Owner.');
            setIsLoading(false);
            return;
        }
        // ... (other validations as before) ...
        const freqNum = parseInt(formData.processingFrequencyCode);
        if (isNaN(freqNum) || formData.processingFrequencyCode.length !== 2 || ((freqNum < 1 || freqNum > 52) && freqNum !== 99) ) {
             setError('Invalid Processing Frequency. Must be 01-52 (e.g., for weekly processing if 52 times a year) or 99 for other/varied.');
             setIsLoading(false);
             return;
        }


        console.log("Data being sent to /api/pafs/create:", formData); // <<<< ADD THIS LINE

        try {
            const response = await axios.post(`${API_BASE_URL}/pafs/create`, formData);
            setMessage(response.data.message || 'PAF initiated successfully!');
            console.log("Created PAF:", response.data.paf);
            setFormData({
                listOwnerId: '', licenseeId: formData.licenseeId, brokerAgentId: '',
                listAdministratorId: '', pafType: 'SERVICE_PROVIDER', jurisdiction: 'US',
                isMultipleLists: false, notes: ''
            });
        } catch (err) {
            // ... (error handling as before) ...
            if (err.response && err.response.data && err.response.data.error) {
                setError(err.response.data.error);
            } else {
                setError('Error initiating PAF. Please try again or check API logs.');
            }
            console.error("Error creating PAF:", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="create-paf-form-container">
            <h2>Initiate New Processing Acknowledgement Form (PAF)</h2>

            {message && <div className="message success">{message}</div>}
            {error && <div className="message error">{error}</div>} {/* Display general errors */}

            <form onSubmit={handleSubmit}>
                <div className="form-section">
                    <h3>Core PAF Information</h3>
                    <div className="form-group">
                        <label htmlFor="listOwnerId">List Owner (Customer)<span className="required-indicator">*</span></label>
                        {loadingParties ? (
                            <p>Loading list owners...</p>
                        ) : listOwners.length > 0 ? (
                            <select id="listOwnerId" name="listOwnerId" value={formData.listOwnerId} onChange={handleChange} required>
                                <option value="">-- Select List Owner --</option>
                                {listOwners.map(owner => (
                                    <option key={owner.party_id} value={owner.party_id}>
                                        {owner.company_name} (ID: {owner.party_id} - NAICS: {owner.naics_code || 'N/A'})
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <p className="message error" style={{textAlign: 'left', padding: '8px'}}>No List Owners found. Please add them via Party Management.</p>
                        )}
                    </div>

                    {/* ... (LicenseeID, PAF Type, Jurisdiction, isMultipleLists - same as before) ... */}
                    <div className="form-group">
                        <label htmlFor="licenseeId">Processing Licensee<span className="required-indicator">*</span></label>
                        <input type="text" id="licenseeId" name="licenseeId" value={formData.licenseeId} onChange={handleChange} required readOnly placeholder="Licensee Party ID" />
                        <small>Typically your organization's ID. Currently: {formData.licenseeId}</small>
                    </div>
                    <div className="form-group">
                        <label htmlFor="pafType">PAF Type</label>
                        <select id="pafType" name="pafType" value={formData.pafType} onChange={handleChange}>
                            <option value="SERVICE_PROVIDER">Service Provider</option>
                            <option value="COMBINED">Combined</option>
                            <option value="MPA">MPA</option>
                            <option value="MPE">MPE</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="jurisdiction">List Owner Jurisdiction</label>
                        <select id="jurisdiction" name="jurisdiction" value={formData.jurisdiction} onChange={handleChange}>
                            <option value="US">US</option>
                            <option value="FOREIGN">Foreign (e.g., Canadian)</option>
                        </select>

                    </div>
                    {/* NEW FIELD FOR PROCESSING FREQUENCY */}
                    <div className="form-group">
                        <label htmlFor="processingFrequencyCode">Processing Frequency Code<span className="required-indicator">*</span></label>
                        <input
                            type="text"
                            id="processingFrequencyCode"
                            name="processingFrequencyCode"
                            value={formData.processingFrequencyCode}
                            onChange={handleChange}
                            maxLength="2"
                            placeholder="e.g., 01, 12, 52, 99"
                            required
                        />
                        <small>Enter 01-52 for approximate annual processing frequency (e.g., 52 for weekly), or 99 for varied/other.</small>
                    </div>

                    <div className="form-group checkbox-group">
                        <input type="checkbox" id="isMultipleLists" name="isMultipleLists" checked={formData.isMultipleLists} onChange={handleChange} />
                        <label htmlFor="isMultipleLists" className="checkbox-label">Covers Multiple Lists</label>
                    </div>
                </div>

                <div className="form-section">
                    <h3>Optional Third Parties</h3>
                    <div className="form-group">
                        <label htmlFor="brokerAgentId">Broker/Agent (Party ID)</label>
                        <input type="text" id="brokerAgentId" name="brokerAgentId" value={formData.brokerAgentId} onChange={handleChange} placeholder="Enter Broker Party ID (optional)" />
                        {/* TODO: Replace with searchable dropdown of Brokers fetched from /api/parties?type=BROKER_AGENT */}
                    </div>
                    <div className="form-group">
                        <label htmlFor="listAdministratorId">List Administrator (Party ID)</label>
                        <input type="text" id="listAdministratorId" name="listAdministratorId" value={formData.listAdministratorId} onChange={handleChange} placeholder="Enter List Admin Party ID (optional)" />
                        {/* TODO: Replace with searchable dropdown of List Admins fetched from /api/parties?type=LIST_ADMINISTRATOR */}
                    </div>
                </div>

                 <div className="form-section">
                    <h3>Internal Notes</h3>
                    {/* ... (Notes textarea as before) ... */}
                    <div className="form-group">
                        <label htmlFor="notes">Notes (for internal use)</label>
                        <textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} rows="3"></textarea>
                    </div>
                </div>

                <div className="button-container">
                    {/* ... (Submit button as before) ... */}
                    <button type="submit" disabled={isLoading || loadingParties}>
                        {isLoading ? 'Initiating...' : 'Initiate PAF'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default CreatePafForm;