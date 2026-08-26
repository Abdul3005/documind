import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConfirmModal from '../ConfirmModal.jsx';

describe('ConfirmModal Component', () => {
  it('renders modal content when open and fires callbacks', () => {
    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();

    render(
      <ConfirmModal
        isOpen={true}
        title="Delete Test Document"
        message="Are you sure you want to proceed?"
        confirmLabel="Confirm Action"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );

    expect(screen.getByText('Delete Test Document')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(handleCancel).toHaveBeenCalledTimes(1);

    const actionBtn = screen.getByRole('button', { name: /Confirm Action/i });
    fireEvent.click(actionBtn);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });
});
