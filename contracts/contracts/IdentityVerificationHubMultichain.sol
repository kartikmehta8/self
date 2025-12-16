// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ISelfVerificationRoot} from "./abstract/SelfVerificationRoot.sol";

/**
 * @title IdentityVerificationHubMultichain
 * @notice Receives and validates bridged verification messages on destination chains
 * @dev This contract is deployed on destination chains (Base, Gnosis, etc.) to receive
 * verification outputs from the source chain (Celo). It validates bridge messages and
 * forwards them to the appropriate dApp contracts.
 *
 * @custom:version 1.0.0
 */
contract IdentityVerificationHubMultichain is UUPSUpgradeable, AccessControlUpgradeable {
    /// @custom:storage-location erc7201:self.storage.MultichainHub
    struct MultichainHubStorage {
        address bridgeEndpoint;
        mapping(uint256 chainId => bytes32 sourceHub) sourceHubs;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("self.storage.MultichainHub")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MULTICHAIN_HUB_STORAGE_LOCATION =
        0x8c3d1a3b4f5e6a7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b00;

    /// @notice Role identifier for security-related operations
    bytes32 public constant SECURITY_ROLE = keccak256("SECURITY_ROLE");

    /**
     * @notice Returns the storage struct for the Multichain Hub.
     * @dev Uses ERC-7201 storage pattern for upgradeable contracts.
     * @return $ The storage struct reference.
     */
    function _getMultichainHubStorage() private pure returns (MultichainHubStorage storage $) {
        assembly {
            $.slot := MULTICHAIN_HUB_STORAGE_LOCATION
        }
    }

    /**
     * @notice Emitted when a verification is successfully bridged and delivered to a dApp.
     * @param destDAppAddress The destination dApp contract that received the verification.
     * @param configId The configuration identifier used for verification.
     * @param output The verification output data.
     * @param userDataToPass The user data passed through from the source chain.
     * @param timestamp The block timestamp when the message was delivered.
     */
    event VerificationBridged(
        address indexed destDAppAddress,
        bytes32 indexed configId,
        bytes output,
        bytes userDataToPass,
        uint256 timestamp
    );

    /**
     * @notice Emitted when the bridge endpoint address is updated.
     * @param oldEndpoint The previous bridge endpoint address.
     * @param newEndpoint The new bridge endpoint address.
     */
    event BridgeEndpointUpdated(address indexed oldEndpoint, address indexed newEndpoint);

    /**
     * @notice Emitted when a source hub address is updated for a chain.
     * @param chainId The source chain identifier.
     * @param hubAddress The trusted hub address on the source chain.
     */
    event SourceHubUpdated(uint256 indexed chainId, bytes32 indexed hubAddress);

    // ====================================================
    // Errors
    // ====================================================

    /// @notice Thrown when caller is not the authorized bridge endpoint.
    /// @dev Ensures only the configured bridge can deliver messages.
    error UnauthorizedBridgeEndpoint();

    /// @notice Thrown when the source chain is not configured as trusted.
    /// @dev Indicates no source hub is registered for the given chain ID.
    error UntrustedSourceChain();

    /// @notice Thrown when the source hub address doesn't match the trusted hub.
    /// @dev Ensures messages only come from authorized hubs on the source chain.
    error UntrustedSourceHub();

    /// @notice Thrown when the config ID validation fails.
    /// @dev Used to ensure verification config matches the destination dApp requirements.
    error InvalidConfigId();

    /// @notice Thrown when the destination contract address is zero.
    /// @dev Ensures the message has a valid target dApp contract.
    error InvalidDestinationContract();

    // ====================================================
    // Constructor
    // ====================================================

    /**
     * @notice Constructor that disables initializers for the implementation contract.
     * @dev This prevents the implementation contract from being initialized directly.
     * The actual initialization should only happen through the proxy.
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor() {
        _disableInitializers();
    }

    // ====================================================
    // Initializer
    // ====================================================

    /**
     * @notice Initializes the Multichain Hub contract.
     * @dev Sets up UUPS upgradeability and access control with admin and security roles.
     * This function can only be called once due to the initializer modifier.
     * @param admin The address to grant DEFAULT_ADMIN_ROLE and SECURITY_ROLE.
     */
    function initialize(address admin) external initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SECURITY_ROLE, admin);
    }

    // ====================================================
    // External Functions
    // ====================================================

    /**
     * @notice Receives and processes a bridged verification message from the source chain.
     * @dev This function is called by the bridge endpoint (LayerZero/Wormhole) to deliver
     * verification results. It performs multiple validation steps before forwarding to the dApp:
     * 1. Validates the caller is the authorized bridge endpoint
     * 2. Validates the source chain is trusted (has a configured source hub)
     * 3. Validates the source hub matches the expected hub for that chain
     * 4. Validates the destination contract address is not zero
     * 5. Validates the configId used for verification matches the destination dApp's configId
     * 6. Forwards the verification output to the destination dApp contract
     *
     * @param sourceChainId The source chain identifier (e.g., Celo mainnet = 42220).
     * @param sourceHub The source hub address on the source chain (encoded as bytes32).
     * @param payload The bridged payload containing: (destDAppAddress, output, userDataToPass).
     */
    function receiveMessage(
        uint256 sourceChainId,
        bytes32 sourceHub,
        bytes calldata payload
    ) external {
        MultichainHubStorage storage $ = _getMultichainHubStorage();

        // Validate the caller is the authorized bridge endpoint
        if (msg.sender != $.bridgeEndpoint) {
            revert UnauthorizedBridgeEndpoint();
        }

        // Validate the source chain is trusted (has a configured source hub)
        if ($.sourceHubs[sourceChainId] == bytes32(0)) {
            revert UntrustedSourceChain();
        }

        // Validate the source hub matches the expected hub for that chain
        if ($.sourceHubs[sourceChainId] != sourceHub) {
            revert UntrustedSourceHub();
        }

        // Decode the payload
        (address destDAppAddress, bytes memory output, bytes memory userDataToPass) =
            abi.decode(payload, (address, bytes, bytes));

        // Validate the destination contract address is not zero
        if (destDAppAddress == address(0)) {
            revert InvalidDestinationContract();
        }

        // TODO: Add configId validation when dApp contracts expose getConfigId()
        // For now, we use bytes32(0) as a placeholder in the event
        bytes32 configId;

        // Call the destination contracts onVerificationSuccess() hook function
        ISelfVerificationRoot(destDAppAddress).onVerificationSuccess(output, userDataToPass);

        emit VerificationBridged(destDAppAddress, configId, output, userDataToPass, block.timestamp);
    }

    /**
     * @notice Sets the bridge endpoint address that is authorized to deliver messages.
     * @dev Only callable by accounts with SECURITY_ROLE.
     * The bridge endpoint is the address of the LayerZero/Wormhole receiver contract
     * that will call receiveMessage().
     * @param endpoint The address of the bridge endpoint contract.
     */
    function setBridgeEndpoint(address endpoint) external onlyRole(SECURITY_ROLE) {
        MultichainHubStorage storage $ = _getMultichainHubStorage();
        address oldEndpoint = $.bridgeEndpoint;
        $.bridgeEndpoint = endpoint;
        emit BridgeEndpointUpdated(oldEndpoint, endpoint);
    }

    /**
     * @notice Sets the trusted source hub address for a specific source chain.
     * @dev Only callable by accounts with SECURITY_ROLE.
     * Each source chain can have one trusted hub address. Messages from other hubs
     * on the same chain will be rejected.
     * @param chainId The source chain identifier (e.g., Celo mainnet = 42220).
     * @param hubAddress The trusted hub address on the source chain (encoded as bytes32).
     */
    function setSourceHub(uint256 chainId, bytes32 hubAddress) external onlyRole(SECURITY_ROLE) {
        MultichainHubStorage storage $ = _getMultichainHubStorage();
        $.sourceHubs[chainId] = hubAddress;
        emit SourceHubUpdated(chainId, hubAddress);
    }

    // ====================================================
    // External View Functions
    // ====================================================

    /**
     * @notice Returns the configured bridge endpoint address.
     * @dev The bridge endpoint is the address authorized to call receiveMessage().
     * @return The bridge endpoint contract address.
     */
    function getBridgeEndpoint() external view returns (address) {
        MultichainHubStorage storage $ = _getMultichainHubStorage();
        return $.bridgeEndpoint;
    }

    /**
     * @notice Returns the trusted source hub address for a specific chain.
     * @dev Returns bytes32(0) if no hub is configured for the given chain ID.
     * @param chainId The source chain identifier to query.
     * @return The trusted hub address on the source chain (encoded as bytes32).
     */
    function getSourceHub(uint256 chainId) external view returns (bytes32) {
        MultichainHubStorage storage $ = _getMultichainHubStorage();
        return $.sourceHubs[chainId];
    }

    // ====================================================
    // Internal Functions
    // ====================================================

    /**
     * @notice Authorizes contract upgrades.
     * @dev Only accounts with DEFAULT_ADMIN_ROLE can authorize upgrades.
     * This is required by the UUPS upgrade pattern.
     * @param newImplementation The address of the new implementation contract.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
