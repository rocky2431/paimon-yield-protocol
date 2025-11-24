import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

export const metadata: Metadata = {
  title: 'Paimon Yield Protocol',
  description: 'RWA Yield Aggregator on BSC - ERC4626 Tokenized Vault for Real World Assets',
  keywords: ['RWA', 'DeFi', 'BSC', 'Yield', 'Vault', 'ERC4626'],
  authors: [{ name: 'Paimon Finance' }],
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
      <body className={`${inter.variable} antialiased`}>
        <Providers cookies={cookies}>{children}</Providers>
      </body>
    </html>
  );
}
