// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IBrainPassNFT {
    function mintPass(address user) external returns (uint256);
}

interface IXPBadge {
    function mintBadge(address user, uint256 badgeId, uint256 amount, bytes calldata data) external;
}

/**
 * @title BrainRegistry
 * @author Ritual Brain Team
 * @notice Primary register contract for managing developer neural identities, cognitive scores, and XP parameters.
 */
contract BrainRegistry is Ownable2Step, ReentrancyGuard {
    
    // --- Struct Pack Optimization ---
    struct Profile {
        string username;          // User alias
        address walletAddress;    // EVM Address (fits in one word 160 bits)
        uint256 joinTimestamp;    // Epoch timestamp
        uint256 xp;               // Total synaptic points
        uint256 level;            // Sync level
        uint256 brainScore;       // Dynamic cognitive assessment score
        string metadataURI;       // External profile parameters link
        bool exists;              // Register existence indicator
    }

    // --- State Storage ---
    address public brainPassNFTAddress;
    address public xpBadgeAddress;

    mapping(address => Profile) private _profiles;
    mapping(address => bool) public authorizedContracts;

    // Track minted badges to prevent duplicate milestone rewards
    mapping(address => mapping(uint256 => bool)) public hasMilestoneBadge;

    // --- Custom Gas-Optimized Errors ---
    error NotAuthorized();
    error ProfileAlreadyExists();
    error ProfileDoesNotExist();
    error InvalidAddress();
    error InvalidXPValue();
    error InvalidScoreValue();
    error RegistryNotLinked();
    error UsernameEmpty();

    // --- Events ---
    event ProfileCreated(address indexed user, string username, uint256 timestamp, uint256 passId);
    event ProfileUpdated(address indexed user, string username, string metadataURI);
    event XPAdded(address indexed user, uint256 amount, uint256 newXP, uint256 newLevel);
    event BrainScoreUpdated(address indexed user, uint256 oldScore, uint256 newScore);
    event MilestoneBadgeTriggered(address indexed user, uint256 badgeId);
    event AuthorizationUpdated(address indexed contractAddress, bool status);
    event LinkContractsUpdated(address passAddress, address badgeAddress);

    // --- Modifiers ---
    modifier onlyAuthorized() {
        if (msg.sender != owner() && !authorizedContracts[msg.sender]) {
            revert NotAuthorized();
        }
        _;
    }

    modifier profileExists(address user) {
        if (!_profiles[user].exists) {
            revert ProfileDoesNotExist();
        }
        _;
    }

    /**
     * @notice Construct BrainRegistry setting initial deployer as owner
     */
    constructor() Ownable(msg.sender) {}

    // --- External Setters (Owner Only) ---

    /**
     * @notice Link the auxiliary ERC721 Access Pass and ERC1155 Milestones Badge contracts
     * @param _pass Address of the BrainPassNFT contract
     * @param _badge Address of the XPBadge contract
     */
    function linkContracts(address _pass, address _badge) external onlyOwner {
        if (_pass == address(0) || _badge == address(0)) {
            revert InvalidAddress();
        }
        brainPassNFTAddress = _pass;
        xpBadgeAddress = _badge;
        emit LinkContractsUpdated(_pass, _badge);
    }

    /**
     * @notice Set validation status for helper node or game contracts
     * @param _contract Address of contract to configure
     * @param _status True to authorize, False to revoke
     */
    function setAuthorizedContract(address _contract, bool _status) external onlyOwner {
        if (_contract == address(0)) {
            revert InvalidAddress();
        }
        authorizedContracts[_contract] = _status;
        emit AuthorizationUpdated(_contract, _status);
    }

    // --- Core Register Actions ---

    /**
     * @notice Create a new profile and mint the dynamic BrainPass NFT
     * @param _username Builder's display name
     * @param _metadataURI Link to JSON hosting credentials and avatars
     */
    function createProfile(
        string calldata _username,
        string calldata _metadataURI
    ) external nonReentrant returns (uint256) {
        if (brainPassNFTAddress == address(0)) {
            revert RegistryNotLinked();
        }
        if (_profiles[msg.sender].exists) {
            revert ProfileAlreadyExists();
        }
        if (bytes(_username).length == 0) {
            revert UsernameEmpty();
        }

        // Initialize user profile slot
        _profiles[msg.sender] = Profile({
            username: _username,
            walletAddress: msg.sender,
            joinTimestamp: block.timestamp,
            xp: 0,
            level: 1,
            brainScore: 0,
            metadataURI: _metadataURI,
            exists: true
        });

        // Trigger dynamic ERC721 minting. Emits PassMinted in NFT contract.
        uint256 passId = IBrainPassNFT(brainPassNFTAddress).mintPass(msg.sender);

        emit ProfileCreated(msg.sender, _username, block.timestamp, passId);
        return passId;
    }

    /**
     * @notice Update custom profile settings (username & metadata links)
     * @param _username New builder display name
     * @param _metadataURI New JSON configuration link
     */
    function updateProfile(
        string calldata _username,
        string calldata _metadataURI
    ) external profileExists(msg.sender) {
        if (bytes(_username).length == 0) {
            revert UsernameEmpty();
        }

        Profile storage profile = _profiles[msg.sender];
        profile.username = _username;
        profile.metadataURI = _metadataURI;

        emit ProfileUpdated(msg.sender, _username, _metadataURI);
    }

    /**
     * @notice Add XP to a registered user and automatically check milestone badge rewards
     * @param _user Target wallet address
     * @param _amount Synaptic points value to add
     */
    function addXP(
        address _user,
        uint256 _amount
    ) external onlyAuthorized profileExists(_user) nonReentrant {
        if (_amount == 0) {
            revert InvalidXPValue();
        }

        Profile storage profile = _profiles[_user];
        profile.xp += _amount;

        // Calculate Level (linear scale: 1 level per 1000 XP)
        uint256 calculatedLevel = (profile.xp / 1000) + 1;
        if (calculatedLevel > profile.level) {
            profile.level = calculatedLevel;
        }

        emit XPAdded(_user, _amount, profile.xp, profile.level);

        // Check and trigger milestones
        _checkAndTriggerBadges(_user, profile.xp);
    }

    /**
     * @notice Set cognitive verification score computed by node validators or self-submitted by user
     * @param _user Target wallet address
     * @param _score Scientific scan score rating (0-100)
     */
    function updateBrainScore(
        address _user,
        uint256 _score
    ) external profileExists(_user) {
        if (msg.sender != _user && msg.sender != owner() && !authorizedContracts[msg.sender]) {
            revert NotAuthorized();
        }
        if (_score > 100) {
            revert InvalidScoreValue();
        }

        uint256 oldScore = _profiles[_user].brainScore;
        _profiles[_user].brainScore = _score;

        emit BrainScoreUpdated(_user, oldScore, _score);
    }

    // --- Read Helpers ---

    /**
     * @notice Retrieve the detailed profile structure of a registered wallet
     * @param _user Address of target profile
     */
    function getProfile(
        address _user
    ) external view returns (Profile memory) {
        if (!_profiles[_user].exists) {
            revert ProfileDoesNotExist();
        }
        return _profiles[_user];
    }

    // --- Internal Helpers ---

    /**
     * @dev Core milestone evaluation. Interface calls XPBadge to mint.
     */
    function _checkAndTriggerBadges(address _user, uint256 _xp) internal {
        if (xpBadgeAddress == address(0)) return;

        // Milestone 1: 1000 XP (Synapse Initiate - Badge ID 1)
        if (_xp >= 1000 && !hasMilestoneBadge[_user][1]) {
            hasMilestoneBadge[_user][1] = true;
            emit MilestoneBadgeTriggered(_user, 1);
            IXPBadge(xpBadgeAddress).mintBadge(_user, 1, 1, "");
        }
        // Milestone 2: 5000 XP (Cortex Builder - Badge ID 2)
        if (_xp >= 5000 && !hasMilestoneBadge[_user][2]) {
            hasMilestoneBadge[_user][2] = true;
            emit MilestoneBadgeTriggered(_user, 2);
            IXPBadge(xpBadgeAddress).mintBadge(_user, 2, 1, "");
        }
        // Milestone 3: 10000 XP (Neural Overlord - Badge ID 3)
        if (_xp >= 10000 && !hasMilestoneBadge[_user][3]) {
            hasMilestoneBadge[_user][3] = true;
            emit MilestoneBadgeTriggered(_user, 3);
            IXPBadge(xpBadgeAddress).mintBadge(_user, 3, 1, "");
        }
    }
}
