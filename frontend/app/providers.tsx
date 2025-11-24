'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, type Config } from 'wagmi';
import { createAppKit } from '@reown/appkit/react';
import { wagmiAdapter, projectId, networks, metadata } from '@/lib/wagmi/config';
import { type ReactNode, useState, useEffect } from 'react';
import { cookieToInitialState } from 'wagmi';

// Create AppKit modal instance (singleton)
let appKitInitialized = false;

function initAppKit() {
  if (appKitInitialized || typeof window === 'undefined') return;

  createAppKit({
    adapters: [wagmiAdapter],
    networks: [...networks],
    projectId,
    metadata,
    features: {
      analytics: true,
      email: true, // Enable email login
      socials: ['google', 'x', 'discord', 'github'], // Social logins
    },
    themeMode: 'light',
    themeVariables: {
      '--w3m-accent': '#0ea5e9', // Sky blue accent color
      '--w3m-border-radius-master': '8px',
    },
  });

  appKitInitialized = true;
}

interface ProvidersProps {
  children: ReactNode;
  cookies?: string | null;
}

export function Providers({ children, cookies }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Initialize AppKit on client side
  useEffect(() => {
    initAppKit();
  }, []);

  // Get initial state from cookies for SSR
  const initialState = cookies
    ? cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies)
    : undefined;

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
