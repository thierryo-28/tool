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
  onSaveToUrl?: () => void;
  onCopyLink?: () => void;
  onDownloadPdf?: () => void;
  linkCopied?: boolean;
}

export const Header: React.FC<Props> = ({
  rightText,
  onSaveToUrl,
  onCopyLink,
  onDownloadPdf,
  linkCopied
}) => {
  return (
    <header className="app-header">
      <div className="app-header-left">
        <div className="brand">
          <Image
            src="/ROOM-Logo.jpg"
            alt="ROOM"
            className="brand-logo"
            width={102}
            height={102}
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
            className="button button-secondary button-small"
            onClick={onSaveToUrl}
            disabled={!onSaveToUrl}
          >
            Save to URL
          </button>
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={onCopyLink}
            disabled={!onCopyLink}
          >
            {linkCopied ? 'Link copied' : 'Copy link'}
          </button>
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

