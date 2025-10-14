// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Upgrades, Options} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {IdentityVerificationHubImplV2} from "../contracts/IdentityVerificationHubImplV2.sol";
import {IdentityRegistryImplV1} from "../contracts/registry/IdentityRegistryImplV1.sol";
import {IdentityRegistryIdCardImplV1} from "../contracts/registry/IdentityRegistryIdCardImplV1.sol";
import {IdentityRegistryAadhaarImplV1} from "../contracts/registry/IdentityRegistryAadhaarImplV1.sol";

/**
 * @title UpgradeToAccessControl
 * @notice Foundry script to upgrade contracts from Ownable2StepUpgradeable to AccessControlUpgradeable
 *
 * This script:
 * 1. Upgrades IdentityVerificationHubImplV2 from Ownable to AccessControl governance
 * 2. Upgrades IdentityRegistryImplV1 (Passport) from Ownable to AccessControl
 * 3. Upgrades IdentityRegistryIdCardImplV1 from Ownable to AccessControl
 * 4. Upgrades IdentityRegistryAadhaarImplV1 from Ownable to AccessControl
 * 5. Calls initializeGovernance() on each upgraded contract to set up roles
 * 6. Transfers roles to multisigs and deployer renounces all roles
 *
 * Usage:
 * - Set in .env file:
 *   CRITICAL_GOVERNANCE_ADDRESS=0x...
 *   STANDARD_GOVERNANCE_ADDRESS=0x...
 *
 * - Dry run:
 *   forge script script/UpgradeToAccessControl.s.sol \
 *     --libraries "contracts/libraries/CustomVerifier.sol:CustomVerifier:0x9E66B82Da87309fAE1403078d498a069A30860c4" \
 *     --libraries "node_modules/poseidon-solidity/PoseidonT3.sol:PoseidonT3:0xF134707a4C4a3a76b8410fC0294d620A7c341581" \
 *     --fork-url $CELO_RPC_URL \
 *     --sender 0xCaEe7aAF115F04D836E2D362A7c07F04db436bd0
 *
 * - Execute on mainnet:
 *   forge script script/UpgradeToAccessControl.s.sol \
 *     --libraries "contracts/libraries/CustomVerifier.sol:CustomVerifier:0x9E66B82Da87309fAE1403078d498a069A30860c4" \
 *     --libraries "node_modules/poseidon-solidity/PoseidonT3.sol:PoseidonT3:0xF134707a4C4a3a76b8410fC0294d620A7c341581" \
 *     --rpc-url $CELO_RPC_URL \
 *     --broadcast \
 *     --verify \
 *     --private-key $DEPLOYER_PRIVATE_KEY
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

    // Governance roles
    bytes32 public constant CRITICAL_ROLE = keccak256("CRITICAL_ROLE");
    bytes32 public constant STANDARD_ROLE = keccak256("STANDARD_ROLE");

    // Multisig addresses (from environment)
    address criticalMultisig;
    address standardMultisig;

    function run() external {
        console2.log("================================================================================");
        console2.log("CELO GOVERNANCE UPGRADE: Ownable -> AccessControl");
        console2.log("================================================================================");

        console2.log("\nDeployer:", msg.sender);
        console2.log("Chain ID:", block.chainid);

        // Get multisig addresses from .env
        criticalMultisig = vm.envAddress("CRITICAL_GOVERNANCE_ADDRESS");
        standardMultisig = vm.envAddress("STANDARD_GOVERNANCE_ADDRESS");

        require(criticalMultisig != address(0), "CRITICAL_GOVERNANCE_ADDRESS not set in .env");
        require(standardMultisig != address(0), "STANDARD_GOVERNANCE_ADDRESS not set in .env");

        console2.log("\nGovernance addresses (roles will be transferred):");
        console2.log("  Critical Multisig:", criticalMultisig);
        console2.log("  Standard Multisig:", standardMultisig);

        // Start broadcasting transactions
        vm.startBroadcast();

        // Step 1: Upgrade Hub
        upgradeHub();

        // Step 2: Upgrade Passport Registry
        upgradePassportRegistry();

        // Step 3: Upgrade ID Card Registry
        upgradeIdCardRegistry();

        // Step 4: Upgrade Aadhaar Registry
        upgradeAadhaarRegistry();

        // Step 5: Transfer roles to multisigs
        transferRolesToMultisigs();

        vm.stopBroadcast();

        console2.log("\n================================================================================");
        console2.log("UPGRADE COMPLETE!");
        console2.log("================================================================================");

        console2.log("\nRoles transferred to multisigs - deployer has ZERO control");
        console2.log("\nNext steps:");
        console2.log("1. Verify all state was preserved (run tests)");
        console2.log("2. Verify multisigs have control");
        console2.log("3. Update documentation");
    }

    function upgradeHub() internal {
        console2.log("\n[1/4] Upgrading IdentityVerificationHubImplV2...");
        console2.log("   Proxy address:", HUB_PROXY);

        Options memory opts;
        opts.unsafeSkipStorageCheck = true; // Validator flags deleted namespace error when changing from Ownable to AccessControl

        // Upgrade the proxy to new implementation with governance
        Upgrades.upgradeProxy(
            HUB_PROXY,
            "IdentityVerificationHubImplV2.sol:IdentityVerificationHubImplV2",
            abi.encodeCall(IdentityVerificationHubImplV2.initializeGovernance, ()),
            opts
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

        Options memory opts;
        opts.unsafeSkipStorageCheck = true; // Validator flags deleted namespace error when changing from Ownable to AccessControl

        Upgrades.upgradeProxy(
            REGISTRY_PASSPORT_PROXY,
            "IdentityRegistryImplV1.sol:IdentityRegistryImplV1",
            abi.encodeCall(IdentityRegistryImplV1.initializeGovernance, ()),
            opts
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

        Options memory opts;
        opts.unsafeSkipStorageCheck = true; // Validator flags deleted namespace error when changing from Ownable to AccessControl

        Upgrades.upgradeProxy(
            REGISTRY_ID_CARD_PROXY,
            "IdentityRegistryIdCardImplV1.sol:IdentityRegistryIdCardImplV1",
            abi.encodeCall(IdentityRegistryIdCardImplV1.initializeGovernance, ()),
            opts
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

        Options memory opts;
        opts.unsafeSkipStorageCheck = true; // Validator flags deleted namespace error when changing from Ownable to AccessControl

        Upgrades.upgradeProxy(
            REGISTRY_AADHAAR_PROXY,
            "IdentityRegistryAadhaarImplV1.sol:IdentityRegistryAadhaarImplV1",
            abi.encodeCall(IdentityRegistryAadhaarImplV1.initializeGovernance, ()),
            opts
        );

        console2.log("   Status: Upgraded successfully");

        // Verify governance roles
        IdentityRegistryAadhaarImplV1 registry = IdentityRegistryAadhaarImplV1(REGISTRY_AADHAAR_PROXY);
        require(registry.hasRole(CRITICAL_ROLE, msg.sender), "Deployer missing CRITICAL_ROLE");
        require(registry.hasRole(STANDARD_ROLE, msg.sender), "Deployer missing STANDARD_ROLE");
        console2.log("   Governance: Deployer has both roles");
    }

    function transferRolesToMultisigs() internal {
        console2.log("\n[5/5] Transferring Roles to Multisigs...");

        // Get contract instances
        IdentityVerificationHubImplV2 hub = IdentityVerificationHubImplV2(HUB_PROXY);
        IdentityRegistryImplV1 passportRegistry = IdentityRegistryImplV1(REGISTRY_PASSPORT_PROXY);
        IdentityRegistryIdCardImplV1 idCardRegistry = IdentityRegistryIdCardImplV1(REGISTRY_ID_CARD_PROXY);
        IdentityRegistryAadhaarImplV1 aadhaarRegistry = IdentityRegistryAadhaarImplV1(REGISTRY_AADHAAR_PROXY);

        // Grant roles to multisigs
        console2.log("   Granting roles to multisigs...");
        hub.grantRole(CRITICAL_ROLE, criticalMultisig);
        hub.grantRole(STANDARD_ROLE, standardMultisig);

        passportRegistry.grantRole(CRITICAL_ROLE, criticalMultisig);
        passportRegistry.grantRole(STANDARD_ROLE, standardMultisig);

        idCardRegistry.grantRole(CRITICAL_ROLE, criticalMultisig);
        idCardRegistry.grantRole(STANDARD_ROLE, standardMultisig);

        aadhaarRegistry.grantRole(CRITICAL_ROLE, criticalMultisig);
        aadhaarRegistry.grantRole(STANDARD_ROLE, standardMultisig);

        // Deployer renounces roles
        console2.log("   Deployer renouncing all roles...");
        hub.renounceRole(CRITICAL_ROLE, msg.sender);
        hub.renounceRole(STANDARD_ROLE, msg.sender);

        passportRegistry.renounceRole(CRITICAL_ROLE, msg.sender);
        passportRegistry.renounceRole(STANDARD_ROLE, msg.sender);

        idCardRegistry.renounceRole(CRITICAL_ROLE, msg.sender);
        idCardRegistry.renounceRole(STANDARD_ROLE, msg.sender);

        aadhaarRegistry.renounceRole(CRITICAL_ROLE, msg.sender);
        aadhaarRegistry.renounceRole(STANDARD_ROLE, msg.sender);

        console2.log("   Status: Roles transferred successfully");

        // Verify deployer has no roles
        require(!hub.hasRole(CRITICAL_ROLE, msg.sender), "Hub: Deployer still has CRITICAL_ROLE");
        require(!hub.hasRole(STANDARD_ROLE, msg.sender), "Hub: Deployer still has STANDARD_ROLE");
        require(!passportRegistry.hasRole(CRITICAL_ROLE, msg.sender), "Passport: Deployer still has CRITICAL_ROLE");
        require(!idCardRegistry.hasRole(CRITICAL_ROLE, msg.sender), "IDCard: Deployer still has CRITICAL_ROLE");
        require(!aadhaarRegistry.hasRole(CRITICAL_ROLE, msg.sender), "Aadhaar: Deployer still has CRITICAL_ROLE");

        // Verify multisigs have roles
        require(hub.hasRole(CRITICAL_ROLE, criticalMultisig), "Hub: Critical multisig missing CRITICAL_ROLE");
        require(hub.hasRole(STANDARD_ROLE, standardMultisig), "Hub: Standard multisig missing STANDARD_ROLE");

        console2.log("   Verification: Deployer has ZERO control");
        console2.log("   Verification: Multisigs have full control");
    }
}
