// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/**
 * @title ImplRoot
 * @dev Abstract contract providing upgradeable functionality via UUPSUpgradeable,
 * along with role-based access control using AccessControlUpgradeable.
 * Serves as a base for upgradeable implementations.
 *
 * Governance Roles:
 * - CRITICAL_ROLE: Critical operations and role management (3/5 multisig consensus)
 * - STANDARD_ROLE: Standard operations (2/5 multisig consensus)
 */
abstract contract ImplRoot is UUPSUpgradeable, AccessControlUpgradeable {
    /// @notice Critical operations requiring 3/5 multisig consensus
    bytes32 public constant CRITICAL_ROLE = keccak256("CRITICAL_ROLE");

    /// @notice Standard operations requiring 2/5 multisig consensus
    bytes32 public constant STANDARD_ROLE = keccak256("STANDARD_ROLE");

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;

    /**
     * @dev Initializes the contract by setting the deployer as the initial owner and initializing
     * the UUPS proxy functionality.
     *
     * This function should be called in the initializer of the derived contract.
     */
    function __ImplRoot_init() internal virtual onlyInitializing {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(CRITICAL_ROLE, msg.sender);
        _grantRole(STANDARD_ROLE, msg.sender);

        // Set role admins - CRITICAL_ROLE manages all roles
        _setRoleAdmin(CRITICAL_ROLE, CRITICAL_ROLE);
        _setRoleAdmin(STANDARD_ROLE, CRITICAL_ROLE);
    }

    /**
     * @dev Authorizes an upgrade to a new implementation.
     * Requirements:
     *   - Must be called through a proxy.
     *   - Caller must have CRITICAL_ROLE.
     *
     * @param newImplementation The address of the new implementation contract.
     */
    function _authorizeUpgrade(address newImplementation) internal virtual override onlyProxy onlyRole(CRITICAL_ROLE) {}
}
