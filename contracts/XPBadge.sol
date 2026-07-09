// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title XPBadge
 * @author Ritual Brain Team
 * @notice ERC1155 multi-token badge contract for rewarding developer wallets as they cross synaptic XP milestones.
 */
contract XPBadge is ERC1155, Ownable {

    // --- Collection Meta ---
    string public name = "Ritual Brain XP Badges";
    string public symbol = "RBBADGE";

    // --- State Storage ---
    mapping(address => bool) public authorizedMintingContracts;

    // --- Custom Errors ---
    error NotAuthorized();
    error InvalidAddress();
    error LengthMismatch();

    // --- Events ---
    event BadgeMinted(address indexed user, uint256 indexed badgeId, uint256 amount);
    event BadgeBatchMinted(address indexed user, uint256[] badgeIds, uint256[] amounts);
    event AuthorizationUpdated(address indexed contractAddress, bool status);
    event URIUpdated(string newURI);

    // --- Modifiers ---
    modifier onlyAuthorized() {
        if (msg.sender != owner() && !authorizedMintingContracts[msg.sender]) {
            revert NotAuthorized();
        }
        _;
    }

    /**
     * @notice Construct XPBadge, assigning metadata base URI
     * @param _uri Base token URI configuration link
     */
    constructor(string memory _uri) ERC1155(_uri) Ownable(msg.sender) {
        emit URIUpdated(_uri);
    }

    // --- External Setters (Owner Only) ---

    /**
     * @notice Authorize or revoke validator/registry contracts for minting access
     * @param _contract Target contract address to change permissions
     * @param _status True to authorize, False to revoke
     */
    function setAuthorizedContract(address _contract, bool _status) external onlyOwner {
        if (_contract == address(0)) {
            revert InvalidAddress();
        }
        authorizedMintingContracts[_contract] = _status;
        emit AuthorizationUpdated(_contract, _status);
    }

    /**
     * @notice Set global collection URI structure
     * @param _newuri New base URI string
     */
    function setURI(string calldata _newuri) external onlyOwner {
        _setURI(_newuri);
        emit URIUpdated(_newuri);
    }

    // --- Core Operations (Authorized Only) ---

    /**
     * @notice Mint a specific milestone badge to a developer
     * @param _user Target builder wallet address
     * @param _badgeId Token milestone index (e.g. 1 for Initiate, 2 for Builder, 3 for Overlord)
     * @param _amount Number of badges to mint
     * @param _data Auxiliary payload bytes
     */
    function mintBadge(
        address _user,
        uint256 _badgeId,
        uint256 _amount,
        bytes calldata _data
    ) external onlyAuthorized {
        if (_user == address(0)) {
            revert InvalidAddress();
        }

        _mint(_user, _badgeId, _amount, _data);
        emit BadgeMinted(_user, _badgeId, _amount);
    }

    /**
     * @notice Batch mint multiple milestone badges to a developer
     * @param _user Target builder wallet address
     * @param _badgeIds Array of token indices to mint
     * @param _amounts Array of counts matching token indices
     * @param _data Auxiliary payload bytes
     */
    function mintBatchBadges(
        address _user,
        uint256[] calldata _badgeIds,
        uint256[] calldata _amounts,
        bytes calldata _data
    ) external onlyAuthorized {
        if (_user == address(0)) {
            revert InvalidAddress();
        }
        if (_badgeIds.length != _amounts.length) {
            revert LengthMismatch();
        }

        _mintBatch(_user, _badgeIds, _amounts, _data);
        emit BadgeBatchMinted(_user, _badgeIds, _amounts);
    }
}
