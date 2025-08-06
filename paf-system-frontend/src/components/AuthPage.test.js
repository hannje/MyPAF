import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom'; // Provides useful custom matchers
import { BrowserRouter } from 'react-router-dom';
import AuthPage from '../AuthPage'; // Adjust import path as needed
import { AuthProvider } from '../../context/AuthContext'; // We need to provide the context

// Helper function to wrap components in necessary providers for testing
const renderWithProviders = (ui, { providerProps, ...renderOptions }) => {
  return render(
    <BrowserRouter>
      <AuthProvider {...providerProps}>{ui}</AuthProvider>
    </BrowserRouter>,
    renderOptions
  );
};

describe('AuthPage Component', () => {

  test('renders login form correctly', () => {
    renderWithProviders(<AuthPage />);

    // Check if the main elements are on the screen
    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  test('allows user to type into email and password fields', () => {
    renderWithProviders(<AuthPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    // Simulate user typing
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    // Check if the input values have been updated
    expect(emailInput.value).toBe('test@example.com');
    expect(passwordInput.value).toBe('password123');
  });

  // This is a more advanced test that mocks the API call
  test('displays an error message on failed login', async () => {
    // We need to mock the axios.post call for this test
    // This requires a more advanced setup using jest.mock('axios') which we can cover next.
    // For now, this is a placeholder for what a more complex test would look like.
    
    // Example (would require mocking):
    // jest.mock('axios');
    // axios.post.mockRejectedValueOnce({ response: { data: { message: 'Invalid credentials' } } });
    
    // renderWithProviders(<AuthPage />);
    // fireEvent.click(screen.getByRole('button', { name: /login/i }));
    
    // const errorMessage = await screen.findByText(/invalid credentials/i);
    // expect(errorMessage).toBeInTheDocument();
  });

});