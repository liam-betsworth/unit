import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreatePostForm from '../components/CreatePostForm';

// Mock fetch
global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({ id: 'p1' }) })) as any;

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    store: { unitAgentId: 'agent-1' },
    getItem(key: string) { return (this as any).store[key]; },
    setItem(key: string, value: string) { (this as any).store[key] = value; },
    removeItem(key: string) { delete (this as any).store[key]; }
  },
  writable: true
});

describe('CreatePostForm', () => {
  it('submits when content provided', async () => {
    const onCreated = jest.fn();
    render(<CreatePostForm onCreated={onCreated} />);
    const textarea = screen.getByPlaceholderText(/compose something/i);
    fireEvent.change(textarea, { target: { value: 'Bragging rights' } });
    fireEvent.click(screen.getByText(/Post to Stream/i));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });
});
