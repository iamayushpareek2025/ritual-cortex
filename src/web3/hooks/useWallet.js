import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { formatUnits } from 'viem';

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
    console.log('[useWallet] value:', balanceData?.value?.toString());
    console.log('[useWallet] decimals:', balanceData?.decimals);
  }

  // Guard against NaN by formatting the raw bigint balance value manually.
  // This ensures custom chain tokens (like RITUAL) format correctly even if Wagmi's formatted field is empty.
  const formattedBalance = (() => {
    if (!balanceData) return null;
    const value = balanceData.value;
    const decimals = balanceData.decimals ?? 18;
    const symbol = balanceData.symbol || 'RITUAL';

    if (value === undefined || value === null) return null;

    try {
      // Convert raw bigint value to decimal string (e.g., 1000000000000000000n -> "1")
      const formattedStr = formatUnits(value, decimals);
      const num = parseFloat(formattedStr);
      if (isNaN(num)) return null;
      const result = `${num.toFixed(4)} ${symbol}`;
      console.log('[useWallet] manually formatted balance:', result);
      return result;
    } catch (e) {
      console.error('[useWallet] manually formatting failed:', e);
      return null;
    }
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
