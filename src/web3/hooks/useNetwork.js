import { useAccount, useSwitchChain } from 'wagmi';

export function useNetwork() {
  const { chain } = useAccount();
  const { switchChain, switchChainAsync, chains } = useSwitchChain();

  // Connected but chain ID is not 1979 (Ritual Testnet)
  const isWrongNetwork = chain ? chain.id !== 1979 : false;

  const handleSwitchToRitual = async () => {
    if (switchChainAsync) {
      try {
        await switchChainAsync({ chainId: 1979 });
      } catch (err) {
        console.error('Failed to switch chain to Ritual Testnet:', err);
      }
    } else if (switchChain) {
      switchChain({ chainId: 1979 });
    }
  };

  return {
    chain,
    chains,
    switchChain: handleSwitchToRitual,
    rawSwitchChain: switchChain,
    isWrongNetwork,
  };
}
