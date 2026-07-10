import React from 'react';
import { http, createConfig, WagmiProvider } from 'wagmi';
import { ritualTestnet } from './chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30s — reduces hammering the RPC when many users are active
    },
  },
});

// Ritual Brain WalletConnect project ID (replace with your own from https://cloud.walletconnect.com)
// Without this, WalletConnect silently falls back to MetaMask and confuses mobile users.
const WC_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

export const config = createConfig({
  chains: [ritualTestnet],
  connectors: [
    injected({ target: 'metaMask' }),
    coinbaseWallet({ appName: 'Ritual Brain' }),
    // OKX Wallet injects itself as window.okxwallet
    injected({
      target: {
        id: 'okxWallet',
        name: 'OKX Wallet',
        provider: () =>
          typeof window !== 'undefined' ? window.okxwallet : undefined,
      },
    }),
    ...(WC_PROJECT_ID
      ? [walletConnect({ projectId: WC_PROJECT_ID })]
      : []),
    // NOTE: Do NOT add a second bare injected() here — it shares the same
    // window.ethereum object as the MetaMask connector and causes connector
    // resolution conflicts that surface as false "extension locked" errors.
  ],
  transports: {
    [ritualTestnet.id]: http('https://rpc.ritualfoundation.org'),
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
