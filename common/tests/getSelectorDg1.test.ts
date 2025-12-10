// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

import { describe, expect, it } from 'vitest';

import { attributeToPosition, attributeToPosition_ID } from '../src/constants/constants.js';
import type { SelfAppDisclosureConfig } from '../src/utils/appType.js';
import { getSelectorDg1 } from '../src/utils/circuits/registerInputs.js';

const MOCK_MRZ_PASSPORT_FIRST_LINE = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
const MOCK_MRZ_PASSPORT_SECOND_LINE = 'L898902C36UTO7408122F1204159ZE184226B<<<<<10';

const MOCK_MRZ_PASSPORT = `${MOCK_MRZ_PASSPORT_FIRST_LINE}${MOCK_MRZ_PASSPORT_SECOND_LINE}`;

const MOCK_MRZ_ID_CARD_FIRST_LINE = 'I<UTOD231458907<<<<<<<<<<<<<<<';
const MOCK_MRZ_ID_CARD_SECOND_LINE = '7408122F1204159UTO<<<<<<<<<<<6';
const MOCK_MRZ_ID_CARD_THIRD_LINE = 'ERIKSSON<<ANNA<MARIA<<<<<<<<<<';

const MOCK_MRZ_ID_CARD = `${MOCK_MRZ_ID_CARD_FIRST_LINE}${MOCK_MRZ_ID_CARD_SECOND_LINE}${MOCK_MRZ_ID_CARD_THIRD_LINE}`;

function revealMRZByBitmap(mrz: string, selector: string): string {
  const selectorArray = selector.split('');
  const mrzArray = mrz.replace(/\n/g, '').split('');

  return selectorArray.map((bit, idx) => (bit === '1' ? (mrzArray[idx] ?? '0') : '0')).join('');
}

describe('getSelectorDg1', () => {
  it('throws an exception when first_name or last_name are enabled but mrz is not provided', () => {
    const disclosures: SelfAppDisclosureConfig = { first_name: true, last_name: true };

    expect(() => getSelectorDg1('passport', disclosures)).toThrow(
      'MRZ is required to generate dynamic selector DG1'
    );
  });

  describe('passport (88 character bitmap)', () => {
    it('test reveal', () => {
      expect(revealMRZByBitmap(MOCK_MRZ_PASSPORT, Array(88).fill('1').join(''))).toEqual(
        MOCK_MRZ_PASSPORT.replace(/\n/g, '').split('').join('')
      );

      expect(revealMRZByBitmap(MOCK_MRZ_PASSPORT, Array(88).fill('0').join(''))).toEqual(
        Array(88).fill('0').join('')
      );
    });

    it('reveals first name', () => {
      const firstNameSelectorForFirstLine = '00000000000001111111111111111111111111111111';

      expect(
        revealMRZByBitmap(MOCK_MRZ_PASSPORT_FIRST_LINE, firstNameSelectorForFirstLine)
      ).toEqual('0000000000000<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<');
    });

    it('reveals last name', () => {
      const lastNameSelectorForFirstLine = '00000111111111100000000000000000000000000000';

      expect(revealMRZByBitmap(MOCK_MRZ_PASSPORT_FIRST_LINE, lastNameSelectorForFirstLine)).toEqual(
        '00000ERIKSSON<<00000000000000000000000000000'
      );
    });

    it('should return all zeros when no disclosures are enabled', () => {
      const disclosures: SelfAppDisclosureConfig = {};
      const result = getSelectorDg1('passport', disclosures);

      expect(result).toBeDefined();
      expect(result!.length).toBe(88);
      expect(result!.every((bit) => bit === '0')).toBe(true);

      expect(revealMRZByBitmap(MOCK_MRZ_PASSPORT, (result as string[]).join(''))).toEqual(
        Array(88).fill('0').join('')
      );
    });

    it('should mark issuing_state positions (2-4) when enabled', () => {
      const disclosures: SelfAppDisclosureConfig = { issuing_state: true };
      const result = getSelectorDg1('passport', disclosures);

      expect(result).toBeDefined();
      // Positions 2, 3, 4 should be '1'
      expect(result![2]).toBe('1');
      expect(result![3]).toBe('1');
      expect(result![4]).toBe('1');
      // Adjacent positions should be '0'
      expect(result![1]).toBe('0');
      expect(result![5]).toBe('0');

      expect(revealMRZByBitmap(MOCK_MRZ_PASSPORT, (result as string[]).join(''))).toEqual(
        '00UTO00000000000000000000000000000000000000000000000000000000000000000000000000000000000'
      );
    });

    it('should mark name positions (5-43) when enabled', () => {
      const disclosures: SelfAppDisclosureConfig = { name: true };
      const result = getSelectorDg1('passport', disclosures);

      expect(result).toBeDefined();
      // First and last positions of name range
      expect(result![5]).toBe('1');
      expect(result![43]).toBe('1');
      // All positions in range should be '1'
      for (let i = 5; i <= 43; i++) {
        expect(result![i]).toBe('1');
      }
      // Adjacent positions should be '0'
      expect(result![4]).toBe('0');
      expect(result![44]).toBe('0');

      expect(revealMRZByBitmap(MOCK_MRZ_PASSPORT, (result as string[]).join(''))).toEqual(
        '00000ERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<00000000000000000000000000000000000000000000'
      );
    });

    it('should mark passport_number positions (44-52) when enabled', () => {
      const disclosures: SelfAppDisclosureConfig = { passport_number: true };
      const result = getSelectorDg1('passport', disclosures);

      expect(result).toBeDefined();
      for (let i = 44; i <= 52; i++) {
        expect(result![i]).toBe('1');
      }
      expect(result![43]).toBe('0');
      expect(result![53]).toBe('0');

      expect(revealMRZByBitmap(MOCK_MRZ_PASSPORT, (result as string[]).join(''))).toEqual(
        '00000000000000000000000000000000000000000000L898902C300000000000000000000000000000000000'
      );
    });

    it('should mark nationality positions (54-56) when enabled', () => {
      const disclosures: SelfAppDisclosureConfig = { nationality: true };
      const result = getSelectorDg1('passport', disclosures);

      expect(result).toBeDefined();
      for (let i = 54; i <= 56; i++) {
        expect(result![i]).toBe('1');
      }
      expect(result![53]).toBe('0');
      expect(result![57]).toBe('0');

      expect(revealMRZByBitmap(MOCK_MRZ_PASSPORT, (result as string[]).join(''))).toEqual(
        '000000000000000000000000000000000000000000000000000000UTO0000000000000000000000000000000'
      );
    });

    it('should mark date_of_birth positions (57-62) when enabled', () => {
      const disclosures: SelfAppDisclosureConfig = { date_of_birth: true };
      const result = getSelectorDg1('passport', disclosures);

      expect(result).toBeDefined();
      for (let i = 57; i <= 62; i++) {
        expect(result![i]).toBe('1');
      }

      expect(revealMRZByBitmap(MOCK_MRZ_PASSPORT, (result as string[]).join(''))).toEqual(
        '0000000000000000000000000000000000000000000000000000000007408120000000000000000000000000'
      );
    });

    it('should mark gender position (64) when enabled', () => {
      const disclosures: SelfAppDisclosureConfig = { gender: true };
      const result = getSelectorDg1('passport', disclosures);

      expect(result).toBeDefined();
      expect(result![64]).toBe('1');
      expect(result![63]).toBe('0');
      expect(result![65]).toBe('0');

      expect(revealMRZByBitmap(MOCK_MRZ_PASSPORT, (result as string[]).join(''))).toEqual(
        '0000000000000000000000000000000000000000000000000000000000000000F00000000000000000000000'
      );
    });

    it('should mark expiry_date positions (65-70) when enabled', () => {
      const disclosures: SelfAppDisclosureConfig = { expiry_date: true };
      const result = getSelectorDg1('passport', disclosures);

      expect(result).toBeDefined();
      for (let i = 65; i <= 70; i++) {
        expect(result![i]).toBe('1');
      }

      expect(revealMRZByBitmap(MOCK_MRZ_PASSPORT, (result as string[]).join(''))).toEqual(
        '0000000000000000000000000000000000000000000000000000000000000000012041500000000000000000'
      );
    });

    it('should handle multiple disclosures simultaneously', () => {
      const disclosures: SelfAppDisclosureConfig = {
        issuing_state: true,
        nationality: true,
        gender: true,
      };
      const result = getSelectorDg1('passport', disclosures);

      expect(result).toBeDefined();
      // issuing_state: 2-4
      for (let i = 2; i <= 4; i++) {
        expect(result![i]).toBe('1');
      }
      // nationality: 54-56
      for (let i = 54; i <= 56; i++) {
        expect(result![i]).toBe('1');
      }
      // gender: 64
      expect(result![64]).toBe('1');
      // Other positions should be '0'
      expect(result![0]).toBe('0');
      expect(result![50]).toBe('0');

      expect(revealMRZByBitmap(MOCK_MRZ_PASSPORT, (result as string[]).join(''))).toEqual(
        '00UTO0000000000000000000000000000000000000000000000000UTO0000000F00000000000000000000000'
      );
    });

    it('should handle multiple disclosures simultaneously (including dynamic first name)', () => {
      const disclosures: SelfAppDisclosureConfig = {
        issuing_state: true,
        first_name: true,
      };

      const result = getSelectorDg1('passport', disclosures, MOCK_MRZ_PASSPORT);
      const bitmap = result?.join('');

      expect(result?.join('')).toEqual(
        '0011100000000111111111111111111111111111111100000000000000000000000000000000000000000000'
      );

      expect(revealMRZByBitmap(MOCK_MRZ_PASSPORT, bitmap!)).toEqual(
        '00UTO00000000<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<00000000000000000000000000000000000000000000'
      );
    });

    it('should handle multiple disclosures simultaneously (including dynamic last name)', () => {
      const disclosures: SelfAppDisclosureConfig = {
        issuing_state: true,
        last_name: true,
      };

      const result = getSelectorDg1('passport', disclosures, MOCK_MRZ_PASSPORT);
      const bitmap = result?.join('');

      expect(result?.join('')).toEqual(
        '0011111111111110000000000000000000000000000000000000000000000000000000000000000000000000'
      );

      expect(revealMRZByBitmap(MOCK_MRZ_PASSPORT, bitmap!)).toEqual(
        '00UTOERIKSSON<<0000000000000000000000000000000000000000000000000000000000000000000000000'
      );
    });

    it('should handle first + last name as name disclosure', () => {
      const firstAndLastNameDisclosures: SelfAppDisclosureConfig = {
        first_name: true,
        last_name: true,
      };

      const firstAndLastNameDisclosuresSelector = getSelectorDg1(
        'passport',
        firstAndLastNameDisclosures,
        MOCK_MRZ_PASSPORT
      );
      const firstAndLastNameBitmap = firstAndLastNameDisclosuresSelector?.join('');

      const nameDisclosure: SelfAppDisclosureConfig = { name: true };
      const nameDisclosureSelector = getSelectorDg1('passport', nameDisclosure, MOCK_MRZ_PASSPORT);
      const nameDisclosureBitmap = nameDisclosureSelector?.join('');

      expect(firstAndLastNameBitmap).toEqual(nameDisclosureBitmap);
    });

    it('should ignore ofac disclosure (not mapped to positions)', () => {
      const disclosures: SelfAppDisclosureConfig = { ofac: true };
      const result = getSelectorDg1('passport', disclosures);

      expect(result).toBeDefined();
      expect(result!.every((bit) => bit === '0')).toBe(true);
    });

    it('should ignore excludedCountries disclosure (not mapped to positions)', () => {
      const disclosures: SelfAppDisclosureConfig = { excludedCountries: ['USA', 'GBR'] };
      const result = getSelectorDg1('passport', disclosures);

      expect(result).toBeDefined();
      expect(result!.every((bit) => bit === '0')).toBe(true);
    });

    it('should ignore minimumAge disclosure (not mapped to positions)', () => {
      const disclosures: SelfAppDisclosureConfig = { minimumAge: 18 };
      const result = getSelectorDg1('passport', disclosures);

      expect(result).toBeDefined();
      expect(result!.every((bit) => bit === '0')).toBe(true);
    });

    it('should handle disabled disclosures (false values)', () => {
      const disclosures: SelfAppDisclosureConfig = {
        issuing_state: false,
        name: false,
        passport_number: true,
        first_name: false,
        last_name: false,
      };
      const result = getSelectorDg1('passport', disclosures);

      expect(result).toBeDefined();
      // Only passport_number should be marked
      for (let i = 44; i <= 52; i++) {
        expect(result![i]).toBe('1');
      }
      // issuing_state and name should NOT be marked
      for (let i = 2; i <= 4; i++) {
        expect(result![i]).toBe('0');
      }
      for (let i = 5; i <= 43; i++) {
        expect(result![i]).toBe('0');
      }

      expect(revealMRZByBitmap(MOCK_MRZ_PASSPORT, (result as string[]).join(''))).toEqual(
        '00000000000000000000000000000000000000000000L898902C300000000000000000000000000000000000'
      );
    });
  });

  describe('id_card (90 character bitmap)', () => {
    it('test reveal', () => {
      expect(revealMRZByBitmap(MOCK_MRZ_ID_CARD, Array(90).fill('1').join(''))).toEqual(
        MOCK_MRZ_ID_CARD.replace(/\n/g, '').split('').join('')
      );

      expect(revealMRZByBitmap(MOCK_MRZ_ID_CARD, Array(90).fill('0').join(''))).toEqual(
        Array(90).fill('0').join('')
      );
    });

    it('reveals first name', () => {
      // ID card name is on third line (positions 60-89)
      // Name format: ERIKSSON<<ANNA<MARIA<<<<<<<<<<
      // First name starts after << (position 70 in the full MRZ)
      const firstNameSelectorForThirdLine = '000000000011111111111111111111';

      expect(revealMRZByBitmap(MOCK_MRZ_ID_CARD_THIRD_LINE, firstNameSelectorForThirdLine)).toEqual(
        '0000000000ANNA<MARIA<<<<<<<<<<'
      );
    });

    it('reveals last name', () => {
      // Last name is ERIKSSON (positions 0-7 of third line, 60-67 in full MRZ)
      const lastNameSelectorForThirdLine = '111111111100000000000000000000';

      expect(revealMRZByBitmap(MOCK_MRZ_ID_CARD_THIRD_LINE, lastNameSelectorForThirdLine)).toEqual(
        'ERIKSSON<<00000000000000000000'
      );
    });

    it('should return all zeros when no disclosures are enabled', () => {
      const disclosures: SelfAppDisclosureConfig = {};
      const result = getSelectorDg1('id_card', disclosures);

      expect(result).toBeDefined();
      expect(result!.length).toBe(90);
      expect(result!.every((bit) => bit === '0')).toBe(true);

      expect(revealMRZByBitmap(MOCK_MRZ_ID_CARD, (result as string[]).join(''))).toEqual(
        Array(90).fill('0').join('')
      );
    });

    it('should mark issuing_state positions (2-4) when enabled', () => {
      const disclosures: SelfAppDisclosureConfig = { issuing_state: true };
      const result = getSelectorDg1('id_card', disclosures);

      expect(result).toBeDefined();
      // Positions 2, 3, 4 should be '1'
      expect(result![2]).toBe('1');
      expect(result![3]).toBe('1');
      expect(result![4]).toBe('1');
      // Adjacent positions should be '0'
      expect(result![1]).toBe('0');
      expect(result![5]).toBe('0');

      expect(revealMRZByBitmap(MOCK_MRZ_ID_CARD, (result as string[]).join(''))).toEqual(
        '00UTO0000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
      );
    });

    it('should mark name positions (60-89) when enabled', () => {
      const disclosures: SelfAppDisclosureConfig = { name: true };
      const result = getSelectorDg1('id_card', disclosures);

      expect(result).toBeDefined();
      // First and last positions of name range
      expect(result![60]).toBe('1');
      expect(result![89]).toBe('1');
      // All positions in range should be '1'
      for (let i = 60; i <= 89; i++) {
        expect(result![i]).toBe('1');
      }
      // Adjacent positions should be '0'
      expect(result![59]).toBe('0');

      expect(revealMRZByBitmap(MOCK_MRZ_ID_CARD, (result as string[]).join(''))).toEqual(
        '000000000000000000000000000000000000000000000000000000000000ERIKSSON<<ANNA<MARIA<<<<<<<<<<'
      );
    });

    it('should mark passport_number (document_number) positions (5-13) when enabled', () => {
      const disclosures: SelfAppDisclosureConfig = { passport_number: true };
      const result = getSelectorDg1('id_card', disclosures);

      expect(result).toBeDefined();
      for (let i = 5; i <= 13; i++) {
        expect(result![i]).toBe('1');
      }
      expect(result![4]).toBe('0');
      expect(result![14]).toBe('0');

      expect(revealMRZByBitmap(MOCK_MRZ_ID_CARD, (result as string[]).join(''))).toEqual(
        '00000D231458900000000000000000000000000000000000000000000000000000000000000000000000000000'
      );
    });

    it('should mark nationality positions (45-47) when enabled', () => {
      const disclosures: SelfAppDisclosureConfig = { nationality: true };
      const result = getSelectorDg1('id_card', disclosures);

      expect(result).toBeDefined();
      for (let i = 45; i <= 47; i++) {
        expect(result![i]).toBe('1');
      }
      expect(result![44]).toBe('0');
      expect(result![48]).toBe('0');

      expect(revealMRZByBitmap(MOCK_MRZ_ID_CARD, (result as string[]).join(''))).toEqual(
        '000000000000000000000000000000000000000000000UTO000000000000000000000000000000000000000000'
      );
    });

    it('should mark date_of_birth positions (30-35) when enabled', () => {
      const disclosures: SelfAppDisclosureConfig = { date_of_birth: true };
      const result = getSelectorDg1('id_card', disclosures);

      expect(result).toBeDefined();
      for (let i = 30; i <= 35; i++) {
        expect(result![i]).toBe('1');
      }
      expect(result![29]).toBe('0');
      expect(result![36]).toBe('0');

      expect(revealMRZByBitmap(MOCK_MRZ_ID_CARD, (result as string[]).join(''))).toEqual(
        '000000000000000000000000000000740812000000000000000000000000000000000000000000000000000000'
      );
    });

    it('should mark gender position (37) when enabled', () => {
      const disclosures: SelfAppDisclosureConfig = { gender: true };
      const result = getSelectorDg1('id_card', disclosures);

      expect(result).toBeDefined();
      expect(result![37]).toBe('1');
      expect(result![36]).toBe('0');
      expect(result![38]).toBe('0');

      expect(revealMRZByBitmap(MOCK_MRZ_ID_CARD, (result as string[]).join(''))).toEqual(
        '0000000000000000000000000000000000000F0000000000000000000000000000000000000000000000000000'
      );
    });

    it('should mark expiry_date positions (38-43) when enabled', () => {
      const disclosures: SelfAppDisclosureConfig = { expiry_date: true };
      const result = getSelectorDg1('id_card', disclosures);

      expect(result).toBeDefined();
      for (let i = 38; i <= 43; i++) {
        expect(result![i]).toBe('1');
      }
      expect(result![37]).toBe('0');
      expect(result![44]).toBe('0');

      expect(revealMRZByBitmap(MOCK_MRZ_ID_CARD, (result as string[]).join(''))).toEqual(
        '000000000000000000000000000000000000001204150000000000000000000000000000000000000000000000'
      );
    });

    it('should handle multiple disclosures simultaneously', () => {
      const disclosures: SelfAppDisclosureConfig = {
        issuing_state: true,
        nationality: true,
        gender: true,
      };
      const result = getSelectorDg1('id_card', disclosures);

      expect(result).toBeDefined();
      // issuing_state: 2-4
      for (let i = 2; i <= 4; i++) {
        expect(result![i]).toBe('1');
      }
      // nationality: 45-47
      for (let i = 45; i <= 47; i++) {
        expect(result![i]).toBe('1');
      }
      // gender: 37
      expect(result![37]).toBe('1');
      // Other positions should be '0'
      expect(result![0]).toBe('0');
      expect(result![50]).toBe('0');

      expect(revealMRZByBitmap(MOCK_MRZ_ID_CARD, (result as string[]).join(''))).toEqual(
        '00UTO00000000000000000000000000000000F0000000UTO000000000000000000000000000000000000000000'
      );
    });

    it('should handle multiple disclosures simultaneously (including dynamic first name)', () => {
      const disclosures: SelfAppDisclosureConfig = {
        issuing_state: true,
        first_name: true,
      };

      const result = getSelectorDg1('id_card', disclosures, MOCK_MRZ_ID_CARD);
      const bitmap = result?.join('');

      // ID card name is at positions 60-89: ERIKSSON<<ANNA<MARIA<<<<<<<<<<
      // lastName = ERIKSSON (8 chars), so first_name starts at 60 + 8 = 68
      // first_name covers positions 68-89 (<<ANNA<MARIA<<<<<<<<<<)
      expect(result?.join('')).toEqual(
        '001110000000000000000000000000000000000000000000000000000000000000001111111111111111111111'
      );

      expect(revealMRZByBitmap(MOCK_MRZ_ID_CARD, bitmap!)).toEqual(
        // '00111000000000000000000000000000000000000000000000000000000000000000111111111111111111111'
        '00UTO000000000000000000000000000000000000000000000000000000000000000<<ANNA<MARIA<<<<<<<<<<'
      );
    });

    it('should handle multiple disclosures simultaneously (including dynamic last name)', () => {
      const disclosures: SelfAppDisclosureConfig = {
        issuing_state: true,
        last_name: true,
      };

      const result = getSelectorDg1('id_card', disclosures, MOCK_MRZ_ID_CARD);
      const bitmap = result?.join('');

      expect(result?.join('')).toEqual(
        // 'I<UTOD231458907<<<<<<<<<<<<<<<7408122F1204159UTO<<<<<<<<<<<6ERIKSSON<<ANNA<MARIA<<<<<<<<<<'
        '001110000000000000000000000000000000000000000000000000000000111111111100000000000000000000'
      );

      expect(revealMRZByBitmap(MOCK_MRZ_ID_CARD, bitmap!)).toEqual(
        '00UTO0000000000000000000000000000000000000000000000000000000ERIKSSON<<00000000000000000000'
      );
    });

    it('should handle first + last name as name disclosure', () => {
      const firstAndLastNameDisclosures: SelfAppDisclosureConfig = {
        first_name: true,
        last_name: true,
      };

      const firstAndLastNameDisclosuresSelector = getSelectorDg1(
        'id_card',
        firstAndLastNameDisclosures,
        MOCK_MRZ_ID_CARD
      );
      const firstAndLastNameBitmap = firstAndLastNameDisclosuresSelector?.join('');

      const nameDisclosure: SelfAppDisclosureConfig = { name: true };
      const nameDisclosureSelector = getSelectorDg1('id_card', nameDisclosure, MOCK_MRZ_ID_CARD);
      const nameDisclosureBitmap = nameDisclosureSelector?.join('');

      expect(firstAndLastNameBitmap).toEqual(nameDisclosureBitmap);
    });

    it('should ignore ofac disclosure (not mapped to positions)', () => {
      const disclosures: SelfAppDisclosureConfig = { ofac: true };
      const result = getSelectorDg1('id_card', disclosures);

      expect(result).toBeDefined();
      expect(result!.every((bit) => bit === '0')).toBe(true);
    });

    it('should ignore excludedCountries disclosure (not mapped to positions)', () => {
      const disclosures: SelfAppDisclosureConfig = { excludedCountries: ['USA', 'GBR'] };
      const result = getSelectorDg1('id_card', disclosures);

      expect(result).toBeDefined();
      expect(result!.every((bit) => bit === '0')).toBe(true);
    });

    it('should ignore minimumAge disclosure (not mapped to positions)', () => {
      const disclosures: SelfAppDisclosureConfig = { minimumAge: 18 };
      const result = getSelectorDg1('id_card', disclosures);

      expect(result).toBeDefined();
      expect(result!.every((bit) => bit === '0')).toBe(true);
    });

    it('should handle disabled disclosures (false values)', () => {
      const disclosures: SelfAppDisclosureConfig = {
        issuing_state: false,
        name: false,
        passport_number: true,
      };
      const result = getSelectorDg1('id_card', disclosures);

      expect(result).toBeDefined();
      // Only passport_number should be marked (positions 5-13 for ID card)
      for (let i = 5; i <= 13; i++) {
        expect(result![i]).toBe('1');
      }
      // issuing_state should NOT be marked
      for (let i = 2; i <= 4; i++) {
        expect(result![i]).toBe('0');
      }
      // name should NOT be marked
      for (let i = 60; i <= 89; i++) {
        expect(result![i]).toBe('0');
      }

      expect(revealMRZByBitmap(MOCK_MRZ_ID_CARD, (result as string[]).join(''))).toEqual(
        '00000D231458900000000000000000000000000000000000000000000000000000000000000000000000000000'
      );
    });
  });

  describe('attribute position verification', () => {
    it('should match attributeToPosition constants for passport', () => {
      // Verify our test expectations match the actual constants
      expect(attributeToPosition.issuing_state).toEqual([2, 4]);
      expect(attributeToPosition.name).toEqual([5, 43]);
      expect(attributeToPosition.passport_number).toEqual([44, 52]);
      expect(attributeToPosition.nationality).toEqual([54, 56]);
      expect(attributeToPosition.date_of_birth).toEqual([57, 62]);
      expect(attributeToPosition.gender).toEqual([64, 64]);
      expect(attributeToPosition.expiry_date).toEqual([65, 70]);
    });

    it('should match attributeToPosition_ID constants for id_card', () => {
      expect(attributeToPosition_ID.issuing_state).toEqual([2, 4]);
      expect(attributeToPosition_ID.name).toEqual([60, 89]);
      expect(attributeToPosition_ID.passport_number).toEqual([5, 13]);
      expect(attributeToPosition_ID.nationality).toEqual([45, 47]);
      expect(attributeToPosition_ID.date_of_birth).toEqual([30, 35]);
      expect(attributeToPosition_ID.gender).toEqual([37, 37]);
      expect(attributeToPosition_ID.expiry_date).toEqual([38, 43]);
    });
  });
});
