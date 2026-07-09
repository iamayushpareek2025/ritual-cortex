/**
 * deploy-v2.js — Deploy BrainRegistryV2 only.
 *
 * BrainRegistryV2 adds:
 *   - address[] public registeredBuilders
 *   - getRegisteredBuilders() public view
 *   - createProfile() pushes msg.sender into the array
 *
 * The existing XPBadge and BrainPassNFT contracts are REUSED.
 * The old BrainRegistry V1 (0x9693952eBd35616Cc9B325e9E68CBA1f889e56bf) is
 * NOT modified or touched.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-v2.js --network ritualTestnet
 */
import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Existing deployed addresses — read from the current config
const EXISTING = {
  pass:  "0x40a95EFFED8Cd266EfA8Aa1279bD02Dc36C31d0d",
  badge: "0x9B421B22231C49e3dbc5Cde2FEdDF6cd4C617e2b",
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("=================================================================");
  console.log("Deploying BrainRegistryV2 on Ritual Testnet...");
  console.log("Deployer:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("Reusing BrainPassNFT:", EXISTING.pass);
  console.log("Reusing XPBadge:     ", EXISTING.badge);
  console.log("=================================================================\n");

  // 1. Deploy BrainRegistryV2
  console.log("[1/4] Deploying BrainRegistryV2...");
  const V2Factory = await hre.ethers.getContractFactory("BrainRegistryV2");
  const v2 = await V2Factory.deploy();
  await v2.waitForDeployment();
  const v2Address = await v2.getAddress();
  console.log("BrainRegistryV2 deployed to:", v2Address);

  // 2. Link BrainPassNFT and XPBadge inside V2
  console.log("\n[2/4] Linking contracts inside BrainRegistryV2...");
  const linkTx = await v2.linkContracts(EXISTING.pass, EXISTING.badge);
  await linkTx.wait();
  console.log("linkContracts() OK");

  // 3. Set V2 as the authorized registry inside BrainPassNFT
  console.log("\n[3/4] Setting BrainRegistryV2 inside BrainPassNFT...");
  const passContract = await hre.ethers.getContractAt("BrainPassNFT", EXISTING.pass);
  const setRegTx = await passContract.setRegistryAddress(v2Address);
  await setRegTx.wait();
  console.log("setRegistryAddress() OK");

  // 4. Authorize V2 inside XPBadge
  console.log("\n[4/4] Authorizing BrainRegistryV2 inside XPBadge...");
  const badgeContract = await hre.ethers.getContractAt("XPBadge", EXISTING.badge);
  const authTx = await badgeContract.setAuthorizedContract(v2Address, true);
  await authTx.wait();
  console.log("setAuthorizedContract() OK");

  console.log("\n=================================================================");
  console.log("BrainRegistryV2 fully deployed and wired:");
  console.log("  V2 Registry:  ", v2Address);
  console.log("  BrainPassNFT: ", EXISTING.pass);
  console.log("  XPBadge:      ", EXISTING.badge);
  console.log("=================================================================\n");

  // --- Update contracts-config.json ---
  const configPath = path.join(__dirname, "../src/web3/contracts-config.json");
  const config = {
    chainId: 1979,
    networkName: "ritualTestnet",
    registryAddress: v2Address,
    passAddress: EXISTING.pass,
    badgeAddress: EXISTING.badge,
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("Frontend config updated:", configPath);

  // --- Verify V2 state ---
  console.log("\n--- Verifying V2 state ---");
  const linkedPass  = await v2.brainPassNFTAddress();
  const linkedBadge = await v2.xpBadgeAddress();
  const count       = await v2.getBuilderCount();
  console.log("brainPassNFTAddress:", linkedPass);
  console.log("xpBadgeAddress:     ", linkedBadge);
  console.log("registeredBuilders count:", count.toString());

  console.log("\n Deployment complete. Update the frontend and re-create your profile on V2.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
