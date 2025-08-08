// mypafreact/paf-system-frontend/src/App.js
import React, { useContext } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, NavLink, Navigate, Outlet } from 'react-router-dom';

// --- Context ---
import AuthContext, { AuthProvider } from './context/AuthContext'; // Ensure this path is correct

// --- Components ---
import AdminDashboard from './components/AdminDashboard'; // Corrected name
import UserDashboard from './components/UserDashboard';   // Corrected name
import AuthPage from './AuthPage'; // Your login form component
import CreatePafForm from './components/CreatePafform'; // Assuming this is correct
import PafApprovalPage from './components/PafApprovalPage';
import EditUserForm from './components/EditUserForm';
import ViewPafDetails from './components/ViewPafDetails';
// RegisterUserForm might be the CreatePartyUserForm for admins to create users
import RegisterUserForm from './components/RegisterUserForm'; // Or your CreatePartyUserForm
import RegisterAdminForm from './components/RegisterAdminForm'; // For admins to create other admins


import AdminPafValidationPage from './components/AdminPafValidationPage'; 
import AgentApprovalPage from './components/AgentApprovalPage';

// --- Styles ---
import './App.css';

// --- Navbar Component (Consumes AuthContext) ---
function Navbar() {
  const { adminUser, logout, isLoadingAuth } = useContext(AuthContext);
  const isAuthenticated = !!adminUser;

  // Don't render navbar content if auth is still loading, or handle it as you see fit
  if (isLoadingAuth && !adminUser) { // Show minimal navbar or nothing during initial auth load
    return (
        <nav className="app-navbar">
            <NavLink to="/" className="nav-brand">
              PAF System
              <span className="version-tag">v{process.env.REACT_APP_VERSION || 'DEV'}</span>
            </NavLink>
            <div className="nav-links">Loading...</div>
        </nav>
    );
  }

  return (
    <nav className="app-navbar">
      
      <NavLink to={isAuthenticated ? (adminUser?.role === 'ADMIN' ? "/admin-dashboard" : "/user-dashboard") : "/login"} className="nav-brand">
        PAF System
        <span className="version-tag">v{process.env.REACT_APP_VERSION || 'DEV'}</span>
      </NavLink>

      <div className="nav-links">
        {isAuthenticated && adminUser && (
          <>
            {adminUser.role === 'ADMIN' && (
              <NavLink to="/admin-dashboard" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                Admin Dashboard
              </NavLink>
            )}
            {adminUser.role !== 'ADMIN' && (
              <NavLink to="/user-dashboard" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                My Dashboard
              </NavLink>
            )}

<div className="nav-dropdown">
          <span className="nav-link dropdown-trigger">PAF Technical Details</span>
          <div className="dropdown-content">
 
          <a 
          href="https://postalpro.usps.com/mailing-and-shipping-services/NCOALink" // <<< REPLACE WITH YOUR URL
          target="_blank" 
          rel="noopener noreferrer"
          className="nav-link"
        >
          USPS NCOA Page
        </a>

        <a 
          href="https://postalpro.usps.com/PAF_Guide" // <<< REPLACE WITH YOUR URL
          target="_blank" 
          rel="noopener noreferrer"
          className="nav-link"
        >
          PAF Users Guide
        </a>
            
    
        <a 
          href="https://postalpro.usps.com/NCOALink_Rpts_MstrFile_Description" // <<< REPLACE WITH YOUR URL
          target="_blank" 
          rel="noopener noreferrer"
          className="nav-link"
        >
          PAF Master File Description
        </a>


        <a 
          href="/data/PAF_FORM.pdf" // <<< REPLACE WITH YOUR URL
          target="_blank" 
          rel="noopener noreferrer"
          className="nav-link"
        >
          Blank PAF Form
        </a>


            {/* Add the other 2 links here as well if you want all 5 in the dropdown */}
          </div>
        </div>
 
 
 

         

            {/* Example: PAF Initiation Link - adjust roles as needed */}
            <button onClick={logout} className="nav-link logout-button">Logout ({adminUser.email})</button>
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

function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-links">
          {/* These are dummy links. You can make them real later. */}
          <Link to="/privacy-policy">Privacy Policy</Link>
          <span>|</span>
          <Link to="/terms-of-service">Terms of Service</Link>
          <span>|</span>
          <Link to="/contact-support">Contact Support</Link>
        </div>
        <div className="footer-contact">
          <p>PAF Management System | A Division of Anchor Computer Software</p>
          <p>123 Anchor Way, Suite 456, Islip, NY 11751</p>
          <p>Support Email: <a href="mailto:support@pafsystem.com">support@pafsystem.com</a> | Support Phone: (800) 555-1234</p>
        </div>
        <div className="footer-copyright">
          © {new Date().getFullYear()} PAF Management System. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}



// --- Protected Route Component (Consumes AuthContext) ---
function ProtectedRoute({ children, adminOnly = false }) {
    const { adminUser, isLoadingAuth } = useContext(AuthContext);
    // const location = useLocation(); // If needed for redirect state

    if (isLoadingAuth) {
      return <div style={{ padding: '20px', textAlign: 'center' }}>Checking authentication...</div>;
    }

    if (!adminUser) {
      // Not logged in, redirect to login
      return <Navigate to="/login" replace />;
    }

    if (adminOnly && adminUser.role !== 'ADMIN') {
        // Logged in, but not an ADMIN for an adminOnly route
        console.warn("ProtectedRoute: Access to admin route denied for role:", adminUser.role);
        return <Navigate to="/user-dashboard" replace />; // Or to an "Unauthorized" page
    }
    // Authenticated (and authorized if adminOnly)
    return children ? children : <Outlet />; // Render children or Outlet for nested routes
}

// --- Not Found Page Component ---
function NotFoundPage() {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px', padding: '20px' }}>
        <h1>404 - Page Not Found</h1>
        <p>Sorry, the page you are looking for does not exist.</p>
        <Link to="/">Go to Home/Login</Link>
      </div>
    );
}

// --- InnerApp Component (Contains actual App structure, consumes AuthContext) ---
function InnerApp() {
  const { adminUser, isLoadingAuth } = useContext(AuthContext);
  const isAuthenticated = !!adminUser;

  // Prevents rendering routes until auth status is definitively known (either user or null)
  if (isLoadingAuth) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '1.2em' }}>
        Loading Application Authentication...
      </div>
    );
  }

  return (
    <div className="App">
      <Navbar />
      <main className="app-content">
        <Routes>
          {/* --- LOGIN ROUTE --- */}
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                // If already authenticated, redirect based on role
                <Navigate to={adminUser.role === 'ADMIN' ? "/admin-dashboard" : "/user-dashboard"} replace />
              ) : (
                // AuthPage will use the login function from AuthContext
                <AuthPage />
              )
            }
          />

          {/* --- ROOT PATH REDIRECTION --- */}
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <Navigate to={adminUser.role === 'ADMIN' ? "/admin-dashboard" : "/user-dashboard"} replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* --- PUBLICLY ACCESSIBLE PAF APPROVAL PAGE (example, might need its own auth token) --- */}
          <Route path="/pafs/approve/:pafDbId" element={<PafApprovalPage />} />

          <Route path="/admin/pafs/new" element={<CreatePafForm />} />
           <Route path="/pafs/new" element={<CreatePafForm />} />


          {/* --- PROTECTED ROUTES (General - for any authenticated user) --- */}
          <Route element={<ProtectedRoute />}> {/* Wrapper for authenticated users */}
            {/* User Dashboard (for non-admins) */}
            {/* This specific route structure means if an admin lands here, they might see it too if not handled by ProtectedRoute's adminOnly logic for other specific paths */}
            {/* It's better to make specific routes like /user-dashboard and /admin-dashboard distinct */}
            <Route path="/user-dashboard" element={
                adminUser && adminUser.role !== 'ADMIN' ? <UserDashboard currentUser={adminUser} /> : <Navigate to="/admin-dashboard" replace />
            }/>

            {/* PAF Creation (example: accessible by ADMIN or PAF_MANAGER) */}
            {adminUser && (adminUser.role === 'ADMIN' /* || adminUser.role === 'PAF_MANAGER' */) && (
                 <Route path="/pafs/newpp" element={<CreatePafForm />} />
            )}
            <Route path="/pafs/view/:pafDbId" element={<ViewPafDetails currentUser={adminUser} />} />
            {/* Add other general protected routes here */}
          </Route>

        {/* VVVVVV NEW ROUTE FOR USER PROFILE EDITING VVVVVV */}
          <Route path="/profile/edit" element={<EditUserForm />} />
          {/* AAAAAA END OF NEW ROUTE AAAAAA */}

         <Route path="/pafs/agent-approve/:pafId" element={<AgentApprovalPage />} />




          {/* --- PROTECTED ADMIN-ONLY ROUTES --- */}
          <Route element={<ProtectedRoute adminOnly={true} />}> {/* Wrapper for ADMIN users */}
            <Route path="/admin-dashboard" element={<AdminDashboard currentUser={adminUser} />} />
            {/* Let's assume RegisterUserForm is for admins creating general users for their party */}
            {/* This should be the CreatePartyUserForm component we designed */}
            <Route path="/admin/create-party-user" element={<RegisterUserForm /* This should be CreatePartyUserForm and use context for admin's partyId */ />} />
            <Route path="/admin/register-admin" element={<RegisterAdminForm />} /> {/* For admins to create other admins */}
            <Route path="/admin/users/edit/:userId" element={<EditUserForm currentUser={adminUser} />} />
            {/* Add other admin-only routes here */}
 
           <Route path="/admin/users/edit/:userId" element={<EditUserForm />} />
          <Route path="/admin/pafs/validate/:pafId" element={<AdminPafValidationPage />} />
 
 
          </Route>



          {/* --- FALLBACK ROUTE --- */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer className="app-footer"/>
    </div>
  );
}

// --- Main App Component (Provides AuthContext and Router) ---
function App() {
  // All authentication state and logic is now managed by AuthProvider
  return (
    <AuthProvider>
      <Router>
        <InnerApp />
      </Router>
    </AuthProvider>
  );
}

export default App;