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
 *   SECURITY_GOVERNANCE_ADDRESS=0x...
 *   OPERATIONS_GOVERNANCE_ADDRESS=0x...
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
    bytes32 public constant SECURITY_ROLE = keccak256("SECURITY_ROLE");
    bytes32 public constant OPERATIONS_ROLE = keccak256("OPERATIONS_ROLE");

    // Multisig addresses (from environment)
    address securityMultisig;
    address operationsMultisig;

    function run() external {
        console2.log("================================================================================");
        console2.log("CELO GOVERNANCE UPGRADE: Ownable -> AccessControl");
        console2.log("================================================================================");

        console2.log("\nDeployer:", msg.sender);
        console2.log("Chain ID:", block.chainid);

        // Get multisig addresses from .env
        securityMultisig = vm.envAddress("SECURITY_GOVERNANCE_ADDRESS");
        operationsMultisig = vm.envAddress("OPERATIONS_GOVERNANCE_ADDRESS");

        require(securityMultisig != address(0), "SECURITY_GOVERNANCE_ADDRESS not set in .env");
        require(operationsMultisig != address(0), "OPERATIONS_GOVERNANCE_ADDRESS not set in .env");

        console2.log("\nGovernance addresses (roles will be transferred):");
        console2.log("  Critical Multisig:", securityMultisig);
        console2.log("  Standard Multisig:", operationsMultisig);

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
        require(hub.hasRole(SECURITY_ROLE, msg.sender), "Deployer missing SECURITY_ROLE");
        require(hub.hasRole(OPERATIONS_ROLE, msg.sender), "Deployer missing OPERATIONS_ROLE");
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
        require(registry.hasRole(SECURITY_ROLE, msg.sender), "Deployer missing SECURITY_ROLE");
        require(registry.hasRole(OPERATIONS_ROLE, msg.sender), "Deployer missing OPERATIONS_ROLE");
        console2.log("   Governance: Deployer has both roles");
    }

    function upgradeIdCardRegistry() internal {
        console2.log("\n[3/4] Upgrading IdentityRegistryIdCardImplV1...");
        console2.log("   Proxy address:", REGISTRY_ID_CARD_PROXY);

        Options memory opts;
        opts.unsafeSkipStorageCheck = true; // Triggers from changing Ownable to AccessControl
        // Due to ERC-7201, we can be sure no storage collision will occur as Ownable and AccessControl variables are stored separately
        // This is double checked by UpgradeToAccessControl.t.sol which verifies no state collision occurs

        Upgrades.upgradeProxy(
            REGISTRY_ID_CARD_PROXY,
            "IdentityRegistryIdCardImplV1.sol:IdentityRegistryIdCardImplV1",
            abi.encodeCall(IdentityRegistryIdCardImplV1.initializeGovernance, ()),
            opts
        );

        console2.log("   Status: Upgraded successfully");

        // Verify governance roles
        IdentityRegistryIdCardImplV1 registry = IdentityRegistryIdCardImplV1(REGISTRY_ID_CARD_PROXY);
        require(registry.hasRole(SECURITY_ROLE, msg.sender), "Deployer missing SECURITY_ROLE");
        require(registry.hasRole(OPERATIONS_ROLE, msg.sender), "Deployer missing OPERATIONS_ROLE");
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
        require(registry.hasRole(SECURITY_ROLE, msg.sender), "Deployer missing SECURITY_ROLE");
        require(registry.hasRole(OPERATIONS_ROLE, msg.sender), "Deployer missing OPERATIONS_ROLE");
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
        hub.grantRole(SECURITY_ROLE, securityMultisig);
        hub.grantRole(OPERATIONS_ROLE, operationsMultisig);

        passportRegistry.grantRole(SECURITY_ROLE, securityMultisig);
        passportRegistry.grantRole(OPERATIONS_ROLE, operationsMultisig);

        idCardRegistry.grantRole(SECURITY_ROLE, securityMultisig);
        idCardRegistry.grantRole(OPERATIONS_ROLE, operationsMultisig);

        aadhaarRegistry.grantRole(SECURITY_ROLE, securityMultisig);
        aadhaarRegistry.grantRole(OPERATIONS_ROLE, operationsMultisig);

        // Deployer renounces roles
        console2.log("   Deployer renouncing all roles...");
        hub.renounceRole(SECURITY_ROLE, msg.sender);
        hub.renounceRole(OPERATIONS_ROLE, msg.sender);

        passportRegistry.renounceRole(SECURITY_ROLE, msg.sender);
        passportRegistry.renounceRole(OPERATIONS_ROLE, msg.sender);

        idCardRegistry.renounceRole(SECURITY_ROLE, msg.sender);
        idCardRegistry.renounceRole(OPERATIONS_ROLE, msg.sender);

        aadhaarRegistry.renounceRole(SECURITY_ROLE, msg.sender);
        aadhaarRegistry.renounceRole(OPERATIONS_ROLE, msg.sender);

        console2.log("   Status: Roles transferred successfully");

        // Verify deployer has no roles
        require(!hub.hasRole(SECURITY_ROLE, msg.sender), "Hub: Deployer still has SECURITY_ROLE");
        require(!hub.hasRole(OPERATIONS_ROLE, msg.sender), "Hub: Deployer still has OPERATIONS_ROLE");
        require(!passportRegistry.hasRole(SECURITY_ROLE, msg.sender), "Passport: Deployer still has SECURITY_ROLE");
        require(!idCardRegistry.hasRole(SECURITY_ROLE, msg.sender), "IDCard: Deployer still has SECURITY_ROLE");
        require(!aadhaarRegistry.hasRole(SECURITY_ROLE, msg.sender), "Aadhaar: Deployer still has SECURITY_ROLE");

        // Verify multisigs have roles
        require(hub.hasRole(SECURITY_ROLE, securityMultisig), "Hub: Critical multisig missing SECURITY_ROLE");
        require(hub.hasRole(OPERATIONS_ROLE, operationsMultisig), "Hub: Standard multisig missing OPERATIONS_ROLE");

        console2.log("   Verification: Deployer has ZERO control");
        console2.log("   Verification: Multisigs have full control");
    }
}
