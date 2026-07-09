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
 * @title BrainRegistryV2
 * @author Ritual Brain Team
 * @notice Extends BrainRegistry V1 with a global address registry so the
 *         frontend can enumerate every registered builder and build a real
 *         on-chain leaderboard.
 *
 * Changes vs V1:
 *  - address[] public registeredBuilders  — ordered list of all builder addresses
 *  - getRegisteredBuilders()              — read accessor for the full list
 *  - createProfile() pushes msg.sender to registeredBuilders on first registration
 *
 * The original V1 contract (0x9693952eBd35616Cc9B325e9E68CBA1f889e56bf) is
 * NOT modified. This is a fresh deployment with its own state.
 */
contract BrainRegistryV2 is Ownable2Step, ReentrancyGuard {

    // --- Struct Pack Optimization (identical to V1) ---
    struct Profile {
        string username;
        address walletAddress;
        uint256 joinTimestamp;
        uint256 xp;
        uint256 level;
        uint256 brainScore;
        string metadataURI;
        bool exists;
    }

    // --- State Storage ---
    address public brainPassNFTAddress;
    address public xpBadgeAddress;

    mapping(address => Profile) private _profiles;
    mapping(address => bool) public authorizedContracts;
    mapping(address => mapping(uint256 => bool)) public hasMilestoneBadge;

    // NEW in V2: ordered list of every registered builder address
    address[] public registeredBuilders;

    // --- Custom Errors ---
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

    constructor() Ownable(msg.sender) {}

    // --- Owner Setters ---

    function linkContracts(address _pass, address _badge) external onlyOwner {
        if (_pass == address(0) || _badge == address(0)) revert InvalidAddress();
        brainPassNFTAddress = _pass;
        xpBadgeAddress = _badge;
        emit LinkContractsUpdated(_pass, _badge);
    }

    function setAuthorizedContract(address _contract, bool _status) external onlyOwner {
        if (_contract == address(0)) revert InvalidAddress();
        authorizedContracts[_contract] = _status;
        emit AuthorizationUpdated(_contract, _status);
    }

    // --- Core Actions ---

    /**
     * @notice Create a new profile, mint BrainPass NFT, and register
     *         msg.sender in the global registeredBuilders array.
     */
    function createProfile(
        string calldata _username,
        string calldata _metadataURI
    ) external nonReentrant returns (uint256) {
        if (brainPassNFTAddress == address(0)) revert RegistryNotLinked();
        if (_profiles[msg.sender].exists) revert ProfileAlreadyExists();
        if (bytes(_username).length == 0) revert UsernameEmpty();

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

        // NEW: append to global builder list so frontend can enumerate all profiles
        registeredBuilders.push(msg.sender);

        uint256 passId = IBrainPassNFT(brainPassNFTAddress).mintPass(msg.sender);
        emit ProfileCreated(msg.sender, _username, block.timestamp, passId);
        return passId;
    }

    function updateProfile(
        string calldata _username,
        string calldata _metadataURI
    ) external profileExists(msg.sender) {
        if (bytes(_username).length == 0) revert UsernameEmpty();
        Profile storage profile = _profiles[msg.sender];
        profile.username = _username;
        profile.metadataURI = _metadataURI;
        emit ProfileUpdated(msg.sender, _username, _metadataURI);
    }

    function addXP(
        address _user,
        uint256 _amount
    ) external onlyAuthorized profileExists(_user) nonReentrant {
        if (_amount == 0) revert InvalidXPValue();
        Profile storage profile = _profiles[_user];
        profile.xp += _amount;
        uint256 calculatedLevel = (profile.xp / 1000) + 1;
        if (calculatedLevel > profile.level) profile.level = calculatedLevel;
        emit XPAdded(_user, _amount, profile.xp, profile.level);
        _checkAndTriggerBadges(_user, profile.xp);
    }

    function updateBrainScore(
        address _user,
        uint256 _score
    ) external profileExists(_user) {
        if (msg.sender != _user && msg.sender != owner() && !authorizedContracts[msg.sender]) {
            revert NotAuthorized();
        }
        if (_score > 100) revert InvalidScoreValue();
        uint256 oldScore = _profiles[_user].brainScore;
        _profiles[_user].brainScore = _score;
        emit BrainScoreUpdated(_user, oldScore, _score);
    }

    // --- Read Helpers ---

    function getProfile(address _user) external view returns (Profile memory) {
        if (!_profiles[_user].exists) revert ProfileDoesNotExist();
        return _profiles[_user];
    }

    /**
     * @notice NEW in V2 — returns the full array of registered builder addresses.
     *         The frontend iterates this list and calls getProfile() for each address
     *         to build a real global leaderboard.
     */
    function getRegisteredBuilders() external view returns (address[] memory) {
        return registeredBuilders;
    }

    /**
     * @notice Convenience: returns total number of registered builders.
     */
    function getBuilderCount() external view returns (uint256) {
        return registeredBuilders.length;
    }

    // --- Internal ---
    function _checkAndTriggerBadges(address _user, uint256 _xp) internal {
        if (xpBadgeAddress == address(0)) return;
        if (_xp >= 1000 && !hasMilestoneBadge[_user][1]) {
            hasMilestoneBadge[_user][1] = true;
            emit MilestoneBadgeTriggered(_user, 1);
            IXPBadge(xpBadgeAddress).mintBadge(_user, 1, 1, "");
        }
        if (_xp >= 5000 && !hasMilestoneBadge[_user][2]) {
            hasMilestoneBadge[_user][2] = true;
            emit MilestoneBadgeTriggered(_user, 2);
            IXPBadge(xpBadgeAddress).mintBadge(_user, 2, 1, "");
        }
        if (_xp >= 10000 && !hasMilestoneBadge[_user][3]) {
            hasMilestoneBadge[_user][3] = true;
            emit MilestoneBadgeTriggered(_user, 3);
            IXPBadge(xpBadgeAddress).mintBadge(_user, 3, 1, "");
        }
    }
}
