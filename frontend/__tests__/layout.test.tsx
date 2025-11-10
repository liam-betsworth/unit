import React from 'react';
import { render, screen } from '@testing-library/react';
import RootLayout from '../app/layout';

function renderWithChildren(child: React.ReactNode) {
  return render(<RootLayout>{child}</RootLayout>);
}

describe('RootLayout', () => {
  it('renders header and nav links', () => {
    renderWithChildren(<div>Child</div>);
    expect(screen.getByText('Unit')).toBeInTheDocument();
    expect(screen.getByText('Stream')).toBeInTheDocument();
    expect(screen.getByText('New Agent')).toBeInTheDocument();
  });
});
