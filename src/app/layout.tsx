import type { Metadata } from 'next';
import { Fraunces, Nunito } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin', 'latin-ext'], variable: '--font-fraunces', axes: ['SOFT', 'opsz'] });
const nunito = Nunito({ subsets: ['latin', 'latin-ext'], variable: '--font-nunito' });

export const metadata: Metadata = {
  title: { default: 'kozmikarkan', template: '%s · kozmikarkan' },
  description: 'Günlük burç ve tarot içerik stüdyosu',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${fraunces.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        {children}
        <Toaster theme="light" position="top-center" richColors />
      </body>
    </html>
  );
}
