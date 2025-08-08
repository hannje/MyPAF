// mypafreact/paf-system-frontend/src/components/AuthPage.js

import React, { useState, useContext } from 'react'; // Make sure useContext is imported
import { useNavigate } from 'react-router-dom';
import AuthContext from './context/AuthContext'; // Adjust path if needed
import './AuthPage.css'; // Or your specific login form styles

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://10.72.14.19:3443';

function AuthPage() { // No onLoginSuccess prop here
  console.log('AuthPage: Component rendering/mounted.');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Debug: Log when error state changes
  React.useEffect(() => {
    console.log('AuthPage: Error state changed to:', error);
  }, [error]);
  const [isLoading, setIsLoading] = useState(false);

  // Use the context to get the login function
  const authContext = useContext(AuthContext);
  console.log('AuthPage: Value from useContext(AuthContext):', authContext);


  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    console.log('AuthPage: handleSubmit function CALLED.');
    event.preventDefault();
    setError('');
    setIsLoading(true);

    // Check if context and login function are available
    if (!authContext || typeof authContext.login !== 'function') {
        console.error('AuthPage Error: login function from AuthContext is not available!', authContext);
        setError('Login service is currently unavailable. Please try again later.');
        setIsLoading(false);
        return;
    }

    try {
 //     console.log('AuthPage handleSubmit: Calling context.login function...');
      // The login function from AuthContext itself should handle setting the user
      // and token, and then return the user object (or throw an error).


      const loggedInUser = await authContext.login(email, password);
      
      
 ////     console.log('AuthPage handleSubmit: Context login function returned:', loggedInUser);

      // Navigation logic based on the role in the returned user object
      if (loggedInUser && loggedInUser.role) {
        if (loggedInUser.role === 'ADMIN') {
 //         console.log('AuthPage handleSubmit: Role is ADMIN. Navigating to /admin-dashboard.');
          navigate('/admin-dashboard', { replace: true });
        } else {
  //        console.log(`AuthPage handleSubmit: Role is ${loggedInUser.role}. Navigating to /user-dashboard.`);
          navigate('/user-dashboard', { replace: true });
        }
      } else {
        // This case means context.login might not have returned a valid user/role
        // or an error wasn't thrown as expected.
        console.error('AuthPage handleSubmit: Login may have succeeded at context level but user data/role is invalid here.', loggedInUser);
        setError('Login completed but user information is incomplete.');
      }
    } catch (err) {
      // Don't set isLoading here - do it in finally block 
      console.log('AuthPage handleSubmit: Error during login process:', err);
      console.error('AuthPage handleSubmit: Full error object:', err);
      console.error('AuthPage handleSubmit: Error response:', err.response);
      console.error('AuthPage handleSubmit: Error message:', err.message);
     
      let errorMessage = 'Invalid email or password. Please try again.';
      
      if (err.response) {
        switch (err.response.status) {
          case 401:
            errorMessage = 'Invalid email or password. Please check your credentials and try again.';
            break;
          case 403:
            errorMessage = 'Account access is restricted. Please contact support.';
            break;
          case 429:
            errorMessage = 'Too many login attempts. Please wait a few minutes before trying again.';
            break;
          case 500:
            errorMessage = 'Server error occurred. Please try again later.';
            break;
          default:
            errorMessage = err.response.data?.message || errorMessage;
        }
      } else if (err.request) {
        errorMessage = 'Unable to connect to the server. Please check your connection and try again.';
      } else if (err.message) {
        errorMessage = err.message.includes('invalid') || err.message.includes('password') || err.message.includes('credentials') 
          ? 'Invalid email or password. Please check your credentials and try again.'
          : err.message;
      }
      
      console.error('AuthPage: Setting error message:', errorMessage);
      setError(errorMessage);
      
      // Force a re-render to make sure the error is displayed
      setTimeout(() => {
        console.error('AuthPage: Current error state after setTimeout:', errorMessage);
      }, 100);

 
 
    } finally {
      setIsLoading(false);
    }
  };

  return (

    
    <div  className="auth-page-container" >

<div className="login-header">
          <h1 className="login-title">MyPAF</h1>
          <p className="login-tagline">Your solution for PAF Management, made simple.</p>
        </div>


      <form onSubmit={handleSubmit}  className="auth-form" >
        <div  className="form-group" >
          <label htmlFor="login-email">Email:</label>
          <input type="email" id="login-email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div  className="form-group" >
          <label htmlFor="login-password">Password:</label>
          <input type="password" id="login-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <button type="submit"  className="auth-button"  disabled={isLoading}
                  onClick={() => console.log("--- LOGIN BUTTON WAS CLICKED ---")} // <<< ADD THIS onClick

        >
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
 
      </form>
      {error && (
          <div className="error-message" role="alert" aria-live="polite">
            <strong>Login Failed:</strong> {error}
          </div>
        )}
        {/* Debug: Show error state */}
        {console.log('AuthPage render: current error state:', error)}

    </div>
  );
}

export default AuthPage;