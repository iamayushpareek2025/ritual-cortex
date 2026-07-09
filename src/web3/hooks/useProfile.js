/**
 * useProfile — single source of truth for the connected wallet's on-chain profile.
 *
 * Decodes BrainRegistry.getProfile() using NAMED struct fields only.
 * Converts every uint256 BigInt to a plain JS number before returning.
 * Never returns NaN — all numeric fields fall back to 0 (or 1 for level).
 *
 * Returns:
 *   profile  — decoded profile object (or null when no profile exists)
 *   hasProfile — boolean
 *   isLoading — boolean
 *   refetch   — call this after any successful write transaction
 */

import { useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES, BRAIN_REGISTRY_ABI } from '../contracts';

/** Safely convert a BigInt (or anything) to a plain JS number, never NaN. */
function safeNum(value, fallback = 0) {
  if (value === undefined || value === null) return fallback;
  try {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Parse the raw Viem tuple into a clean JS object.
 * Viem returns a plain object with the exact field names from the ABI —
 * do NOT use numeric indices (profile[0], profile[1], …).
 */
function parseProfile(raw) {
  if (!raw || !raw.exists) return null;

  return {
    // String fields — returned as plain JS strings by Viem
    username:      raw.username      ?? '',
    walletAddress: raw.walletAddress ?? '',
    metadataURI:   raw.metadataURI   ?? '',

    // Boolean
    exists: raw.exists === true,

    // uint256 BigInt fields — convert with safeNum
    // Using ?? not || so that 0n is preserved (not treated as falsy)
    joinTimestamp: safeNum(raw.joinTimestamp ?? 0n, 0),
    xp:            safeNum(raw.xp            ?? 0n, 0),
    level:         safeNum(raw.level         ?? 1n, 1),
    brainScore:    safeNum(raw.brainScore     ?? 0n, 0),
  };
}

export function useProfile(address) {
  const { data, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.registry,
    abi: BRAIN_REGISTRY_ABI,
    functionName: 'getProfile',
    args: [address],
    query: {
      // Only fetch when we have an address; suppress the ProfileDoesNotExist
      // revert by catching it gracefully (Wagmi returns undefined on revert).
      enabled: !!address,
      retry: false,
    },
  });

  const profile = parseProfile(data);
  const hasProfile = profile !== null;

  return { profile, hasProfile, isLoading, refetch };
}
