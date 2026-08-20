import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TherapistCard } from '../../../../src/components/directory/therapist-card';
import type { TherapistProfileSummary } from '../../../../src/components/directory/therapist-card';

const mockProfile: TherapistProfileSummary = {
  id: 'tp-001',
  name: 'Dr. Amara Moyo',
  bio: 'Specialist in trauma and anxiety therapy with 10 years of experience.',
  specializations: ['Trauma', 'Anxiety', 'Depression'],
  languages: ['English', 'Shona'],
  city: 'Harare',
  province: 'Harare Province',
};

describe('TherapistCard', () => {
  it('renders the therapist name', () => {
    render(<TherapistCard profile={mockProfile} />);
    expect(screen.getByRole('heading', { name: /Dr. Amara Moyo/i })).toBeInTheDocument();
  });

  it('renders the bio text', () => {
    render(<TherapistCard profile={mockProfile} />);
    expect(screen.getByText(/Specialist in trauma/i)).toBeInTheDocument();
  });

  it('renders all specializations', () => {
    render(<TherapistCard profile={mockProfile} />);
    expect(screen.getByText('Trauma')).toBeInTheDocument();
    expect(screen.getByText('Anxiety')).toBeInTheDocument();
    expect(screen.getByText('Depression')).toBeInTheDocument();
  });

  it('renders all languages', () => {
    render(<TherapistCard profile={mockProfile} />);
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Shona')).toBeInTheDocument();
  });

  it('renders city and province location', () => {
    render(<TherapistCard profile={mockProfile} />);
    expect(screen.getByText(/Harare/i)).toBeInTheDocument();
  });

  it('renders a link to the therapist profile page', () => {
    render(<TherapistCard profile={mockProfile} />);
    const link = screen.getByRole('link', { name: /view profile/i });
    expect(link).toHaveAttribute('href', '/directory/tp-001');
  });

  it('renders gracefully when bio is null', () => {
    const profileNoBio: TherapistProfileSummary = { ...mockProfile, bio: null };
    render(<TherapistCard profile={profileNoBio} />);
    expect(screen.getByRole('heading', { name: /Dr. Amara Moyo/i })).toBeInTheDocument();
  });

  it('renders gracefully when city is null', () => {
    const profileNoLocation: TherapistProfileSummary = {
      ...mockProfile,
      city: null,
      province: null,
    };
    render(<TherapistCard profile={profileNoLocation} />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('has an accessible card role (article)', () => {
    render(<TherapistCard profile={mockProfile} />);
    expect(screen.getByRole('article')).toBeInTheDocument();
  });
});
