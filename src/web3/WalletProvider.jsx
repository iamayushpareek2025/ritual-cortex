import React from 'react';
import { http, createConfig, WagmiProvider } from 'wagmi';
import { ritualTestnet } from './chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected, coinbaseWallet } from 'wagmi/connectors';

const queryClient = new QueryClient();

export const config = createConfig({
  chains: [ritualTestnet],
  connectors: [
    injected({ target: 'metaMask' }),
    coinbaseWallet({ appName: 'Ritual Brain' }),
    injected() // fallback for other browser wallet extensions
  ],
  transports: {
    [ritualTestnet.id]: http(),
  },
});

export function WalletProvider({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
