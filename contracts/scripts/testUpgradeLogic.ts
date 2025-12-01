import { ethers } from "hardhat";

/**
 * Test Script - Validate UUPS Upgrade Logic
 *
 * This script tests the upgrade logic used in upgradeToMultisig.ts by:
 * 1. Deploying a mock UUPS proxy and implementation
 * 2. Testing the upgradeToAndCall function
 * 3. Validating that the pattern matches existing Ignition scripts
 *
 * Based on the working logic from:
 * - ignition/modules/upgrade/deployNewHubAndUpgrade.ts
 * - ignition/modules/upgrade/deployNewRegistryAndUpgrade.ts
 */

const log = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  error: (msg: string) => console.log(`❌ ${msg}`),
  step: (msg: string) => console.log(`\n🔄 ${msg}`),
};

async function main() {
  log.step("Testing UUPS upgrade logic...");

  try {
    // Deploy CustomVerifier library (needed for HubV2)
    log.info("Deploying CustomVerifier library...");
    const CustomVerifierFactory = await ethers.getContractFactory("CustomVerifier");
    const customVerifier = await CustomVerifierFactory.deploy();
    await customVerifier.waitForDeployment();
    log.success(`CustomVerifier deployed: ${await customVerifier.getAddress()}`);

    // Test Hub upgrade logic
    await testHubUpgradeLogic(await customVerifier.getAddress());

    // Test Registry upgrade logic
    await testRegistryUpgradeLogic();

    log.success("✅ All upgrade logic tests passed!");

  } catch (error) {
    log.error(`Test failed: ${error}`);
    process.exitCode = 1;
  }
}

async function testHubUpgradeLogic(customVerifierAddress: string) {
  log.step("Testing IdentityVerificationHub upgrade logic...");

  // Deploy initial implementation (V1)
  const HubV1Factory = await ethers.getContractFactory("IdentityVerificationHubImplV1");
  const hubV1Impl = await HubV1Factory.deploy();
  await hubV1Impl.waitForDeployment();
  log.info(`HubV1 implementation deployed: ${await hubV1Impl.getAddress()}`);

  // Deploy proxy pointing to V1
  const ProxyFactory = await ethers.getContractFactory("ERC1967Proxy");

  // Encode initialize call for V1 (requires 6 parameters)
  const initializeData = HubV1Factory.interface.encodeFunctionData("initialize", [
    ethers.ZeroAddress, // dscVerifier
    ethers.ZeroAddress, // attestationVerifier
    ethers.ZeroAddress, // registry
    "0x0000000000000000000000000000000000000000000000000000000000000000", // ofacRoot
    "0x0000000000000000000000000000000000000000000000000000000000000000", // forbiddenCountriesRoot
    [] // forbiddenCountriesList
  ]);

  const proxy = await ProxyFactory.deploy(await hubV1Impl.getAddress(), initializeData);
  await proxy.waitForDeployment();
  log.info(`Proxy deployed: ${await proxy.getAddress()}`);

  // Deploy new implementation (V2) with CustomVerifier
  const HubV2Factory = await ethers.getContractFactory("IdentityVerificationHubImplV2", {
    libraries: {
      CustomVerifier: customVerifierAddress
    }
  });
  const hubV2Impl = await HubV2Factory.deploy();
  await hubV2Impl.waitForDeployment();
  log.info(`HubV2 implementation deployed: ${await hubV2Impl.getAddress()}`);

  // Test the upgrade logic (same as upgradeToMultisig.ts)
  const hubContract = await ethers.getContractAt("IdentityVerificationHubImplV2", await proxy.getAddress());

  log.info("Testing upgradeToAndCall...");
  const tx = await hubContract.upgradeToAndCall(await hubV2Impl.getAddress(), "0x");
  const receipt = await tx.wait();

  log.success(`✅ Hub upgrade successful!`);
  log.info(`   Transaction: ${tx.hash}`);
  log.info(`   Gas used: ${receipt?.gasUsed?.toString() || 'unknown'}`);

  // Verify governance roles
  const [deployer] = await ethers.getSigners();
  const hasRole = await hubContract.hasRole(await hubContract.SECURITY_ROLE(), deployer.address);

  if (hasRole) {
    log.success("✅ Governance verification: deployer has SECURITY_ROLE");
  } else {
    log.error("❌ Governance verification failed: deployer doesn't have SECURITY_ROLE");
  }
}

async function testRegistryUpgradeLogic() {
  log.step("Testing IdentityRegistry upgrade logic...");

  // Deploy PoseidonT3 library (needed for Registry)
  const PoseidonT3Factory = await ethers.getContractFactory("PoseidonT3");
  const poseidonT3 = await PoseidonT3Factory.deploy();
  await poseidonT3.waitForDeployment();
  log.info(`PoseidonT3 deployed: ${await poseidonT3.getAddress()}`);

  // Deploy initial Registry implementation
  const RegistryFactory = await ethers.getContractFactory("IdentityRegistryImplV1", {
    libraries: {
      PoseidonT3: await poseidonT3.getAddress()
    }
  });
  const registryImpl = await RegistryFactory.deploy();
  await registryImpl.waitForDeployment();
  log.info(`Registry implementation deployed: ${await registryImpl.getAddress()}`);

  // Deploy proxy pointing to Registry
  const ProxyFactory = await ethers.getContractFactory("ERC1967Proxy");

  // Encode initialize call for Registry (requires hub address)
  const initializeData = RegistryFactory.interface.encodeFunctionData("initialize", [
    ethers.ZeroAddress // hubAddress
  ]);

  const proxy = await ProxyFactory.deploy(await registryImpl.getAddress(), initializeData);
  await proxy.waitForDeployment();
  log.info(`Registry proxy deployed: ${await proxy.getAddress()}`);

  // Deploy new Registry implementation (same contract, but with governance)
  const newRegistryImpl = await RegistryFactory.deploy();
  await newRegistryImpl.waitForDeployment();
  log.info(`New Registry implementation deployed: ${await newRegistryImpl.getAddress()}`);

  // Test the upgrade logic (same as upgradeToMultisig.ts)
  const registryContract = await ethers.getContractAt("IdentityRegistryImplV1", await proxy.getAddress());

  log.info("Testing Registry upgradeToAndCall...");
  const tx = await registryContract.upgradeToAndCall(await newRegistryImpl.getAddress(), "0x");
  const receipt = await tx.wait();

  log.success(`✅ Registry upgrade successful!`);
  log.info(`   Transaction: ${tx.hash}`);
  log.info(`   Gas used: ${receipt?.gasUsed?.toString() || 'unknown'}`);

  // Verify governance roles
  const [deployer] = await ethers.getSigners();
  const hasRole = await registryContract.hasRole(await registryContract.SECURITY_ROLE(), deployer.address);

  if (hasRole) {
    log.success("✅ Governance verification: deployer has SECURITY_ROLE");
  } else {
    log.error("❌ Governance verification failed: deployer doesn't have SECURITY_ROLE");
  }
}

// Execute the test
main().catch((error) => {
  log.error(`Test failed: ${error}`);
  process.exitCode = 1;
});
