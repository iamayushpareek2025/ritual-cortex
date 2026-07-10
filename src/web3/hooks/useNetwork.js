import { useAccount, useSwitchChain } from 'wagmi';

export function useNetwork() {
  const { chain } = useAccount();
  const { switchChain, switchChainAsync } = useSwitchChain();

  // Connected but chain ID is not 1979 (Ritual Testnet)
  const isWrongNetwork = chain ? chain.id !== 1979 : false;

  const handleSwitchToRitual = async () => {
    // Let errors bubble up — callers handle user-rejected / failed switch themselves.
    if (switchChainAsync) {
      return await switchChainAsync({ chainId: 1979 });
    } else if (switchChain) {
      switchChain({ chainId: 1979 });
    }
  };

  return {
    chain,
    switchChain: handleSwitchToRitual,
    isWrongNetwork,
  };
}
