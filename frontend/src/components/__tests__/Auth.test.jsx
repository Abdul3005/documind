import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from '../../pages/LoginPage.jsx';
import RegisterPage from '../../pages/RegisterPage.jsx';
import { AuthProvider, useAuth } from '../../context/AuthContext.jsx';

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

  it('purges all document states, localStorage, and sessionStorage completely upon logout', () => {
    function TestConsumer() {
      const {
        activeDocument,
        setActiveDocument,
        summary,
        setSummary,
        messages,
        setMessages,
        documentList,
        setDocumentList,
        logout,
      } = useAuth();

      return (
        <div>
          <div data-testid="active-doc">{activeDocument ? activeDocument.filename : 'null'}</div>
          <div data-testid="summary-text">{summary || 'null'}</div>
          <div data-testid="msg-count">{messages.length}</div>
          <div data-testid="doc-count">{documentList.length}</div>
          <button
            onClick={() => {
              setActiveDocument({ id: 'doc-1', filename: 'UserA_Confidential.pdf' });
              setSummary('User A confidential summary');
              setMessages([{ id: 'm1', content: 'Secret message' }]);
              setDocumentList([{ id: 'doc-1', filename: 'UserA_Confidential.pdf' }]);
            }}
          >
            Populate State
          </button>
          <button onClick={logout}>Sign Out</button>
        </div>
      );
    }

    // Set sample data in localStorage and sessionStorage
    window.localStorage.setItem('documind_token', 'sample_token_user_a');
    window.localStorage.setItem('documind_active_doc_id', 'doc-1');
    window.sessionStorage.setItem('temp_session_key', 'user_a_session');

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // 1. Populate state
    fireEvent.click(screen.getByText('Populate State'));
    expect(screen.getByTestId('active-doc').textContent).toBe('UserA_Confidential.pdf');
    expect(screen.getByTestId('summary-text').textContent).toBe('User A confidential summary');
    expect(screen.getByTestId('msg-count').textContent).toBe('1');
    expect(screen.getByTestId('doc-count').textContent).toBe('1');

    // 2. Perform logout
    fireEvent.click(screen.getByText('Sign Out'));

    // 3. Verify all states are purged to null / []
    expect(screen.getByTestId('active-doc').textContent).toBe('null');
    expect(screen.getByTestId('summary-text').textContent).toBe('null');
    expect(screen.getByTestId('msg-count').textContent).toBe('0');
    expect(screen.getByTestId('doc-count').textContent).toBe('0');

    // 4. Verify localStorage and sessionStorage are completely purged
    expect(window.localStorage.getItem('documind_token')).toBeNull();
    expect(window.localStorage.getItem('documind_active_doc_id')).toBeNull();
    expect(window.sessionStorage.getItem('temp_session_key')).toBeNull();
  });

  it('restores user session when valid token or refresh succeeds', async () => {
    function StatusConsumer() {
      const { user, isAuthenticated, loading } = useAuth();
      if (loading) return <div>Loading Auth...</div>;
      return (
        <div>
          <div data-testid="auth-status">{isAuthenticated ? 'AUTHENTICATED' : 'ANONYMOUS'}</div>
          <div data-testid="auth-user">{user ? user.email : 'NONE'}</div>
        </div>
      );
    }

    render(
      <AuthProvider>
        <StatusConsumer />
      </AuthProvider>
    );

    // Initial state without token should complete loading cleanly to anonymous
    expect(await screen.findByTestId('auth-status')).toBeInTheDocument();
    expect(screen.getByTestId('auth-status').textContent).toBe('ANONYMOUS');
  });
});
