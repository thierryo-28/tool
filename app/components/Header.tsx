'use client';

import React from 'react';
import Image from 'next/image';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton
} from '@clerk/nextjs';

interface Props {
  rightText?: string;
  onDownloadPdf?: () => void;
}

export const Header: React.FC<Props> = ({
  rightText,
  onDownloadPdf
}) => {
  return (
    <header className="app-header">
      <div className="app-header-left">
        <div className="brand">
          <Image
            src="/NinjaLogo.jpg"
            alt="Ninja"
            className="brand-logo"
            width={230}
            height={230}
            priority
          />
        </div>
      </div>
      <div className="app-header-right">
        <div className="app-header-auth no-print">
          <SignedOut>
            <SignInButton mode="modal">
              <button
                type="button"
                className="button button-secondary button-small"
              >
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <div className="app-header-user">
              <UserButton
                showName
                appearance={{
                  elements: {
                    userButtonTrigger: 'app-header-user-trigger',
                    userButtonOuterIdentifier: 'app-header-user-name'
                  }
                }}
              />
            </div>
          </SignedIn>
        </div>
        <div className="app-header-kicker">Planner</div>
        <div className="app-header-title">{rightText ?? 'Sales Capacity'}</div>
        <div className="app-header-actions no-print">
          <button
            type="button"
            className="button button-small"
            onClick={onDownloadPdf}
            disabled={!onDownloadPdf}
          >
            Download PDF
          </button>
        </div>
      </div>
    </header>
  );
};

