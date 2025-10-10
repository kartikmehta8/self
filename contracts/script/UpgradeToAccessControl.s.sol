// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {IdentityVerificationHubImplV2} from "../contracts/IdentityVerificationHubImplV2.sol";
import {IdentityRegistryImplV1} from "../contracts/registry/IdentityRegistryImplV1.sol";
import {IdentityRegistryIdCardImplV1} from "../contracts/registry/IdentityRegistryIdCardImplV1.sol";
import {IdentityRegistryAadhaarImplV1} from "../contracts/registry/IdentityRegistryAadhaarImplV1.sol";
import {PCR0Manager} from "../contracts/utils/PCR0Manager.sol";

/**
 * @title UpgradeToAccessControl
 * @notice Foundry script to upgrade contracts from Ownable2StepUpgradeable to AccessControlUpgradeable
 *
 * This script:
 * 1. Upgrades IdentityVerificationHubImplV2 from Ownable to AccessControl governance
 * 2. Upgrades IdentityRegistryImplV1 (Passport) from Ownable to AccessControl
 * 3. Upgrades IdentityRegistryIdCardImplV1 from Ownable to AccessControl
 * 4. Upgrades IdentityRegistryAadhaarImplV1 from Ownable to AccessControl (if deployed)
 * 5. Calls initializeGovernance() on each upgraded contract to set up roles
 *
 * Usage:
 * - Dry run (local fork): forge script script/UpgradeToAccessControl.s.sol --fork-url $CELO_RPC_URL
 * - Execute on fork: forge script script/UpgradeToAccessControl.s.sol --fork-url $CELO_RPC_URL --broadcast
 * - Execute on mainnet: forge script script/UpgradeToAccessControl.s.sol --rpc-url celo --broadcast --verify
 */
contract UpgradeToAccessControl is Script {
    // ============================================================================
    // DEPLOYED CONTRACT ADDRESSES (Celo Mainnet)
    // Source: ignition/deployments/prod/deployed_addresses.json
    // ============================================================================

    // PROXY CONTRACTS (these are upgraded)
    address constant HUB_PROXY = 0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF; // IdentityVerificationHub V2 proxy
    address constant REGISTRY_PASSPORT_PROXY = 0x37F5CB8cB1f6B00aa768D8aA99F1A9289802A968; // IdentityRegistry (Passport) proxy
    address constant REGISTRY_ID_CARD_PROXY = 0xeAD1E6Ec29c1f3D33a0662f253a3a94D189566E1; // IdentityRegistry (ID Card) proxy
    address constant REGISTRY_AADHAAR_PROXY = 0xd603Fa8C8f4694E8DD1DcE1f27C0C3fc91e32Ac4; // IdentityRegistry (Aadhaar) proxy

    // LIBRARY ADDRESSES (needed for contract linking)
    address constant CUSTOM_VERIFIER = 0x9E66B82Da87309fAE1403078d498a069A30860c4; // CustomVerifier library
    address constant POSEIDON_T3 = 0xF134707a4C4a3a76b8410fC0294d620A7c341581; // PoseidonT3 library

    // Governance roles
    bytes32 public constant CRITICAL_ROLE = keccak256("CRITICAL_ROLE");
    bytes32 public constant STANDARD_ROLE = keccak256("STANDARD_ROLE");

    function run() external {
        console2.log("================================================================================");
        console2.log("CELO GOVERNANCE UPGRADE: Ownable -> AccessControl");
        console2.log("================================================================================");

            // Validate addresses
            require(HUB_PROXY != address(0), "HUB_PROXY not set");
            require(REGISTRY_PASSPORT_PROXY != address(0), "REGISTRY_PASSPORT_PROXY not set");
            require(REGISTRY_ID_CARD_PROXY != address(0), "REGISTRY_ID_CARD_PROXY not set");
            require(REGISTRY_AADHAAR_PROXY != address(0), "REGISTRY_AADHAAR_PROXY not set");
            require(CUSTOM_VERIFIER != address(0), "CUSTOM_VERIFIER not set");
            require(POSEIDON_T3 != address(0), "POSEIDON_T3 not set");

        console2.log("\nDeployer:", msg.sender);
        console2.log("Chain ID:", block.chainid);
        console2.log("");

        // Start broadcasting transactions
        vm.startBroadcast();

        // Step 1: Upgrade Hub
        upgradeHub();

        // Step 2: Upgrade Passport Registry
        upgradePassportRegistry();

        // Step 3: Upgrade ID Card Registry (if deployed)
        if (REGISTRY_ID_CARD_PROXY != address(0)) {
            upgradeIdCardRegistry();
        }

        // Step 4: Upgrade Aadhaar Registry
        upgradeAadhaarRegistry();

        vm.stopBroadcast();

        console2.log("\n================================================================================");
        console2.log("UPGRADE COMPLETE!");
        console2.log("================================================================================");
        console2.log("\nNext steps:");
        console2.log("1. Verify all state was preserved (run tests)");
        console2.log("2. Transfer roles to multisigs using TransferRolesToMultisigs.s.sol");
        console2.log("3. Verify deployer no longer has control");
    }

    function upgradeHub() internal {
        console2.log("\n[1/4] Upgrading IdentityVerificationHubImplV2...");
        console2.log("   Proxy address:", HUB_PROXY);

        // Upgrade the proxy to new implementation with governance
        Upgrades.upgradeProxy(
            HUB_PROXY,
            "IdentityVerificationHubImplV2.sol:IdentityVerificationHubImplV2",
            abi.encodeCall(IdentityVerificationHubImplV2.initializeGovernance, ())
        );

        console2.log("   Status: Upgraded successfully");

        // Verify governance roles
        IdentityVerificationHubImplV2 hub = IdentityVerificationHubImplV2(HUB_PROXY);
        require(hub.hasRole(CRITICAL_ROLE, msg.sender), "Deployer missing CRITICAL_ROLE");
        require(hub.hasRole(STANDARD_ROLE, msg.sender), "Deployer missing STANDARD_ROLE");
        console2.log("   Governance: Deployer has both roles");
    }

    function upgradePassportRegistry() internal {
        console2.log("\n[2/4] Upgrading IdentityRegistryImplV1 (Passport)...");
        console2.log("   Proxy address:", REGISTRY_PASSPORT_PROXY);

        Upgrades.upgradeProxy(
            REGISTRY_PASSPORT_PROXY,
            "registry/IdentityRegistryImplV1.sol:IdentityRegistryImplV1",
            abi.encodeCall(IdentityRegistryImplV1.initializeGovernance, ())
        );

        console2.log("   Status: Upgraded successfully");

        // Verify governance roles
        IdentityRegistryImplV1 registry = IdentityRegistryImplV1(REGISTRY_PASSPORT_PROXY);
        require(registry.hasRole(CRITICAL_ROLE, msg.sender), "Deployer missing CRITICAL_ROLE");
        require(registry.hasRole(STANDARD_ROLE, msg.sender), "Deployer missing STANDARD_ROLE");
        console2.log("   Governance: Deployer has both roles");
    }

    function upgradeIdCardRegistry() internal {
        console2.log("\n[3/4] Upgrading IdentityRegistryIdCardImplV1...");
        console2.log("   Proxy address:", REGISTRY_ID_CARD_PROXY);

        Upgrades.upgradeProxy(
            REGISTRY_ID_CARD_PROXY,
            "registry/IdentityRegistryIdCardImplV1.sol:IdentityRegistryIdCardImplV1",
            abi.encodeCall(IdentityRegistryIdCardImplV1.initializeGovernance, ())
        );

        console2.log("   Status: Upgraded successfully");

        // Verify governance roles
        IdentityRegistryIdCardImplV1 registry = IdentityRegistryIdCardImplV1(REGISTRY_ID_CARD_PROXY);
        require(registry.hasRole(CRITICAL_ROLE, msg.sender), "Deployer missing CRITICAL_ROLE");
        require(registry.hasRole(STANDARD_ROLE, msg.sender), "Deployer missing STANDARD_ROLE");
        console2.log("   Governance: Deployer has both roles");
    }

    function upgradeAadhaarRegistry() internal {
        console2.log("\n[4/4] Upgrading IdentityRegistryAadhaarImplV1...");
        console2.log("   Proxy address:", REGISTRY_AADHAAR_PROXY);

        Upgrades.upgradeProxy(
            REGISTRY_AADHAAR_PROXY,
            "registry/IdentityRegistryAadhaarImplV1.sol:IdentityRegistryAadhaarImplV1",
            abi.encodeCall(IdentityRegistryAadhaarImplV1.initializeGovernance, ())
        );

        console2.log("   Status: Upgraded successfully");

        // Verify governance roles
        IdentityRegistryAadhaarImplV1 registry = IdentityRegistryAadhaarImplV1(REGISTRY_AADHAAR_PROXY);
        require(registry.hasRole(CRITICAL_ROLE, msg.sender), "Deployer missing CRITICAL_ROLE");
        require(registry.hasRole(STANDARD_ROLE, msg.sender), "Deployer missing STANDARD_ROLE");
        console2.log("   Governance: Deployer has both roles");
    }
}
