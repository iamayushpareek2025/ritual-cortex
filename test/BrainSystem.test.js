import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("Ritual Brain System Contracts Test Suite", function () {
  let owner;
  let user1;
  let user2;
  let validatorNode;
  let unauthorizedUser;

  let xpBadge;
  let brainRegistry;
  let brainPassNFT;

  beforeEach(async function () {
    // 1. Get signer wallets
    [owner, user1, user2, validatorNode, unauthorizedUser] = await ethers.getSigners();

    // 2. Deploy XPBadge (ERC1155 achievements)
    const XPBadgeFactory = await ethers.getContractFactory("XPBadge");
    xpBadge = await XPBadgeFactory.deploy("https://api.ritualbrain.net/badges/{id}.json");
    await xpBadge.waitForDeployment();

    // 3. Deploy BrainRegistry (State database)
    const BrainRegistryFactory = await ethers.getContractFactory("BrainRegistry");
    brainRegistry = await BrainRegistryFactory.deploy();
    await brainRegistry.waitForDeployment();

    // 4. Deploy BrainPassNFT (ERC721 credentials pass) linking to BrainRegistry
    const BrainPassNFTFactory = await ethers.getContractFactory("BrainPassNFT");
    brainPassNFT = await BrainPassNFTFactory.deploy(await brainRegistry.getAddress());
    await brainPassNFT.waitForDeployment();

    // 5. Connect Registry, Pass, and Badge contracts together
    await brainRegistry.linkContracts(
      await brainPassNFT.getAddress(),
      await xpBadge.getAddress()
    );

    // 6. Whitelist Registry inside XPBadge
    await xpBadge.setAuthorizedContract(await brainRegistry.getAddress(), true);

    // 7. Whitelist validatorNode inside BrainRegistry
    await brainRegistry.setAuthorizedContract(validatorNode.address, true);
  });

  describe("Profile Creation & Constraints", function () {
    it("Should allow a user to create only one profile successfully", async function () {
      // User1 creates their profile
      await expect(
        brainRegistry.connect(user1).createProfile("builder_one", "ipfs://profile-meta-1")
      ).to.emit(brainRegistry, "ProfileCreated");

      // Verify profile values in storage
      const profile = await brainRegistry.getProfile(user1.address);
      expect(profile.username).to.equal("builder_one");
      expect(profile.walletAddress).to.equal(user1.address);
      expect(profile.xp).to.equal(0n);
      expect(profile.level).to.equal(1n);
      expect(profile.exists).to.be.true;

      // Re-registering user1 should fail with custom error ProfileAlreadyExists
      await expect(
        brainRegistry.connect(user1).createProfile("builder_one_alt", "ipfs://profile-meta-2")
      ).to.be.revertedWithCustomError(brainRegistry, "ProfileAlreadyExists");
    });

    it("Should reject profile creation if username is empty", async function () {
      await expect(
        brainRegistry.connect(user1).createProfile("", "ipfs://profile-meta-1")
      ).to.be.revertedWithCustomError(brainRegistry, "UsernameEmpty");
    });
  });

  describe("Brain Pass NFT Integration", function () {
    it("Should automatically mint a Brain Pass NFT upon profile creation", async function () {
      // Verify no passes exist before profile creation
      expect(await brainPassNFT.balanceOf(user1.address)).to.equal(0n);

      // Create profile
      await brainRegistry.connect(user1).createProfile("builder_one", "ipfs://profile-meta-1");

      // Verify pass ID is recorded and ERC721 balance equals 1
      const tokenId = await brainPassNFT.userPassId(user1.address);
      expect(tokenId).to.equal(1n);
      expect(await brainPassNFT.balanceOf(user1.address)).to.equal(1n);

      // Verify dynamic tokenURI pulls metadata URI from registry
      expect(await brainPassNFT.tokenURI(tokenId)).to.equal("ipfs://profile-meta-1");
    });

    it("Should dynamic-update tokenURI when profile metadata changes", async function () {
      await brainRegistry.connect(user1).createProfile("builder_one", "ipfs://profile-meta-1");
      const tokenId = await brainPassNFT.userPassId(user1.address);

      // Update metadata links
      await expect(
        brainRegistry.connect(user1).updateProfile("builder_one", "ipfs://new-meta-uri")
      ).to.emit(brainRegistry, "ProfileUpdated");

      // Verify tokenURI resolves to new metadata link immediately
      expect(await brainPassNFT.tokenURI(tokenId)).to.equal("ipfs://new-meta-uri");
    });
  });

  describe("XP Scoring & Leveling Boundaries", function () {
    it("Should allow owner or authorized contracts to add XP", async function () {
      await brainRegistry.connect(user1).createProfile("builder_one", "ipfs://profile-meta-1");

      // Owner adds XP
      await expect(
        brainRegistry.connect(owner).addXP(user1.address, 450)
      ).to.emit(brainRegistry, "XPAdded").withArgs(user1.address, 450, 450, 1);

      // Validator adds XP
      await expect(
        brainRegistry.connect(validatorNode).addXP(user1.address, 200)
      ).to.emit(brainRegistry, "XPAdded").withArgs(user1.address, 200, 650, 1);

      const profile = await brainRegistry.getProfile(user1.address);
      expect(profile.xp).to.equal(650n);
    });

    it("Should level up the user when XP crosses level thresholds (1 level per 1000 XP)", async function () {
      await brainRegistry.connect(user1).createProfile("builder_one", "ipfs://profile-meta-1");

      // Add 999 XP
      await brainRegistry.connect(owner).addXP(user1.address, 999);
      let profile = await brainRegistry.getProfile(user1.address);
      expect(profile.level).to.equal(1n);

      // Add 1 more XP (total 1000)
      await brainRegistry.connect(owner).addXP(user1.address, 1);
      profile = await brainRegistry.getProfile(user1.address);
      expect(profile.level).to.equal(2n);

      // Add 2500 more XP (total 3500)
      await brainRegistry.connect(owner).addXP(user1.address, 2500);
      profile = await brainRegistry.getProfile(user1.address);
      expect(profile.level).to.equal(4n);
    });
  });

  describe("Milestone Achievements (ERC1155 Badges)", function () {
    it("Should automatically mint Badge ID 1 when user hits 1000 XP milestone", async function () {
      await brainRegistry.connect(user1).createProfile("builder_one", "ipfs://profile-meta-1");

      // Verify no badge exists initially
      expect(await xpBadge.balanceOf(user1.address, 1)).to.equal(0n);

      // Add 900 XP (total 900)
      await brainRegistry.connect(owner).addXP(user1.address, 900);
      expect(await xpBadge.balanceOf(user1.address, 1)).to.equal(0n);

      // Add 100 XP (total 1000) -> Crosses Milestone 1
      await expect(
        brainRegistry.connect(owner).addXP(user1.address, 100)
      ).to.emit(brainRegistry, "MilestoneBadgeTriggered").withArgs(user1.address, 1);

      // Verify Badge ID 1 was minted
      expect(await xpBadge.balanceOf(user1.address, 1)).to.equal(1n);
    });

    it("Should prevent duplicate mints of the same milestone badge to the user", async function () {
      await brainRegistry.connect(user1).createProfile("builder_one", "ipfs://profile-meta-1");

      // Trigger first milestone
      await brainRegistry.connect(owner).addXP(user1.address, 1000);
      expect(await xpBadge.balanceOf(user1.address, 1)).to.equal(1n);

      // Add more XP (bringing total to 2000) -> Should NOT trigger badge minting again
      await brainRegistry.connect(owner).addXP(user1.address, 1000);
      expect(await xpBadge.balanceOf(user1.address, 1)).to.equal(1n);
    });
  });

  describe("Access Controls & Validation Rules", function () {
    it("Should reject XP modifications from unauthorized addresses", async function () {
      await brainRegistry.connect(user1).createProfile("builder_one", "ipfs://profile-meta-1");

      // Unauthorized user tries to add XP
      await expect(
        brainRegistry.connect(unauthorizedUser).addXP(user1.address, 100)
      ).to.be.revertedWithCustomError(brainRegistry, "NotAuthorized");
    });

    it("Should reject brain score updates from unauthorized addresses", async function () {
      await brainRegistry.connect(user1).createProfile("builder_one", "ipfs://profile-meta-1");

      // Unauthorized user tries to set brain score
      await expect(
        brainRegistry.connect(unauthorizedUser).updateBrainScore(user1.address, 85)
      ).to.be.revertedWithCustomError(brainRegistry, "NotAuthorized");
    });
  });

  describe("Brain Score Verification Engine", function () {
    it("Should allow authorized node to update brain score and emit update events", async function () {
      await brainRegistry.connect(user1).createProfile("builder_one", "ipfs://profile-meta-1");

      // ValidatorNode updates score to 92
      await expect(
        brainRegistry.connect(validatorNode).updateBrainScore(user1.address, 92)
      ).to.emit(brainRegistry, "BrainScoreUpdated").withArgs(user1.address, 0, 92);

      const profile = await brainRegistry.getProfile(user1.address);
      expect(profile.brainScore).to.equal(92n);
    });

    it("Should allow the user to self-submit/update their own brain score", async function () {
      await brainRegistry.connect(user1).createProfile("builder_one", "ipfs://profile-meta-1");

      // User1 updates their own score to 88
      await expect(
        brainRegistry.connect(user1).updateBrainScore(user1.address, 88)
      ).to.emit(brainRegistry, "BrainScoreUpdated").withArgs(user1.address, 0, 88);

      const profile = await brainRegistry.getProfile(user1.address);
      expect(profile.brainScore).to.equal(88n);
    });

    it("Should reject brain score updates greater than 100", async function () {
      await brainRegistry.connect(user1).createProfile("builder_one", "ipfs://profile-meta-1");

      await expect(
        brainRegistry.connect(validatorNode).updateBrainScore(user1.address, 101)
      ).to.be.revertedWithCustomError(brainRegistry, "InvalidScoreValue");
    });
  });
});
