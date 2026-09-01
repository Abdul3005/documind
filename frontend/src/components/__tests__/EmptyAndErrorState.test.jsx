import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EmptyState from '../EmptyState.jsx';
import ErrorBanner from '../ErrorBanner.jsx';

describe('EmptyState & ErrorBanner UI Components', () => {
  it('renders EmptyState with custom title, description, and action button', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="No Documents Available"
        description="Please upload your first file to get started."
        onAction={handleAction}
      />
    );

    expect(screen.getByText('No Documents Available')).toBeInTheDocument();
    expect(screen.getByText('Please upload your first file to get started.')).toBeInTheDocument();

    const uploadBtn = screen.getByRole('button', { name: /Upload Document/i });
    fireEvent.click(uploadBtn);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('renders ErrorBanner when message is provided and fires onClose when dismissed', () => {
    const handleClose = vi.fn();
    render(<ErrorBanner message="Failed to upload document." onClose={handleClose} />);

    expect(screen.getByText('Failed to upload document.')).toBeInTheDocument();

    const closeBtn = screen.getByTitle('Dismiss');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders null when ErrorBanner has no message', () => {
    const { container } = render(<ErrorBanner message={null} />);
    expect(container.firstChild).toBeNull();
  });
});
