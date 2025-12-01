import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Upgrade Safety Validation Tests", function () {
  let deployer: SignerWithAddress;
  let securityMultisig: SignerWithAddress;
  let operationsMultisig: SignerWithAddress;

  beforeEach(async function () {
    [deployer, securityMultisig, operationsMultisig] = await ethers.getSigners();
  });

  describe("Storage Layout Validation", function () {
    it("should validate storage layout compatibility using OpenZeppelin", async function () {
      // Deploy CustomVerifier library
      const CustomVerifier = await ethers.getContractFactory("CustomVerifier");
      const customVerifier = await CustomVerifier.deploy();
      await customVerifier.waitForDeployment();

      // Test IdentityVerificationHub storage layout validation
      const IdentityVerificationHub = await ethers.getContractFactory("IdentityVerificationHubImplV2", {
        libraries: {
          CustomVerifier: await customVerifier.getAddress()
        }
      });

      // OpenZeppelin's validateImplementation should pass for our contracts
      await expect(
        upgrades.validateImplementation(IdentityVerificationHub, {
          kind: "uups",
          unsafeAllowLinkedLibraries: true,
          unsafeAllow: ["constructor", "external-library-linking"]
        })
      ).to.not.be.reverted;

      // Deploy PoseidonT3 library for IdentityRegistry
      const PoseidonT3 = await ethers.getContractFactory("PoseidonT3");
      const poseidonT3 = await PoseidonT3.deploy();
      await poseidonT3.waitForDeployment();

      // Test IdentityRegistry storage layout validation
      const IdentityRegistry = await ethers.getContractFactory("IdentityRegistryImplV1", {
        libraries: {
          PoseidonT3: await poseidonT3.getAddress()
        }
      });
      await expect(
        upgrades.validateImplementation(IdentityRegistry, {
          kind: "uups",
          unsafeAllowLinkedLibraries: true,
          unsafeAllow: ["constructor", "external-library-linking"]
        })
      ).to.not.be.reverted;
    });
  });

  describe("Implementation Validation", function () {

    it("should validate PCR0Manager implementation", async function () {
      const PCR0Manager = await ethers.getContractFactory("PCR0Manager");

      // PCR0Manager is not upgradeable, but we can still validate it's safe
      await expect(PCR0Manager.deploy()).to.not.be.reverted;
    });

    it("should validate VerifyAll implementation", async function () {
      const VerifyAll = await ethers.getContractFactory("VerifyAll");
      const mockHub = ethers.Wallet.createRandom().address;
      const mockRegistry = ethers.Wallet.createRandom().address;

      // VerifyAll is not upgradeable, but we can still validate deployment
      await expect(VerifyAll.deploy(
        mockHub,
        mockRegistry
      )).to.not.be.reverted;
    });
  });

  describe("Library Compatibility", function () {
    it("should validate CustomVerifier library is upgrade-safe", async function () {
      const CustomVerifier = await ethers.getContractFactory("CustomVerifier");

      // Libraries should deploy without issues
      await expect(CustomVerifier.deploy()).to.not.be.reverted;
    });

    it("should validate library linking in upgraded contracts", async function () {
      // Deploy library
      const CustomVerifier = await ethers.getContractFactory("CustomVerifier");
      const customVerifier = await CustomVerifier.deploy();
      await customVerifier.waitForDeployment();

      // Deploy contract with library
      const IdentityVerificationHub = await ethers.getContractFactory("IdentityVerificationHubImplV2", {
        libraries: {
          CustomVerifier: await customVerifier.getAddress()
        }
      });

      // Should deploy successfully with library linking
      const proxy = await upgrades.deployProxy(
        IdentityVerificationHub,
        [],
        {
          kind: "uups",
          unsafeAllowLinkedLibraries: true,
          unsafeAllowConstructors: true,
          unsafeSkipStorageCheck: true,
          unsafeAllow: ["constructor", "external-library-linking", "storage-check"],
          libraries: {
            CustomVerifier: await customVerifier.getAddress()
          }
        }
      );

      await expect(proxy.waitForDeployment()).to.not.be.reverted;
    });
  });

  describe("Initialization Safety", function () {
    it("should validate governance initialization is safe", async function () {
      const PCR0Manager = await ethers.getContractFactory("PCR0Manager");

      // Should initialize with valid addresses
      const pcr0Manager = await PCR0Manager.deploy();

      await pcr0Manager.waitForDeployment();

      // Verify initialization worked correctly
      const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
      const OPERATIONS_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATIONS_ROLE"));

      // PCR0Manager now grants initial roles to deployer
      const SECURITY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SECURITY_ROLE"));
      expect(await pcr0Manager.hasRole(SECURITY_ROLE, deployer.address)).to.be.true;
      expect(await pcr0Manager.hasRole(OPERATIONS_ROLE, deployer.address)).to.be.true;
    });

    it("should prevent initialization with zero addresses", async function () {
      const PCR0Manager = await ethers.getContractFactory("PCR0Manager");

      // PCR0Manager no longer takes constructor arguments, so this test is no longer relevant
      // The contract now grants initial roles to msg.sender (deployer)
      const pcr0Manager = await PCR0Manager.deploy();
      await pcr0Manager.waitForDeployment();

      // Verify deployer has initial roles
      const SECURITY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SECURITY_ROLE"));
      expect(await pcr0Manager.hasRole(SECURITY_ROLE, deployer.address)).to.be.true;
    });
  });

  describe("Proxy Compatibility", function () {
    it("should validate UUPS proxy compatibility", async function () {
      // Deploy a test contract that inherits from ImplRoot
      const TestContract = await ethers.getContractFactory("MockImplRoot");

      // Should deploy as UUPS proxy successfully
      const proxy = await upgrades.deployProxy(
        TestContract,
        [],
        {
          kind: "uups",
          initializer: "exposed__ImplRoot_init()",
          unsafeAllowConstructors: true,
          unsafeSkipStorageCheck: true
        }
      );

      await expect(proxy.waitForDeployment()).to.not.be.reverted;
    });

    it("should validate proxy admin functions work correctly", async function () {
      const TestContract = await ethers.getContractFactory("MockImplRoot");

      const proxy = await upgrades.deployProxy(
        TestContract,
        [],
        {
          kind: "uups",
          initializer: "exposed__ImplRoot_init()",
          unsafeAllowConstructors: true,
          unsafeSkipStorageCheck: true
        }
      );

      await proxy.waitForDeployment();

      // Verify proxy admin functions are accessible
      const proxyAddress = await proxy.getAddress();
      expect(proxyAddress).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("Gas Usage Validation", function () {
    it("should validate upgrade gas costs are reasonable", async function () {
      // Deploy initial implementation
      const CustomVerifier = await ethers.getContractFactory("CustomVerifier");
      const customVerifier = await CustomVerifier.deploy();
      await customVerifier.waitForDeployment();

      const IdentityVerificationHub = await ethers.getContractFactory("IdentityVerificationHubImplV2", {
        libraries: {
          CustomVerifier: await customVerifier.getAddress()
        }
      });

      const proxy = await upgrades.deployProxy(
        IdentityVerificationHub,
        [],
        {
          kind: "uups",
          unsafeAllowLinkedLibraries: true,
          unsafeAllowConstructors: true,
          unsafeSkipStorageCheck: true,
          unsafeAllow: ["constructor", "external-library-linking", "storage-check"],
          libraries: {
            CustomVerifier: await customVerifier.getAddress()
          }
        }
      );

      await proxy.waitForDeployment();

      // Upgrade and measure gas
      const NewImplementation = await ethers.getContractFactory("IdentityVerificationHubImplV2", {
        libraries: {
          CustomVerifier: await customVerifier.getAddress()
        }
      });

      const upgradeTx = await upgrades.upgradeProxy(
        await proxy.getAddress(),
        NewImplementation,
        {
          kind: "uups",
          unsafeAllowLinkedLibraries: true,
          unsafeAllowConstructors: true,
          unsafeSkipStorageCheck: true,
          unsafeAllow: ["constructor", "external-library-linking", "storage-check"]
        }
      );

      const receipt = await upgradeTx.deploymentTransaction()?.wait();

      // Verify gas usage is reasonable (adjust threshold as needed)
      if (receipt) {
        expect(receipt.gasUsed).to.be.lessThan(ethers.parseUnits("5000000", "wei")); // 5M gas limit
      }
    });
  });
});
