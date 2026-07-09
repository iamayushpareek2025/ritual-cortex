import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';

export function useWallet() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  
  // Fetches the native token balance of the connected address
  const { data: balanceData, isLoading: isBalanceLoading, refetch: refetchBalance } = useBalance({
    address,
  });

  // DEBUG: log raw balance object so we can inspect what Wagmi returns
  if (address && balanceData !== undefined) {
    console.log('[useWallet] address:', address);
    console.log('[useWallet] raw balance object:', balanceData);
    console.log('[useWallet] formatted field:', balanceData?.formatted);
  }

  // Guard against NaN:
  // On custom chains like Ritual Testnet, Wagmi may return balanceData with
  // balanceData.formatted === undefined. parseFloat(undefined) = NaN, which
  // propagates to the UI as "NaN RITUAL".
  // Fix: use balanceData.formatted only when it is a valid non-empty string.
  const formattedBalance = (() => {
    if (!balanceData) return null;                         // still loading
    const raw = balanceData.formatted;
    if (raw === undefined || raw === null || raw === '') return null;  // no data yet
    const num = parseFloat(raw);
    if (isNaN(num)) return null;                          // Wagmi returned garbage
    const symbol = balanceData.symbol || 'RITUAL';
    const result = `${num.toFixed(4)} ${symbol}`;
    console.log('[useWallet] formatted balance:', result);
    return result;
  })();


  const connect = async (providerId) => {
    let connector;
    if (providerId === 'metamask') {
      // Find MetaMask connector, fall back to injected
      connector = connectors.find(c => c.id === 'metaMaskSDK' || c.id === 'metaMask' || c.id === 'injected');
    } else if (providerId === 'coinbase') {
      // Find Coinbase connector
      connector = connectors.find(c => c.id === 'coinbaseWalletSDK' || c.id === 'coinbaseWallet');
    } else if (providerId === 'walletconnect') {
      // Find WalletConnect connector or default injected fallback
      connector = connectors.find(c => c.id === 'walletConnect' || c.id === 'walletConnectSDK' || c.id === 'injected');
    } else {
      connector = connectors.find(c => c.id === providerId) || connectors[0];
    }

    if (!connector) {
      // Default fallback to first available connector
      connector = connectors[0];
    }

    if (connector) {
      return await connectAsync({ connector });
    }
    throw new Error('No connector found');
  };

  return {
    address,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    balance: formattedBalance,      // null = loading/unavailable, string = ready
    isBalanceLoading,
    connectors,
    refetchBalance,
  };
}
