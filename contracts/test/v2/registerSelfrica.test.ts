import { ethers } from "hardhat";
import { deploySystemFixturesV2 } from "../utils/deploymentV2";
import { DeployedActorsV2 } from "../utils/types";
import { SELFRICA_ATTESTATION_ID } from "@selfxyz/common/constants/constants";
import { generateMockSelfricaRegisterInput, OFAC_DUMMY_INPUT } from '@selfxyz/common';
import { generateRegisterSelfricaProof } from "../utils/generateProof";
import { expect } from "chai";

describe("Selfrica Registration test", function () {
  this.timeout(0);

  let deployedActors: DeployedActorsV2;
  let snapshotId: string;
  let attestationIdBytes32: string;

  before(async () => {
    deployedActors = await deploySystemFixturesV2();
    attestationIdBytes32 = ethers.zeroPadValue(ethers.toBeHex(BigInt(SELFRICA_ATTESTATION_ID)), 32);

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
      let data = generateMockSelfricaRegisterInput(undefined, true, registerSecret);
      selfricaData = data.inputs;
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
})
