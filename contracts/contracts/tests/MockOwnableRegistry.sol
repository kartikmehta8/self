// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MockOwnableImplRoot} from "./MockOwnableImplRoot.sol";

/**
 * @title MockOwnableRegistry
 * @dev Mock contract that simulates the OLD production Registry using Ownable
 * This represents what's currently deployed in production before the governance upgrade.
 */
contract MockOwnableRegistry is MockOwnableImplRoot {
    /// @notice Hub address
    address private _hub;

    /// @notice Some registry data
    mapping(bytes32 => bool) private _commitments;

    /// @notice Event emitted when registry is initialized
    event RegistryInitialized(address indexed hub);

    /// @notice Event emitted when hub is updated
    event HubUpdated(address indexed hub);

    /**
     * @notice Constructor that disables initializers for the implementation contract.
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the Registry contract (simulates production initialization)
     * @param hubAddress The hub address
     */
    function initialize(address hubAddress) external initializer {
        __MockOwnableImplRoot_init();
        _hub = hubAddress;
        emit RegistryInitialized(hubAddress);
    }

    /**
     * @notice Updates the hub address (simulates production function)
     * @param hubAddress The new hub address
     */
    function updateHub(address hubAddress) external onlyOwner {
        _hub = hubAddress;
        emit HubUpdated(hubAddress);
    }

    /**
     * @notice Adds a commitment (simulates production function)
     * @param commitment The commitment to add
     */
    function addCommitment(bytes32 commitment) external onlyOwner {
        _commitments[commitment] = true;
    }

    /**
     * @notice Gets the hub address
     */
    function getHub() external view returns (address) {
        return _hub;
    }

    /**
     * @notice Checks if a commitment exists
     */
    function hasCommitment(bytes32 commitment) external view returns (bool) {
        return _commitments[commitment];
    }
}


