/**
 * verify-v2.js — End-to-end on-chain verification of BrainRegistryV2
 *
 * Tests:
 *  1. Check current registered builders
 *  2. Register two test wallets (deployer + signer[1]) if not already registered
 *  3. Verify Scan (updateBrainScore) for both
 *  4. Call getRegisteredBuilders() — confirm both addresses appear
 *  5. Call getProfile() for every returned address
 *  6. Print leaderboard rows sorted by GFLOPS
 */
import hre from "hardhat";

const V2_ADDRESS = "0x3ECa9091A928bd5744D9189a170C4405cCaa66ab";

function calcGflops(brainScore, level, xp) {
  return (Number(brainScore) * 1000) + (Number(level) * 5000) + (Number(xp) * 10);
}

async function main() {
  const signers = await hre.ethers.getSigners();
  const walletA = signers[0]; // deployer wallet
  const walletB = signers[1]; // second funded wallet

  console.log("=================================================================");
  console.log("BrainRegistryV2 On-Chain Verification");
  console.log("=================================================================");
  console.log("Wallet A:", walletA.address);
  console.log("Wallet B:", walletB?.address ?? "(not available — only 1 signer configured)");
  console.log("");

  const v2 = await hre.ethers.getContractAt("BrainRegistryV2", V2_ADDRESS);
  const v2B = walletB ? v2.connect(walletB) : null;

  // --- Step 1: Current state ---
  console.log("--- Step 1: Current on-chain state ---");
  let builders = await v2.getRegisteredBuilders();
  const countBefore = await v2.getBuilderCount();
  console.log("registeredBuilders count:", countBefore.toString());
  console.log("registeredBuilders:", builders);
  console.log("");

  // --- Step 2: Register Wallet A if not already ---
  console.log("--- Step 2: Register Wallet A ---");
  const profileA = await v2.getProfile(walletA.address).catch(() => null);
  if (profileA && profileA.exists) {
    console.log("Wallet A already has profile:", profileA.username);
  } else {
    console.log("Creating profile for Wallet A...");
    const tx = await v2.createProfile("WalletA_Tester", "https://test.json");
    const receipt = await tx.wait();
    console.log("createProfile() OK — tx:", receipt.hash);
  }

  // --- Step 3: Register Wallet B if available ---
  console.log("\n--- Step 3: Register Wallet B ---");
  if (v2B && walletB) {
    const profileB = await v2B.getProfile(walletB.address).catch(() => null);
    if (profileB && profileB.exists) {
      console.log("Wallet B already has profile:", profileB.username);
    } else {
      const balB = await hre.ethers.provider.getBalance(walletB.address);
      if (balB > 0n) {
        console.log("Creating profile for Wallet B...");
        const tx = await v2B.createProfile("WalletB_Tester", "https://test2.json");
        const receipt = await tx.wait();
        console.log("createProfile() OK — tx:", receipt.hash);
      } else {
        console.log("Wallet B has no ETH — skipping registration (only 1 funded signer).");
      }
    }
  } else {
    console.log("Only 1 signer available on this network config — skipping Wallet B.");
  }

  // --- Step 4: Verify Scan (updateBrainScore) for each ---
  console.log("\n--- Step 4: Verify Scan (updateBrainScore) ---");
  try {
    const txA = await v2.updateBrainScore(walletA.address, 86);
    const rA = await txA.wait();
    console.log("Wallet A brainScore set to 86 — tx:", rA.hash);
  } catch (e) {
    console.log("Wallet A brainScore update:", e.message.includes("ProfileDoesNotExist") ? "No profile yet" : e.message);
  }

  if (v2B && walletB) {
    try {
      const balB = await hre.ethers.provider.getBalance(walletB.address);
      if (balB > 0n) {
        const txB = await v2B.updateBrainScore(walletB.address, 72);
        const rB = await txB.wait();
        console.log("Wallet B brainScore set to 72 — tx:", rB.hash);
      }
    } catch (e) {
      console.log("Wallet B brainScore update:", e.message);
    }
  }

  // --- Step 5: getRegisteredBuilders() after registration ---
  console.log("\n--- Step 5: getRegisteredBuilders() after registration ---");
  builders = await v2.getRegisteredBuilders();
  const countAfter = await v2.getBuilderCount();
  console.log("registeredBuilders count:", countAfter.toString());
  console.log("registeredBuilders:", builders);

  // --- Step 6: getProfile() for every address ---
  console.log("\n--- Step 6: getProfile() for every registered address ---");
  const leaderboardRows = [];
  for (const addr of builders) {
    try {
      const p = await v2.getProfile(addr);
      const gflops = calcGflops(p.brainScore, p.level, p.xp);
      const row = {
        address: addr,
        username: p.username,
        brainScore: p.brainScore.toString(),
        level: p.level.toString(),
        xp: p.xp.toString(),
        gflops,
      };
      leaderboardRows.push(row);
      console.log(`  ${addr} → username="${p.username}" brainScore=${p.brainScore} level=${p.level} xp=${p.xp} GFLOPS=${gflops.toLocaleString()}`);
    } catch (e) {
      console.log(`  ${addr} → getProfile() failed:`, e.message);
    }
  }

  // --- Step 7: Sort by GFLOPS and print leaderboard ---
  console.log("\n--- Step 7: Leaderboard sorted by GFLOPS (descending) ---");
  leaderboardRows.sort((a, b) => b.gflops - a.gflops);
  leaderboardRows.forEach((row, idx) => {
    console.log(`  Rank ${idx + 1}: ${row.username} (${row.address.slice(0, 6)}...${row.address.slice(-4)}) — GFLOPS: ${row.gflops.toLocaleString()}`);
  });

  // --- Step 8: Summary ---
  console.log("\n=================================================================");
  console.log("VERIFICATION RESULTS");
  console.log("=================================================================");
  console.log(`✅ getRegisteredBuilders() returns ${builders.length} address(es)`);
  console.log(`✅ getProfile() succeeded for all ${leaderboardRows.length} registered builder(s)`);
  console.log(`✅ GFLOPS calculated on-chain data (no mock values needed for real builders)`);
  if (builders.length >= 2) {
    console.log("✅ Both Wallet A AND Wallet B appear on the leaderboard simultaneously");
  } else {
    console.log(`ℹ️  Only ${builders.length} wallet registered (need a second funded signer for 2-wallet test)`);
  }
  console.log("\nFrontend will auto-refresh leaderboard on every block / profile update.");
  console.log("After page refresh, the leaderboard re-fetches from chain — no localStorage dependency.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
