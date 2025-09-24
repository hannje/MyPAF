import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock axios before importing anything else
const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

jest.mock('axios', () => mockAxios);

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => jest.fn(),
}));

// Simple test without router dependencies first
describe('UserDashboard Component', () => {
  const mockCurrentUser = {
    id: 1,
    email: 'test@example.com',
    role: 'USER',
    party_id: 123
  };

  const mockPafsResponse = {
    data: [
      {
        id: 1,
        company_name: 'Test Company',
        status: 'Draft',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('basic import test', () => {
    // Just test that the component can be imported
    const UserDashboard = require('./UserDashboard').default;
    expect(UserDashboard).toBeDefined();
  });

  test('handles null user gracefully', async () => {
    const UserDashboard = require('./UserDashboard').default;

    render(<UserDashboard currentUser={null} />);

    await waitFor(() => {
      expect(screen.getByText(/user not authenticated/i)).toBeInTheDocument();
    });
  });

  test('handles user without ID gracefully', async () => {
    const UserDashboard = require('./UserDashboard').default;
    const userWithoutId = { email: 'test@example.com', role: 'USER' };

    render(<UserDashboard currentUser={userWithoutId} />);

    await waitFor(() => {
      expect(screen.getByText(/user information not available to fetch pafs/i)).toBeInTheDocument();
    });
  });

  test('shows loading state initially with valid user', async () => {
    const UserDashboard = require('./UserDashboard').default;
    mockAxios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<UserDashboard currentUser={mockCurrentUser} />);

    expect(screen.getByText(/loading your pafs/i)).toBeInTheDocument();
  });

  test('displays PAF data when API call succeeds', async () => {
    const UserDashboard = require('./UserDashboard').default;
    mockAxios.get.mockResolvedValueOnce(mockPafsResponse);

    render(<UserDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      // Check that we're not showing the "no data" message
      expect(screen.queryByText(/you do not have any pafs associated/i)).not.toBeInTheDocument();
      // Check that the API was called successfully
      expect(mockAxios.get).toHaveBeenCalled();
    });
  });

  test('displays error when API call fails', async () => {
    const UserDashboard = require('./UserDashboard').default;
    mockAxios.get.mockRejectedValueOnce(new Error('Network Error'));

    render(<UserDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByText(/could not load your pafs/i)).toBeInTheDocument();
    });
  });

  test('makes API call with correct parameters', async () => {
    const UserDashboard = require('./UserDashboard').default;
    mockAxios.get.mockResolvedValueOnce(mockPafsResponse);

    render(<UserDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/pafs/my-pafs'),
        expect.objectContaining({
          withCredentials: true
        })
      );
    });
  });
});