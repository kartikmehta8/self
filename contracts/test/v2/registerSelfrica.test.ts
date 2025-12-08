import { ethers } from "hardhat";
import { deploySystemFixturesV2 } from "../utils/deploymentV2";
import { DeployedActorsV2 } from "../utils/types";
import { KYC_ATTESTATION_ID } from "@selfxyz/common/constants/constants";
import { generateMockKycRegisterInput } from '@selfxyz/common/utils/kyc/generateInputs';
import { generateRegisterSelfricaProof } from "../utils/generateProof";
import { expect } from "chai";

/**
 * Packs a uint256 value into field elements as a 64-character hex string.
 * This mirrors how the GCP JWT circuit outputs pubkey commitments.
 */
function packUint256ToHexFields(value: bigint): [bigint, bigint, bigint] {
  const hexStr = value.toString(16).padStart(64, '0');
  const bytes = Buffer.from(hexStr, 'utf8');

  let p0 = 0n, p1 = 0n, p2 = 0n;

  for (let i = 0; i < Math.min(31, bytes.length); i++) {
    p0 |= BigInt(bytes[i]) << BigInt(i * 8);
  }
  for (let i = 31; i < Math.min(62, bytes.length); i++) {
    p1 |= BigInt(bytes[i]) << BigInt((i - 31) * 8);
  }
  for (let i = 62; i < Math.min(93, bytes.length); i++) {
    p2 |= BigInt(bytes[i]) << BigInt((i - 62) * 8);
  }

  return [p0, p1, p2];
}

describe("Selfrica Registration test", function () {
  this.timeout(0);

  let deployedActors: DeployedActorsV2;
  let snapshotId: string;
  let attestationIdBytes32: string;

  before(async () => {
    deployedActors = await deploySystemFixturesV2();
    attestationIdBytes32 = ethers.zeroPadValue(ethers.toBeHex(BigInt(KYC_ATTESTATION_ID)), 32);

    // Set the owner as the TEE for all tests
    await deployedActors.registrySelfrica.updateTEE(await deployedActors.owner.getAddress());

    console.log("🎉 System deployment and initial setup completed!");
  });

  beforeEach(async () => {
    snapshotId = await ethers.provider.send("evm_snapshot", []);
  });

  afterEach(async () => {
    await ethers.provider.send("evm_revert", [snapshotId]);
  });

  describe("Identity Commitment", () => {
    let selfricaData: any;
    let registerProof: any;
    let registerSecret: string;
    let mockVerifier: any;
    let mockProof: any;
    let mockPubSignals: [bigint, bigint, bigint, bigint, bigint, bigint, bigint];
    const GCP_ROOT_CA_PUBKEY_HASH = 21107503781769611051785921462832133421817512022858926231578334326320168810501n;
    let snapshotId: string;

    before(async () => {
      registerSecret = "12345";
      selfricaData = generateMockKycRegisterInput(undefined, true, registerSecret);
      registerProof = await generateRegisterSelfricaProof(registerSecret, selfricaData);

      // Deploy and set mock GCP JWT verifier
      const MockVerifierFactory = await ethers.getContractFactory("MockGCPJWTVerifier");
      mockVerifier = await MockVerifierFactory.deploy();
      await mockVerifier.waitForDeployment();
      await deployedActors.registrySelfrica.updateGCPJWTVerifier(mockVerifier.target);

      // Get the pubkey commitment from the register proof and pack as hex
      const pubkeyCommitment = registerProof.pubSignals[registerProof.pubSignals.length - 1];
      const [p0, p1, p2] = packUint256ToHexFields(BigInt(pubkeyCommitment));

      // Test image hash that unpacks to: d2221a0ee83901980c607ceff2edbedf3f6ce5f437eafa5d89be39e9e7487c04
      const testImageHash = {
        p0: 177384435506496807268973340845468654286294928521500580044819492874465981028n,
        p1: 175298970718174405520284770870231222447414486446296682893283627688949855078n,
        p2: 13360n,
      };

      // Add the corresponding PCR0 (16 zero bytes + 32 hash bytes)
      const pcr0Bytes = ethers.getBytes("0x" + "00".repeat(16) + "d2221a0ee83901980c607ceff2edbedf3f6ce5f437eafa5d89be39e9e7487c04");
      await deployedActors.pcr0Manager.addPCR0(pcr0Bytes);

      // Register the pubkey commitment via GCP JWT proof
      mockProof = {
        a: [1n, 2n] as [bigint, bigint],
        b: [[1n, 2n], [3n, 4n]] as [[bigint, bigint], [bigint, bigint]],
        c: [1n, 2n] as [bigint, bigint],
      };

      mockPubSignals = [
        GCP_ROOT_CA_PUBKEY_HASH,
        p0, p1, p2,
        testImageHash.p0, testImageHash.p1, testImageHash.p2,
      ];
      // Take an EVM snapshot before tests to allow reverting in each test for isolation
      // We will use this snapshot in the afterEach for revert, but store it here.
      // Using Mocha "this" context to store snapshotId for this suite.
      snapshotId = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async () => {
      await ethers.provider.send("evm_revert", [snapshotId]);
      snapshotId = await ethers.provider.send("evm_snapshot", []);
    });

    it("should successfully register an identity commitment", async () => {
      await deployedActors.registrySelfrica.registerPubkeyCommitment(
        mockProof.a, mockProof.b, mockProof.c, mockPubSignals
      );

      await expect(deployedActors.hub.registerCommitment(attestationIdBytes32, 0n, registerProof)).to.emit(
        deployedActors.registrySelfrica,
        "CommitmentRegistered",
      );

      const isRegistered = await deployedActors.registrySelfrica.nullifiers(registerProof.pubSignals[1]);
      expect(isRegistered).to.be.true;
    });

    it("should throw an error if the pubkey commitment is not registered", async () => {
      await expect(deployedActors.hub.registerCommitment(attestationIdBytes32, 0n, registerProof)).to.be.revertedWithCustomError(
        deployedActors.hub,
        "InvalidPubkeyCommitment",
      );
    });

    it("should not register an identity commitment if the proof is invalid", async () => {
      await deployedActors.registrySelfrica.registerPubkeyCommitment(
        mockProof.a, mockProof.b, mockProof.c, mockPubSignals
      );

      const invalidRegisterProof = structuredClone(registerProof);
      invalidRegisterProof.pubSignals[1] = 0n;
      await expect(
        deployedActors.hub.registerCommitment(attestationIdBytes32, 0n, invalidRegisterProof)
      ).to.be.revertedWithCustomError(deployedActors.hub, "InvalidRegisterProof");
    });

    it("should fail with NoVerifierSet when using non-existent register verifier ID", async () => {
      await expect(
        deployedActors.hub.registerCommitment(attestationIdBytes32, 999999n, registerProof),
      ).to.be.revertedWithCustomError(deployedActors.hub, "NoVerifierSet");
    });

    it("should fail with NoVerifierSet when attestation ID is invalid", async () => {
      const invalidAttestationId = ethers.zeroPadValue(ethers.toBeHex(999), 32);
      await expect(
        deployedActors.hub.registerCommitment(invalidAttestationId, 0n, registerProof),
      ).to.be.revertedWithCustomError(deployedActors.hub, "NoVerifierSet");
    });

    it("should fail with InvalidAttestationId for mismatched verifier registry", async () => {
      const invalidAttestationId = ethers.zeroPadValue(ethers.toBeHex(999), 32);
      await deployedActors.hub.updateRegisterCircuitVerifier(
        invalidAttestationId,
        1n,
        await deployedActors.registryAadhaar.getAddress(),
      );

      await expect(
        deployedActors.hub.registerCommitment(invalidAttestationId, 1n, registerProof),
      ).to.be.revertedWithCustomError(deployedActors.hub, "InvalidAttestationId");
    });

    it("should fail with InvalidPubkeyCommitment when pubkey commitment is not registered", async () => {
      const newRegisterProof = structuredClone(registerProof);
      newRegisterProof.pubSignals[3] = 0n;

      await expect(
        deployedActors.hub.registerCommitment(attestationIdBytes32, 0n, newRegisterProof),
      ).to.be.revertedWithCustomError(deployedActors.hub, "InvalidPubkeyCommitment");
    });
  });

  describe("GCP JWT Pubkey Registration", () => {
    const GCP_ROOT_CA_PUBKEY_HASH = 21107503781769611051785921462832133421817512022858926231578334326320168810501n;
    const mockProof = {
      a: [1n, 2n] as [bigint, bigint],
      b: [[1n, 2n], [3n, 4n]] as [[bigint, bigint], [bigint, bigint]],
      c: [1n, 2n] as [bigint, bigint],
    };

    it("should have correct GCP_ROOT_CA_PUBKEY_HASH constant", async () => {
      const contractHash = await deployedActors.registrySelfrica.GCP_ROOT_CA_PUBKEY_HASH();
      expect(contractHash).to.equal(GCP_ROOT_CA_PUBKEY_HASH);
    });

    it("should fail with INVALID_IMAGE when image hash not in PCR0Manager", async () => {
      const mockPubSignals: [bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
        GCP_ROOT_CA_PUBKEY_HASH, 1n, 2n, 3n, 4n, 5n, 6n
      ];

      await expect(
        deployedActors.registrySelfrica.registerPubkeyCommitment(
          mockProof.a, mockProof.b, mockProof.c, mockPubSignals
        ),
      ).to.be.revertedWithCustomError(deployedActors.registrySelfrica, "INVALID_IMAGE");
    });

    it("should not allow non-owner to update GCP JWT verifier", async () => {
      await expect(
        deployedActors.registrySelfrica.connect(deployedActors.user1).updateGCPJWTVerifier(
          ethers.Wallet.createRandom().address
        ),
      ).to.be.revertedWithCustomError(deployedActors.registrySelfrica, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to update GCP JWT verifier", async () => {
      const newVerifier = ethers.Wallet.createRandom().address;
      await deployedActors.registrySelfrica.updateGCPJWTVerifier(newVerifier);
    });

    describe("TEE Access Control", () => {
      it("should not allow non-TEE to register pubkey commitment", async () => {
        const mockPubSignals: [bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
          GCP_ROOT_CA_PUBKEY_HASH, 1n, 2n, 3n, 4n, 5n, 6n
        ];

        await expect(
          deployedActors.registrySelfrica.connect(deployedActors.user1).registerPubkeyCommitment(
            mockProof.a, mockProof.b, mockProof.c, mockPubSignals
          ),
        ).to.be.revertedWithCustomError(deployedActors.registrySelfrica, "ONLY_TEE_CAN_ACCESS");
      });

      it("should not allow non-owner to update TEE", async () => {
        await expect(
          deployedActors.registrySelfrica.connect(deployedActors.user1).updateTEE(
            ethers.Wallet.createRandom().address
          ),
        ).to.be.revertedWithCustomError(deployedActors.registrySelfrica, "OwnableUnauthorizedAccount");
      });

      it("should allow owner to update TEE", async () => {
        const newTee = ethers.Wallet.createRandom().address;
        await deployedActors.registrySelfrica.updateTEE(newTee);
        expect(await deployedActors.registrySelfrica.tee()).to.equal(newTee);
      });

      it("should fail with TEE_NOT_SET when TEE address is zero", async () => {
        // Deploy minimal fresh registry to test uninitialized TEE state
        const freshImpl = await (await ethers.getContractFactory("IdentityRegistrySelfricaImplV1", {
          libraries: { PoseidonT3: deployedActors.poseidonT3.target },
        })).deploy();

        const initData = freshImpl.interface.encodeFunctionData("initialize", [
          ethers.ZeroAddress,
          deployedActors.pcr0Manager.target,
        ]);
        const freshProxy = await (await ethers.getContractFactory("IdentityRegistry"))
          .deploy(freshImpl.target, initData);

        const freshRegistry = await ethers.getContractAt("IdentityRegistrySelfricaImplV1", freshProxy.target);
        await freshRegistry.updateGCPJWTVerifier(deployedActors.gcpJwtVerifier.target);

        const mockPubSignals: [bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
          GCP_ROOT_CA_PUBKEY_HASH, 1n, 2n, 3n, 4n, 5n, 6n
        ];

        await expect(
          freshRegistry.registerPubkeyCommitment(mockProof.a, mockProof.b, mockProof.c, mockPubSignals),
        ).to.be.revertedWithCustomError(freshRegistry, "TEE_NOT_SET");
      });
    });

    describe("with MockGCPJWTVerifier", () => {
      let mockVerifier: any;

      before(async () => {
        const MockVerifierFactory = await ethers.getContractFactory("MockGCPJWTVerifier");
        mockVerifier = await MockVerifierFactory.deploy();
        await mockVerifier.waitForDeployment();
        await deployedActors.registrySelfrica.updateGCPJWTVerifier(mockVerifier.target);
      });

      afterEach(async () => {
        await mockVerifier.setShouldVerify(true);
      });

      it("should fail with INVALID_PROOF when verifier rejects proof", async () => {
        await mockVerifier.setShouldVerify(false);
        const mockPubSignals: [bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
          GCP_ROOT_CA_PUBKEY_HASH, 1n, 2n, 3n, 4n, 5n, 6n
        ];

        await expect(
          deployedActors.registrySelfrica.registerPubkeyCommitment(
            mockProof.a, mockProof.b, mockProof.c, mockPubSignals
          ),
        ).to.be.revertedWithCustomError(deployedActors.registrySelfrica, "INVALID_PROOF");
      });

      it("should fail with INVALID_ROOT_CA when root CA hash does not match", async () => {
        const mockPubSignals: [bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
          12345n, 1n, 2n, 3n, 4n, 5n, 6n
        ];

        await expect(
          deployedActors.registrySelfrica.registerPubkeyCommitment(
            mockProof.a, mockProof.b, mockProof.c, mockPubSignals
          ),
        ).to.be.revertedWithCustomError(deployedActors.registrySelfrica, "INVALID_ROOT_CA");
      });

      it("should fail with INVALID_IMAGE when image hash not in PCR0Manager", async () => {
        const mockPubSignals: [bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
          GCP_ROOT_CA_PUBKEY_HASH, 1n, 2n, 3n, 4n, 5n, 6n
        ];

        await expect(
          deployedActors.registrySelfrica.registerPubkeyCommitment(
            mockProof.a, mockProof.b, mockProof.c, mockPubSignals
          ),
        ).to.be.revertedWithCustomError(deployedActors.registrySelfrica, "INVALID_IMAGE");
      });
    });
  });
});
