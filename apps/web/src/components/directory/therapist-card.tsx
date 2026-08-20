import Link from 'next/link';

export interface TherapistProfileSummary {
  id: string;
  name: string;
  bio: string | null;
  specializations: readonly string[];
  languages: readonly string[];
  city: string | null;
  province: string | null;
}

interface TherapistCardProps {
  profile: TherapistProfileSummary;
}

/**
 * Card showing an approved therapist's summary in the public directory.
 * Uses role="article" so screen readers announce each card as a distinct item.
 */
export function TherapistCard({ profile }: TherapistCardProps): React.JSX.Element {
  const location = [profile.city, profile.province].filter(Boolean).join(', ');

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition-shadow hover:shadow-md">
      {/* Name */}
      <h3 className="text-lg font-semibold text-[var(--color-foreground)]">{profile.name}</h3>

      {/* Location */}
      {location && <p className="text-sm text-[var(--color-muted)]">{location}</p>}

      {/* Bio */}
      {profile.bio && (
        <p className="line-clamp-2 text-sm text-[var(--color-foreground)]">{profile.bio}</p>
      )}

      {/* Specializations */}
      {profile.specializations.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Specializations">
          {profile.specializations.map((spec) => (
            <span
              key={spec}
              className="rounded-full bg-[var(--color-accent)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)]"
            >
              {spec}
            </span>
          ))}
        </div>
      )}

      {/* Languages */}
      {profile.languages.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Languages">
          {profile.languages.map((lang) => (
            <span
              key={lang}
              className="rounded-full bg-[var(--color-border)] px-2.5 py-0.5 text-xs text-[var(--color-foreground)]"
            >
              {lang}
            </span>
          ))}
        </div>
      )}

      {/* CTA */}
      <Link
        href={`/directory/${profile.id}`}
        className="mt-auto inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-medium text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)]"
      >
        View Profile
      </Link>
    </article>
  );
}
