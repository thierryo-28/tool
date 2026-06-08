import type { Metadata } from 'next';
import React from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { SiteFooter } from './components/SiteFooter';
import { SiteHeader } from './components/SiteHeader';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sales Capacity Planner',
  description: 'Plan SDR, AE, and AM headcount and capacity versus targets.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <div className="site-shell">
            <SiteHeader />
            <div className="site-shell-content">{children}</div>
            <SiteFooter />
          </div>
        </ClerkProvider>
      </body>
    </html>
  );
}

