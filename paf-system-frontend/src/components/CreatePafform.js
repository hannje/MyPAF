import React, { useState, useContext,useEffect } from 'react';

import { useLocation, useNavigate } from 'react-router-dom'; // <<< Add useNavigate

import axios from 'axios';
import AuthContext from '../context/AuthContext'; // To get logged-in user details

import './CreatePafform.css'; // Create a CSS file for this potentially large form



//const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://10.72.14.19:3001';
const API_BASE_URL = 'https://10.72.14.19:3443';

function CreatePafForm({ onSuccess }) {
  const { adminUser: loggedInUser } = useContext(AuthContext);

  const location = useLocation(); // <<< 2. Get the location object
  // Check if initial data was passed in the navigation state
  const navigate = useNavigate(); // <<< For redirecting after update

  const initialData = location.state?.initialPafData || {};

  const isEditMode = !!initialData.id; // <<< Determine if we are editing

  console.log("initdata", initialData);


  // --- State for all form fields ---
  // List Owner Details
 // const [listOwnerSic, setListOwnerSic] = useState('');
 // const [companyName, setCompanyName] = useState(''); // List Owner Company
 // const [parentCompany, setParentCompany] = useState('');
 // const [alternateCompanyName, setAlternateCompanyName] = useState('');
 // const [streetAddress, setStreetAddress] = useState('');
 // const [city, setCity] = useState('');
 // const [state, setStateVal] = useState('');
 // const [zipCode, setZipCode] = useState('');
 // const [zip4, setZip4] = useState('');
 // const [telephone, setTelephone] = useState('');
 // const [faxNumber, setFaxNumber] = useState('');
 // const [urbanization, setUrbanization] = useState('');
 // const [listOwnerCrid, setListOwnerCrid] = useState('');
 // const [mailerId, setMailerId] = useState(''); // This is Mailer ID from form, not related to USPS Mailer ID for NCOA

 // const [jurisdiction, setJurisdiction] = useState('US'); // 


  // Signer Details
 // const [signerName, setSignerName] = useState('');
 // const [signerTitle, setSignerTitle] = useState('');
 // const [signerEmail, setSignerEmail] = useState('');
 // const [dateSigned, setDateSigned] = useState(''); // Use type="date" input

  // PAF Specifics
 // const [listName, setListName] = useState('');
 // const [frequency, setFrequency] = useState(''); // Could be a select: ONE-TIME, MONTHLY, ANNUALLY, etc.
 // const [notes, setNotes] = useState('');
  
  const [naicsCodes, setNaicsCodes] = useState([]);
  const [isLoadingNaics, setIsLoadingNaics] = useState(true);

  const [listOwnerSic, setListOwnerSic] = useState(initialData.listOwnerSic || '');
  const [companyName, setCompanyName] = useState(initialData.companyName || '');
  const [parentCompany, setParentCompany] = useState(initialData.parentCompany || '');
  const [alternateCompanyName, setAlternateCompanyName] = useState(initialData.alternateCompanyName || '');
  const [streetAddress, setStreetAddress] = useState(initialData.streetAddress || '');
  const [city, setCity] = useState(initialData.city || '');
  const [state, setStateVal] = useState(initialData.state || '');
  const [zipCode, setZipCode] = useState(initialData.zipCode || '');
  const [zip4, setZip4] = useState(initialData.zip4 || '');
  const [telephone, setTelephone] = useState(initialData.telephone || '');
  const [faxNumber, setFaxNumber] = useState(initialData.faxNumber || '');
  const [urbanization, setUrbanization] = useState(initialData.urbanization || '');
  const [listOwnerCrid, setListOwnerCrid] = useState(initialData.listOwnerCrid || '');
  const [mailerId, setMailerId] = useState(initialData.mailerId || '');

  const [signerName, setSignerName] = useState(initialData.signerName || '');
  const [signerTitle, setSignerTitle] = useState(initialData.signerTitle || '');
  const [signerEmail, setSignerEmail] = useState(initialData.signerEmail || '');
  // Do not pre-fill dateSigned, as a new signature implies a new date
  const [dateSigned, setDateSigned] = useState('');

  const [listName, setListName] = useState(initialData.listName || '');
  const [frequency, setFrequency] = useState(initialData.frequency || '');
  const [jurisdiction, setJurisdiction] = useState(initialData.jurisdiction || 'US');
  const [notes, setNotes] = useState(initialData.notes || '');

  // Agent details can also be pre-filled
  //const [agentId, setAgentId] = useState(initialData.agentId || '');
  //const [agentSignedDate, setAgentSignedDate] = useState(''); // Don't pre-fill agent signature date

  const [agentId, setAgentId] = useState('');
  const [agentSignedDate, setAgentSignedDate] = useState('');

  // VVVVVV NEW STATE FOR AGENT DROPDOWN VVVVVV
  const [agentList, setAgentList] = useState([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  // AAAAAA END OF NEW STATE AAAAAA






// useEffect to fetch NAICS codes when the component mounts
  useEffect(() => {
    const fetchNaicsCodes = async () => {
      console.log("CreatePafForm: Fetching NAICS codes...");
      setIsLoadingNaics(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/data/naics-codes`);
        if (Array.isArray(response.data)) {
          setNaicsCodes(response.data);
          console.log(`CreatePafForm: Loaded ${response.data.length} NAICS codes.`);
        } else {
          console.error("CreatePafForm: NAICS data from API is not an array.");
        }
      } catch (error) {
        console.error("CreatePafForm: Failed to fetch NAICS codes:", error);
        // You might want to set an error state here
      } finally {
        setIsLoadingNaics(false);
      }
    }
    
    fetchNaicsCodes();


  }, []); // Empty dependency array means this runs once on mount

useEffect(() => {
   
    const fetchInitialData = async () => {
      setIsLoadingAgents(true);
      try {
        // Use Promise.all to run requests in parallel

        const response = await axios.get(`${API_BASE_URL}/api/users/agents`,
          {
              withCredentials: true // Essential for sending the session cookie
            }
        );
 
 
        console.log("CreatePafForm: Fetched initial Agents:", response.data);

        if (Array.isArray(response.data)) {
           setAgentList(response.data);
        }
      } catch (error) {
        console.error("CreatePafForm: Failed to fetch initial Agents:", error);
        // Set an error state if you have one for the whole form
      } finally {
        setIsLoadingAgents(false);
      }

      console.log("agebt list", agentList);
    };

    fetchInitialData();


  }, []); // Empty dependency array means this runs once on mount


  
  

  // Agent Details (Agent selection might be a dropdown populated from users with 'AGENT' role)
 // const [agentId, setAgentId] = useState(''); // This would be a users.id
 // const [agentSignedDate, setAgentSignedDate] = useState('');

  // UI State
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const clearForm = () => {
    setListOwnerSic(''); setCompanyName(''); setParentCompany(''); setAlternateCompanyName('');
    setStreetAddress(''); setCity(''); setStateVal(''); setZipCode(''); setZip4('');
    setTelephone(''); setFaxNumber(''); setUrbanization(''); setListOwnerCrid(''); setMailerId('');
    setSignerName(''); setSignerTitle(''); setSignerEmail(''); setDateSigned('');
    setListName(''); setFrequency(''); setNotes('');
    setAgentId(''); setAgentSignedDate('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    if (!loggedInUser || !loggedInUser.id) {
      setError("User not authenticated. Please log in again.");
      setIsLoading(false);
      return;
    }

    // Basic Validation (add more as needed)
        // Core fields that are always required
    if (!companyName || !listName || !signerName || !signerTitle) {
      setError('Company Name, List Name, Signer Name, and Signer Title are required.');
      setIsLoading(false);
      return;
    }

    // Conditionally check for dateSigned ONLY in create mode
    if (!isEditMode && !dateSigned) {
      setError('Date Signed is required when creating a new PAF.');
      setIsLoading(false);
      return;
    }

    const pafData = {
      // The backend will determine/generate 'list_owner_id'
      // The backend will use loggedInUser.id for 'created_by_user_id'
      // The backend needs to determine 'licensee_id' (likely from loggedInUser's scope/admin)

      listOwnerSic, companyName, parentCompany, alternateCompanyName,
      streetAddress, city, state, zipCode, zip4, telephone, faxNumber, urbanization,
      listOwnerCrid, mailerId,
      signerName, signerTitle, signerEmail, dateSigned,
      listName, frequency, notes,
      jurisdiction: jurisdiction, // <<< ADD jurisdiction TO PAYLOAD
      agentId: agentId || null, // Send null if empty
      agentSignedDate: agentSignedDate || null, // Send null if empty
    };

   try {
      let response;
      if (isEditMode) {
        // --- UPDATE LOGIC ---
        const url = `${API_BASE_URL}/api/pafs/${initialData.id}`;
        console.log(`CreatePafForm (Edit Mode): Submitting PUT to ${url}`, pafData);
        response = await axios.put(url, pafData, { withCredentials: true });
        setMessage(response.data.message || 'PAF updated successfully!');
        // Optionally redirect back to the details page or dashboard
        setTimeout(() => navigate(`/pafs/view/${initialData.id}`), 2000);
      } else {
        // --- CREATE LOGIC ---
        const url = `${API_BASE_URL}/api/pafs`;
        console.log(`CreatePafForm (Create Mode): Submitting POST to ${url}`, pafData);
        response = await axios.post(url, pafData, { withCredentials: true });
        setMessage(response.data.message || 'PAF created successfully!');
        clearForm(); // Only clear the form on successful *creation*
      }

      if (onSuccess) { // Can still be used for things like refreshing a list
        onSuccess(response.data.paf);
      }

    }
    
    catch (err) {
      console.error('PAF creation error:', err.response?.data?.message || err.message || err);
      setError(err.response?.data?.message || 'Failed to create PAF. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // This form will be long. Consider breaking it into sections or steps if UX demands.
  return (
    <div className="form-container paf-creation-form"> {/* Add specific class for styling */}
  <h2>{isEditMode ? `Modify PAF (ID: ${initialData.listOwnerId})` : 'Initiate New PAF'}</h2>
      <form onSubmit={handleSubmit} className="form">
        <fieldset>
          <legend>List Owner Company Information</legend>
          <div className="form-group"><label>Company Name (List Owner):</label><input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required /></div>
 
 
           <div className="form-group">
            <label htmlFor="listOwnerSic">List Owner SIC (NAICS Code):</label>
            <select
              id="listOwnerSic"
              value={listOwnerSic}
              onChange={(e) => setListOwnerSic(e.target.value)}
              disabled={isLoadingNaics} // Disable dropdown while loading
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


 
          <div className="form-group"><label>Parent Company (if any):</label><input type="text" value={parentCompany} onChange={(e) => setParentCompany(e.target.value)} /></div>
          <div className="form-group"><label>Alternate Company Name (DBA):</label><input type="text" value={alternateCompanyName} onChange={(e) => setAlternateCompanyName(e.target.value)} /></div>
          <div className="form-group"><label>Street Address:</label><input type="text" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} /></div>
          <div className="form-group"><label>City:</label><input type="text" value={city} onChange={(e) => setCity(e.target.value)} /></div>
          <div className="form-group"><label>State:</label><input type="text" value={state} onChange={(e) => setStateVal(e.target.value)} /></div>
          <div className="form-group"><label>Zip Code:</label><input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} /></div>
          <div className="form-group"><label>Zip+4:</label><input type="text" value={zip4} onChange={(e) => setZip4(e.target.value)} maxLength="4" /></div>
          <div className="form-group"><label>Telephone:</label><input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} /></div>
          <div className="form-group"><label>Fax Number:</label><input type="tel" value={faxNumber} onChange={(e) => setFaxNumber(e.target.value)} /></div>
          <div className="form-group"><label>Urbanization (if applicable):</label><input type="text" value={urbanization} onChange={(e) => setUrbanization(e.target.value)} /></div>
          <div className="form-group"><label>List Owner CRID:</label><input type="text" value={listOwnerCrid} onChange={(e) => setListOwnerCrid(e.target.value)} /></div>
          <div className="form-group"><label>Mailer ID (List Owner's):</label><input type="text" value={mailerId} onChange={(e) => setMailerId(e.target.value)} /></div>
        </fieldset>

        <fieldset>
          <legend>List Owner Signer Details</legend>
          <div className="form-group"><label>Signer Full Name:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} required /></div>
          <div className="form-group"><label>Signer Title:</label><input type="text" value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} required /></div>
          <div className="form-group"><label>Signer Email:</label><input type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} /></div>

            
          {/* VVVVVV THE CHANGE IS HERE VVVVVV */}
          <div className="form-group">
            <label htmlFor="dateSigned">Date Signed by List Owner:</label>
            <input 
              type="date" 
              id="dateSigned" 
              value={dateSigned} 
              onChange={(e) => setDateSigned(e.target.value)} 
              required 
              disabled={isEditMode} // <<< DISABLE THE INPUT IN EDIT MODE
            />
            {isEditMode && ( // <<< Optionally, show a message explaining why it's disabled
              <small style={{display: 'block', marginTop: '5px'}}>
                The signed date cannot be changed during modification. Use the "Renew PAF" function to update the signature date.
              </small>
            )}
          </div>

 

        </fieldset>

        <fieldset>
          <legend>PAF Details</legend>
          <div className="form-group"><label>List Name / Description:</label><input type="text" value={listName} onChange={(e) => setListName(e.target.value)} required /></div>
          <div className="form-group">
            <label>Processing Frequency:</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                <option value="">Select Frequency</option>
                <option value="01">01 - Once Annually (or first of year)</option>
                <option value="04">04 - Quarterly</option>
                <option value="12">12 - Monthly</option>
                <option value="26">26 - Bi-Weekly</option>
                <option value="52">52 - Weekly</option>
                <option value="99">99 - Varied / Other / As Submitted</option>
                    </select>
          </div>

          <div className="form-group">
            <label htmlFor="paf-jurisdiction">Jurisdiction:</label>
            <select id="paf-jurisdiction" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} required>
              <option value="US">US (United States)</option>
              <option value="FOREIGN">Foreign</option>
            </select>
          </div>


          <div className="form-group"><label>Notes:</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="3"></textarea></div>
        </fieldset>

        <fieldset>
          <legend>Agent/Broker Information (If Applicable)</legend>
 
 
 <div className="form-group">
            <label htmlFor="paf-agentId">Agent/Broker (User in System):</label>
            <select
              id="paf-agentId"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              disabled={isLoadingAgents}
            >
              <option value="">
                {isLoadingAgents ? 'Loading agents...' : 'Select an Agent (Optional)'}
              </option>
              {/* Map over the 'agents' state array to create an <option> for each agent */}
 
              {agentList.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} {/* <<< Use the 'name' property directly */}
                </option>
              ))}
   
 
            </select>
          </div>


          <div className="form-group"><label>Date Signed by Agent:</label><input type="date" value={agentSignedDate} onChange={(e) => setAgentSignedDate(e.target.value)} /></div>
        </fieldset>

       <div className="form-action-center"> {/* New wrapper div for centering */}
          <button type="submit" className="submit-button large-button" disabled={isLoading}>
            {isLoading 
              ? (isEditMode ? 'Saving Changes...' : 'Submitting PAF...') 
              : (isEditMode ? 'Save PAF Changes' : 'Submit New PAF')
            }
          </button>
        </div>

      </form>
      {message && <p className="success-message" style={{ color: 'green', marginTop: '10px' }}>{message}</p>}
      {error && <p className="error-message" style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
    </div>
  );
}

export default CreatePafForm;