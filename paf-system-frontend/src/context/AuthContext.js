// mypafreact/paf-system-frontend/src/context/AuthContext.js
import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios'; // Still useful for making API calls
import apiClient from '../api/apiClient'; // <<< IMPORT your new apiClient

//const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://10.72.14.19:3001';
const API_BASE_URL = 'https://10.72.14.19:3443';

const AuthContext = createContext(null);

 


export const AuthProvider = ({ children }) => {
 // console.log('AuthProvider COMPONENT IS RENDERING/MOUNTING (Session-Based)');
  const [adminUser, setAdminUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Function to check session and fetch user profile on app load
  const checkSessionAndFetchProfile = useCallback(async () => {
   // console.log('AuthContext checkSessionAndFetchProfile: Called');
    try {
      // This endpoint on your backend should check for a valid session cookie
      // and return the user if authenticated.
      // axios will automatically send any httpOnly cookies set by your domain.
      setIsLoadingAuth(true);
      
      const response = await axios.get(`${API_BASE_URL}/api/auth/session-status`, { withCredentials: true }); // Or '/api/auth/me', '/api/auth/profile'
      
      if (response.data && response.data.user) {
  //      console.log('AuthContext checkSessionAndFetchProfile: Session valid, user data:', response.data.user);
        setAdminUser(response.data.user);
      } else {
 //       console.log('AuthContext checkSessionAndFetchProfile: No active session or user data not returned.');
        setAdminUser(null);
      }
    } catch (error) {
      // An error (e.g., 401) likely means no active session or an issue.
      console.warn('AuthContext checkSessionAndFetchProfile: Error checking session or no active session:', error.response?.data?.message || error.message);
      setAdminUser(null);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
  //  console.log('AuthContext useEffect: Calling checkSessionAndFetchProfile on mount.');
    checkSessionAndFetchProfile();
  }, [checkSessionAndFetchProfile]);


  const login = async (email, password) => {
 //   console.log('[AuthContext] login: Called. Setting isLoadingAuth to TRUE.');
    setIsLoadingAuth(true); // Set loading true at the very start

    try {

//      const response = await axios.post(`${API_BASE_URL}/api/auth/login`,
//        { email, password },
//       { withCredentials: true }
 //     );
      
       const response = await apiClient.post(`/api/auth/login`, { email, password });


 //     console.log('[AuthContext] login: API call successful. Response:', response.data);

      if (response.data && response.data.user) {
        setAdminUser(response.data.user);
        console.log('[AuthContext] login: adminUser state SET to:', response.data.user);
        return response.data.user; // Return user object on success
      } else {
        // Handle cases where API returns 200 OK but no user data
        console.error('[AuthContext] login: Response missing user data.');
        setAdminUser(null); // Ensure user is cleared
        throw new Error("Login response from server was invalid.");
      }
    } catch (error) {
      console.error('[AuthContext] login: FAILED.', error.response?.data || error.message);
      setAdminUser(null); // Clear any previous user state
      throw error; // Re-throw the error for the component to handle (e.g., to show "Invalid credentials")
    } finally {
      // VVVVVV THIS IS THE GUARANTEED FIX VVVVVV
      // This block will run after the 'try' succeeds OR after the 'catch' block runs.
 //     console.log('[AuthContext] login: FINALLY block. Setting isLoadingAuth to FALSE.');
      setIsLoadingAuth(false);
      // AAAAAA END OF FIX AAAAAA
    }
  };

  const logout = async () => {
    console.log('AuthContext logout: Attempting logout (session-based)');
    try {
      // This backend endpoint should destroy the session on the server
      // and typically clear the session cookie.
      await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, { withCredentials: true }); // Send empty body if needed
      console.log('AuthContext logout: Server logout successful.');
    } catch (error) {
      console.error('AuthContext logout: Failed to logout from server:', error.response?.data?.message || error.message);
      // Still proceed to clear frontend state even if server logout fails,
      // but log the error.
    } finally {
      setAdminUser(null);
      // Cookies are typically cleared by the server response Set-Cookie header with an expired date
      // or removed by the browser if the server signals session termination.
      // No need to clear axios defaults for Authorization header.
      console.log('AuthContext logout: adminUser state cleared.');
    }
  };

  const contextValue = {
    adminUser,
    isLoadingAuth,
    login,
    logout,
    checkSessionAndFetchProfile // Expose if needed for manual refresh
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;