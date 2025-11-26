import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { Providers } from './providers';

// Font optimization: Use display swap for better LCP
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap', // Prevents FOIT (Flash of Invisible Text)
  preload: true,
});

export const metadata: Metadata = {
  title: 'Paimon Yield Protocol',
  description: 'RWA Yield Aggregator on BSC - ERC4626 Tokenized Vault for Real World Assets',
  keywords: ['RWA', 'DeFi', 'BSC', 'Yield', 'Vault', 'ERC4626'],
  authors: [{ name: 'Paimon Finance' }],
  // Preconnect to external resources for faster loading
  other: {
    'link': [
      { rel: 'preconnect', href: 'https://bsc-dataseed.binance.org' },
      { rel: 'dns-prefetch', href: 'https://bscscan.com' },
    ],
  },
};

// Viewport optimization: Prevent layout shifts from zoom
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0ea5e9',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get cookies for SSR wallet state hydration
  const headersList = await headers();
  const cookies = headersList.get('cookie');

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preload critical resources for LCP optimization */}
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://bsc-dataseed.binance.org"
        />
        <link
          rel="dns-prefetch"
          href="https://bscscan.com"
        />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <Providers cookies={cookies}>{children}</Providers>
        {/* Vercel Analytics - Core Web Vitals monitoring */}
        <Analytics />
        {/* Vercel Speed Insights - Performance monitoring */}
        <SpeedInsights />
      </body>
    </html>
  );
}
