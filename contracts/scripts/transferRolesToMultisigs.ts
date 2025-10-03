import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

// ============================================================================
// HARDCODED DEPLOYED ADDRESSES - UPDATE THESE MANUALLY
// ============================================================================

/**
 * Role Transfer Script
 *
 * This script transfers roles from the deployer to the multisig addresses
 * for all governance-enabled contracts.
 *
 * Note: Must update .env with the CRITICAL_MULTISIG and STANDARD_MULTISIG addresses
 */

const DEPLOYED_ADDRESSES = {
  // Hub contracts
  "IdentityVerificationHub": "0x0000000000000000000000000000000000000000", // UPDATE THIS

  // Registry contracts
  "IdentityRegistry": "0x0000000000000000000000000000000000000000", // UPDATE THIS
  "IdentityRegistryIdCard": "0x0000000000000000000000000000000000000000", // UPDATE THIS
  "IdentityRegistryAadhaar": "0x0000000000000000000000000000000000000000", // UPDATE THIS

  // Utility contracts
  "PCR0Manager": "0x0000000000000000000000000000000000000000", // UPDATE THIS
  "VerifyAll": "0x0000000000000000000000000000000000000000", // UPDATE THIS
};

// Simple logging utility
const log = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  error: (msg: string) => console.log(`❌ ${msg}`),
  warning: (msg: string) => console.log(`⚠️  ${msg}`),
  step: (msg: string) => console.log(`\n🔄 ${msg}`),
  header: (msg: string) => console.log(`\n🎯 ${msg}`),
};

const NETWORK = process.env.NETWORK;
const CRITICAL_MULTISIG = process.env.CRITICAL_MULTISIG;
const STANDARD_MULTISIG = process.env.STANDARD_MULTISIG;
const DRY_RUN = process.env.DRY_RUN === "true";

/**
 * Role Transfer Script
 *
 * This script transfers roles from the deployer to the multisig addresses
 * for all governance-enabled contracts.
 */

async function main() {
  log.header("🔄 Role Transfer to Multisigs");
  log.info(`Network: ${NETWORK}`);
  log.info(`Critical Multisig: ${CRITICAL_MULTISIG}`);
  log.info(`Standard Multisig: ${STANDARD_MULTISIG}`);
  log.info(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE EXECUTION"}`);
  log.info("");

  if (!CRITICAL_MULTISIG || !STANDARD_MULTISIG) {
    throw new Error("CRITICAL_MULTISIG and STANDARD_MULTISIG must be set in environment variables");
  }

  if (!ethers.isAddress(CRITICAL_MULTISIG) || !ethers.isAddress(STANDARD_MULTISIG)) {
    throw new Error("Invalid multisig addresses");
  }

  const [deployer] = await ethers.getSigners();
  log.info(`Deployer: ${deployer.address}`);
  log.info("");

  // Validate addresses
  validateAddresses();

  // Transfer roles for upgradeable contracts (Hub and Registry)
  await transferUpgradeableContractRoles();

  // Transfer roles for utility contracts
  await transferUtilityContractRoles();

  log.success("🎉 Role transfer completed successfully!");
}

function validateAddresses() {
  log.step("Validating hardcoded addresses...");

  for (const [name, address] of Object.entries(DEPLOYED_ADDRESSES)) {
    if (address && address !== "0x0000000000000000000000000000000000000000") {
      if (!ethers.isAddress(address)) {
        throw new Error(`Invalid address for ${name}: ${address}`);
      }
      log.info(`✓ ${name}: ${address}`);
    } else {
      log.warning(`⚠️  ${name}: Not set (will skip)`);
    }
  }
}

async function transferUpgradeableContractRoles() {
  log.step("Transferring roles for upgradeable contracts...");

  // Hub contracts
  const hubs = [
    { name: "IdentityVerificationHub", address: DEPLOYED_ADDRESSES.IdentityVerificationHub, contract: "IdentityVerificationHubImplV2" },
  ];

  for (const hub of hubs) {
    try {
      if (!hub.address || hub.address === "0x0000000000000000000000000000000000000000") {
        log.warning(`Skipping ${hub.name} - address not set`);
        continue;
      }

      log.info(`Transferring roles for ${hub.name} at ${hub.address}...`);
      const hubContract = await ethers.getContractAt(hub.contract, hub.address);
      await transferRolesForContract(hubContract, hub.name);
    } catch (error) {
      log.error(`Failed to transfer roles for ${hub.name}: ${error}`);
    }
  }

  // Registry contracts
  const registries = [
    { name: "IdentityRegistry", address: DEPLOYED_ADDRESSES.IdentityRegistry, contract: "IdentityRegistryImplV1" },
    { name: "IdentityRegistryIdCard", address: DEPLOYED_ADDRESSES.IdentityRegistryIdCard, contract: "IdentityRegistryIdCardImplV1" },
    { name: "IdentityRegistryAadhaar", address: DEPLOYED_ADDRESSES.IdentityRegistryAadhaar, contract: "IdentityRegistryAadhaarImplV1" },
  ];

  for (const registry of registries) {
    try {
      if (!registry.address || registry.address === "0x0000000000000000000000000000000000000000") {
        log.warning(`Skipping ${registry.name} - address not set`);
        continue;
      }

      log.info(`Transferring roles for ${registry.name} at ${registry.address}...`);
      const registryContract = await ethers.getContractAt(registry.contract, registry.address);
      await transferRolesForContract(registryContract, registry.name);
    } catch (error) {
      log.error(`Failed to transfer roles for ${registry.name}: ${error}`);
    }
  }
}

async function transferUtilityContractRoles() {
  log.step("Transferring roles for utility contracts...");

  const utilities = [
    { name: "PCR0Manager", address: DEPLOYED_ADDRESSES.PCR0Manager, contract: "PCR0Manager" },
    { name: "VerifyAll", address: DEPLOYED_ADDRESSES.VerifyAll, contract: "VerifyAll" },
  ];

  for (const utility of utilities) {
    try {
      if (!utility.address || utility.address === "0x0000000000000000000000000000000000000000") {
        log.warning(`Skipping ${utility.name} - address not set`);
        continue;
      }

      log.info(`Transferring roles for ${utility.name} at ${utility.address}...`);
      const contract = await ethers.getContractAt(utility.contract, utility.address);
      await transferRolesForContract(contract, utility.name);
    } catch (error) {
      log.error(`Failed to transfer roles for ${utility.name}: ${error}`);
    }
  }
}

async function transferRolesForContract(contract: any, contractName: string) {
  const [deployer] = await ethers.getSigners();

  const CRITICAL_ROLE = await contract.CRITICAL_ROLE();
  const STANDARD_ROLE = await contract.STANDARD_ROLE();

  // Check current roles
  const deployerHasCritical = await contract.hasRole(CRITICAL_ROLE, deployer.address);
  const deployerHasStandard = await contract.hasRole(STANDARD_ROLE, deployer.address);

  if (!deployerHasCritical || !deployerHasStandard) {
    log.warning(`⚠️  Deployer doesn't have all roles for ${contractName}, skipping...`);
    return;
  }

  if (DRY_RUN) {
    log.info(`[DRY RUN] Would grant CRITICAL_ROLE to ${CRITICAL_MULTISIG}`);
    log.info(`[DRY RUN] Would grant STANDARD_ROLE to ${STANDARD_MULTISIG}`);
    log.info(`[DRY RUN] Would renounce deployer roles`);
    return;
  }

  // Grant roles to multisigs
  log.info(`Granting CRITICAL_ROLE to ${CRITICAL_MULTISIG}...`);
  await contract.connect(deployer).grantRole(CRITICAL_ROLE, CRITICAL_MULTISIG);

  log.info(`Granting STANDARD_ROLE to ${STANDARD_MULTISIG}...`);
  await contract.connect(deployer).grantRole(STANDARD_ROLE, STANDARD_MULTISIG);

  // Verify roles were granted
  const criticalGranted = await contract.hasRole(CRITICAL_ROLE, CRITICAL_MULTISIG);
  const standardGranted = await contract.hasRole(STANDARD_ROLE, STANDARD_MULTISIG);

  if (!criticalGranted || !standardGranted) {
    throw new Error(`Failed to grant roles to multisigs for ${contractName}`);
  }

  // Renounce deployer roles
  log.info(`Renouncing deployer roles...`);
  await contract.connect(deployer).renounceRole(CRITICAL_ROLE, deployer.address);
  await contract.connect(deployer).renounceRole(STANDARD_ROLE, deployer.address);

  // Verify roles were renounced
  const deployerStillHasCritical = await contract.hasRole(CRITICAL_ROLE, deployer.address);
  const deployerStillHasStandard = await contract.hasRole(STANDARD_ROLE, deployer.address);

  if (deployerStillHasCritical || deployerStillHasStandard) {
    throw new Error(`Failed to renounce deployer roles for ${contractName}`);
  }

  log.success(`✅ ${contractName} roles successfully transferred to multisigs`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
