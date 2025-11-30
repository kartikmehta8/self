import { ethers } from "hardhat";
import { deploySystemFixturesV2 } from "../utils/deploymentV2";
import { DeployedActorsV2 } from "../utils/types";
import { KYC_ATTESTATION_ID } from "@selfxyz/common/constants/constants";
import { generateMockKycRegisterInput, OFAC_DUMMY_INPUT } from '@selfxyz/common';
import { generateRegisterSelfricaProof } from "../utils/generateProof";
import { expect } from "chai";

describe("Selfrica Registration test", function () {
  this.timeout(0);

  let deployedActors: DeployedActorsV2;
  let snapshotId: string;
  let attestationIdBytes32: string;

  before(async () => {
    deployedActors = await deploySystemFixturesV2();
    attestationIdBytes32 = ethers.zeroPadValue(ethers.toBeHex(BigInt(KYC_ATTESTATION_ID)), 32);

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

    before(async () => {
      registerSecret = "12345";
      selfricaData = generateMockKycRegisterInput(undefined, true, registerSecret);
      registerProof = await generateRegisterSelfricaProof(registerSecret, selfricaData);

      //register the pubkey commitment
      const pubkeyCommitment = registerProof.pubSignals[registerProof.pubSignals.length - 1];
      const tx = await deployedActors.registrySelfrica.registerPubkeyCommitment(pubkeyCommitment);
      await tx.wait();
    });

    it("should successfully register an identity commitment", async () => {
      await expect(deployedActors.hub.registerCommitment(attestationIdBytes32, 0n, registerProof)).to.emit(
        deployedActors.registrySelfrica,
        "CommitmentRegistered",
      );

      const isRegistered = await deployedActors.registrySelfrica.nullifiers(registerProof.pubSignals[1]);
      expect(isRegistered).to.be.true;
    })

    it("should not register an identity commitment if the proof is invalid", async () => {
      const invalidRegisterProof = structuredClone(registerProof);
      invalidRegisterProof.pubSignals[1] = 0n;
      await expect(deployedActors.hub.registerCommitment(attestationIdBytes32, 0n, invalidRegisterProof)).to.be.revertedWithCustomError(deployedActors.hub, "InvalidRegisterProof");
    });

    it("should fail with NoVerifierSet when using non-existent register verifier ID", async () => {
      const nonExistentVerifierId = 999999; // Non-existent verifier ID

      await expect(
        deployedActors.hub.registerCommitment(attestationIdBytes32, nonExistentVerifierId, registerProof),
      ).to.be.revertedWithCustomError(deployedActors.hub, "NoVerifierSet");
    });

    it("should fail with NoVerifierSet when register verifier exists but attestation ID is invalid", async () => {
      const invalidAttestationId = ethers.zeroPadValue(ethers.toBeHex(999), 32);

      await expect(
        deployedActors.hub.registerCommitment(invalidAttestationId, 0n, registerProof),
      ).to.be.revertedWithCustomError(deployedActors.hub, "NoVerifierSet");
    });

    it("should fail with InvalidAttestationId when register verifier exists but attestation ID is invalid", async () => {
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

    it("should fail with InvalidPubkey when pubkey commitment is not registered", async () => {
      const newRegisterProof = structuredClone(registerProof);
      newRegisterProof.pubSignals[3] = 0n;

      await expect(
        deployedActors.hub.registerCommitment(attestationIdBytes32, 0n, newRegisterProof),
      ).to.be.revertedWithCustomError(deployedActors.hub, "InvalidPubkeyCommitment");
    });
  });

  describe("GCP JWT Pubkey Registration (registerPubkey)", () => {
    const GCP_ROOT_CA_PUBKEY_HASH = 21107503781769611051785921462832133421817512022858926231578334326320168810501n;

    // Mock proof data
    const mockProofA: [bigint, bigint] = [1n, 2n];
    const mockProofB: [[bigint, bigint], [bigint, bigint]] = [[1n, 2n], [3n, 4n]];
    const mockProofC: [bigint, bigint] = [1n, 2n];

    it("should have correct GCP_ROOT_CA_PUBKEY_HASH constant", async () => {
      const contractHash = await deployedActors.registrySelfrica.GCP_ROOT_CA_PUBKEY_HASH();
      expect(contractHash).to.equal(GCP_ROOT_CA_PUBKEY_HASH);
    });

    it("should fail with INVALID_PROOF when proof verification fails", async () => {
      const mockPubSignals: [bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
        GCP_ROOT_CA_PUBKEY_HASH, 1n, 2n, 3n, 4n, 5n, 6n
      ];

      await expect(
        deployedActors.registrySelfrica.registerPubkey(mockProofA, mockProofB, mockProofC, mockPubSignals),
      ).to.be.revertedWithCustomError(deployedActors.registrySelfrica, "INVALID_PROOF");
    });

    it("should not allow non-owner to update GCP JWT verifier", async () => {
      await expect(
        deployedActors.registrySelfrica.connect(deployedActors.user1).updateGCPJWTVerifier(ethers.Wallet.createRandom().address),
      ).to.be.revertedWithCustomError(deployedActors.registrySelfrica, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to update GCP JWT verifier", async () => {
      const newVerifier = ethers.Wallet.createRandom().address;
      await deployedActors.registrySelfrica.updateGCPJWTVerifier(newVerifier);
    });

    describe("with MockGCPJWTVerifier (tests INVALID_ROOT_CA, INVALID_IMAGE, INVALID_PROOF)", () => {
      let mockVerifier: any;

      before(async () => {
        // Deploy configurable mock verifier (defaults to returning true)
        const MockVerifierFactory = await ethers.getContractFactory("MockGCPJWTVerifier");
        mockVerifier = await MockVerifierFactory.deploy();
        await mockVerifier.waitForDeployment();

        // Set mock verifier
        await deployedActors.registrySelfrica.updateGCPJWTVerifier(mockVerifier.target);
      });

      afterEach(async () => {
        // Reset mock verifier to default state after each test
        await mockVerifier.setShouldVerify(true);
      });

      it("should fail with INVALID_PROOF when mock verifier returns false", async () => {
        // Configure mock verifier to reject proofs
        await mockVerifier.setShouldVerify(false);
        expect(await mockVerifier.getShouldVerify()).to.be.false;

        const mockPubSignals: [bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
          GCP_ROOT_CA_PUBKEY_HASH, 1n, 2n, 3n, 4n, 5n, 6n
        ];

        await expect(
          deployedActors.registrySelfrica.registerPubkey(mockProofA, mockProofB, mockProofC, mockPubSignals),
        ).to.be.revertedWithCustomError(deployedActors.registrySelfrica, "INVALID_PROOF");
      });

      it("should fail with INVALID_ROOT_CA when root CA hash does not match", async () => {
        const wrongRootCA = 12345n;
        const mockPubSignals: [bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
          wrongRootCA, 1n, 2n, 3n, 4n, 5n, 6n
        ];

        await expect(
          deployedActors.registrySelfrica.registerPubkey(mockProofA, mockProofB, mockProofC, mockPubSignals),
        ).to.be.revertedWithCustomError(deployedActors.registrySelfrica, "INVALID_ROOT_CA");
      });

      it("should fail with INVALID_IMAGE when image hash not in PCR0Manager", async () => {
        // pubSignals[4-6] are image hash - using values that won't be in PCR0Manager
        const mockPubSignals: [bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
          GCP_ROOT_CA_PUBKEY_HASH, 1n, 2n, 3n, 4n, 5n, 6n
        ];

        await expect(
          deployedActors.registrySelfrica.registerPubkey(mockProofA, mockProofB, mockProofC, mockPubSignals),
        ).to.be.revertedWithCustomError(deployedActors.registrySelfrica, "INVALID_IMAGE");
      });
    });
  });
})
