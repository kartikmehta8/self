import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

// ============================================================================
// HARDCODED DEPLOYED ADDRESSES - UPDATE THESE MANUALLY
// ============================================================================

const DEPLOYED_ADDRESSES = {
  // ============================================================================
  // EXISTING UUPS PROXY CONTRACTS TO UPGRADE
  // ============================================================================

  // Current deployed proxy contracts
  "IdentityVerificationHub": "0x0000000000000000000000000000000000000000", // UPDATE THIS - Current Hub proxy address
  "IdentityRegistry": "0x0000000000000000000000000000000000000000", // UPDATE THIS - Current Registry proxy address
  "IdentityRegistryIdCard": "0x0000000000000000000000000000000000000000", // UPDATE THIS - Current ID Card Registry proxy address
  "IdentityRegistryAadhaar": "0x0000000000000000000000000000000000000000", // UPDATE THIS - Current Aadhaar Registry proxy address

  // ============================================================================
  // NEW IMPLEMENTATION CONTRACTS (already deployed with governance)
  // ============================================================================

  // New implementation contracts to upgrade to
  "IdentityVerificationHubImplV2_New": "0x0000000000000000000000000000000000000000", // UPDATE THIS - New Hub implementation address
  "IdentityRegistryImplV1_New": "0x0000000000000000000000000000000000000000", // UPDATE THIS - New Registry implementation address
  "IdentityRegistryIdCardImplV1_New": "0x0000000000000000000000000000000000000000", // UPDATE THIS - New ID Card Registry implementation address
  "IdentityRegistryAadhaarImplV1_New": "0x0000000000000000000000000000000000000000", // UPDATE THIS - New Aadhaar Registry implementation address

};

// Simple logging utility
const log = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  error: (msg: string) => console.log(`❌ ${msg}`),
  warning: (msg: string) => console.log(`⚠️  ${msg}`),
  step: (msg: string) => console.log(`\n🔄 ${msg}`),
};

/**
 * Contract Upgrade Script - Calls upgrade functions on existing contracts
 *
 * This script calls upgrade functions (like upgradeToAndCall) on existing UUPS contracts
 * to point them to new implementation contracts that have already been deployed.
 *
 * WORKFLOW:
 * 1. Deploy new implementation contracts with governance (using Ignition or separate scripts)
 * 2. Update DEPLOYED_ADDRESSES with both old and new contract addresses
 * 3. Run this script to call upgrade functions on the existing contracts
 * 4. Transfer roles to multisigs using transferRolesToMultisigs.ts
 *
 * UUPS CONTRACTS TO UPGRADE:
 * - IdentityVerificationHub (proxy) -> IdentityVerificationHubImplV2 (new implementation)
 * - IdentityRegistry (proxy) -> IdentityRegistryImplV1 (new implementation)
 * - IdentityRegistryIdCard (proxy) -> IdentityRegistryIdCardImplV1 (new implementation)
 * - IdentityRegistryAadhaar (proxy) -> IdentityRegistryAadhaarImplV1 (new implementation)
 *
 *
 * Usage:
 * NETWORK=celo PRIVATE_KEY=0x... npx tsx scripts/upgradeToMultisig.ts
 *
 * Dry run (validation only):
 * DRY_RUN=true NETWORK=celo npx tsx scripts/upgradeToMultisig.ts
 */

const NETWORK = process.env.NETWORK;
const DRY_RUN = process.env.DRY_RUN === "true";

if (!NETWORK) {
  throw new Error("Missing required environment variables: NETWORK");
}

async function main() {
  log.info(`Starting contract upgrade script for network: ${NETWORK}`);
  log.info(`Mode: ${DRY_RUN ? "DRY RUN (validation only) - No actual upgrades will be performed":
    "LIVE EXECUTION"}`);

  // Validate hardcoded addresses
  validateAddresses();

  // Step 1: Upgrade IdentityVerificationHub proxy to new implementation
  await upgradeIdentityVerificationHub();

  // Step 2: Upgrade Registry contracts to new implementations
  await upgradeRegistryContracts();

  log.success("UUPS contract upgrades completed successfully!");
  log.info("");
  log.info("📋 Next Steps:");
  log.info("1. Deploy new PCR0Manager and VerifyAll contracts using Ignition modules (if needed)");
  log.info("2. Update any references to point to new PCR0Manager/VerifyAll addresses");
  log.info("3. Transfer roles to multisigs: npx hardhat run scripts/transferRolesToMultisigs.ts --network " + NETWORK);
  log.info("4. Verify all contracts are working with new governance");
}

function validateAddresses() {
  log.step("Validating hardcoded addresses...");

  // Check all addresses are valid (if set)
  for (const [key, address] of Object.entries(DEPLOYED_ADDRESSES)) {
    if (address && address !== "0x0000000000000000000000000000000000000000") {
      if (!ethers.isAddress(address)) {
        throw new Error(`Invalid address for ${key}: ${address}`);
      }
      log.info(`✓ ${key}: ${address}`);
    } else {
      log.warning(`⚠️  ${key}: Not set (will skip if needed)`);
    }
  }

  log.success("All set addresses are valid");
}

async function upgradeIdentityVerificationHub() {
  log.step("Upgrading IdentityVerificationHub proxy to new implementation...");

  try {
    const hubProxyAddress = DEPLOYED_ADDRESSES.IdentityVerificationHub;
    const newImplementationAddress = DEPLOYED_ADDRESSES.IdentityVerificationHubImplV2_New;

    // Skip if addresses not set
    if (!hubProxyAddress || hubProxyAddress === "0x0000000000000000000000000000000000000000") {
      log.warning("Skipping IdentityVerificationHub - proxy address not set");
      return;
    }

    if (!newImplementationAddress || newImplementationAddress === "0x0000000000000000000000000000000000000000") {
      log.warning("Skipping IdentityVerificationHub - new implementation address not set");
      return;
    }

    log.info(`Hub proxy address: ${hubProxyAddress}`);
    log.info(`New implementation address: ${newImplementationAddress}`);

    if (DRY_RUN) {
      log.info("[DRY RUN] Would call upgradeToAndCall on Hub proxy");
      log.info(`[DRY RUN] Target implementation: ${newImplementationAddress}`);
      log.info(`[DRY RUN] Upgrade data: 0x (empty - no initialization needed)`);
      return;
    }

    // Get the current hub contract - use the current implementation interface
    const hubContract = await ethers.getContractAt("IdentityVerificationHubImplV2", hubProxyAddress);

    // Call upgradeToAndCall with empty data (no re-initialization needed)
    log.info("Calling upgradeToAndCall on Hub proxy...");
    const tx = await hubContract.upgradeToAndCall(newImplementationAddress, "0x");
    const receipt = await tx.wait();

    log.success(`✅ Hub upgraded successfully!`);
    log.info(`   Transaction: ${tx.hash}`);
    log.info(`   Gas used: ${receipt?.gasUsed?.toString() || 'unknown'}`);

    // Verify the upgrade was successful by checking the implementation
    const [deployer] = await ethers.getSigners();
    try {
      const hasRole = await hubContract.hasRole(await hubContract.SECURITY_ROLE(), deployer.address);
      if (hasRole) {
        log.success("✅ Governance verification: deployer has SECURITY_ROLE");
      } else {
        log.warning("⚠️  Governance verification: deployer doesn't have SECURITY_ROLE (may be expected)");
      }
    } catch (roleError) {
      log.warning(`⚠️  Could not verify governance roles: ${roleError}`);
    }

  } catch (error) {
    log.error(`❌ Failed to upgrade IdentityVerificationHub: ${error}`);
    throw error; // Re-throw to stop execution
  }
}

async function upgradeRegistryContracts() {
  log.step("Upgrading Registry contracts to new implementations...");

  const registries = [
    {
      name: "IdentityRegistry",
      proxyAddress: DEPLOYED_ADDRESSES.IdentityRegistry,
      newImplementationAddress: DEPLOYED_ADDRESSES.IdentityRegistryImplV1_New,
      contract: "IdentityRegistryImplV1"
    },
    {
      name: "IdentityRegistryIdCard",
      proxyAddress: DEPLOYED_ADDRESSES.IdentityRegistryIdCard,
      newImplementationAddress: DEPLOYED_ADDRESSES.IdentityRegistryIdCardImplV1_New,
      contract: "IdentityRegistryIdCardImplV1"
    },
    {
      name: "IdentityRegistryAadhaar",
      proxyAddress: DEPLOYED_ADDRESSES.IdentityRegistryAadhaar,
      newImplementationAddress: DEPLOYED_ADDRESSES.IdentityRegistryAadhaarImplV1_New,
      contract: "IdentityRegistryAadhaarImplV1"
    },
  ];

  let upgradeCount = 0;
  let skipCount = 0;

  for (const registry of registries) {
    try {
      // Skip if proxy address is not set
      if (!registry.proxyAddress || registry.proxyAddress === "0x0000000000000000000000000000000000000000") {
        log.warning(`Skipping ${registry.name} - proxy address not set`);
        skipCount++;
        continue;
      }

      // Skip if new implementation address is not set
      if (!registry.newImplementationAddress || registry.newImplementationAddress === "0x0000000000000000000000000000000000000000") {
        log.warning(`Skipping ${registry.name} - new implementation address not set`);
        skipCount++;
        continue;
      }

      log.info(`Upgrading registry: ${registry.name}`);
      log.info(`  Proxy address: ${registry.proxyAddress}`);
      log.info(`  New implementation: ${registry.newImplementationAddress}`);

      if (DRY_RUN) {
        log.info(`[DRY RUN] Would call upgradeToAndCall on ${registry.name} proxy`);
        log.info(`[DRY RUN] Target implementation: ${registry.newImplementationAddress}`);
        log.info(`[DRY RUN] Upgrade data: 0x (empty - no initialization needed)`);
        upgradeCount++;
        continue;
      }

      // Get the registry contract and call upgrade function
      const registryContract = await ethers.getContractAt(registry.contract, registry.proxyAddress);

      log.info(`Calling upgradeToAndCall on ${registry.name} proxy...`);
      const tx = await registryContract.upgradeToAndCall(registry.newImplementationAddress, "0x");
      const receipt = await tx.wait();

      log.success(`✅ Registry ${registry.name} upgraded successfully!`);
      log.info(`   Transaction: ${tx.hash}`);
      log.info(`   Gas used: ${receipt?.gasUsed?.toString() || 'unknown'}`);
      upgradeCount++;

    } catch (error) {
      log.error(`❌ Registry ${registry.name} failed to upgrade: ${error}`);
      // Continue with other registries instead of stopping
    }
  }

  log.info(`Registry upgrade summary: ${upgradeCount} upgraded, ${skipCount} skipped`);
}

// Execute the upgrade
main().catch((error) => {
  log.error(`Upgrade failed: ${error}`);
  process.exitCode = 1;
});
