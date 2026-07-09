import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("===============================================================");
  console.log("Starting production deployment on target network...");
  console.log("Deployer account address:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer account balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("===============================================================");

  // 1. Deploy XPBadge
  console.log("\n[1/3] Deploying XPBadge...");
  const XPBadgeFactory = await hre.ethers.getContractFactory("XPBadge");
  const xpBadge = await XPBadgeFactory.deploy("https://api.ritualbrain.net/badges/{id}.json");
  await xpBadge.waitForDeployment();
  const xpBadgeAddress = await xpBadge.getAddress();
  console.log("XPBadge deployed to:", xpBadgeAddress);

  // 2. Deploy BrainPassNFT
  // Using deployer's address as the initial placeholder registry address to bypass constructor checks
  console.log("\n[2/3] Deploying BrainPassNFT with placeholder registry address...");
  const BrainPassNFTFactory = await hre.ethers.getContractFactory("BrainPassNFT");
  const brainPassNFT = await BrainPassNFTFactory.deploy(deployer.address);
  await brainPassNFT.waitForDeployment();
  const brainPassNFTAddress = await brainPassNFT.getAddress();
  console.log("BrainPassNFT deployed to:", brainPassNFTAddress);

  // 3. Deploy BrainRegistry
  console.log("\n[3/3] Deploying BrainRegistry...");
  const BrainRegistryFactory = await hre.ethers.getContractFactory("BrainRegistry");
  const brainRegistry = await BrainRegistryFactory.deploy();
  await brainRegistry.waitForDeployment();
  const brainRegistryAddress = await brainRegistry.getAddress();
  console.log("BrainRegistry deployed to:", brainRegistryAddress);

  // 4. Set real registry address inside BrainPassNFT
  console.log("\n[Config] Setting BrainRegistry address inside BrainPassNFT...");
  const setRegistryTx = await brainPassNFT.setRegistryAddress(brainRegistryAddress);
  await setRegistryTx.wait();
  console.log("Registry address set successfully!");

  // 5. Link contracts inside BrainRegistry
  console.log("[Config] Linking pass and badge inside BrainRegistry...");
  const linkContractsTx = await brainRegistry.linkContracts(brainPassNFTAddress, xpBadgeAddress);
  await linkContractsTx.wait();
  console.log("Contracts linked successfully in registry!");

  // 6. Authorize BrainRegistry inside XPBadge
  console.log("[Config] Whitelisting BrainRegistry inside XPBadge...");
  const authorizeTx = await xpBadge.setAuthorizedContract(brainRegistryAddress, true);
  await authorizeTx.wait();
  console.log("BrainRegistry authorized in XPBadge!");

  // 7. Verify all contract linkages after deployment by reading state
  console.log("\n[Verification] Verifying contract state linkages on-chain...");
  const linkedRegistry = await brainPassNFT.registryAddress();
  const linkedPass = await brainRegistry.brainPassNFTAddress();
  const linkedBadge = await brainRegistry.xpBadgeAddress();
  const isRegistryAuthorized = await xpBadge.authorizedMintingContracts(brainRegistryAddress);

  console.log("Verification checks:");
  console.log(" - BrainPassNFT -> registryAddress match:", linkedRegistry === brainRegistryAddress ? "PASS ✅" : "FAIL ❌");
  console.log(" - BrainRegistry -> brainPassNFTAddress match:", linkedPass === brainPassNFTAddress ? "PASS ✅" : "FAIL ❌");
  console.log(" - BrainRegistry -> xpBadgeAddress match:", linkedBadge === xpBadgeAddress ? "PASS ✅" : "FAIL ❌");
  console.log(" - XPBadge -> registry authorization verified:", isRegistryAuthorized ? "PASS ✅" : "FAIL ❌");

  if (
    linkedRegistry !== brainRegistryAddress ||
    linkedPass !== brainPassNFTAddress ||
    linkedBadge !== xpBadgeAddress ||
    !isRegistryAuthorized
  ) {
    throw new Error("Link verification failed! Linkages are incorrect.");
  }
  console.log("All contract linkages verified successfully! On-chain state is solid.");

  // 8. Write address configuration file for the React frontend
  const configPath = path.join(__dirname, "../src/web3/contracts-config.json");
  const configData = {
    chainId: 1979,
    networkName: "ritualTestnet",
    registryAddress: brainRegistryAddress,
    passAddress: brainPassNFTAddress,
    badgeAddress: xpBadgeAddress,
  };
  
  // Ensure target folder exists
  const targetDir = path.dirname(configPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
  console.log("\n[Config] Frontend configuration file written to:", configPath);

  console.log("\n===============================================================");
  console.log("Deployment completed successfully! 🎉");
  console.log("Deployed addresses summary:");
  console.log(JSON.stringify(configData, null, 2));
  console.log("===============================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nDeployment failed! ❌");
    console.error(error);
    process.exit(1);
  });
