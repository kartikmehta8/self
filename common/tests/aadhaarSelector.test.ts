// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

import { describe, expect, it } from 'vitest';

import {
  type AadhaarField,
  createSelector,
  MAX_FIELD_BYTE_SIZE,
  NAME_MAX_LENGTH,
  SELECTOR_BITS,
} from '../src/utils/aadhaar/constants.js';

/**
 * Helper to convert bigint selector to bit array for easier verification
 */
function selectorToBitArray(selector: bigint): number[] {
  const bits: number[] = [];
  for (let i = 0; i < 121; i++) {
    bits.push(Number((selector >> BigInt(i)) & 1n));
  }
  return bits;
}

/**
 * Helper to check if specific bit positions are set in the selector
 */
function areBitsSet(selector: bigint, positions: readonly number[]): boolean {
  for (const pos of positions) {
    if (((selector >> BigInt(pos)) & 1n) !== 1n) {
      return false;
    }
  }
  return true;
}

/**
 * Helper to check if specific bit positions are NOT set in the selector
 */
function areBitsUnset(selector: bigint, positions: readonly number[]): boolean {
  for (const pos of positions) {
    if (((selector >> BigInt(pos)) & 1n) !== 0n) {
      return false;
    }
  }
  return true;
}

describe('createSelector', () => {
  describe('basic field selection', () => {
    it('should return 0n when no fields are provided', () => {
      const selector = createSelector([]);
      expect(selector).toBe(0n);
    });

    it('should set GENDER bit (position 0)', () => {
      const selector = createSelector(['GENDER']);
      expect(areBitsSet(selector, SELECTOR_BITS.GENDER)).toBe(true);
      // Verify only bit 0 is set
      expect(selector).toBe(1n);
    });

    it('should set YEAR_OF_BIRTH bits (positions 1-4)', () => {
      const selector = createSelector(['YEAR_OF_BIRTH']);
      expect(areBitsSet(selector, SELECTOR_BITS.YEAR_OF_BIRTH)).toBe(true);
      // Bits 1, 2, 3, 4 = 2 + 4 + 8 + 16 = 30
      expect(selector).toBe(30n);
    });

    it('should set MONTH_OF_BIRTH bits (positions 5-6)', () => {
      const selector = createSelector(['MONTH_OF_BIRTH']);
      expect(areBitsSet(selector, SELECTOR_BITS.MONTH_OF_BIRTH)).toBe(true);
      // Bits 5, 6 = 32 + 64 = 96
      expect(selector).toBe(96n);
    });

    it('should set DAY_OF_BIRTH bits (positions 7-8)', () => {
      const selector = createSelector(['DAY_OF_BIRTH']);
      expect(areBitsSet(selector, SELECTOR_BITS.DAY_OF_BIRTH)).toBe(true);
      // Bits 7, 8 = 128 + 256 = 384
      expect(selector).toBe(384n);
    });

    it('should set NAME bits (positions 9-70)', () => {
      const selector = createSelector(['NAME']);
      expect(areBitsSet(selector, SELECTOR_BITS.NAME)).toBe(true);
      // Verify all 62 bits for NAME are set
      expect(SELECTOR_BITS.NAME.length).toBe(NAME_MAX_LENGTH); // 62
    });

    it('should set AADHAAR_LAST_4_DIGITS bits (positions 71-74)', () => {
      const selector = createSelector(['AADHAAR_LAST_4_DIGITS']);
      expect(areBitsSet(selector, SELECTOR_BITS.AADHAAR_LAST_4_DIGITS)).toBe(true);
    });

    it('should set PINCODE bits (positions 75-80)', () => {
      const selector = createSelector(['PINCODE']);
      expect(areBitsSet(selector, SELECTOR_BITS.PINCODE)).toBe(true);
    });

    it('should set STATE bits (positions 81-111)', () => {
      const selector = createSelector(['STATE']);
      expect(areBitsSet(selector, SELECTOR_BITS.STATE)).toBe(true);
      // Verify all 31 bits for STATE are set
      expect(SELECTOR_BITS.STATE.length).toBe(MAX_FIELD_BYTE_SIZE); // 31
    });

    it('should set PHONE_LAST_4_DIGITS bits (positions 112-115)', () => {
      const selector = createSelector(['PHONE_LAST_4_DIGITS']);
      expect(areBitsSet(selector, SELECTOR_BITS.PHONE_LAST_4_DIGITS)).toBe(true);
    });

    it('should set PHOTO_HASH bit (position 116)', () => {
      const selector = createSelector(['PHOTO_HASH' as AadhaarField]);
      expect(areBitsSet(selector, SELECTOR_BITS.PHOTO_HASH)).toBe(true);
      // Verify only bit 116 is set
      expect(selector).toBe(1n << 116n);
    });

    it('should set OFAC_NAME_DOB_CHECK bit (position 117)', () => {
      const selector = createSelector(['OFAC_NAME_DOB_CHECK']);
      expect(areBitsSet(selector, SELECTOR_BITS.OFAC_NAME_DOB_CHECK)).toBe(true);
      expect(selector).toBe(1n << 117n);
    });

    it('should set OFAC_NAME_YOB_CHECK bit (position 118)', () => {
      const selector = createSelector(['OFAC_NAME_YOB_CHECK']);
      expect(areBitsSet(selector, SELECTOR_BITS.OFAC_NAME_YOB_CHECK)).toBe(true);
      expect(selector).toBe(1n << 118n);
    });
  });

  describe('MINIMUM_AGE_VALID special case', () => {
    it('should return 0n when only MINIMUM_AGE_VALID is provided (no selector bit)', () => {
      const selector = createSelector(['MINIMUM_AGE_VALID']);
      expect(selector).toBe(0n);
    });

    it('should ignore MINIMUM_AGE_VALID when combined with other fields', () => {
      const selectorWithMinAge = createSelector(['GENDER', 'MINIMUM_AGE_VALID']);
      const selectorWithoutMinAge = createSelector(['GENDER']);
      expect(selectorWithMinAge).toBe(selectorWithoutMinAge);
    });
  });

  describe('multiple field selection', () => {
    it('should combine multiple fields correctly', () => {
      const selector = createSelector(['GENDER', 'YEAR_OF_BIRTH']);
      // GENDER: bit 0 = 1
      // YEAR_OF_BIRTH: bits 1-4 = 30
      // Total = 31
      expect(selector).toBe(31n);
    });

    it('should handle all date-related fields', () => {
      const selector = createSelector(['YEAR_OF_BIRTH', 'MONTH_OF_BIRTH', 'DAY_OF_BIRTH']);
      expect(areBitsSet(selector, SELECTOR_BITS.YEAR_OF_BIRTH)).toBe(true);
      expect(areBitsSet(selector, SELECTOR_BITS.MONTH_OF_BIRTH)).toBe(true);
      expect(areBitsSet(selector, SELECTOR_BITS.DAY_OF_BIRTH)).toBe(true);
      // Bits 1-8 = 2+4+8+16+32+64+128+256 = 510
      expect(selector).toBe(510n);
    });

    it('should handle location fields', () => {
      const selector = createSelector(['PINCODE', 'STATE']);
      expect(areBitsSet(selector, SELECTOR_BITS.PINCODE)).toBe(true);
      expect(areBitsSet(selector, SELECTOR_BITS.STATE)).toBe(true);
    });

    it('should handle OFAC check fields', () => {
      const selector = createSelector(['OFAC_NAME_DOB_CHECK', 'OFAC_NAME_YOB_CHECK']);
      expect(areBitsSet(selector, SELECTOR_BITS.OFAC_NAME_DOB_CHECK)).toBe(true);
      expect(areBitsSet(selector, SELECTOR_BITS.OFAC_NAME_YOB_CHECK)).toBe(true);
      // Bits 117 and 118
      expect(selector).toBe((1n << 117n) + (1n << 118n));
    });

    it('should handle all selectable fields', () => {
      const allFields: AadhaarField[] = [
        'GENDER',
        'YEAR_OF_BIRTH',
        'MONTH_OF_BIRTH',
        'DAY_OF_BIRTH',
        'NAME',
        'AADHAAR_LAST_4_DIGITS',
        'PINCODE',
        'STATE',
        'PHONE_LAST_4_DIGITS',
        'OFAC_NAME_DOB_CHECK',
        'OFAC_NAME_YOB_CHECK',
      ];
      const selector = createSelector(allFields);

      // Verify all expected bits are set
      for (const field of allFields) {
        const selectorBits = SELECTOR_BITS[field as keyof typeof SELECTOR_BITS];
        expect(areBitsSet(selector, selectorBits)).toBe(true);
      }
    });
  });

  describe('customNameSelectorBits', () => {
    it('should apply custom name selector bits when NAME is not in fieldsToReveal', () => {
      // Create custom bits for the first 10 characters of name
      const customBits = Array(NAME_MAX_LENGTH).fill(0);
      customBits[0] = 1;
      customBits[1] = 1;
      customBits[2] = 1;

      const selector = createSelector([], customBits);

      // Bits 9, 10, 11 should be set (NAME starts at position 9)
      expect(areBitsSet(selector, [9, 10, 11])).toBe(true);
      // Other NAME bits should not be set
      expect(areBitsUnset(selector, [12, 13, 14])).toBe(true);
    });

    it('should not override NAME bits when customNameSelectorBits is all zeros', () => {
      // NAME field sets all bits 9-70 to 1
      // Custom bits with all 0s should NOT override these 1s (1 | 0 = 1)
      const customBits = Array(NAME_MAX_LENGTH).fill(0);

      const selectorWithZeroCustomBits = createSelector(['NAME'], customBits);
      const selectorWithoutCustomBits = createSelector(['NAME']);

      // Both should be identical - all NAME bits should remain set
      expect(selectorWithZeroCustomBits).toBe(selectorWithoutCustomBits);

      // Verify all NAME bits are still set to 1
      const bits = selectorToBitArray(selectorWithZeroCustomBits);
      for (let i = 0; i < NAME_MAX_LENGTH; i++) {
        expect(bits[9 + i]).toBe(1);
      }
    });

    it('should merge custom name bits with NAME field selection using OR', () => {
      // NAME field sets all bits 9-70
      // Custom bits with some 1s should OR with the NAME bits
      const customBits = Array(NAME_MAX_LENGTH).fill(0);
      customBits[0] = 1; // Already set by NAME
      customBits[5] = 1; // Already set by NAME

      const selectorWithCustom = createSelector(['NAME'], customBits);
      const selectorWithoutCustom = createSelector(['NAME']);

      // Should be the same since OR with 1 = 1
      expect(selectorWithCustom).toBe(selectorWithoutCustom);
    });

    it('should allow partial name revelation with custom bits', () => {
      // Reveal only first name (first 20 characters)
      const customBits = Array(NAME_MAX_LENGTH).fill(0);
      for (let i = 0; i < 20; i++) {
        customBits[i] = 1;
      }

      const selector = createSelector([], customBits);
      const bits = selectorToBitArray(selector);

      // Positions 9-28 should be set (NAME starts at 9)
      for (let i = 9; i < 29; i++) {
        expect(bits[i]).toBe(1);
      }
      // Positions 29-70 should not be set
      for (let i = 29; i <= 70; i++) {
        expect(bits[i]).toBe(0);
      }
    });

    it('should handle custom bits for last name only', () => {
      // Reveal only last name (last 20 characters)
      const customBits = Array(NAME_MAX_LENGTH).fill(0);
      for (let i = NAME_MAX_LENGTH - 20; i < NAME_MAX_LENGTH; i++) {
        customBits[i] = 1;
      }

      const selector = createSelector([], customBits);
      const bits = selectorToBitArray(selector);

      // First 42 NAME bits should not be set
      for (let i = 9; i < 9 + NAME_MAX_LENGTH - 20; i++) {
        expect(bits[i]).toBe(0);
      }
      // Last 20 NAME bits should be set
      for (let i = 9 + NAME_MAX_LENGTH - 20; i <= 70; i++) {
        expect(bits[i]).toBe(1);
      }
    });

    it('should combine custom name bits with other fields', () => {
      const customBits = Array(NAME_MAX_LENGTH).fill(0);
      customBits[0] = 1;
      customBits[1] = 1;

      const selector = createSelector(['GENDER', 'YEAR_OF_BIRTH'], customBits);
      const bits = selectorToBitArray(selector);

      // GENDER bit should be set
      expect(bits[0]).toBe(1);
      // YEAR_OF_BIRTH bits should be set
      for (let i = 1; i <= 4; i++) {
        expect(bits[i]).toBe(1);
      }
      // Custom name bits at positions 9 and 10 should be set
      expect(bits[9]).toBe(1);
      expect(bits[10]).toBe(1);
      // Other name positions should not be set
      expect(bits[11]).toBe(0);
    });

    it('should handle alternating pattern in custom name bits', () => {
      // Alternate pattern: every other character
      const customBits = Array(NAME_MAX_LENGTH).fill(0);
      for (let i = 0; i < NAME_MAX_LENGTH; i += 2) {
        customBits[i] = 1;
      }

      const selector = createSelector([], customBits);
      const bits = selectorToBitArray(selector);

      // Check alternating pattern starting from position 9
      for (let i = 0; i < NAME_MAX_LENGTH; i++) {
        const bitPos = 9 + i;
        if (i % 2 === 0) {
          expect(bits[bitPos]).toBe(1);
        } else {
          expect(bits[bitPos]).toBe(0);
        }
      }
    });

    it('should handle empty custom name bits array', () => {
      const customBits = Array(NAME_MAX_LENGTH).fill(0);

      const selector = createSelector(['GENDER'], customBits);
      const selectorWithoutCustom = createSelector(['GENDER']);

      expect(selector).toBe(selectorWithoutCustom);
    });

    it('should handle all-ones custom name bits', () => {
      const customBits = Array(NAME_MAX_LENGTH).fill(1);

      const selector = createSelector([], customBits);
      const selectorWithName = createSelector(['NAME']);

      // Should be equivalent to selecting NAME field
      expect(selector).toBe(selectorWithName);
    });

    it('should handle custom bits shorter than NAME_MAX_LENGTH without underflow', () => {
      // If custom bits is shorter, it should only set the provided positions
      // and not cause any underflow/undefined access issues
      const customBits = [1, 1, 1]; // Only 3 bits

      const selector = createSelector([], customBits);
      const bits = selectorToBitArray(selector);

      // Only first 3 NAME positions should be set
      expect(bits[9]).toBe(1);
      expect(bits[10]).toBe(1);
      expect(bits[11]).toBe(1);

      // Remaining NAME positions should be 0 (not NaN or undefined behavior)
      for (let i = 12; i <= 70; i++) {
        expect(bits[i]).toBe(0);
      }

      // Other bits outside NAME range should be unaffected
      expect(bits[0]).toBe(0); // GENDER
      expect(bits[71]).toBe(0); // AADHAAR_LAST_4_DIGITS start
    });

    it('should handle very short custom bits (single element) without underflow', () => {
      const customBits = [1]; // Only 1 bit

      const selector = createSelector([], customBits);
      const bits = selectorToBitArray(selector);

      // Only first NAME position should be set
      expect(bits[9]).toBe(1);

      // All other NAME positions should be 0
      for (let i = 10; i <= 70; i++) {
        expect(bits[i]).toBe(0);
      }
    });

    it('should handle empty custom bits array without issues', () => {
      const customBits: number[] = []; // Empty array

      const selector = createSelector([], customBits);

      // Should return 0n since no fields selected and no custom bits
      expect(selector).toBe(0n);

      // Verify no bits are set
      const bits = selectorToBitArray(selector);
      for (let i = 0; i < 121; i++) {
        expect(bits[i]).toBe(0);
      }
    });

    it('should handle custom bits longer than NAME_MAX_LENGTH without overflow', () => {
      // Extra elements beyond NAME_MAX_LENGTH should be ignored
      // and should NOT affect bits outside the NAME range
      const customBits = Array(NAME_MAX_LENGTH + 50).fill(1); // 112 bits (62 + 50 extra)

      const selector = createSelector([], customBits);
      const bits = selectorToBitArray(selector);

      // All NAME positions (9-70) should be set
      for (let i = 9; i <= 70; i++) {
        expect(bits[i]).toBe(1);
      }

      // Bits BEFORE NAME range should NOT be affected (no overflow into lower bits)
      for (let i = 0; i <= 8; i++) {
        expect(bits[i]).toBe(0);
      }

      // Bits AFTER NAME range should NOT be affected (no overflow into higher bits)
      // These would be AADHAAR_LAST_4_DIGITS (71-74), PINCODE (75-80), etc.
      for (let i = 71; i <= 120; i++) {
        expect(bits[i]).toBe(0);
      }
    });

    it('should handle custom bits much longer than NAME_MAX_LENGTH safely', () => {
      // Test with a significantly larger array to ensure no buffer overflow
      const customBits = Array(500).fill(1); // Way more than needed

      const selector = createSelector([], customBits);
      const selectorWithName = createSelector(['NAME']);

      // Should be equivalent to just selecting NAME - extra bits ignored
      expect(selector).toBe(selectorWithName);

      // Verify only NAME bits are set, nothing else
      const bits = selectorToBitArray(selector);
      for (let i = 0; i < 121; i++) {
        if (i >= 9 && i <= 70) {
          expect(bits[i]).toBe(1);
        } else {
          expect(bits[i]).toBe(0);
        }
      }
    });

    it('should handle custom bits with mixed values at boundary', () => {
      // Set bits at the boundaries of the NAME range
      const customBits = Array(NAME_MAX_LENGTH).fill(0);
      customBits[0] = 1; // First NAME bit (position 9)
      customBits[NAME_MAX_LENGTH - 1] = 1; // Last NAME bit (position 70)

      const selector = createSelector([], customBits);
      const bits = selectorToBitArray(selector);

      // First and last NAME bits should be set
      expect(bits[9]).toBe(1);
      expect(bits[70]).toBe(1);

      // Middle NAME bits should not be set
      for (let i = 10; i < 70; i++) {
        expect(bits[i]).toBe(0);
      }

      // Adjacent bits outside NAME range should not be affected
      expect(bits[8]).toBe(0); // DAY_OF_BIRTH end
      expect(bits[71]).toBe(0); // AADHAAR_LAST_4_DIGITS start
    });

    it('should use bitwise OR for merging custom bits', () => {
      // Test that OR logic works: 0 | 1 = 1, 1 | 0 = 1, 1 | 1 = 1, 0 | 0 = 0
      const customBits = Array(NAME_MAX_LENGTH).fill(0);
      customBits[0] = 1;

      // When NAME is selected, bit at position 9 is already 1
      // OR with custom bit 1 should still be 1
      const selector = createSelector(['NAME'], customBits);
      const bits = selectorToBitArray(selector);

      expect(bits[9]).toBe(1); // 1 | 1 = 1
    });
  });

  describe('selector bit positions verification', () => {
    it('should have correct SELECTOR_BITS positions', () => {
      expect(SELECTOR_BITS.GENDER).toEqual([0]);
      expect(SELECTOR_BITS.YEAR_OF_BIRTH).toEqual([1, 2, 3, 4]);
      expect(SELECTOR_BITS.MONTH_OF_BIRTH).toEqual([5, 6]);
      expect(SELECTOR_BITS.DAY_OF_BIRTH).toEqual([7, 8]);
      expect(SELECTOR_BITS.AADHAAR_LAST_4_DIGITS).toEqual([71, 72, 73, 74]);
      expect(SELECTOR_BITS.PINCODE).toEqual([75, 76, 77, 78, 79, 80]);
      expect(SELECTOR_BITS.PHONE_LAST_4_DIGITS).toEqual([112, 113, 114, 115]);
      expect(SELECTOR_BITS.PHOTO_HASH).toEqual([116]);
      expect(SELECTOR_BITS.OFAC_NAME_DOB_CHECK).toEqual([117]);
      expect(SELECTOR_BITS.OFAC_NAME_YOB_CHECK).toEqual([118]);
    });

    it('should have correct NAME positions (9-70)', () => {
      const nameBits = SELECTOR_BITS.NAME;
      expect(nameBits.length).toBe(62);
      expect(nameBits[0]).toBe(9);
      expect(nameBits[61]).toBe(70);
    });

    it('should have correct STATE positions (81-111)', () => {
      const stateBits = SELECTOR_BITS.STATE;
      expect(stateBits.length).toBe(31);
      expect(stateBits[0]).toBe(81);
      expect(stateBits[30]).toBe(111);
    });
  });

  describe('edge cases', () => {
    it('should handle duplicate fields', () => {
      const selector = createSelector(['GENDER', 'GENDER', 'GENDER']);
      const selectorOnce = createSelector(['GENDER']);
      expect(selector).toBe(selectorOnce);
    });

    it('should return bigint type', () => {
      const selector = createSelector(['GENDER']);
      expect(typeof selector).toBe('bigint');
    });

    it('should produce a valid bigint for all fields combined', () => {
      const allFields: AadhaarField[] = [
        'GENDER',
        'YEAR_OF_BIRTH',
        'MONTH_OF_BIRTH',
        'DAY_OF_BIRTH',
        'NAME',
        'AADHAAR_LAST_4_DIGITS',
        'PINCODE',
        'STATE',
        'PHONE_LAST_4_DIGITS',
        'OFAC_NAME_DOB_CHECK',
        'OFAC_NAME_YOB_CHECK',
      ];
      const selector = createSelector(allFields);

      // Should be a positive bigint
      expect(selector > 0n).toBe(true);

      // Should be less than 2^121 (max 121 bits)
      expect(selector < 2n ** 121n).toBe(true);
    });

    it('should handle PHOTO_HASH as a field (via type casting)', () => {
      // PHOTO_HASH is in SELECTOR_BITS but not in AadhaarField type
      // The function should handle it via the 'as keyof typeof SELECTOR_BITS' cast
      const selector = createSelector(['PHOTO_HASH' as AadhaarField]);
      expect(selector).toBe(1n << 116n);
    });
  });
});
