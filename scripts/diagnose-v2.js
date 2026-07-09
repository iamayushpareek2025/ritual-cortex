/**
 * diagnose-v2.js — Diagnose why createProfile reverts on BrainRegistryV2
 */
import hre from "hardhat";

const V2_ADDRESS  = "0xc71daFEfeE08AF74594b56c70CcB363260d08798";
const PASS_ADDRESS = "0x40a95EFFED8Cd266EfA8Aa1279bD02Dc36C31d0d";
const BADGE_ADDRESS = "0x9B421B22231C49e3dbc5Cde2FEdDF6cd4C617e2b";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const v2   = await hre.ethers.getContractAt("BrainRegistryV2", V2_ADDRESS);
  const pass = await hre.ethers.getContractAt("BrainPassNFT", PASS_ADDRESS);

  console.log("\n--- V2 internal state ---");
  console.log("brainPassNFTAddress:", await v2.brainPassNFTAddress());
  console.log("xpBadgeAddress:     ", await v2.xpBadgeAddress());
  console.log("owner:              ", await v2.owner());

  console.log("\n--- BrainPassNFT state ---");
  // Check what the NFT contract's registry address is set to
  try {
    const registryInPass = await pass.registryAddress();
    console.log("NFT registryAddress:", registryInPass);
    console.log("V2 address:         ", V2_ADDRESS);
    console.log("Registry matches V2:", registryInPass.toLowerCase() === V2_ADDRESS.toLowerCase());
  } catch(e) {
    console.log("Could not read registryAddress from NFT:", e.message);
    // Try alternative getter names
    try { console.log("brainRegistry:", await pass.brainRegistry()); } catch {}
    try { console.log("registry:", await pass.registry()); } catch {}
    try { console.log("minterAddress:", await pass.minterAddress()); } catch {}
  }

  console.log("\n--- Check deployer profile on V2 ---");
  try {
    const p = await v2.getProfile(deployer.address);
    console.log("Profile exists:", p.exists, "username:", p.username);
  } catch(e) {
    console.log("No profile (ProfileDoesNotExist):", e.message.slice(0,60));
  }

  console.log("\n--- Simulate createProfile staticCall ---");
  try {
    await v2.createProfile.staticCall("TestUser", "https://test.json");
    console.log("staticCall succeeded — tx should work");
  } catch(e) {
    console.log("staticCall reverted:", e.message);
    // Check custom error
    if (e.data) console.log("revert data:", e.data);
  }
}

main().catch(console.error);
