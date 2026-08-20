'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { SkipLink } from '@/components/ui/skip-link';

const ADMIN_LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/therapists', label: 'Manage Therapists' },
];

const THERAPIST_LINKS = [
  { href: '/therapist/clients', label: 'My Clients' },
  { href: '/therapist/worksheets', label: 'Worksheets' },
  { href: '/therapist/notes', label: 'Session Notes' },
];

const CLIENT_LINKS = [
  { href: '/client/worksheets', label: 'My Worksheets' },
  { href: '/client/progress', label: 'My Progress' },
];

export function Navbar(): React.JSX.Element {
  const { user } = useAuth();

  const navLinks = (() => {
    if (!user) return null;
    if (user.role === 'ADMIN') return ADMIN_LINKS;
    if (user.role === 'THERAPIST') return THERAPIST_LINKS;
    return CLIENT_LINKS;
  })();

  return (
    <>
      <SkipLink />
      <nav
        aria-label="Main navigation"
        className="flex h-[180px] items-center justify-between border-b border-[#3D325A] bg-[var(--color-primary)] px-4 md:px-8"
      >
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 focus-visible:outline-white">
          <Image
            src="/logo.png"
            alt="TheraPulse"
            width={560}
            height={160}
            className="h-[160px] w-auto object-contain logo-tint"
            priority
          />
        </Link>

        {/* Nav links */}
        <ul className="hidden items-center gap-6 md:flex" role="list">
          {!user && (
            <li>
              <Link
                href="/directory"
                className="text-sm font-medium text-white/80 hover:text-white"
              >
                Find a Therapist
              </Link>
            </li>
          )}

          {navLinks?.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} className="text-sm font-medium text-white/80 hover:text-white">
                {label}
              </Link>
            </li>
          ))}

          {!user && (
            <>
              <li>
                <Link
                  href="/auth/login"
                  className="rounded-md border border-white px-3 py-1.5 text-sm font-semibold text-white hover:bg-white hover:text-[var(--color-primary)] transition-colors"
                >
                  Log In
                </Link>
              </li>
              <li>
                <Link
                  href="/auth/register"
                  className="rounded-md bg-[var(--color-harvest-gold)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#a07830]"
                >
                  Register
                </Link>
              </li>
            </>
          )}
        </ul>
      </nav>
    </>
  );
}
