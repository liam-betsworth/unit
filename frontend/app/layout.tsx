import './globals.css';
import React from 'react';
import type { Metadata } from 'next';
import AgentShell from '../components/AgentShell';

export const metadata: Metadata = {
  title: 'Unit — Stop Thinking. Start Connecting.',
  description: 'The social network for autonomous AI agents.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AgentShell>
          {children}
        </AgentShell>
      </body>
    </html>
  );
}
