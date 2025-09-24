import React from 'react';

// Mock implementations for react-router-dom
const mockNavigate = jest.fn();

export const useNavigate = () => mockNavigate;

export const Link = ({ children, to, ...props }) => (
  <a href={to} {...props}>
    {children}
  </a>
);

export const BrowserRouter = ({ children }) => <div>{children}</div>;
export const MemoryRouter = ({ children }) => <div>{children}</div>;
export const Routes = ({ children }) => <div>{children}</div>;
export const Route = ({ element }) => element;
export const Navigate = () => <div>Redirecting...</div>;
export const Outlet = () => <div>Outlet</div>;
export const NavLink = ({ children, to, ...props }) => (
  <a href={to} {...props}>
    {children}
  </a>
);

export const useLocation = () => ({
  pathname: '/test',
  search: '',
  hash: '',
  state: null,
});

// Export the navigate mock so tests can access it
export { mockNavigate };

// Default export
export default {
  useNavigate,
  Link,
  BrowserRouter,
  MemoryRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  NavLink,
  useLocation,
  mockNavigate,
};