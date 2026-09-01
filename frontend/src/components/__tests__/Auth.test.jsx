import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from '../../pages/LoginPage.jsx';
import RegisterPage from '../../pages/RegisterPage.jsx';
import { AuthProvider } from '../../context/AuthContext.jsx';

describe('Authentication UI Components', () => {
  it('renders LoginPage form fields and handles login submit click', () => {
    const handleSwitch = vi.fn();
    render(
      <AuthProvider>
        <LoginPage onSwitchToRegister={handleSwitch} />
      </AuthProvider>
    );

    expect(screen.getByText(/Welcome Back to DocuMind/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('user@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();

    const switchBtn = screen.getByText('Create Account');
    fireEvent.click(switchBtn);
    expect(handleSwitch).toHaveBeenCalledTimes(1);
  });

  it('renders RegisterPage form fields and validates password match', async () => {
    const handleSwitch = vi.fn();
    render(
      <AuthProvider>
        <RegisterPage onSwitchToLogin={handleSwitch} />
      </AuthProvider>
    );

    expect(screen.getByText(/Create Your Account/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Abdul Rehman')).toBeInTheDocument();

    // Fill in mismatching passwords
    fireEvent.change(screen.getByPlaceholderText('Abdul Rehman'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText('user@example.com'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('At least 6 characters'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText('Re-enter password'), { target: { value: 'different123' } });

    const submitBtn = screen.getByRole('button', { name: /Create Account/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
  });
});
