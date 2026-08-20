import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/auth-context';
import { Navbar } from '@/components/nav/navbar';

export const metadata: Metadata = {
  title: {
    default: 'TheraPulse',
    template: '%s | TheraPulse',
  },
  description: 'Digitizing therapy workflows for Zimbabwean therapists and clients',
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navbar />
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
