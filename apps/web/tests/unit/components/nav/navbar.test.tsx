import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Navbar } from '../../../../src/components/nav/navbar';

// Mock the auth context to control user state in tests
vi.mock('../../../../src/context/auth-context', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../../../src/context/auth-context';

const mockUseAuth = vi.mocked(useAuth);

describe('Navbar', () => {
  it('renders the TheraPulse logo / brand link', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, refetch: vi.fn() });
    render(<Navbar />);
    expect(screen.getByRole('link', { name: /TheraPulse/i })).toBeInTheDocument();
  });

  it('includes a skip-to-main-content link for accessibility', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, refetch: vi.fn() });
    render(<Navbar />);
    const skip = screen.getByText(/skip to main content/i);
    expect(skip).toBeInTheDocument();
    expect(skip.closest('a')).toHaveAttribute('href', '#main-content');
  });

  it('shows login and register links when no user is authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, refetch: vi.fn() });
    render(<Navbar />);
    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /register/i })).toBeInTheDocument();
  });

  it('shows Find a Therapist link for unauthenticated visitors', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, refetch: vi.fn() });
    render(<Navbar />);
    expect(screen.getByRole('link', { name: /find a therapist/i })).toBeInTheDocument();
  });

  it('shows admin links when user role is ADMIN', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        email: 'admin@tp.com',
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      isLoading: false,
      refetch: vi.fn(),
    });
    render(<Navbar />);
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /manage therapists/i })).toBeInTheDocument();
  });

  it('shows therapist links when user role is THERAPIST', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: '2',
        email: 'therapist@tp.com',
        role: 'THERAPIST',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      isLoading: false,
      refetch: vi.fn(),
    });
    render(<Navbar />);
    expect(screen.getByRole('link', { name: /my clients/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /worksheets/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /session notes/i })).toBeInTheDocument();
  });

  it('shows client links when user role is CLIENT', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: '3',
        email: 'client@tp.com',
        role: 'CLIENT',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      isLoading: false,
      refetch: vi.fn(),
    });
    render(<Navbar />);
    expect(screen.getByRole('link', { name: /my worksheets/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /my progress/i })).toBeInTheDocument();
  });

  it('does NOT show login/register when a user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: '3',
        email: 'client@tp.com',
        role: 'CLIENT',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      isLoading: false,
      refetch: vi.fn(),
    });
    render(<Navbar />);
    expect(screen.queryByRole('link', { name: /log in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /register/i })).not.toBeInTheDocument();
  });

  it('has role="navigation" for screen readers', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, refetch: vi.fn() });
    render(<Navbar />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
