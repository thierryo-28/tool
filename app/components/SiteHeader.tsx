'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton
} from '@clerk/nextjs';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-header-logo" aria-label="Revenue Ninja home">
          <Image
            src="/NinjaLogo.jpg"
            alt="Revenue Ninja"
            width={230}
            height={230}
            className="site-header-logo-img"
            priority
          />
        </Link>
        <div className="site-header-auth no-print">
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
      </div>
    </header>
  );
}
