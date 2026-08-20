import Image from 'next/image';
import Link from 'next/link';

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Therapist selects a worksheet',
    body: 'Your therapist chooses from a library of clinically designed assessments and worksheets tailored to your treatment plan.',
  },
  {
    step: '02',
    title: 'Sent directly to your dashboard',
    body: 'The worksheet appears in your client dashboard instantly. Complete it at your own pace, from anywhere.',
  },
  {
    step: '03',
    title: 'Therapist reviews your responses',
    body: 'Your therapist sees your completed worksheet in real time, using your responses to guide your next session.',
  },
];

export default function Page(): React.JSX.Element {
  return (
    <>
      {/* Hero */}
      <section className="flex min-h-[calc(50vh)] flex-col items-center justify-center gap-8 p-8 text-center">
        <Image
          src="/logo.png"
          alt="TheraPulse"
          width={720}
          height={208}
          className="w-full max-w-[480px] h-auto logo-tint"
          priority
        />
        <div className="flex gap-4">
          <Link
            href="/directory"
            className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 font-medium text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)]"
          >
            Find a Therapist
          </Link>
          <Link
            href="/auth/register"
            className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 font-medium hover:bg-[var(--color-accent)]"
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 pb-20 pt-4">
        <h2 className="mb-10 text-center text-2xl font-bold text-[var(--color-primary)]">
          How Worksheets Work
        </h2>
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
          {HOW_IT_WORKS.map(({ step, title, body }) => (
            <div
              key={step}
              className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
            >
              <span
                className="mb-3 text-3xl font-extrabold"
                style={{ color: 'var(--color-harvest-gold)' }}
                aria-hidden="true"
              >
                {step}
              </span>
              <h3 className="mb-2 text-base font-semibold text-[var(--color-primary)]">{title}</h3>
              <p className="text-sm leading-relaxed text-[var(--color-foreground)]/80">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
