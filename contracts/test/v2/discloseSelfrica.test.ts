import { calculateUserIdentifierHash, customHasher, generateRSAKeyPair, hashEndpointWithScope, NON_OFAC_DUMMY_INPUT, serializeSmileData, pubkeyCommitment, SELFRICA_ID_NUMBER_INDEX, SELFRICA_ID_NUMBER_LENGTH, packBytesAndPoseidon } from "@selfxyz/common";
import { Country3LetterCode } from "@selfxyz/common/constants/countries";
import { DeployedActorsV2 } from "../utils/types";
import { deploySystemFixturesV2 } from "../utils/deploymentV2";
import { ethers } from "hardhat";
import { expect } from "chai";
import { generateSelfricaDiscloseInput } from "@selfxyz/common";
import { getSMTs } from "../utils/generateProof";
import { getPackedForbiddenCountries } from "@selfxyz/common/utils/contracts/forbiddenCountries";
import { BigNumberish } from "ethers";
import { generateVcAndDiscloseSelfricaProof } from "../utils/generateProof";
import { SELFRICA_ATTESTATION_ID } from "@selfxyz/common/constants/constants";
import { poseidon2 } from "poseidon-lite";

const { privateKey, publicKey } = generateRSAKeyPair();

describe("Self Verification Flow V2 - Selfrica", () => {
  let deployedActors: DeployedActorsV2;
  let snapshotId: string;
  let nullifier: any;
  let tree: any;
  let nameAndDob_smt: any;
  let nameAndYob_smt: any;

  let userIdentifierHash: bigint;
  let forbiddenCountriesList: Country3LetterCode[];
  let forbiddenCountriesListPacked: string[];
  let verificationConfigV2: any;
  let scopeAsBigInt: bigint;
  let baseVcAndDiscloseProof: any;

  before(async () => {
    deployedActors = await deploySystemFixturesV2();

    const expectedScopeFromHash = hashEndpointWithScope(deployedActors.testSelfVerificationRoot.target.toString().toLowerCase(), "test-scope");
    scopeAsBigInt = BigInt(expectedScopeFromHash);

    const destChainId = 31337;
    const user1Address = await deployedActors.user1.getAddress();
    const userData = "test-user-data-for-verification";

    userIdentifierHash = BigInt(calculateUserIdentifierHash(destChainId, user1Address.slice(2), userData).toString());
    nameAndDob_smt = getSMTs().nameAndDob_selfrica_smt;
    nameAndYob_smt = getSMTs().nameAndYob_selfrica_smt;

    const hashFunction = (a: bigint, b: bigint) => poseidon2([a, b]);
    const LeanIMT = await import("@openpassport/zk-kit-lean-imt").then((mod) => mod.LeanIMT);
    tree = new LeanIMT<bigint>((a, b) => poseidon2([a, b]), []);

    const testInputs = generateSelfricaDiscloseInput(
      NON_OFAC_DUMMY_INPUT,
      nameAndDob_smt,
      nameAndYob_smt,
      tree,
      false,
      scopeAsBigInt.toString(),
      userIdentifierHash.toString(),
      [
        "GENDER",
        "FULL_NAME",
        "DOB",
        "ID_NUMBER",
        "ISSUANCE_DATE",
        "EXPIRY_DATE",
        "COUNTRY",
        "GENDER",
        "ADDRESS",
      ],
      undefined,
      18,
      true,
      scopeAsBigInt.toString(),
    );

    nullifier = testInputs.SmileID_data_padded.slice(SELFRICA_ID_NUMBER_INDEX, SELFRICA_ID_NUMBER_INDEX + SELFRICA_ID_NUMBER_LENGTH).map((x) => Number(x));
    nullifier = packBytesAndPoseidon(nullifier);
    const commitment = poseidon2([testInputs.secret, packBytesAndPoseidon(testInputs.SmileID_data_padded.map((x) => Number(x)))]);

    await deployedActors.registrySelfrica.devAddIdentityCommitment(nullifier, commitment);

    forbiddenCountriesList = [] as Country3LetterCode[];
    forbiddenCountriesListPacked = getPackedForbiddenCountries(forbiddenCountriesList);

    verificationConfigV2 = {
      olderThanEnabled: true,
      olderThan: "20",
      forbiddenCountriesEnabled: true,
      forbiddenCountriesListPacked: forbiddenCountriesListPacked as [
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish,
      ],
      ofacEnabled: [false, false, false] as [boolean, boolean, boolean],
    };

    await deployedActors.testSelfVerificationRoot.setVerificationConfig(verificationConfigV2);
    baseVcAndDiscloseProof = await generateVcAndDiscloseSelfricaProof(testInputs);
    snapshotId = await ethers.provider.send("evm_snapshot", []);
  })

  afterEach(async () => {
    await ethers.provider.send("evm_revert", [snapshotId]);
    snapshotId = await ethers.provider.send("evm_snapshot", []);
  });

  describe("Complete V2 Verification Flow - Selfrica", () => {
    it("should complete full Selfrica verification flow with proper proof encoding", async () => {
      const destChainId = ethers.zeroPadValue(ethers.toBeHex(31337), 32);
      const user1Address = await deployedActors.user1.getAddress();
      const userData = ethers.toUtf8Bytes("test-user-data-for-verification");

      //set the config
      const verificationConfigV2 = {
        olderThanEnabled: true,
        olderThan: "00",
        forbiddenCountriesEnabled: true,
        forbiddenCountriesListPacked: forbiddenCountriesListPacked as [
          BigNumberish,
          BigNumberish,
          BigNumberish,
          BigNumberish,
        ],
        ofacEnabled: [false, false, false] as [boolean, boolean, boolean],
      };

      await deployedActors.testSelfVerificationRoot.setVerificationConfig(verificationConfigV2);

      const userContextData = ethers.solidityPacked(
        ["bytes32", "bytes32", "bytes"],
        [destChainId, ethers.zeroPadValue(user1Address, 32), userData],
      );

      const attestationId = ethers.zeroPadValue(ethers.toBeHex(BigInt(SELFRICA_ATTESTATION_ID)), 32);

      const encodedProof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] pubSignals)"],
        [
          [
            baseVcAndDiscloseProof.a,
            baseVcAndDiscloseProof.b,
            baseVcAndDiscloseProof.c,
            baseVcAndDiscloseProof.pubSignals,
          ],
        ],
      );

      const proofData = ethers.solidityPacked(["bytes32", "bytes"], [attestationId, encodedProof]);

      await deployedActors.testSelfVerificationRoot.resetTestState();

      const tx = await deployedActors.testSelfVerificationRoot.verifySelfProof(proofData, userContextData);

      await expect(tx).to.emit(deployedActors.testSelfVerificationRoot, "VerificationCompleted");

      expect(await deployedActors.testSelfVerificationRoot.verificationSuccessful()).to.be.true;

      const lastOutput = await deployedActors.testSelfVerificationRoot.lastOutput();
      expect(lastOutput).to.not.equal("0x");

      const expectedUserData = ethers.solidityPacked(["bytes"], [userData]);
      const actualUserData = await deployedActors.testSelfVerificationRoot.lastUserData();
      expect(actualUserData).to.equal(expectedUserData);
    });

    it("should not verify if the config is not set", async () => {
      const destChainId = ethers.zeroPadValue(ethers.toBeHex(31337), 32);
      const user1Address = await deployedActors.user1.getAddress();
      const userData = ethers.toUtf8Bytes("test-user-data-for-verification");

      const userContextData = ethers.solidityPacked(
        ["bytes32", "bytes32", "bytes"],
        [destChainId, ethers.zeroPadValue(user1Address, 32), userData],
      );

      const verificationConfigV2 = {
        olderThanEnabled: true,
        olderThan: "00",
        forbiddenCountriesEnabled: true,
        forbiddenCountriesListPacked: forbiddenCountriesListPacked as [
          BigNumberish,
          BigNumberish,
          BigNumberish,
          BigNumberish,
        ],
        ofacEnabled: [false, false, false] as [boolean, boolean, boolean],
      };

      await deployedActors.testSelfVerificationRoot.setVerificationConfigNoHub(verificationConfigV2);

      const attestationId = ethers.zeroPadValue(ethers.toBeHex(BigInt(SELFRICA_ATTESTATION_ID)), 32);

      const encodedProof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] pubSignals)"],
        [
          [
            baseVcAndDiscloseProof.a,
            baseVcAndDiscloseProof.b,
            baseVcAndDiscloseProof.c,
            baseVcAndDiscloseProof.pubSignals,
          ],
        ],
      );

      const proofData = ethers.solidityPacked(["bytes32", "bytes"], [attestationId, encodedProof]);

      await deployedActors.testSelfVerificationRoot.resetTestState();

      await expect(
        deployedActors.testSelfVerificationRoot.verifySelfProof(proofData, userContextData),
      ).to.be.revertedWithCustomError(deployedActors.hubImplV2, "ConfigNotSet");
    });

    it("should fail with invalid length of proofData", async () => {
      const destChainId = ethers.zeroPadValue(ethers.toBeHex(31337), 32);
      const user1Address = await deployedActors.user1.getAddress();
      const userData = ethers.toUtf8Bytes("test-user-data-for-verification");

      const verificationConfigV2 = {
        olderThanEnabled: true,
        olderThan: "00",
        forbiddenCountriesEnabled: true,
        forbiddenCountriesListPacked: forbiddenCountriesListPacked as [
          BigNumberish,
          BigNumberish,
          BigNumberish,
          BigNumberish,
        ],
        ofacEnabled: [false, false, false] as [boolean, boolean, boolean],
      };

      await deployedActors.testSelfVerificationRoot.setVerificationConfig(verificationConfigV2);

      const userContextData = ethers.solidityPacked(
        ["bytes32", "bytes32", "bytes"],
        [destChainId, ethers.zeroPadValue(user1Address, 32), userData],
      );

      const invalidProofData = ethers.toUtf8Bytes("short");

      await expect(
        deployedActors.testSelfVerificationRoot.verifySelfProof(invalidProofData, userContextData),
      ).to.be.revertedWithCustomError(deployedActors.testSelfVerificationRoot, "InvalidDataFormat");
    });

    it("should fail with invalid length of userContextData", async () => {
      const invalidUserContextData = ethers.toUtf8Bytes("short");

      const attestationId = ethers.zeroPadValue(ethers.toBeHex(BigInt(SELFRICA_ATTESTATION_ID)), 32);

      const encodedProof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] pubSignals)"],
        [
          [
            baseVcAndDiscloseProof.a,
            baseVcAndDiscloseProof.b,
            baseVcAndDiscloseProof.c,
            baseVcAndDiscloseProof.pubSignals,
          ],
        ],
      );

      const proofData = ethers.solidityPacked(["bytes32", "bytes"], [attestationId, encodedProof]);

      await expect(
        deployedActors.testSelfVerificationRoot.verifySelfProof(proofData, invalidUserContextData),
      ).to.be.revertedWithCustomError(deployedActors.testSelfVerificationRoot, "InvalidDataFormat");
    });

    it("should fail with invalid scope", async () => {
      const destChainId = ethers.zeroPadValue(ethers.toBeHex(31337), 32);
      const user1Address = await deployedActors.user1.getAddress();
      const userData = ethers.toUtf8Bytes("test-user-data-for-verification");

      //set the config
      const verificationConfigV2 = {
        olderThanEnabled: true,
        olderThan: "00",
        forbiddenCountriesEnabled: true,
        forbiddenCountriesListPacked: forbiddenCountriesListPacked as [
          BigNumberish,
          BigNumberish,
          BigNumberish,
          BigNumberish,
        ],
        ofacEnabled: [false, false, false] as [boolean, boolean, boolean],
      };

      await deployedActors.testSelfVerificationRoot.setVerificationConfig(verificationConfigV2);

      const userContextData = ethers.solidityPacked(
        ["bytes32", "bytes32", "bytes"],
        [destChainId, ethers.zeroPadValue(user1Address, 32), userData],
      );

      const attestationId = ethers.zeroPadValue(ethers.toBeHex(BigInt(SELFRICA_ATTESTATION_ID)), 32);

      const clonedPubSignal = structuredClone(baseVcAndDiscloseProof.pubSignals);
      clonedPubSignal[15] = 1n;

      const encodedProof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] pubSignals)"],
        [
          [
            baseVcAndDiscloseProof.a,
            baseVcAndDiscloseProof.b,
            baseVcAndDiscloseProof.c,
            clonedPubSignal,
          ],
        ],
      );

      const proofData = ethers.solidityPacked(["bytes32", "bytes"], [attestationId, encodedProof]);

      await deployedActors.testSelfVerificationRoot.resetTestState();

      await expect(deployedActors.testSelfVerificationRoot.verifySelfProof(proofData, userContextData)).to.be.revertedWithCustomError(deployedActors.hubImplV2, "ScopeMismatch");
    })

    it("should fail with invalid user identifier", async () => {
      const destChainId = ethers.zeroPadValue(ethers.toBeHex(31337), 32);
      const user1Address = await deployedActors.user1.getAddress();
      const userData = ethers.toUtf8Bytes("test-user-data-for-verification");

      //set the config
      const verificationConfigV2 = {
        olderThanEnabled: true,
        olderThan: "00",
        forbiddenCountriesEnabled: true,
        forbiddenCountriesListPacked: forbiddenCountriesListPacked as [
          BigNumberish,
          BigNumberish,
          BigNumberish,
          BigNumberish,
        ],
        ofacEnabled: [false, false, false] as [boolean, boolean, boolean],
      };

      await deployedActors.testSelfVerificationRoot.setVerificationConfig(verificationConfigV2);

      const userContextData = ethers.solidityPacked(
        ["bytes32", "bytes32", "bytes"],
        [destChainId, ethers.zeroPadValue(user1Address, 32), userData],
      );

      const attestationId = ethers.zeroPadValue(ethers.toBeHex(BigInt(SELFRICA_ATTESTATION_ID)), 32);

      const clonedPubSignal = structuredClone(baseVcAndDiscloseProof.pubSignals);
      clonedPubSignal[19] = 1n;

      const encodedProof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] pubSignals)"],
        [
          [
            baseVcAndDiscloseProof.a,
            baseVcAndDiscloseProof.b,
            baseVcAndDiscloseProof.c,
            clonedPubSignal,
          ],
        ],
      );

      const proofData = ethers.solidityPacked(["bytes32", "bytes"], [attestationId, encodedProof]);

      await deployedActors.testSelfVerificationRoot.resetTestState();

      await expect(deployedActors.testSelfVerificationRoot.verifySelfProof(proofData, userContextData)).to.be.revertedWithCustomError(deployedActors.hubImplV2, "InvalidUserIdentifierInProof");
    })

    it("should fail with invalid current date + 2 day", async () => {
      const destChainId = ethers.zeroPadValue(ethers.toBeHex(31337), 32);
      const user1Address = await deployedActors.user1.getAddress();
      const userData = ethers.toUtf8Bytes("test-user-data-for-verification");

      //set the config
      const verificationConfigV2 = {
        olderThanEnabled: true,
        olderThan: "00",
        forbiddenCountriesEnabled: true,
        forbiddenCountriesListPacked: forbiddenCountriesListPacked as [
          BigNumberish,
          BigNumberish,
          BigNumberish,
          BigNumberish,
        ],
        ofacEnabled: [false, false, false] as [boolean, boolean, boolean],
      };

      await deployedActors.testSelfVerificationRoot.setVerificationConfig(verificationConfigV2);

      const userContextData = ethers.solidityPacked(
        ["bytes32", "bytes32", "bytes"],
        [destChainId, ethers.zeroPadValue(user1Address, 32), userData],
      );

      const attestationId = ethers.zeroPadValue(ethers.toBeHex(BigInt(SELFRICA_ATTESTATION_ID)), 32);

      const clonedPubSignal = structuredClone(baseVcAndDiscloseProof.pubSignals);
      clonedPubSignal[clonedPubSignal.length - 1] = (+clonedPubSignal[clonedPubSignal.length - 1] + 2).toString();

      const encodedProof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] pubSignals)"],
        [
          [
            baseVcAndDiscloseProof.a,
            baseVcAndDiscloseProof.b,
            baseVcAndDiscloseProof.c,
            clonedPubSignal,
          ],
        ],
      );

      const proofData = ethers.solidityPacked(["bytes32", "bytes"], [attestationId, encodedProof]);

      await deployedActors.testSelfVerificationRoot.resetTestState();

      await expect(deployedActors.testSelfVerificationRoot.verifySelfProof(proofData, userContextData)).to.be.revertedWithCustomError(deployedActors.hubImplV2, "CurrentDateNotInValidRange");
    });

    it("should fail with invalid current date -1 day", async () => {
      const destChainId = ethers.zeroPadValue(ethers.toBeHex(31337), 32);
      const user1Address = await deployedActors.user1.getAddress();
      const userData = ethers.toUtf8Bytes("test-user-data-for-verification");

      //set the config
      const verificationConfigV2 = {
        olderThanEnabled: true,
        olderThan: "00",
        forbiddenCountriesEnabled: true,
        forbiddenCountriesListPacked: forbiddenCountriesListPacked as [
          BigNumberish,
          BigNumberish,
          BigNumberish,
          BigNumberish,
        ],
        ofacEnabled: [false, false, false] as [boolean, boolean, boolean],
      };

      await deployedActors.testSelfVerificationRoot.setVerificationConfig(verificationConfigV2);

      const userContextData = ethers.solidityPacked(
        ["bytes32", "bytes32", "bytes"],
        [destChainId, ethers.zeroPadValue(user1Address, 32), userData],
      );

      const attestationId = ethers.zeroPadValue(ethers.toBeHex(BigInt(SELFRICA_ATTESTATION_ID)), 32);

      const clonedPubSignal = structuredClone(baseVcAndDiscloseProof.pubSignals);
      clonedPubSignal[clonedPubSignal.length - 1] = (+clonedPubSignal[clonedPubSignal.length - 1] - 1).toString();

      const encodedProof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] pubSignals)"],
        [
          [
            baseVcAndDiscloseProof.a,
            baseVcAndDiscloseProof.b,
            baseVcAndDiscloseProof.c,
            clonedPubSignal,
          ],
        ],
      );

      const proofData = ethers.solidityPacked(["bytes32", "bytes"], [attestationId, encodedProof]);

      await deployedActors.testSelfVerificationRoot.resetTestState();

      await expect(deployedActors.testSelfVerificationRoot.verifySelfProof(proofData, userContextData)).to.be.revertedWithCustomError(deployedActors.hubImplV2, "CurrentDateNotInValidRange");
    });

    it("should fail with invalid groth16 proof", async () => {
      const destChainId = ethers.zeroPadValue(ethers.toBeHex(31337), 32);
      const user1Address = await deployedActors.user1.getAddress();
      const userData = ethers.toUtf8Bytes("test-user-data-for-verification");

      //set the config
      const verificationConfigV2 = {
        olderThanEnabled: true,
        olderThan: "00",
        forbiddenCountriesEnabled: true,
        forbiddenCountriesListPacked: forbiddenCountriesListPacked as [
          BigNumberish,
          BigNumberish,
          BigNumberish,
          BigNumberish,
        ],
        ofacEnabled: [false, false, false] as [boolean, boolean, boolean],
      };

      await deployedActors.testSelfVerificationRoot.setVerificationConfig(verificationConfigV2);

      const userContextData = ethers.solidityPacked(
        ["bytes32", "bytes32", "bytes"],
        [destChainId, ethers.zeroPadValue(user1Address, 32), userData],
      );

      const attestationId = ethers.zeroPadValue(ethers.toBeHex(BigInt(SELFRICA_ATTESTATION_ID)), 32);

      const clonedGrothProof = structuredClone(baseVcAndDiscloseProof);
      clonedGrothProof.a = ["999999999", "888888888"];
      clonedGrothProof.b = [
        ["777777777", "666666666"],
        ["555555555", "444444444"],
      ];
      clonedGrothProof.c = ["333333333", "222222222"];

      const encodedProof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] pubSignals)"],
        [
          [
            clonedGrothProof.a,
            clonedGrothProof.b,
            clonedGrothProof.c,
            clonedGrothProof.pubSignals,
          ],
        ],
      );

      const proofData = ethers.solidityPacked(["bytes32", "bytes"], [attestationId, encodedProof]);

      await deployedActors.testSelfVerificationRoot.resetTestState();

      await expect(deployedActors.testSelfVerificationRoot.verifySelfProof(proofData, userContextData)).to.be.revertedWithCustomError(deployedActors.hubImplV2, "InvalidVcAndDiscloseProof");
    });

    it("should fail verification with invalid attestation Id", async () => {
      const destChainId = ethers.zeroPadValue(ethers.toBeHex(31337), 32);
      const user1Address = await deployedActors.user1.getAddress();
      const userData = ethers.toUtf8Bytes("test-user-data-for-verification");

      const userContextData = ethers.solidityPacked(
        ["bytes32", "bytes32", "bytes"],
        [destChainId, ethers.zeroPadValue(user1Address, 32), userData],
      );

      const verificationConfigV2 = {
        olderThanEnabled: true,
        olderThan: "00",
        forbiddenCountriesEnabled: true,
        forbiddenCountriesListPacked: forbiddenCountriesListPacked as [
          BigNumberish,
          BigNumberish,
          BigNumberish,
          BigNumberish,
        ],
        ofacEnabled: [false, false, false] as [boolean, boolean, boolean],
      };

      await deployedActors.testSelfVerificationRoot.setVerificationConfig(verificationConfigV2);
      const invalidAttestationId = ethers.zeroPadValue(ethers.toBeHex(999999), 32);

      const encodedProof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] pubSignals)"],
        [
          [
            baseVcAndDiscloseProof.a,
            baseVcAndDiscloseProof.b,
            baseVcAndDiscloseProof.c,
            baseVcAndDiscloseProof.pubSignals,
          ],
        ],
      );

      const proofData = ethers.solidityPacked(["bytes32", "bytes"], [invalidAttestationId, encodedProof]);

      await expect(
        deployedActors.testSelfVerificationRoot.verifySelfProof(proofData, userContextData),
      ).to.be.revertedWith("Invalid attestation ID");
    });

    it("should fail verification with invalid ofac check", async () => {
      const destChainId = ethers.zeroPadValue(ethers.toBeHex(31337), 32);
      const user1Address = await deployedActors.user1.getAddress();
      const userData = ethers.toUtf8Bytes("test-user-data-for-verification");

      const userContextData = ethers.solidityPacked(
        ["bytes32", "bytes32", "bytes"],
        [destChainId, ethers.zeroPadValue(user1Address, 32), userData],
      );

      const verificationConfigV2 = {
        olderThanEnabled: true,
        olderThan: "00",
        forbiddenCountriesEnabled: true,
        forbiddenCountriesListPacked: forbiddenCountriesListPacked as [
          BigNumberish,
          BigNumberish,
          BigNumberish,
          BigNumberish,
        ],
        ofacEnabled: [false, true, false] as [boolean, boolean, boolean],
      };

      await deployedActors.testSelfVerificationRoot.setVerificationConfig(verificationConfigV2);

      const attestationId = ethers.zeroPadValue(ethers.toBeHex(BigInt(SELFRICA_ATTESTATION_ID)), 32);

      const encodedProof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] pubSignals)"],
        [
          [
            baseVcAndDiscloseProof.a,
            baseVcAndDiscloseProof.b,
            baseVcAndDiscloseProof.c,
            baseVcAndDiscloseProof.pubSignals,
          ],
        ],
      );

      const proofData = ethers.solidityPacked(["bytes32", "bytes"], [attestationId, encodedProof]);

      await expect(
        deployedActors.testSelfVerificationRoot.verifySelfProof(proofData, userContextData),
      ).to.be.revertedWithCustomError(deployedActors.customVerifier, "InvalidOfacCheck");
    });

    it("should fail verification with invalid forbidden countries check", async () => {
      const destChainId = ethers.zeroPadValue(ethers.toBeHex(31337), 32);
      const user1Address = await deployedActors.user1.getAddress();
      const userData = ethers.toUtf8Bytes("test-user-data-for-verification");

      const userContextData = ethers.solidityPacked(
        ["bytes32", "bytes32", "bytes"],
        [destChainId, ethers.zeroPadValue(user1Address, 32), userData],
      );

      const verificationConfigV2 = {
        olderThanEnabled: true,
        olderThan: "00",
        forbiddenCountriesEnabled: true,
        forbiddenCountriesListPacked: [1n, 1n, 1n, 1n] as [BigNumberish, BigNumberish, BigNumberish, BigNumberish],
        ofacEnabled: [false, false, false] as [boolean, boolean, boolean],
      };

      await deployedActors.testSelfVerificationRoot.setVerificationConfig(verificationConfigV2);

      const attestationId = ethers.zeroPadValue(ethers.toBeHex(BigInt(SELFRICA_ATTESTATION_ID)), 32);

      const encodedProof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] pubSignals)"],
        [
          [
            baseVcAndDiscloseProof.a,
            baseVcAndDiscloseProof.b,
            baseVcAndDiscloseProof.c,
            baseVcAndDiscloseProof.pubSignals,
          ],
        ],
      );

      const proofData = ethers.solidityPacked(["bytes32", "bytes"], [attestationId, encodedProof]);

      await expect(
        deployedActors.testSelfVerificationRoot.verifySelfProof(proofData, userContextData),
      ).to.be.revertedWithCustomError(deployedActors.customVerifier, "InvalidForbiddenCountries");
    });

    it("should fail verification with invalid older than check", async () => {
      const destChainId = ethers.zeroPadValue(ethers.toBeHex(31337), 32);
      const user1Address = await deployedActors.user1.getAddress();
      const userData = ethers.toUtf8Bytes("test-user-data-for-verification");

      const userContextData = ethers.solidityPacked(
        ["bytes32", "bytes32", "bytes"],
        [destChainId, ethers.zeroPadValue(user1Address, 32), userData],
      );

      const verificationConfigV2 = {
        olderThanEnabled: true,
        olderThan: "50",
        forbiddenCountriesEnabled: true,
        forbiddenCountriesListPacked: forbiddenCountriesListPacked as [
          BigNumberish,
          BigNumberish,
          BigNumberish,
          BigNumberish,
        ],
        ofacEnabled: [false, false, false] as [boolean, boolean, boolean],
      };

      await deployedActors.testSelfVerificationRoot.setVerificationConfig(verificationConfigV2);

      const attestationId = ethers.zeroPadValue(ethers.toBeHex(BigInt(SELFRICA_ATTESTATION_ID)), 32);

      const encodedProof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] pubSignals)"],
        [
          [
            baseVcAndDiscloseProof.a,
            baseVcAndDiscloseProof.b,
            baseVcAndDiscloseProof.c,
            baseVcAndDiscloseProof.pubSignals,
          ],
        ],
      );

      const proofData = ethers.solidityPacked(["bytes32", "bytes"], [attestationId, encodedProof]);

      await expect(
        deployedActors.testSelfVerificationRoot.verifySelfProof(proofData, userContextData),
      ).to.be.revertedWithCustomError(deployedActors.customVerifier, "InvalidOlderThan");
    });

    it("should fail verification with invalid dest chain id", async () => {
      const destChainId = 31338;
      const user1Address = await deployedActors.user1.getAddress();
      const userData = "test-user-data-for-verification";

      const userContextData = ethers.solidityPacked(
        ["bytes32", "bytes32", "bytes"],
        [
          ethers.zeroPadValue(ethers.toBeHex(destChainId), 32),
          ethers.zeroPadValue(user1Address, 32),
          ethers.toUtf8Bytes(userData),
        ],
      );

      const newUserIdentifierHash = BigInt(
        calculateUserIdentifierHash(destChainId, user1Address.slice(2), userData).toString(),
      );

      const verificationConfigV2 = {
        olderThanEnabled: true,
        olderThan: "00",
        forbiddenCountriesEnabled: true,
        forbiddenCountriesListPacked: forbiddenCountriesListPacked as [
          BigNumberish,
          BigNumberish,
          BigNumberish,
          BigNumberish,
        ],
        ofacEnabled: [false, false, false] as [boolean, boolean, boolean],
      };

      await deployedActors.testSelfVerificationRoot.setVerificationConfig(verificationConfigV2);

      const inputs = generateSelfricaDiscloseInput(
        NON_OFAC_DUMMY_INPUT,
        nameAndDob_smt,
        nameAndYob_smt,
        tree,
        false,
        scopeAsBigInt.toString(),
        newUserIdentifierHash.toString(),
        [
          "GENDER",
          "FULL_NAME",
          "DOB",
          "ID_NUMBER",
          "ISSUANCE_DATE",
          "EXPIRY_DATE",
          "COUNTRY",
          "GENDER",
          "ADDRESS",
        ],
        undefined,
        18,
        false,
        scopeAsBigInt.toString(),
      );

      const newProof = await generateVcAndDiscloseSelfricaProof(inputs);
      const attestationId = ethers.zeroPadValue(ethers.toBeHex(BigInt(SELFRICA_ATTESTATION_ID)), 32);
      const encodedProof = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] pubSignals)"],
        [
          [newProof.a, newProof.b, newProof.c, newProof.pubSignals],
        ],
      );
      const proofData = ethers.solidityPacked(["bytes32", "bytes"], [attestationId, encodedProof]);

      await expect(
        deployedActors.testSelfVerificationRoot.verifySelfProof(proofData, userContextData),
      ).to.be.revertedWithCustomError(deployedActors.hubImplV2, "CrossChainIsNotSupportedYet");
    });

    it("should fail verification with invalid msg sender to call onVerificationSuccess", async () => {
      const mockOutput = ethers.toUtf8Bytes("mock-verification-output");
      const mockUserData = ethers.toUtf8Bytes("mock-user-data");

      // Try to call onVerificationSuccess directly from a non-hub address
      await expect(
        deployedActors.testSelfVerificationRoot
          .connect(deployedActors.user1)
          .onVerificationSuccess(mockOutput, mockUserData),
      ).to.be.revertedWithCustomError(deployedActors.testSelfVerificationRoot, "UnauthorizedCaller");

      // Also test with owner account (should still fail)
      await expect(
        deployedActors.testSelfVerificationRoot
          .connect(deployedActors.owner)
          .onVerificationSuccess(mockOutput, mockUserData),
      ).to.be.revertedWithCustomError(deployedActors.testSelfVerificationRoot, "UnauthorizedCaller");
    });
  });
});
