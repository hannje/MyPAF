// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, NavLink, Navigate, Outlet } from 'react-router-dom';

// Import your components
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import RegisterUserForm from './components/RegisterUserForm';
import CreatePafForm from './components/CreatePafform';
import AuthPage from './components/AuthPage';
import PafApprovalPage from './components/PafApprovalPage'; // New component
import EditUserForm from './components/EditUserForm'; // Import the new component

import ViewPafDetails from './components/ViewPafDetails';

import './App.css'; // Your main App styles

// Navbar Component (can be in its own file: Navbar.js)
function Navbar({ isAuthenticated, user, onLogout }) {
  return (
    <nav className="app-navbar">
      <NavLink to={isAuthenticated ? (user?.role === 'ADMIN' ? "/admin-dashboard" : "/dashboard") : "/"} className="nav-brand">
        PAF System
      </NavLink>
      <div className="nav-links">
        {isAuthenticated && (
          <>
            {user?.role === 'ADMIN' && (
              <NavLink to="/admin-dashboard" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                Admin Dashboard
              </NavLink>
            )}
            {user?.role !== 'ADMIN' && (
              <NavLink to="/dashboard" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                My Dashboard
              </NavLink>
            )}
            {(user?.role === 'ADMIN' || user?.role === 'PAF_MANAGER') && (
              <NavLink to="/admin/pafs/new" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                Initiate PAF
              </NavLink>
            )}
            {user?.role === 'ADMIN' && (
                <NavLink to="/admin/register-user" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                Register User
                </NavLink>
            )}
            <button onClick={onLogout} className="nav-link logout-button">Logout ({user?.email || 'User'})</button>
          </>
        )}
        {!isAuthenticated && (
             <NavLink to="/login" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                Login
            </NavLink>
        )}
      </div>
    </nav>
  );
}

// Protected Route Component (can be in its own file: ProtectedRoute.js)
function ProtectedRoute({ isAuthenticated, children }) {
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />; // Redirect to login if not authenticated
    }
    // If children are provided, render them, otherwise render an Outlet for nested routes.
    return children ? children : <Outlet />;
}

// Not Found Page Component (can be in its own file: NotFoundPage.js)
function NotFoundPage() {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px', padding: '20px' }}>
        <h1>404 - Page Not Found</h1>
        <p>Sorry, the page you are looking for does not exist.</p>
        <Link to="/">Go to Homepage (or Login)</Link>
      </div>
    );
}

// Main App Component
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Check for persisted auth state on initial load
    // return !!localStorage.getItem('pafAuthToken'); // Example if using token
    return false; // Default to not authenticated for now
  });
  const [currentUser, setCurrentUser] = useState(() => {
    // const userStr = localStorage.getItem('pafUser');
    // return userStr ? JSON.parse(userStr) : null;
    return null; // Default to no user for now
  });

  // Optional: Effect to synchronize with localStorage or make an API call to verify session
  useEffect(() => {
    // This is where you might verify a token with the backend if it exists in localStorage
    // For now, this effect doesn't do much beyond logging for this simplified example.
    if (isAuthenticated && currentUser) {
        console.log("App loaded. User is authenticated:", currentUser.email);
    } else {
        console.log("App loaded. User is not authenticated.");
    }
  }, [isAuthenticated, currentUser]); // Rerun if auth state changes

  const handleLoginSuccess = (userDataFromApi) => {
    console.log("Login successful in App.js, user data from API:", userDataFromApi);
    setIsAuthenticated(true);
    setCurrentUser(userDataFromApi); // This should be the user object { userId, email, role, ... }
    // If using tokens from backend:
    // localStorage.setItem('pafAuthToken', userDataFromApi.token);
    // localStorage.setItem('pafUser', JSON.stringify(userDataFromApi)); // Store user details
  };

  const handleLogout = () => {
    console.log("Logging out...");
    setIsAuthenticated(false);
    setCurrentUser(null);
    // localStorage.removeItem('pafAuthToken');
    // localStorage.removeItem('pafUser');
    // Consider navigating to '/login' here if not handled by ProtectedRoute redirecting
  };

  return (
    <Router>
      <div className="App">
        <Navbar isAuthenticated={isAuthenticated} user={currentUser} onLogout={handleLogout} />
        <main className="app-content">
          <Routes>
            {/* Public Routes */}
            <Route
              path="/login"
              element={
                isAuthenticated ? (
                  <Navigate to={currentUser?.role === 'ADMIN' ? "/admin-dashboard" : "/dashboard"} replace />
                ) : (
                  <AuthPage onLoginSuccess={handleLoginSuccess} />
                )
              }
            />
            <Route
              path="/"
              element={
                isAuthenticated ? (
                  <Navigate to={currentUser?.role === 'ADMIN' ? "/admin-dashboard" : "/dashboard"} replace />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* PAF Approval Page - This link would typically be sent via email or a notification.
                It might not need full app authentication if it uses a secure, one-time token in the URL itself,
                or it could be a page within a logged-in List Owner's portal.
                For simplicity here, making it a public route accessible by its path.
                In a real app, you might want to protect it or have a separate flow.
            */}
            <Route path="/pafs/approve/:pafDbId" element={<PafApprovalPage />} />


            {/* Protected Routes Wrapper */}
            <Route element={<ProtectedRoute isAuthenticated={isAuthenticated} />}>
              {/* Admin Specific Routes */}
              {currentUser?.role === 'ADMIN' && (
                <>
                  <Route path="/admin-dashboard" element={<AdminDashboard currentUser={currentUser} />} />
                  <Route path="/admin/register-user" element={<RegisterUserForm />} />
                  {/* Add other admin-only routes here */}
                </>
              )}

              {/* General User Dashboard (non-admin) */}
              {currentUser?.role && currentUser.role !== 'ADMIN' && (
                 <Route path="/dashboard" element={<UserDashboard currentUser={currentUser} />} />
              )}

              {/* Routes accessible by multiple authenticated roles (e.g., Admin or PAF Manager) */}
              {(currentUser?.role === 'ADMIN' || currentUser?.role === 'PAF_MANAGER') && (
                <Route path="/admin/pafs/new" element={<CreatePafForm />} />
              )}

              {/* Add other protected routes here, e.g., view specific PAF details */}
              {/* <Route path="/pafs/view/:pafId" element={<ViewPafDetails />} /> */}
 
            <Route path="/pafs/view/:pafDbId" element={<ViewPafDetails currentUser={currentUser} />} >
                    {/* Pass currentUser if needed for role-based actions on this page */}
                </Route>
 
            <Route path="/admin/users/edit/:userId" element={<EditUserForm currentUser={currentUser} />} />
                                                             
 
            </Route>

 

            {/* Fallback for any unmatched routes */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <footer className="app-footer">
          <p>© {new Date().getFullYear()} PAF Management System. All rights reserved.</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;