import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { AdminUser } from '../types.ts';

interface SiteHeaderProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  currentAdmin: AdminUser | null;
}

export function SiteHeader({ currentPath, onNavigate, currentAdmin }: SiteHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'News', path: '/news' },
    { label: 'Announcements', path: '/announcements' },
    { label: 'About', path: '/#about' },
    { label: 'Contact', path: '/#contact' },
  ];

  const handleLinkClick = (path: string) => {
    setMobileOpen(false);
    onNavigate(path);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-stone-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Brand Logo */}
        <button
          type="button"
          onClick={() => handleLinkClick('/')}
          className="inline-flex items-center shrink-0 cursor-pointer text-left focus:outline-none"
          aria-label="LASU Campus Broadcast Home"
        >
          <img
            src="https://bobodhouhertyoflasu.com.ng/logo/lasulogo.png"
            alt="Lagos State University (LASU) Broadcast"
            className="h-9 sm:h-10 w-auto object-contain"
          />
        </button>

        {/* Zone 2: 5 concise single-line text nav links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-semibold uppercase tracking-wider text-[#525866]" aria-label="Primary Navigation">
          {navItems.map((item) => {
            const isActive =
              item.path === '/'
                ? currentPath === '/'
                : !item.path.includes('#') && currentPath.startsWith(item.path);
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleLinkClick(item.path)}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors duration-150 cursor-pointer ${
                  isActive
                    ? 'text-[#B91C1C] border-[#B91C1C]'
                    : 'border-transparent hover:text-[#0B2545] hover:border-stone-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleLinkClick(currentAdmin ? '/admin' : '/admin/login')}
            className="hidden sm:inline-flex items-center justify-center px-4 py-1.5 text-xs font-semibold text-white bg-[#0B2545] hover:bg-[#13315C] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer min-h-[36px]"
          >
            {currentAdmin ? 'Dashboard' : 'Admin Portal'}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 border border-stone-300 text-[#14181F] hover:bg-stone-100 cursor-pointer"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-stone-200 bg-white px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => handleLinkClick(item.path)}
              className="w-full text-left px-3 py-2 text-sm font-medium text-[#14181F] hover:bg-stone-100 cursor-pointer"
            >
              {item.label}
            </button>
          ))}
          <div className="pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={() => handleLinkClick(currentAdmin ? '/admin' : '/admin/login')}
              className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-[#0B2545] hover:bg-[#13315C] cursor-pointer"
            >
              {currentAdmin ? 'Admin Dashboard' : 'Admin Portal'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
