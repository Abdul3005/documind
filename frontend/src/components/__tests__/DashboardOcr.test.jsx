import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Dashboard from '../../pages/Dashboard.jsx';

describe('Dashboard OCR Badge & Document UX', () => {
  it('renders Extracted via OCR badge when extractionMethod is ocr', () => {
    const docs = [
      {
        id: 'doc-ocr-1',
        filename: 'scanned_receipt.png',
        fileType: 'image',
        status: 'ready',
        extractionMethod: 'ocr',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'doc-text-2',
        filename: 'contract.pdf',
        fileType: 'pdf',
        status: 'ready',
        extractionMethod: 'text',
        createdAt: new Date().toISOString(),
      },
    ];

    render(
      <Dashboard
        documents={docs}
        loading={false}
        isUploading={false}
        onUpload={() => {}}
        onSelectDocument={() => {}}
        onDeleteDocument={() => {}}
      />
    );

    expect(screen.getByText('scanned_receipt.png')).toBeInTheDocument();
    expect(screen.getByText('contract.pdf')).toBeInTheDocument();
    expect(screen.getByText('Extracted via OCR')).toBeInTheDocument();
    expect(screen.getByText('Native Text')).toBeInTheDocument();
  });
});
