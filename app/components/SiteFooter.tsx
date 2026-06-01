import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav className="site-footer-nav" aria-label="Site footer">
        <Link href="/about" className="site-footer-link">
          About us
        </Link>
        <a href="#" className="site-footer-link">
          Help Center
        </a>
        <a href="#" className="site-footer-link">
          Contact us
        </a>
      </nav>
      <div className="site-footer-logo">
        <Image
          src="/RevenueNinjaLogo.png"
          alt="Revenue Ninja"
          width={160}
          height={160}
          className="site-footer-logo-img"
        />
      </div>
    </footer>
  );
}
