export const SELFRICA_COUNTRY_INDEX = 0;
export const SELFRICA_COUNTRY_LENGTH = 3;

export const SELFRICA_ID_TYPE_INDEX = SELFRICA_COUNTRY_INDEX + SELFRICA_COUNTRY_LENGTH;
export const SELFRICA_ID_TYPE_LENGTH = 27;

export const SELFRICA_ID_NUMBER_INDEX = SELFRICA_ID_TYPE_INDEX + SELFRICA_ID_TYPE_LENGTH;
export const SELFRICA_ID_NUMBER_LENGTH = 20;

export const SELFRICA_ISSUANCE_DATE_INDEX = SELFRICA_ID_NUMBER_INDEX + SELFRICA_ID_NUMBER_LENGTH;
export const SELFRICA_ISSUANCE_DATE_LENGTH = 8;

export const SELFRICA_EXPIRY_DATE_INDEX = SELFRICA_ISSUANCE_DATE_INDEX + SELFRICA_ISSUANCE_DATE_LENGTH;
export const SELFRICA_EXPIRY_DATE_LENGTH = 8;

export const SELFRICA_FULL_NAME_INDEX = SELFRICA_EXPIRY_DATE_INDEX + SELFRICA_EXPIRY_DATE_LENGTH;
export const SELFRICA_FULL_NAME_LENGTH = 40;

export const SELFRICA_DOB_INDEX = SELFRICA_FULL_NAME_INDEX + SELFRICA_FULL_NAME_LENGTH;
export const SELFRICA_DOB_LENGTH = 8;

export const SELFRICA_PHOTO_HASH_INDEX = SELFRICA_DOB_INDEX + SELFRICA_DOB_LENGTH;
export const SELFRICA_PHOTO_HASH_LENGTH = 32;

export const SELFRICA_PHONE_NUMBER_INDEX = SELFRICA_PHOTO_HASH_INDEX + SELFRICA_PHOTO_HASH_LENGTH;
export const SELFRICA_PHONE_NUMBER_LENGTH = 12;

export const SELFRICA_DOCUMENT_INDEX = SELFRICA_PHONE_NUMBER_INDEX + SELFRICA_PHONE_NUMBER_LENGTH;
export const SELFRICA_DOCUMENT_LENGTH = 2;

export const SELFRICA_GENDER_INDEX = SELFRICA_DOCUMENT_INDEX + SELFRICA_DOCUMENT_LENGTH;
export const SELFRICA_GENDER_LENGTH = 6;

export const SELFRICA_ADDRESS_INDEX = SELFRICA_GENDER_INDEX + SELFRICA_GENDER_LENGTH;
export const SELFRICA_ADDRESS_LENGTH = 100;

export const SELFRICA_MAX_LENGTH = SELFRICA_ADDRESS_INDEX + SELFRICA_ADDRESS_LENGTH;

// ------------------------------
// Field lengths for selector bits
// ------------------------------
export const SELFRICA_FIELD_LENGTHS = {
  COUNTRY: SELFRICA_COUNTRY_LENGTH, // 3
  ID_TYPE: SELFRICA_ID_TYPE_LENGTH, // 27
  ID_NUMBER: SELFRICA_ID_NUMBER_LENGTH, // 20
  ISSUANCE_DATE: SELFRICA_ISSUANCE_DATE_LENGTH, // 8
  EXPIRY_DATE: SELFRICA_EXPIRY_DATE_LENGTH, // 8
  FULL_NAME: SELFRICA_FULL_NAME_LENGTH, // 40
  DOB: SELFRICA_DOB_LENGTH, // 8
  PHOTO_HASH: SELFRICA_PHOTO_HASH_LENGTH, // 32
  PHONE_NUMBER: SELFRICA_PHONE_NUMBER_LENGTH, // 12
  DOCUMENT: SELFRICA_DOCUMENT_LENGTH, // 2
  GENDER: SELFRICA_GENDER_LENGTH, // 6
  ADDRESS: SELFRICA_ADDRESS_LENGTH, // 100
} as const;

// ------------------------------
// Reveal data indices for selector bits
// ------------------------------
export const SELFRICA_REVEAL_DATA_INDICES = {
  COUNTRY: 0,
  ID_TYPE: SELFRICA_COUNTRY_LENGTH, // 3
  ID_NUMBER: SELFRICA_ID_TYPE_INDEX + SELFRICA_ID_TYPE_LENGTH, // 30
  ISSUANCE_DATE: SELFRICA_ID_NUMBER_INDEX + SELFRICA_ID_NUMBER_LENGTH, // 50
  EXPIRY_DATE: SELFRICA_ISSUANCE_DATE_INDEX + SELFRICA_ISSUANCE_DATE_LENGTH, // 58
  FULL_NAME: SELFRICA_EXPIRY_DATE_INDEX + SELFRICA_EXPIRY_DATE_LENGTH, // 66
  DOB: SELFRICA_FULL_NAME_INDEX + SELFRICA_FULL_NAME_LENGTH, // 106
  PHOTO_HASH: SELFRICA_DOB_INDEX + SELFRICA_DOB_LENGTH, // 114
  PHONE_NUMBER: SELFRICA_PHOTO_HASH_INDEX + SELFRICA_PHOTO_HASH_LENGTH, // 146
  DOCUMENT: SELFRICA_PHONE_NUMBER_INDEX + SELFRICA_PHONE_NUMBER_LENGTH, // 158
  GENDER: SELFRICA_DOCUMENT_INDEX + SELFRICA_DOCUMENT_LENGTH, // 160
  ADDRESS: SELFRICA_GENDER_INDEX + SELFRICA_GENDER_LENGTH, // 166
} as const;

// ------------------------------
// Selector bit positions for each field
// ------------------------------
export const SELFRICA_SELECTOR_BITS = {
  COUNTRY: Array.from({ length: SELFRICA_COUNTRY_LENGTH }, (_, i) => i) as number[], // 0-2
  ID_TYPE: Array.from({ length: SELFRICA_ID_TYPE_LENGTH }, (_, i) => i + SELFRICA_COUNTRY_LENGTH) as number[], // 3-29
  ID_NUMBER: Array.from({ length: SELFRICA_ID_NUMBER_LENGTH }, (_, i) => i + SELFRICA_ID_TYPE_INDEX + SELFRICA_ID_TYPE_LENGTH) as number[], // 30-49
  ISSUANCE_DATE: Array.from({ length: SELFRICA_ISSUANCE_DATE_LENGTH }, (_, i) => i + SELFRICA_ID_NUMBER_INDEX + SELFRICA_ID_NUMBER_LENGTH) as number[], // 50-57
  EXPIRY_DATE: Array.from({ length: SELFRICA_EXPIRY_DATE_LENGTH }, (_, i) => i + SELFRICA_ISSUANCE_DATE_INDEX + SELFRICA_ISSUANCE_DATE_LENGTH) as number[], // 58-65
  FULL_NAME: Array.from({ length: SELFRICA_FULL_NAME_LENGTH }, (_, i) => i + SELFRICA_EXPIRY_DATE_INDEX + SELFRICA_EXPIRY_DATE_LENGTH) as number[], // 66-105
  DOB: Array.from({ length: SELFRICA_DOB_LENGTH }, (_, i) => i + SELFRICA_FULL_NAME_INDEX + SELFRICA_FULL_NAME_LENGTH) as number[], // 106-113
  PHOTO_HASH: Array.from({ length: SELFRICA_PHOTO_HASH_LENGTH }, (_, i) => i + SELFRICA_DOB_INDEX + SELFRICA_DOB_LENGTH) as number[], // 114-145
  PHONE_NUMBER: Array.from({ length: SELFRICA_PHONE_NUMBER_LENGTH }, (_, i) => i + SELFRICA_PHOTO_HASH_INDEX + SELFRICA_PHOTO_HASH_LENGTH) as number[], // 146-157
  DOCUMENT: Array.from({ length: SELFRICA_DOCUMENT_LENGTH }, (_, i) => i + SELFRICA_PHONE_NUMBER_INDEX + SELFRICA_PHONE_NUMBER_LENGTH) as number[], // 158-159
  GENDER: Array.from({ length: SELFRICA_GENDER_LENGTH }, (_, i) => i + SELFRICA_DOCUMENT_INDEX + SELFRICA_DOCUMENT_LENGTH) as number[], // 160-165
  ADDRESS: Array.from({ length: SELFRICA_ADDRESS_LENGTH }, (_, i) => i + SELFRICA_GENDER_INDEX + SELFRICA_GENDER_LENGTH) as number[], // 166-265
} as const;

export type SelfricaField = keyof typeof SELFRICA_FIELD_LENGTHS;

// ------------------------------
// Public Signals
// ------------------------------
export const SELFRICA_PUBLIC_SIGNALS_ATTESTATION_ID = 0;

export const SELFRICA_PUBLIC_SIGNALS_REVEALED_DATA_PACKED = 1;
export const SELFRICA_PUBLIC_SIGNALS_REVEALED_DATA_PACKED_LENGTH = 9;

export const SELFRICA_PUBLIC_SIGNALS_FORBIDDEN_COUNTRIES_PACKED = 10;
export const SELFRICA_PUBLIC_SIGNALS_FORBIDDEN_COUNTRIES_PACKED_LENGTH = 4;

export const SELFRICA_PUBLIC_SIGNALS_IDENTITY_COMMITMENT = 14;
export const SELFRICA_PUBLIC_SIGNALS_NULLIFIER = 15;

//TODO: FIX THESE
export const SELFRICA_PUBLIC_SIGNALS_PUBKEY = 16;
export const SELFRICA_PUBLIC_SIGNALS_PUBKEY_LENGTH = 17;

export const SELFRICA_PUBLIC_SIGNALS_SCOPE = 33;
export const SELFRICA_PUBLIC_SIGNALS_USER_IDENTIFIER = 34;

export const SELFRICA_PUBLIC_SIGNALS_CURRENT_DATE = 35;
export const SELFRICA_PUBLIC_SIGNALS_CURRENT_DATE_LENGTH = 8;

export const SELFRICA_PUBLIC_SIGNALS_OFAC_NAME_DOB_SMT_ROOT = 43;
export const SELFRICA_PUBLIC_SIGNALS_OFAC_NAME_YOB_SMT_ROOT = 44;

// ------------------------------
// Helper functions for selector bits
// ------------------------------

/**
 * Helper function to extract a specific field from serialized Selfrica data
 * @param serializedData - The serialized Selfrica data string
 * @param field - The field to extract
 * @returns The extracted field data as a string
 */
export function extractSelfricaField(serializedData: string, field: SelfricaField): string {
  const startIndex = SELFRICA_REVEAL_DATA_INDICES[field];
  const length = SELFRICA_FIELD_LENGTHS[field];
  const extracted = serializedData.slice(startIndex, startIndex + length);
  return extracted.replace(/\0+$/, ''); // Remove trailing null characters
}

/**
 * Helper function to create a selector field for revealing specific Selfrica data
 * @param fieldsToReveal - Array of field names to reveal
 * @returns Selector value as bigint
 */
export function createSelfricaSelector(fieldsToReveal: SelfricaField[]): [bigint, bigint] {
  const bits = Array(SELFRICA_MAX_LENGTH).fill(0);

  for (const field of fieldsToReveal) {
    const selectorBits = SELFRICA_SELECTOR_BITS[field];
    for (const bit of selectorBits) {
      bits[bit] = 1;
    }
  }

  let lowResult = 0n;
  let highResult = 0n;

  for (let i = 0; i < 133; i++) {
    if (bits[i]) {
      lowResult += 1n << BigInt(i);
    }
  }
  for (let i = 133; i < SELFRICA_MAX_LENGTH; i++) {
    if (bits[i]) {
      highResult += 1n << BigInt(i - 133);
    }
  }

  return [highResult, lowResult];
}
