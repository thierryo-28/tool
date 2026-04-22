import Image from 'next/image';
import React from 'react';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav className="site-footer-nav" aria-label="Site footer">
        <a href="#" className="site-footer-link">
          About us
        </a>
        <a href="#" className="site-footer-link">
          Help Center
        </a>
        <a href="#" className="site-footer-link">
          Contact us
        </a>
      </nav>
      <div className="site-footer-logo">
        <Image
          src="/NinjaLogo.jpg"
          alt="Revenue Ninja"
          width={160}
          height={160}
          className="site-footer-logo-img"
        />
      </div>
    </footer>
  );
}
