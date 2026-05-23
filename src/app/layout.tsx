import type { Metadata } from 'next';
import { DM_Sans, Playfair_Display, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Navigation } from '@/components/ui/Navigation';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500', '600'],
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '500', '600', '700'],
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'Prowider — Lead Distribution System',
  description: 'Enterprise lead generation and distribution platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${dmSans.variable} ${playfair.variable} ${jetbrains.variable} font-body bg-navy-950 text-white antialiased min-h-screen`}
      >
        <div className="noise-overlay" />
        <Navigation />
        <main className="pt-16">{children}</main>
      </body>
    </html>
  );
}
