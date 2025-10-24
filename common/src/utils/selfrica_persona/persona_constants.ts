/*
 * Persona Data Format (243 bytes total)
 *
 * | Field                | Index | Length |
 * |----------------------|-------|--------|
 * | Country              | 0     | 3      |
 * | ID Type              | 3     | 8      |
 * | ID Number            | 11    | 32     |
 * | Document Number      | 43    | 32     |
 * | Issuance Date        | 75    | 8      |
 * | Expiry Date          | 83    | 8      |
 * | Full Name            | 91    | 64     |
 * | Date of Birth        | 155   | 8      |
 * | Address Subdivision  | 163   | 24     |
 * | Address Postal Code  | 187   | 12     |
 * | Photo Hash           | 199   | 32     |
 * | Phone Number         | 231   | 12     |
 * | Gender               | 243   | 1      |
 */

export const PERSONA_COUNTRY_INDEX = 0;
export const PERSONA_COUNTRY_LENGTH = 3;

export const PERSONA_ID_TYPE_INDEX = PERSONA_COUNTRY_INDEX + PERSONA_COUNTRY_LENGTH;
export const PERSONA_ID_TYPE_LENGTH = 8;

export const PERSONA_ID_NUMBER_INDEX = PERSONA_ID_TYPE_INDEX + PERSONA_ID_TYPE_LENGTH;
export const PERSONA_ID_NUMBER_LENGTH = 32;

export const PERSONA_DOCUMENT_NUMBER_INDEX = PERSONA_ID_NUMBER_INDEX + PERSONA_ID_NUMBER_LENGTH;
export const PERSONA_DOCUMENT_NUMBER_LENGTH = 32;

export const PERSONA_ISSUANCE_DATE_INDEX =
  PERSONA_DOCUMENT_NUMBER_INDEX + PERSONA_DOCUMENT_NUMBER_LENGTH;
export const PERSONA_ISSUANCE_DATE_LENGTH = 8;

export const PERSONA_EXPIRATION_DATE_INDEX =
  PERSONA_ISSUANCE_DATE_INDEX + PERSONA_ISSUANCE_DATE_LENGTH;
export const PERSONA_EXPIRATION_DATE_LENGTH = 8;

export const PERSONA_FULL_NAME_INDEX =
  PERSONA_EXPIRATION_DATE_INDEX + PERSONA_EXPIRATION_DATE_LENGTH;
export const PERSONA_FULL_NAME_LENGTH = 64;

export const PERSONA_DOB_INDEX = PERSONA_FULL_NAME_INDEX + PERSONA_FULL_NAME_LENGTH;
export const PERSONA_DOB_LENGTH = 8;

export const PERSONA_ADDRESS_SUBDIVISION_INDEX = PERSONA_DOB_INDEX + PERSONA_DOB_LENGTH;
export const PERSONA_ADDRESS_SUBDIVISION_LENGTH = 24;

export const PERSONA_ADDRESS_POSTAL_CODE_INDEX =
  PERSONA_ADDRESS_SUBDIVISION_INDEX + PERSONA_ADDRESS_SUBDIVISION_LENGTH;
export const PERSONA_ADDRESS_POSTAL_CODE_LENGTH = 12;

export const PERSONA_PHOTO_HASH_INDEX =
  PERSONA_ADDRESS_POSTAL_CODE_INDEX + PERSONA_ADDRESS_POSTAL_CODE_LENGTH;
export const PERSONA_PHOTO_HASH_LENGTH = 32;

export const PERSONA_PHONE_NUMBER_INDEX = PERSONA_PHOTO_HASH_INDEX + PERSONA_PHOTO_HASH_LENGTH;
export const PERSONA_PHONE_NUMBER_LENGTH = 12;

export const PERSONA_GENDER_INDEX = PERSONA_PHONE_NUMBER_INDEX + PERSONA_PHONE_NUMBER_LENGTH;
export const PERSONA_GENDER_LENGTH = 1;

export const PERSONA_MAX_LENGTH = PERSONA_GENDER_INDEX + PERSONA_GENDER_LENGTH;

export const splitDisclosePersonaSel = (disclose_sel: string[]): string[] => {
  if (disclose_sel.length !== PERSONA_MAX_LENGTH) {
    throw new Error(
      `disclose_sel must have length ${PERSONA_MAX_LENGTH}, got ${disclose_sel.length}`
    );
  }

  // Split into two arrays of 133 bits each
  const disclose_sel_low_bits = disclose_sel.slice(0, PERSONA_MAX_LENGTH / 2);
  const disclose_sel_high_bits = disclose_sel.slice(PERSONA_MAX_LENGTH / 2, PERSONA_MAX_LENGTH);

  // Convert little-endian bit arrays to decimal
  const bitsToDecimal = (bits: string[]): string => {
    let result = BigInt(0);
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] === '1') {
        result += BigInt(1) << BigInt(i);
      }
    }
    return result.toString();
  };

  return [bitsToDecimal(disclose_sel_low_bits), bitsToDecimal(disclose_sel_high_bits)];
};

