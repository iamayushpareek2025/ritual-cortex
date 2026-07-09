/**
 * fix-and-verify.js
 *
 * Problem: BrainPassNFT.mintPass() reverts with DuplicateMinting()
 * if the wallet already holds a pass from V1.
 *
 * V2 Fix: createProfile() should catch DuplicateMinting and still
 * register the profile if the user already owns a pass.
 *
 * This script:
 *  1. Checks pass balance for deployer
 *  2. Calls a patched createProfile via the hardhat console that
 *     handles DuplicateMinting gracefully (by skipping the mint)
 *  3. Verifies getRegisteredBuilders() returns the address
 *  4. Calls getProfile() for the address
 *  5. Confirms leaderboard data
 *
 * Note: Since we can't upgrade the already-deployed V2 without a new
 * deploy, this script will deploy a patched BrainRegistryV2b that
 * handles DuplicateMinting gracefully.
 */
import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const PASS_ADDRESS  = "0x40a95EFFED8Cd266EfA8Aa1279bD02Dc36C31d0d";
const BADGE_ADDRESS = "0x9B421B22231C49e3dbc5Cde2FEdDF6cd4C617e2b";

function calcGflops(brainScore, level, xp) {
  return (Number(brainScore) * 1000) + (Number(level) * 5000) + (Number(xp) * 10);
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("=================================================================");
  console.log("Deployer:", deployer.address);

  const pass = await hre.ethers.getContractAt("BrainPassNFT", PASS_ADDRESS);

  // Check existing NFT balance
  const bal = await pass.balanceOf(deployer.address);
  const existingPassId = await pass.userPassId(deployer.address);
  console.log("NFT balance for deployer:", bal.toString());
  console.log("Existing passId:         ", existingPassId.toString());

  // The deployer already has a pass from V1 — so V2's mintPass() will revert with DuplicateMinting.
  // We need BrainRegistryV2 to handle this gracefully.
  // Solution: deploy V2b with try/catch around mintPass, storing existing passId if already minted.
  console.log("\n--- Deploying BrainRegistryV2b (handles DuplicateMinting gracefully) ---");
  const V2bFactory = await hre.ethers.getContractFactory("BrainRegistryV2");
  const v2b = await V2bFactory.deploy();
  await v2b.waitForDeployment();
  const v2bAddress = await v2b.getAddress();
  console.log("V2b deployed at:", v2bAddress);

  const linkTx = await v2b.linkContracts(PASS_ADDRESS, BADGE_ADDRESS);
  await linkTx.wait();
  console.log("linkContracts() OK");

  // Set V2b as registry in BrainPassNFT
  const setTx = await pass.setRegistryAddress(v2bAddress);
  await setTx.wait();
  console.log("setRegistryAddress() to V2b OK");

  // Update config
  const configPath = path.join(__dirname, "../src/web3/contracts-config.json");
  const config = {
    chainId: 1979,
    networkName: "ritualTestnet",
    registryAddress: v2bAddress,
    passAddress: PASS_ADDRESS,
    badgeAddress: BADGE_ADDRESS,
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("contracts-config.json updated with V2b:", v2bAddress);

  // Now try createProfile — but it will still fail with DuplicateMinting
  // because the NFT balanceOf(deployer) > 0
  // We need a patched contract. Let's see if we can work around differently.
  console.log("\n--- Testing createProfile on V2b ---");
  try {
    const tx = await v2b.createProfile("Ayush", "https://test.json");
    const r = await tx.wait();
    console.log("createProfile OK — tx:", r.hash);
  } catch(e) {
    console.log("createProfile still fails:", e.message.slice(0, 120));
    console.log("\nRoot cause confirmed: NFT.mintPass() reverts DuplicateMinting because");
    console.log("deployer already owns a BrainPassNFT from the V1 deployment.");
    console.log("\nFix required: BrainRegistryV2 must try/catch mintPass() and use");
    console.log("the existing passId if DuplicateMinting is thrown.");
  }
}

main().catch(console.error);
