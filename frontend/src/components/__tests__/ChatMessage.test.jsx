import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ChatMessage from '../ChatMessage.jsx';

describe('ChatMessage RAG Sources Rendering', () => {
  it('renders assistant answer and RAG grounded sources indicator', () => {
    const message = {
      id: 'msg-1',
      role: 'assistant',
      content: 'The contract duration is 12 months.',
      sources: [
        { chunkIndex: 0, similarity: 0.92 },
        { chunkIndex: 2, similarity: 0.85 },
      ],
      createdAt: new Date().toISOString(),
    };

    render(<ChatMessage message={message} />);

    expect(screen.getByText('The contract duration is 12 months.')).toBeInTheDocument();
    expect(screen.getByText('Answer grounded in retrieved document context')).toBeInTheDocument();
    expect(screen.getByText('2 Chunk Sources')).toBeInTheDocument();

    // Toggle expand sources
    const toggleBtn = screen.getByText('2 Chunk Sources');
    fireEvent.click(toggleBtn);

    expect(screen.getByText('Chunk #0')).toBeInTheDocument();
    expect(screen.getByText('92.0%')).toBeInTheDocument();
    expect(screen.getByText('Chunk #2')).toBeInTheDocument();
    expect(screen.getByText('85.0%')).toBeInTheDocument();
  });
});
