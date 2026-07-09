// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IBrainRegistry {
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
    function getProfile(address user) external view returns (Profile memory);
}

/**
 * @title BrainPassNFT
 * @author Ritual Brain Team
 * @notice ERC721 dynamic credentials pass representing developer enrollment in the Ritual Brain system.
 */
contract BrainPassNFT is ERC721, Ownable {

    // --- State Storage ---
    address public registryAddress;
    uint256 private _nextTokenId;

    // Track user pass tokens (one per wallet)
    mapping(address => uint256) public userPassId;

    // --- Custom Errors ---
    error OnlyRegistry();
    error DuplicateMinting();
    error TokenDoesNotExist();
    error InvalidAddress();

    // --- Events ---
    event PassMinted(address indexed user, uint256 indexed tokenId);
    event RegistryAddressUpdated(address indexed newRegistry);

    // --- Modifiers ---
    modifier onlyRegistry() {
        if (msg.sender != registryAddress) {
            revert OnlyRegistry();
        }
        _;
    }

    /**
     * @notice Construct BrainPassNFT setting owner and linking registry
     * @param _registryAddress Address of the BrainRegistry contract
     */
    constructor(address _registryAddress) ERC721("Ritual Brain Pass", "RBPASS") Ownable(msg.sender) {
        if (_registryAddress == address(0)) {
            revert InvalidAddress();
        }
        registryAddress = _registryAddress;
        _nextTokenId = 1; // Start token ID numbering at 1
    }

    // --- External Setters (Owner Only) ---

    /**
     * @notice Update linked registry address
     * @param _newRegistry Address of the new BrainRegistry contract
     */
    function setRegistryAddress(address _newRegistry) external onlyOwner {
        if (_newRegistry == address(0)) {
            revert InvalidAddress();
        }
        registryAddress = _newRegistry;
        emit RegistryAddressUpdated(_newRegistry);
    }

    // --- Core Operations ---

    /**
     * @notice Mint a new credentials pass token
     * @dev Only callable by the whitelisted registry address
     * @param _user Destination builder wallet address
     */
    function mintPass(address _user) external onlyRegistry returns (uint256) {
        if (balanceOf(_user) > 0 || userPassId[_user] != 0) {
            revert DuplicateMinting();
        }

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        userPassId[_user] = tokenId;
        _safeMint(_user, tokenId);

        emit PassMinted(_user, tokenId);
        return tokenId;
    }

    // --- Read Overrides ---

    /**
     * @notice Return the dynamic metadata JSON URI referencing user profile parameters in registry
     * @dev Overridden to retrieve dynamic metadata link from BrainRegistry directly
     * @param tokenId Token index to query
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        // Fetch owner of the pass token
        address tokenOwner = ownerOf(tokenId);

        // Query the profile metadata stored in BrainRegistry
        IBrainRegistry.Profile memory profile = IBrainRegistry(registryAddress).getProfile(tokenOwner);
        
        return profile.metadataURI;
    }

    /**
     * @notice Get next available token ID
     */
    function getNextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
}
