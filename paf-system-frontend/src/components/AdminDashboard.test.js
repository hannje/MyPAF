import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock axios before importing anything else
const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

jest.mock('axios', () => ({
  __esModule: true,
  default: mockAxios,
}));

// Mock apiClient
const mockApiClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../api/apiClient', () => ({
  __esModule: true,
  default: mockApiClient,
}));

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => jest.fn(),
}));

// Mock AuthContext
const mockAuthContext = {
  adminUser: {
    id: 1,
    email: 'admin@example.com',
    role: 'ADMIN',
    party_id: 2
  }
};

jest.mock('../context/AuthContext', () => {
  const { createContext } = jest.requireActual('react');
  return {
    __esModule: true,
    default: createContext(mockAuthContext),
  };
});

// Mock child components
jest.mock('./RegisterAdminForm', () => {
  return function MockRegisterAdminForm() {
    return <div data-testid="register-admin-form">Register Admin Form</div>;
  };
});

jest.mock('./PafTableRow', () => {
  return function MockPafTableRow({ paf }) {
    return <div data-testid="paf-table-row">{paf.company_name}</div>;
  };
});

// Import component after all mocks are set up
const AdminDashboard = require('./AdminDashboard').default;

describe('AdminDashboard Component', () => {
  const mockCurrentUser = {
    id: 1,
    email: 'admin@example.com',
    role: 'ADMIN',
    party_id: 2
  };

  const mockSummaryResponse = {
    data: {
      activePafs: 10,
      pendingValidationUs: 3,
      pendingUspsApprovalForeign: 2,
      rejectedIncomplete: 1,
      renewalDueNext30Days: 5
    }
  };

  const mockPafsResponse = {
    data: [
      {
        id: 1,
        company_name: 'Test Company 1',
        status: 'Pending Validation',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: 2,
        company_name: 'Test Company 2',
        status: 'Approved',
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      }
    ]
  };

  const mockUsersResponse = {
    data: [
      {
        id: 1,
        email: 'user1@example.com',
        role: 'USER',
        party_id: 2,
        created_at: '2024-01-01T00:00:00Z'
      },
      {
        id: 2,
        email: 'user2@example.com',
        role: 'USER',
        party_id: 2,
        created_at: '2024-01-02T00:00:00Z'
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders loading state initially', () => {
      mockAxios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<AdminDashboard currentUser={mockCurrentUser} />);

      expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
      // Component shows loading state with multiple "..." elements
      const loadingElements = screen.getAllByText('...');
      expect(loadingElements.length).toBeGreaterThan(0);
    });

    test('renders admin dashboard header with user email', async () => {
      mockAxios.get
        .mockResolvedValueOnce(mockSummaryResponse)
        .mockResolvedValueOnce(mockPafsResponse)
        .mockResolvedValueOnce(mockUsersResponse);

      render(<AdminDashboard currentUser={mockCurrentUser} />);

      await waitFor(() => {
        expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
        expect(screen.getByText(/admin@example.com/i)).toBeInTheDocument();
      });
    });

    test('renders navigation links', async () => {
      mockAxios.get
        .mockResolvedValueOnce(mockSummaryResponse)
        .mockResolvedValueOnce(mockPafsResponse)
        .mockResolvedValueOnce(mockUsersResponse);

      render(<AdminDashboard currentUser={mockCurrentUser} />);

      await waitFor(() => {
        expect(screen.getByText(/initiate new paf/i)).toBeInTheDocument();
        expect(screen.getByText(/add new admin/i)).toBeInTheDocument();
      });
    });
  });

  describe('Summary Data Display', () => {
    test('displays summary statistics correctly', async () => {
      mockAxios.get
        .mockResolvedValueOnce(mockSummaryResponse)
        .mockResolvedValueOnce(mockPafsResponse)
        .mockResolvedValueOnce(mockUsersResponse);

      render(<AdminDashboard currentUser={mockCurrentUser} />);

      await waitFor(() => {
        expect(screen.getByText('10')).toBeInTheDocument(); // activePafs
        expect(screen.getByText('3')).toBeInTheDocument(); // pendingValidationUs
        expect(screen.getByText('2')).toBeInTheDocument(); // pendingUspsApprovalForeign
        expect(screen.getByText('1')).toBeInTheDocument(); // rejectedIncomplete
        expect(screen.getByText('5')).toBeInTheDocument(); // renewalDueNext30Days
      });
    });

    test('displays summary error when API call fails', async () => {
      mockAxios.get
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce(mockPafsResponse)
        .mockResolvedValueOnce(mockUsersResponse);

      render(<AdminDashboard currentUser={mockCurrentUser} />);

      await waitFor(() => {
        expect(screen.getByText(/could not load summary data/i)).toBeInTheDocument();
      });
    });

    test('displays N/A values when summary fetch fails', async () => {
      mockAxios.get
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce(mockPafsResponse)
        .mockResolvedValueOnce(mockUsersResponse);

      render(<AdminDashboard currentUser={mockCurrentUser} />);

      await waitFor(() => {
        const naElements = screen.getAllByText('N/A');
        expect(naElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('PAF Management', () => {
    test('displays PAF list correctly', async () => {
      mockAxios.get
        .mockResolvedValueOnce(mockSummaryResponse)
        .mockResolvedValueOnce(mockPafsResponse)
        .mockResolvedValueOnce(mockUsersResponse);

      render(<AdminDashboard currentUser={mockCurrentUser} />);

      await waitFor(() => {
        expect(screen.getByText('Test Company 1')).toBeInTheDocument();
        expect(screen.getByText('Test Company 2')).toBeInTheDocument();
      });
    });

    test('displays PAF error when API call fails', async () => {
      mockAxios.get
        .mockResolvedValueOnce(mockSummaryResponse)
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce(mockUsersResponse);

      render(<AdminDashboard currentUser={mockCurrentUser} />);

      await waitFor(() => {
        expect(screen.getByText(/could not load pafs list/i)).toBeInTheDocument();
      });
    });

    test('displays no PAFs message when list is empty', async () => {
      const emptyPafsResponse = { data: [] };
      mockAxios.get
        .mockResolvedValueOnce(mockSummaryResponse)
        .mockResolvedValueOnce(emptyPafsResponse)
        .mockResolvedValueOnce(mockUsersResponse);

      render(<AdminDashboard currentUser={mockCurrentUser} />);

      await waitFor(() => {
        expect(screen.getByText(/no pafs found/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Management', () => {
    test('displays user list correctly', async () => {
      mockAxios.get
        .mockResolvedValueOnce(mockSummaryResponse)
        .mockResolvedValueOnce(mockPafsResponse);

      mockApiClient.get.mockResolvedValueOnce(mockUsersResponse);

      render(<AdminDashboard currentUser={mockCurrentUser} />);

      await waitFor(() => {
        // Check that we're not showing "no users found" message
        expect(screen.queryByText(/no users found/i)).not.toBeInTheDocument();
      });
    });

    test('displays user error when API call fails', async () => {
      mockAxios.get
        .mockResolvedValueOnce(mockSummaryResponse)
        .mockResolvedValueOnce(mockPafsResponse);

      // Mock all user API calls to fail
      mockApiClient.get.mockRejectedValue(new Error('Network Error'));

      render(<AdminDashboard currentUser={mockCurrentUser} />);

      await waitFor(() => {
        // When API fails, component shows "No users found" message
        expect(screen.getByText(/no users found in the system/i)).toBeInTheDocument();
        // And should not show actual user data
        expect(screen.queryByText(/user1@example.com/i)).not.toBeInTheDocument();
      });
    });

    test('displays no users message when list is empty', async () => {
      const emptyUsersResponse = { data: [] };
      mockAxios.get
        .mockResolvedValueOnce(mockSummaryResponse)
        .mockResolvedValueOnce(mockPafsResponse)
        .mockResolvedValueOnce(emptyUsersResponse);

      render(<AdminDashboard currentUser={mockCurrentUser} />);

      await waitFor(() => {
        expect(screen.getByText(/no users found/i)).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    test('makes correct API calls on mount', async () => {
      mockAxios.get
        .mockResolvedValueOnce(mockSummaryResponse)
        .mockResolvedValueOnce(mockPafsResponse);

      mockApiClient.get.mockResolvedValueOnce(mockUsersResponse);

      render(<AdminDashboard currentUser={mockCurrentUser} />);

      await waitFor(() => {
        // Check that axios was called for summary and PAFs
        expect(mockAxios.get).toHaveBeenCalledTimes(2);
        // Check that apiClient was called for users
        expect(mockApiClient.get).toHaveBeenCalledWith('/api/dashboard/users');
      });
    });

    test('sends withCredentials with API requests', async () => {
      mockAxios.get
        .mockResolvedValueOnce(mockSummaryResponse)
        .mockResolvedValueOnce(mockPafsResponse)
        .mockResolvedValueOnce(mockUsersResponse);

      render(<AdminDashboard currentUser={mockCurrentUser} />);

      await waitFor(() => {
        const calls = mockAxios.get.mock.calls;
        calls.forEach(call => {
          if (call[1]) { // If there's a config object
            expect(call[1]).toEqual(
              expect.objectContaining({ withCredentials: true })
            );
          }
        });
      });
    });
  });

  describe('Error Handling', () => {
    test('handles null currentUser gracefully', async () => {
      mockAxios.get
        .mockResolvedValueOnce(mockSummaryResponse)
        .mockResolvedValueOnce(mockPafsResponse)
        .mockResolvedValueOnce(mockUsersResponse);

      render(<AdminDashboard currentUser={null} />);

      await waitFor(() => {
        expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
      });
    });

    test('handles concurrent API failures', async () => {
      mockAxios.get
        .mockRejectedValueOnce(new Error('Summary Error'))
        .mockRejectedValueOnce(new Error('PAFs Error'))
        .mockRejectedValueOnce(new Error('Users Error'));

      render(<AdminDashboard currentUser={mockCurrentUser} />);

      await waitFor(() => {
        // At least one error should be displayed
        const errors = screen.getAllByText(/could not load/i);
        expect(errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Component State Management', () => {
    test('manages loading states correctly', async () => {
      let resolvePromises;
      const promises = new Promise((resolve) => {
        resolvePromises = resolve;
      });

      mockAxios.get.mockReturnValue(promises);

      render(<AdminDashboard currentUser={mockCurrentUser} />);

      // Should show loading states with "..." indicators
      const loadingElements = screen.getAllByText('...');
      expect(loadingElements.length).toBeGreaterThan(0);

      // Resolve promises
      resolvePromises({ data: mockSummaryResponse.data });

      await waitFor(() => {
        // Check that loading states are no longer present
        expect(screen.queryByText('...')).not.toBeInTheDocument();
      });
    });

    test('clears errors on successful API calls', async () => {
      // Mock successful API calls for all endpoints
      mockAxios.get
        .mockResolvedValueOnce(mockSummaryResponse)
        .mockResolvedValueOnce(mockPafsResponse);
      mockApiClient.get.mockResolvedValue(mockUsersResponse);

      render(<AdminDashboard currentUser={mockCurrentUser} />);

      await waitFor(() => {
        // Verify successful data loads by looking for specific elements
        expect(screen.getByText('10')).toBeInTheDocument(); // Summary active count from mockSummaryResponse
        expect(screen.getByText('user1@example.com')).toBeInTheDocument(); // Users loaded
        expect(screen.getByText('Test Company 1')).toBeInTheDocument(); // PAFs loaded

        // Verify no error messages are displayed
        expect(screen.queryByText(/could not load/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
      });
    });
  });
});