import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("RitualBrainModule", (m) => {
  // 1. Deploy XPBadge (ERC1155 achievements)
  const baseURI = m.getParameter("xpBadgeURI", "https://api.ritualbrain.net/badges/{id}.json");
  const xpBadge = m.contract("XPBadge", [baseURI]);

  // 2. Deploy BrainRegistry (Primary state database)
  const brainRegistry = m.contract("BrainRegistry");

  // 3. Deploy BrainPassNFT (ERC721 credentials pass) linking to BrainRegistry
  const brainPassNFT = m.contract("BrainPassNFT", [brainRegistry]);

  // 4. Link contracts in BrainRegistry
  // Calls linkContracts(brainPassNFT, xpBadge)
  m.call(brainRegistry, "linkContracts", [brainPassNFT, xpBadge]);

  // 5. Authorize BrainRegistry inside XPBadge
  // Calls setAuthorizedContract(brainRegistry, true)
  m.call(xpBadge, "setAuthorizedContract", [brainRegistry, true]);

  return { xpBadge, brainRegistry, brainPassNFT };
});
