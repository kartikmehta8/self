import test, { describe } from 'node:test';
import assert from 'node:assert';
import { formatRevealedDataPacked, removeNullBytes } from '../src/utils/id.js';
import { bytesCount } from '../src/utils/proof.js';
import { discloseIndices } from '../src/utils/constants.js';
import { AttestationId } from '../src/types/types.js';

/**
 * Helper to pack an array of bytes into BigInt values for public signals.
 * Each BigInt packs `bytesPerSignal` bytes in little-endian order.
 */
function packBytesToBigInts(bytes: number[], byteCounts: number[]): bigint[] {
  const result: bigint[] = [];
  let byteIndex = 0;

  for (const count of byteCounts) {
    let packed = 0n;
    for (let i = 0; i < count; i++) {
      const byte = bytes[byteIndex] ?? 0;
      packed |= BigInt(byte) << BigInt(i * 8);
      byteIndex++;
    }
    result.push(packed);
  }

  return result;
}

/**
 * Creates mock public signals for passport (attestationId=1) with the given name.
 * Fills other required fields with default values.
 */
function createMockPublicSignals(name: string, attestationId: AttestationId = 1): string[] {
  const indices = discloseIndices[attestationId];
  // @ts-ignore
  const byteCountsForId = bytesCount[attestationId];
  const totalBytes = byteCountsForId.reduce((a, b) => a + b, 0);

  // Create byte array filled with zeros
  const bytes = new Array(totalBytes).fill(0);

  // For passport (id=1): name is at bytes 5-43
  // For biometric ID (id=2): name is at bytes 60-89
  // For aadhaar (id=3): name is at bytes 9-70
  const nameStartMap: Record<AttestationId, number> = { 1: 5, 2: 60, 3: 9 };
  const nameEndMap: Record<AttestationId, number> = { 1: 43, 2: 89, 3: 70 };

  const nameStart = nameStartMap[attestationId];
  const nameEnd = nameEndMap[attestationId];
  const maxNameLength = nameEnd - nameStart + 1;

  // Fill name bytes
  for (let i = 0; i < Math.min(name.length, maxNameLength); i++) {
    bytes[nameStart + i] = name.charCodeAt(i);
  }

  // Pack bytes into BigInts
  const packedBigInts = packBytesToBigInts(bytes, byteCountsForId);

  // Create public signals array with enough slots
  const publicSignals: string[] = new Array(25).fill('0');

  // Set packed revealed data
  for (let i = 0; i < packedBigInts.length; i++) {
    publicSignals[indices.revealedDataPackedIndex + i] = packedBigInts[i].toString();
  }

  // Set nullifier
  publicSignals[indices.nullifierIndex] = '12345678901234567890';

  return publicSignals;
}

describe('removeNullBytes', () => {
  test('removes null bytes from string', () => {
    assert.strictEqual(removeNullBytes('hello\x00world'), 'helloworld');
    assert.strictEqual(removeNullBytes('\x00\x00test\x00'), 'test');
    assert.strictEqual(removeNullBytes('noNulls'), 'noNulls');
  });
});

describe('formatRevealedDataPacked - name parsing', () => {
  test('parses simple name without separators', () => {
    const publicSignals = createMockPublicSignals('ERIKSSON');
    const result = formatRevealedDataPacked(1, publicSignals);

    assert.strictEqual(result.name, 'ERIKSSON');
    // Without << separator, firstName and lastName are empty
    assert.strictEqual(result.firstName, '');
    assert.strictEqual(result.lastName, '');
  });

  test('parses name with single < separators (spaces between parts)', () => {
    // Single < between capital letters becomes a space
    const publicSignals = createMockPublicSignals('ANNA<MARIA');
    const result = formatRevealedDataPacked(1, publicSignals);

    // The regex ([A-Z])<+([A-Z]) replaces A<M with 'A M'
    assert.strictEqual(result.name, 'ANNA MARIA');
    assert.strictEqual(result.firstName, '');
    assert.strictEqual(result.lastName, '');
  });

  test('parses MRZ-style name with << separator', () => {
    // MRZ format: LASTNAME<<FIRSTNAME
    const publicSignals = createMockPublicSignals('ERIKSSON<<ANNA');
    const result = formatRevealedDataPacked(1, publicSignals);

    assert.strictEqual(result.name, 'ERIKSSON ANNA');
    assert.strictEqual(result.firstName, 'ANNA');
    assert.strictEqual(result.lastName, 'ERIKSSON');
  });

  test('parses MRZ-style name with multiple < in first name', () => {
    // LASTNAME<<FIRSTNAME<MIDDLENAME - standard MRZ format
    const publicSignals = createMockPublicSignals('ERIKSSON<<ANNA<MARIA');
    const result = formatRevealedDataPacked(1, publicSignals);

    assert.strictEqual(result.name, 'ERIKSSON ANNA MARIA');
    // firstName includes all parts after << with < replaced by nothing
    assert.strictEqual(result.firstName, 'ANNA MARIA');
    assert.strictEqual(result.lastName, 'ERIKSSON');
  });

  test('handles name with trailing < characters', () => {
    const publicSignals = createMockPublicSignals('ERIKSSON<<<<<<');
    const result = formatRevealedDataPacked(1, publicSignals);

    // Contains << so triggers split: lastName='ERIKSSON', firstName='' (trailing < removed)
    assert.strictEqual(result.name, 'ERIKSSON');
    assert.strictEqual(result.firstName, '');
    assert.strictEqual(result.lastName, 'ERIKSSON');
  });

  test('handles name with leading < characters', () => {
    const publicSignals = createMockPublicSignals('<<<ERIKSSON');
    const result = formatRevealedDataPacked(1, publicSignals);

    // Contains << so triggers split: lastName='', firstName='ERIKSSON' (leading < removed)
    assert.strictEqual(result.name, 'ERIKSSON');
    assert.strictEqual(result.firstName, 'ERIKSSON');
    assert.strictEqual(result.lastName, '');
  });

  test('handles empty name', () => {
    const publicSignals = createMockPublicSignals('');
    const result = formatRevealedDataPacked(1, publicSignals);

    assert.strictEqual(result.name, '');
    assert.strictEqual(result.firstName, '');
    assert.strictEqual(result.lastName, '');
  });

  test('handles name with only < characters', () => {
    const publicSignals = createMockPublicSignals('<<<<<<<');
    const result = formatRevealedDataPacked(1, publicSignals);

    assert.strictEqual(result.name, '');
    assert.strictEqual(result.firstName, '');
    assert.strictEqual(result.lastName, '');
  });

  test('handles complex MRZ name format with suffix', () => {
    // Full MRZ style with multiple name parts
    const publicSignals = createMockPublicSignals('ERIKSSON<<ANNA<MARIA<SOFIA');
    const result = formatRevealedDataPacked(1, publicSignals);

    assert.strictEqual(result.name, 'ERIKSSON ANNA MARIA SOFIA');
    assert.strictEqual(result.firstName, 'ANNA MARIA SOFIA');
    assert.strictEqual(result.lastName, 'ERIKSSON');
  });
});
