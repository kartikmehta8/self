export const SELFPER_COUNTRY_INDEX = 0;
export const SELFPER_COUNTRY_LENGTH = 3;

export const SELFPER_ID_TYPE_INDEX = SELFPER_COUNTRY_INDEX + SELFPER_COUNTRY_LENGTH;
export const SELFPER_ID_TYPE_LENGTH = 27;

export const SELFPER_ID_NUMBER_INDEX = SELFPER_ID_TYPE_INDEX + SELFPER_ID_TYPE_LENGTH;
export const SELFPER_ID_NUMBER_LENGTH = 32; // Updated: max(20, 32) = 32

export const SELFPER_ISSUANCE_DATE_INDEX = SELFPER_ID_NUMBER_INDEX + SELFPER_ID_NUMBER_LENGTH;
export const SELFPER_ISSUANCE_DATE_LENGTH = 8;

export const SELFPER_EXPIRY_DATE_INDEX = SELFPER_ISSUANCE_DATE_INDEX + SELFPER_ISSUANCE_DATE_LENGTH;
export const SELFPER_EXPIRY_DATE_LENGTH = 8;

export const SELFPER_FULL_NAME_INDEX = SELFPER_EXPIRY_DATE_INDEX + SELFPER_EXPIRY_DATE_LENGTH;
export const SELFPER_FULL_NAME_LENGTH = 64; // Updated: max(40, 64) = 64

export const SELFPER_DOB_INDEX = SELFPER_FULL_NAME_INDEX + SELFPER_FULL_NAME_LENGTH;
export const SELFPER_DOB_LENGTH = 8;

export const SELFPER_PHOTO_HASH_INDEX = SELFPER_DOB_INDEX + SELFPER_DOB_LENGTH;
export const SELFPER_PHOTO_HASH_LENGTH = 32;

export const SELFPER_PHONE_NUMBER_INDEX = SELFPER_PHOTO_HASH_INDEX + SELFPER_PHOTO_HASH_LENGTH;
export const SELFPER_PHONE_NUMBER_LENGTH = 12;

export const SELFPER_DOCUMENT_INDEX = SELFPER_PHONE_NUMBER_INDEX + SELFPER_PHONE_NUMBER_LENGTH;
export const SELFPER_DOCUMENT_LENGTH = 32; // Updated: max(2, 32) = 32

export const SELFPER_GENDER_INDEX = SELFPER_DOCUMENT_INDEX + SELFPER_DOCUMENT_LENGTH;
export const SELFPER_GENDER_LENGTH = 6;

export const SELFPER_ADDRESS_INDEX = SELFPER_GENDER_INDEX + SELFPER_GENDER_LENGTH;
export const SELFPER_ADDRESS_LENGTH = 100;

export const SELFPER_MAX_LENGTH = SELFPER_ADDRESS_INDEX + SELFPER_ADDRESS_LENGTH;

// ------------------------------
// Field lengths for selector bits
// ------------------------------
export const SELFPER_FIELD_LENGTHS = {
  COUNTRY: SELFPER_COUNTRY_LENGTH, // 3
  ID_TYPE: SELFPER_ID_TYPE_LENGTH, // 27
  ID_NUMBER: SELFPER_ID_NUMBER_LENGTH, // 32 (updated)
  ISSUANCE_DATE: SELFPER_ISSUANCE_DATE_LENGTH, // 8
  EXPIRY_DATE: SELFPER_EXPIRY_DATE_LENGTH, // 8
  FULL_NAME: SELFPER_FULL_NAME_LENGTH, // 64 (updated)
  DOB: SELFPER_DOB_LENGTH, // 8
  PHOTO_HASH: SELFPER_PHOTO_HASH_LENGTH, // 32
  PHONE_NUMBER: SELFPER_PHONE_NUMBER_LENGTH, // 12
  DOCUMENT: SELFPER_DOCUMENT_LENGTH, // 32 (updated)
  GENDER: SELFPER_GENDER_LENGTH, // 6
  ADDRESS: SELFPER_ADDRESS_LENGTH, // 100
} as const;

// ------------------------------
// Reveal data indices for selector bits
// ------------------------------
export const SELFPER_REVEAL_DATA_INDICES = {
  COUNTRY: 0,
  ID_TYPE: SELFPER_COUNTRY_LENGTH, // 3
  ID_NUMBER: SELFPER_ID_TYPE_INDEX + SELFPER_ID_TYPE_LENGTH, // 30
  ISSUANCE_DATE: SELFPER_ID_NUMBER_INDEX + SELFPER_ID_NUMBER_LENGTH, // 62 (updated)
  EXPIRY_DATE: SELFPER_ISSUANCE_DATE_INDEX + SELFPER_ISSUANCE_DATE_LENGTH, // 70 (updated)
  FULL_NAME: SELFPER_EXPIRY_DATE_INDEX + SELFPER_EXPIRY_DATE_LENGTH, // 78 (updated)
  DOB: SELFPER_FULL_NAME_INDEX + SELFPER_FULL_NAME_LENGTH, // 142 (updated)
  PHOTO_HASH: SELFPER_DOB_INDEX + SELFPER_DOB_LENGTH, // 150 (updated)
  PHONE_NUMBER: SELFPER_PHOTO_HASH_INDEX + SELFPER_PHOTO_HASH_LENGTH, // 182 (updated)
  DOCUMENT: SELFPER_PHONE_NUMBER_INDEX + SELFPER_PHONE_NUMBER_LENGTH, // 194 (updated)
  GENDER: SELFPER_DOCUMENT_INDEX + SELFPER_DOCUMENT_LENGTH, // 226 (updated)
  ADDRESS: SELFPER_GENDER_INDEX + SELFPER_GENDER_LENGTH, // 232 (updated)
} as const;

// ------------------------------
// Selector bit positions for each field
// ------------------------------
export const SELFPER_SELECTOR_BITS = {
  COUNTRY: Array.from({ length: SELFPER_COUNTRY_LENGTH }, (_, i) => i) as number[], // 0-2
  ID_TYPE: Array.from({ length: SELFPER_ID_TYPE_LENGTH }, (_, i) => i + SELFPER_COUNTRY_LENGTH) as number[], // 3-29
  ID_NUMBER: Array.from({ length: SELFPER_ID_NUMBER_LENGTH }, (_, i) => i + SELFPER_ID_TYPE_INDEX + SELFPER_ID_TYPE_LENGTH) as number[], // 30-61 (updated)
  ISSUANCE_DATE: Array.from({ length: SELFPER_ISSUANCE_DATE_LENGTH }, (_, i) => i + SELFPER_ID_NUMBER_INDEX + SELFPER_ID_NUMBER_LENGTH) as number[], // 62-69 (updated)
  EXPIRY_DATE: Array.from({ length: SELFPER_EXPIRY_DATE_LENGTH }, (_, i) => i + SELFPER_ISSUANCE_DATE_INDEX + SELFPER_ISSUANCE_DATE_LENGTH) as number[], // 70-77 (updated)
  FULL_NAME: Array.from({ length: SELFPER_FULL_NAME_LENGTH }, (_, i) => i + SELFPER_EXPIRY_DATE_INDEX + SELFPER_EXPIRY_DATE_LENGTH) as number[], // 78-141 (updated)
  DOB: Array.from({ length: SELFPER_DOB_LENGTH }, (_, i) => i + SELFPER_FULL_NAME_INDEX + SELFPER_FULL_NAME_LENGTH) as number[], // 142-149 (updated)
  PHOTO_HASH: Array.from({ length: SELFPER_PHOTO_HASH_LENGTH }, (_, i) => i + SELFPER_DOB_INDEX + SELFPER_DOB_LENGTH) as number[], // 150-181 (updated)
  PHONE_NUMBER: Array.from({ length: SELFPER_PHONE_NUMBER_LENGTH }, (_, i) => i + SELFPER_PHOTO_HASH_INDEX + SELFPER_PHOTO_HASH_LENGTH) as number[], // 182-193 (updated)
  DOCUMENT: Array.from({ length: SELFPER_DOCUMENT_LENGTH }, (_, i) => i + SELFPER_PHONE_NUMBER_INDEX + SELFPER_PHONE_NUMBER_LENGTH) as number[], // 194-225 (updated)
  GENDER: Array.from({ length: SELFPER_GENDER_LENGTH }, (_, i) => i + SELFPER_DOCUMENT_INDEX + SELFPER_DOCUMENT_LENGTH) as number[], // 226-231 (updated)
  ADDRESS: Array.from({ length: SELFPER_ADDRESS_LENGTH }, (_, i) => i + SELFPER_GENDER_INDEX + SELFPER_GENDER_LENGTH) as number[], // 232-331 (updated)
} as const;

export type SelfperField = keyof typeof SELFPER_FIELD_LENGTHS;


// ------------------------------
// Public Signals Indices
// ------------------------------

export const SELFPER_PUBLIC_SIGNALS_ATTESTATION_ID = 0;

export const SELFPER_PUBLIC_SIGNALS_REVEALED_DATA_PACKED = 1;
export const SELFPER_PUBLIC_SIGNALS_REVEALED_DATA_PACKED_LENGTH = 9;

export const SELFPER_PUBLIC_SIGNALS_FORBIDDEN_COUNTRIES_PACKED = 10;
export const SELFPER_PUBLIC_SIGNALS_FORBIDDEN_COUNTRIES_PACKED_LENGTH = 4;

export const SELFPER_PUBLIC_SIGNALS_NULLIFIER = 14;

export const SELFPER_PUBLIC_SIGNALS_SCOPE = 15;
export const SELFPER_PUBLIC_SIGNALS_USER_IDENTIFIER = 16;

export const SELFPER_PUBLIC_SIGNALS_CURRENT_DATE = 17;
export const SELFPER_PUBLIC_SIGNALS_CURRENT_DATE_LENGTH = 8;

export const SELFPER_PUBLIC_SIGNALS_OFAC_NAME_DOB_SMT_ROOT = 25;
export const SELFPER_PUBLIC_SIGNALS_OFAC_NAME_YOB_SMT_ROOT = 26;

// ------------------------------
// Helper functions for selector bits
// ------------------------------

export function createSelfperSelector(fieldsToReveal: SelfperField[]): [bigint, bigint] {
  const bits = Array(SELFPER_MAX_LENGTH).fill(0);

  for (const field of fieldsToReveal) {
    const selectorBits = SELFPER_SELECTOR_BITS[field];
    for (const bit of selectorBits) {
      bits[bit] = 1;
    }
  }

  let lowResult = 0n;
  let highResult = 0n;

  const splitPoint = Math.floor(SELFPER_MAX_LENGTH / 2);

  for (let i = 0; i < splitPoint; i++) {
    if (bits[i]) {
      lowResult += 1n << BigInt(i);
    }
  }
  for (let i = splitPoint; i < SELFPER_MAX_LENGTH; i++) {
    if (bits[i]) {
      highResult += 1n << BigInt(i - splitPoint);
    }
  }

  return [lowResult, highResult];
}
