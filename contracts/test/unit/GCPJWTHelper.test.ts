import { expect } from "chai";
import { ethers } from "hardhat";
import { TestGCPJWTHelper, MockGCPJWTVerifier } from "../../typechain-types";

describe("GCPJWTHelper", function () {
  let testHelper: TestGCPJWTHelper;

  before(async function () {
    const TestGCPJWTHelperFactory = await ethers.getContractFactory("TestGCPJWTHelper");
    testHelper = await TestGCPJWTHelperFactory.deploy();
    await testHelper.waitForDeployment();
  });

  describe("unpackAndConvertImageHash", function () {
    // Known test vectors from TypeScript implementation
    // These values pack to the hex string: "d2221a0ee83901980c607ceff2edbedf3f6ce5f437eafa5d89be39e9e7487c04"
    const testDigest = {
      p0: 177384435506496807268973340845468654286294928521500580044819492874465981028n,
      p1: 175298970718174405520284770870231222447414486446296682893283627688949855078n,
      p2: 13360n,
    };

    // Expected hash bytes (32 bytes)
    const expectedHashHex = "d2221a0ee83901980c607ceff2edbedf3f6ce5f437eafa5d89be39e9e7487c04";

    it("should return 48 bytes with correct structure", async function () {
      const result = await testHelper.testUnpackAndConvertImageHash(
        testDigest.p0,
        testDigest.p1,
        testDigest.p2,
      );

      // Should be 48 bytes total
      expect(ethers.getBytes(result).length).to.equal(48);
    });

    it("should have 16 leading zero bytes (PCR0 padding)", async function () {
      const result = await testHelper.testUnpackAndConvertImageHash(
        testDigest.p0,
        testDigest.p1,
        testDigest.p2,
      );

      const bytes = ethers.getBytes(result);

      // First 16 bytes should be zeros
      for (let i = 0; i < 16; i++) {
        expect(bytes[i]).to.equal(0, `Byte at index ${i} should be 0`);
      }
    });

    it("should correctly convert hex string to hash bytes", async function () {
      const result = await testHelper.testUnpackAndConvertImageHash(
        testDigest.p0,
        testDigest.p1,
        testDigest.p2,
      );

      const bytes = ethers.getBytes(result);

      // Last 32 bytes should match the expected hash
      const actualHashBytes = bytes.slice(16);
      const expectedHashBytes = ethers.getBytes("0x" + expectedHashHex);

      for (let i = 0; i < 32; i++) {
        expect(actualHashBytes[i]).to.equal(
          expectedHashBytes[i],
          `Hash byte at index ${i} mismatch`,
        );
      }
    });

    it("should handle zeros correctly", async function () {
      // All zeros should produce all zero output
      const result = await testHelper.testUnpackAndConvertImageHash(0n, 0n, 0n);
      const bytes = ethers.getBytes(result);

      for (let i = 0; i < 48; i++) {
        expect(bytes[i]).to.equal(0, `Byte at index ${i} should be 0`);
      }
    });

    it("should correctly parse individual hex characters", async function () {
      // Test that the first byte of the hash (after padding) is correct
      // The hex string starts with "d2", so first hash byte should be 0xd2 = 210
      const byte16 = await testHelper.testGetImageHashByte(
        testDigest.p0,
        testDigest.p1,
        testDigest.p2,
        16,
      );

      expect(byte16).to.equal(0xd2);
    });

    it("should handle lowercase hex characters (a-f)", async function () {
      // The test digest contains lowercase hex chars like 'e', 'f', 'a', 'b', 'c', 'd'
      // Hex string: d2221a0ee83901980c607ceff2edbedf3f6ce5f437eafa5d89be39e9e7487c04
      // Verify specific bytes that use these chars
      const result = await testHelper.testUnpackAndConvertImageHash(
        testDigest.p0,
        testDigest.p1,
        testDigest.p2,
      );

      const bytes = ethers.getBytes(result);

      // "be" at hash position 14 (result[16+14] = result[30]) should be 0xbe = 190
      expect(bytes[30]).to.equal(0xbe);

      // "df" at hash position 15 (result[16+15] = result[31]) should be 0xdf = 223
      expect(bytes[31]).to.equal(0xdf);

      // "ef" at hash position 11 (result[16+11] = result[27]) should be 0xef = 239
      expect(bytes[27]).to.equal(0xef);
    });
  });

  describe("extractPubkeyCommitment", function () {
    // Known test vectors from TypeScript implementation
    // These values pack to the base64url string: "AmtPnrcj3vuhOo10QXjKfsQ2JZsLt7DqeeTHyLlicfUe"
    const testPubkey = {
      p0: 120528331859004517890829780969855117024568439798883539465419002021135281473n,
      p1: 8028474419668106797405631243633n,
      p2: 0n,
    };

    // Expected pubkey commitment (from TypeScript verification)
    const expectedCommitment = 1094227850017695624326559586424504982480957966087397748000597471445507011061n;

    it("should correctly decode base64url and extract commitment", async function () {
      const result = await testHelper.testExtractPubkeyCommitment(
        testPubkey.p0,
        testPubkey.p1,
        testPubkey.p2,
      );

      expect(result).to.equal(expectedCommitment);
    });

    it("should handle zeros correctly", async function () {
      // All zeros should produce zero output
      const result = await testHelper.testExtractPubkeyCommitment(0n, 0n, 0n);
      expect(result).to.equal(0n);
    });

    it("should produce consistent results", async function () {
      // Call multiple times to ensure deterministic behavior
      const result1 = await testHelper.testExtractPubkeyCommitment(
        testPubkey.p0,
        testPubkey.p1,
        testPubkey.p2,
      );

      const result2 = await testHelper.testExtractPubkeyCommitment(
        testPubkey.p0,
        testPubkey.p1,
        testPubkey.p2,
      );

      expect(result1).to.equal(result2);
    });

    it("should handle different base64url characters correctly", async function () {
      // The test string contains various base64url characters:
      // Uppercase: A-Z
      // Lowercase: a-z
      // Numbers: 0-9
      // Special: - and _ (though not in this particular test string)
      // The fact that we get the correct commitment proves all chars are decoded correctly
      const result = await testHelper.testExtractPubkeyCommitment(
        testPubkey.p0,
        testPubkey.p1,
        testPubkey.p2,
      );

      expect(result).to.equal(expectedCommitment);
    });
  });

  describe("Edge Cases", function () {
    it("should handle maximum single byte value in each field", async function () {
      // Pack a single byte 0xff ('ÿ') - not a valid hex char, should produce 0
      const result = await testHelper.testUnpackAndConvertImageHash(255n, 0n, 0n);
      const bytes = ethers.getBytes(result);

      // _hexToNibble returns 0 for invalid hex chars
      expect(bytes[16]).to.equal(0);
    });

    it("should handle field elements with partial data", async function () {
      // Only p0 has data, p1 and p2 are zero
      // Pack "00" as hex (two '0' characters = ASCII 48, 48)
      // 48 + (48 << 8) = 48 + 12288 = 12336
      const result = await testHelper.testUnpackAndConvertImageHash(12336n, 0n, 0n);
      const bytes = ethers.getBytes(result);

      // "00" hex should produce byte 0x00
      expect(bytes[16]).to.equal(0x00);
    });
  });
});

describe("MockGCPJWTVerifier", function () {
  let mockVerifier: MockGCPJWTVerifier;

  beforeEach(async function () {
    const MockGCPJWTVerifierFactory = await ethers.getContractFactory("MockGCPJWTVerifier");
    mockVerifier = await MockGCPJWTVerifierFactory.deploy();
    await mockVerifier.waitForDeployment();
  });

  const mockProofA: [bigint, bigint] = [1n, 2n];
  const mockProofB: [[bigint, bigint], [bigint, bigint]] = [
    [1n, 2n],
    [3n, 4n],
  ];
  const mockProofC: [bigint, bigint] = [1n, 2n];
  const mockPubSignals: [bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
    1n, 2n, 3n, 4n, 5n, 6n, 7n,
  ];

  describe("Default behavior", function () {
    it("should return true by default", async function () {
      const result = await mockVerifier.verifyProof(
        mockProofA,
        mockProofB,
        mockProofC,
        mockPubSignals,
      );
      expect(result).to.be.true;
    });

    it("should start with shouldVerify = true", async function () {
      expect(await mockVerifier.getShouldVerify()).to.be.true;
    });
  });

  describe("Configurable verification", function () {
    it("should return false when setShouldVerify(false) is called", async function () {
      await mockVerifier.setShouldVerify(false);
      expect(await mockVerifier.getShouldVerify()).to.be.false;

      const result = await mockVerifier.verifyProof(
        mockProofA,
        mockProofB,
        mockProofC,
        mockPubSignals,
      );

      expect(result).to.be.false;
    });

    it("should return true again after setShouldVerify(true)", async function () {
      await mockVerifier.setShouldVerify(false);
      await mockVerifier.setShouldVerify(true);
      expect(await mockVerifier.getShouldVerify()).to.be.true;

      const result = await mockVerifier.verifyProof(
        mockProofA,
        mockProofB,
        mockProofC,
        mockPubSignals,
      );

      expect(result).to.be.true;
    });

    it("should persist configuration across multiple calls", async function () {
      // Set to false
      await mockVerifier.setShouldVerify(false);

      // Multiple calls should all return false
      expect(await mockVerifier.verifyProof(mockProofA, mockProofB, mockProofC, mockPubSignals)).to.be.false;
      expect(await mockVerifier.verifyProof(mockProofA, mockProofB, mockProofC, mockPubSignals)).to.be.false;

      // Set back to true
      await mockVerifier.setShouldVerify(true);

      // Now should return true
      expect(await mockVerifier.verifyProof(mockProofA, mockProofB, mockProofC, mockPubSignals)).to.be.true;
    });
  });
});
