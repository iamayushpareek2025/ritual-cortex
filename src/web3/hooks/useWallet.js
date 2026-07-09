import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';

export function useWallet() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  
  // Fetches the native token balance of the connected address
  const { data: balanceData, refetch: refetchBalance } = useBalance({
    address,
  });

  const formattedBalance = balanceData
    ? `${parseFloat(balanceData.formatted).toFixed(4)} ${balanceData.symbol}`
    : '0.0000 RITUAL';

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
    balance: formattedBalance,
    connectors,
    refetchBalance,
  };
}
