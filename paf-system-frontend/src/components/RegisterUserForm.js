import React, { useState } from 'react';
import axios from 'axios';
import './RegisterUserForm.css';

function RegisterUserForm() {
    const [formData, setFormData] = useState({
        // User fields
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        department: '',
        role: 'VIEWER', // Default role for the user being created
        password: '',
        confirmPassword: '',
        isActive: true,

        // Party fields (New)
        createAssociatedParty: true, // Checkbox to control party creation
        companyName: '',
        addressLine1: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'USA',
        partyType: 'LIST_OWNER', // Default, or make user select
        naicsCode: ''
    });

    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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

        if (formData.password !== formData.confirmPassword) {
            setError("User passwords do not match.");
            setIsLoading(false);
            return;
        }
        if (formData.password.length < 8) {
            setError("User password must be at least 8 characters long.");
            setIsLoading(false);
            return;
        }
        if (!formData.firstName || !formData.lastName || !formData.email || !formData.role || !formData.password) {
            setError("Please fill in all required user fields.");
            setIsLoading(false);
            return;
        }

        // Validate party fields if createAssociatedParty is checked
        if (formData.createAssociatedParty) {
            if (!formData.companyName || !formData.addressLine1 || !formData.city || !formData.state || !formData.zipCode || !formData.partyType) {
                setError("Please fill in all required company/party fields if creating an associated party.");
                setIsLoading(false);
                return;
            }
            // Add NAICS validation if partyType requires it (e.g., LIST_OWNER, BROKER_AGENT)
            if ((formData.partyType === 'LIST_OWNER' || formData.partyType === 'BROKER_AGENT') && !formData.naicsCode) {
                setError("NAICS code is required for List Owners and Brokers/Agents.");
                setIsLoading(false);
                return;
            }
        }


        try {
            const apiUrl = 'http://localhost:3001/api/users/create-with-party'; // New API endpoint

            const response = await axios.post(apiUrl, formData);

            setMessage(response.data.message || 'User and Party created successfully!');
            setFormData({ // Reset form
                firstName: '', lastName: '', email: '', phoneNumber: '', department: '',
                role: 'VIEWER', password: '', confirmPassword: '', isActive: true,
                createAssociatedParty: true, companyName: '', addressLine1: '', city: '',
                state: '', zipCode: '', country: 'USA', partyType: 'LIST_OWNER', naicsCode: ''
            });

        } catch (err) {
            if (err.response && err.response.data && err.response.data.error) {
                setError(err.response.data.error);
            } else {
                setError('Error creating user/party: ' + (err.message || 'Please check API.'));
            }
            console.error("Error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="register-form-container user-party-form">
            <h2>Register New User & Associated Company/Party</h2>

            {message && <div className="message success">{message}</div>}
            {error && <div className="message error">{error}</div>}

            <form onSubmit={handleSubmit}>
                <fieldset className="form-section">
                    <legend>User Account Details</legend>
                    {/* ... (existing user fields: firstName, lastName, email, phoneNumber, department, role, password, confirmPassword, isActive) ... */}
                    <div className="form-group">
                        <label htmlFor="firstName">First Name<span className="required-indicator">*</span></label>
                        <input type="text" id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="lastName">Last Name<span className="required-indicator">*</span></label>
                        <input type="text" id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="email">User Email (Login)<span className="required-indicator">*</span></label>
                        <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="role">User Role<span className="required-indicator">*</span></label>
                        <select id="role" name="role" value={formData.role} onChange={handleChange} required>
                            <option value="VIEWER">Viewer</option>
                            <option value="DATA_ENTRY">Data Entry</option>
                            <option value="PAF_MANAGER">PAF Manager (Represents a Party)</option>
                            <option value="ADMIN">System Admin</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">User Password<span className="required-indicator">*</span></label>
                        <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} required minLength="8" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password<span className="required-indicator">*</span></label>
                        <input type="password" id="confirmPassword" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required minLength="8" />
                    </div>
                     <div className="form-group">
                        <label htmlFor="phoneNumber">User Phone Number</label>
                        <input type="tel" id="phoneNumber" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="department">User Department</label>
                        <input type="text" id="department" name="department" value={formData.department} onChange={handleChange} />
                    </div>
                     <div className="form-group checkbox-group">
                        <input type="checkbox" id="isActive" name="isActive" checked={formData.isActive} onChange={handleChange} />
                        <label htmlFor="isActive" className="checkbox-label">User Account Active</label>
                    </div>
                </fieldset>

                <fieldset className="form-section">
                    <legend>
                        <input
                            type="checkbox"
                            id="createAssociatedParty"
                            name="createAssociatedParty"
                            checked={formData.createAssociatedParty}
                            onChange={handleChange}
                            style={{ marginRight: '10px', verticalAlign: 'middle' }}
                        />
                        Create Associated Company/Party Record
                    </legend>

                    {formData.createAssociatedParty && (
                        <>
                            <div className="form-group">
                                <label htmlFor="companyName">Company Name<span className="required-indicator">*</span></label>
                                <input type="text" id="companyName" name="companyName" value={formData.companyName} onChange={handleChange} required={formData.createAssociatedParty} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="partyType">Company/Party Type<span className="required-indicator">*</span></label>
                                <select id="partyType" name="partyType" value={formData.partyType} onChange={handleChange} required={formData.createAssociatedParty}>
                                    <option value="LIST_OWNER">List Owner (Customer)</option>
                                    <option value="BROKER_AGENT">Broker / Agent</option>
                                    <option value="LIST_ADMINISTRATOR">List Administrator</option>
                                    {/* LICENSEE type would usually be pre-existing and not created this way */}
                                </select>
                            </div>
                             <div className="form-group">
                                <label htmlFor="naicsCode">NAICS Code { (formData.partyType === 'LIST_OWNER' || formData.partyType === 'BROKER_AGENT') && <span className="required-indicator">*</span>}</label>
                                <input type="text" id="naicsCode" name="naicsCode" value={formData.naicsCode} onChange={handleChange} required={formData.createAssociatedParty && (formData.partyType === 'LIST_OWNER' || formData.partyType === 'BROKER_AGENT')} />
                                <small>Required for List Owners and Brokers/Agents.</small>
                            </div>
                            <div className="form-group">
                                <label htmlFor="addressLine1">Address Line 1<span className="required-indicator">*</span></label>
                                <input type="text" id="addressLine1" name="addressLine1" value={formData.addressLine1} onChange={handleChange} required={formData.createAssociatedParty} />
                            </div>
                            {/* Add fields for address_line2, city, state, zipCode, country as needed */}
                            <div className="form-group">
                                <label htmlFor="city">City<span className="required-indicator">*</span></label>
                                <input type="text" id="city" name="city" value={formData.city} onChange={handleChange} required={formData.createAssociatedParty} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="state">State<span className="required-indicator">*</span></label>
                                <input type="text" id="state" name="state" value={formData.state} onChange={handleChange} required={formData.createAssociatedParty} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="zipCode">Zip Code<span className="required-indicator">*</span></label>
                                <input type="text" id="zipCode" name="zipCode" value={formData.zipCode} onChange={handleChange} required={formData.createAssociatedParty} />
                            </div>
                             <div className="form-group">
                                <label htmlFor="country">Country<span className="required-indicator">*</span></label>
                                <input type="text" id="country" name="country" value={formData.country} onChange={handleChange} required={formData.createAssociatedParty} />
                            </div>
                        </>
                    )}
                </fieldset>

                <div className="button-container">
                    <button type="submit" disabled={isLoading}>
                        {isLoading ? 'Processing...' : 'Register User & Party'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default RegisterUserForm;