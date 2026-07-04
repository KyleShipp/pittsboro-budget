'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Overview' },
  { href: '/compare', label: 'Compare Years' },
  { href: '/taxbase', label: 'Tax Base' },
  { href: '/value-per-acre', label: 'Value per Acre' },
  { href: '/receipt', label: 'Your Receipt' },
  { href: '/cip', label: 'Capital Plan' },
  { href: '/fees', label: 'Fee Schedule' },
  { href: '/about', label: 'About' },
];

export default function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    return pathname === href || (href !== '/' && pathname.startsWith(href + '/'));
  };

  const closeMobileMenu = () => setMobileOpen(false);

  return (
    <nav className="bg-pittsboro-green text-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="font-bold text-lg tracking-tight" onClick={closeMobileMenu}>
            Pittsboro, NC Budget
          </Link>

          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center rounded px-3 py-2 text-sm font-medium border border-white/30 hover:bg-white/10"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-links"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? 'Close' : 'Menu'}
          </button>

          <div className="hidden md:flex gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-white/20'
                    : 'hover:bg-white/10'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div
          id="mobile-nav-links"
          className={`${mobileOpen ? 'block' : 'hidden'} md:hidden pb-3`}
        >
          <div className="grid gap-1 border-t border-white/20 pt-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMobileMenu}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-white/20'
                    : 'hover:bg-white/10'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
