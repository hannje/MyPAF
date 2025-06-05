// src/components/AuthPage.js
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './AuthPage.css';

const API_BASE_URL = 'http://localhost:3001/api'; // Ensure this matches your Node.js API port

function AuthPage({ onLoginSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!email || !password) {
            setError('Please enter both email and password.');
            setIsLoading(false);
            return;
        }

        try {
            const response = await axios.post(`${API_BASE_URL}/auth/login`, {
                email: email,
                password: password
            });

            console.log("Login API Response:", response.data); // Log successful response

            // Assuming your backend sends back a 'user' object and potentially a 'token'
            // For now, we'll use the user object directly from the response.
            // In a real app with tokens:
            // localStorage.setItem('authToken', response.data.token);
            // localStorage.setItem('user', JSON.stringify(response.data.user));

            if (onLoginSuccess) {
                onLoginSuccess(response.data.user); // Pass the user object to App.js
            }
            navigate('/admin-dashboard'); // Redirect on successful login

        } catch (err) {
            if (err.response && err.response.data && err.response.data.error) {
                // Error from our API (e.g., invalid credentials, account inactive)
                setError(err.response.data.error);
            } else if (err.request) {
                // The request was made but no response was received
                setError('No response from server. Please check if the API is running.');
                console.error("No response from server:", err.request);
            } else {
                // Something happened in setting up the request that triggered an Error
                setError('Login failed. An unexpected error occurred.');
                console.error("Login submission error:", err.message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-page-container">
            <div className="auth-form-wrapper">
                <h2>PAF System Login</h2>
                {error && <div className="message error auth-error">{error}</div>}
                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="Enter your email"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Enter your password"
                        />
                    </div>
                    <button type="submit" className="login-btn" disabled={isLoading}>
                        {isLoading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
                <div className="auth-links">
                    <p>Admin creates user accounts. If you need an account, contact an administrator.
                       {/* Link to registration page might be removed if only admins register users */}
                       {/* <button onClick={() => navigate('/admin/register-user')} className="link-button">
                            Register here
                       </button> */}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default AuthPage;