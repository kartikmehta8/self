import { Point } from '@zk-kit/baby-jubjub';
import * as constants from './constants.js';
import {
  PERSONA_COUNTRY_LENGTH,
  PERSONA_ID_TYPE_LENGTH,
  PERSONA_ID_NUMBER_LENGTH,
  PERSONA_DOCUMENT_NUMBER_LENGTH,
  PERSONA_ISSUANCE_DATE_LENGTH,
  PERSONA_EXPIRATION_DATE_LENGTH,
  PERSONA_FULL_NAME_LENGTH,
  PERSONA_DOB_LENGTH,
  PERSONA_ADDRESS_SUBDIVISION_LENGTH,
  PERSONA_ADDRESS_POSTAL_CODE_LENGTH,
  PERSONA_PHOTO_HASH_LENGTH,
  PERSONA_PHONE_NUMBER_LENGTH,
  PERSONA_GENDER_LENGTH,
} from './persona_constants.js';

export type SmileData = {
    country: string;
    idType: string;
    idNumber: string;
    issuanceDate: string;
    expiryDate: string;
    fullName: string;
    dob: string;
    photoHash: string;
    phoneNumber: string;
    document: string;
    gender: string;
    address: string;
    user_identifier: string;
    current_date: string;
    majority_age_ASCII: string;
    selector_older_than: string;
};

export const serializeSmileData = (smileData: SmileData) => {
    //ensure max length of each field
    let serializedData = '';
    serializedData += smileData.country.toUpperCase().padEnd(constants.SELFRICA_COUNTRY_LENGTH, '\0');
    serializedData += smileData.idType.toUpperCase().padEnd(constants.SELFRICA_ID_TYPE_LENGTH, '\0');
    serializedData += smileData.idNumber.padEnd(constants.SELFRICA_ID_NUMBER_LENGTH, '\0');
    serializedData += smileData.issuanceDate.padEnd(constants.SELFRICA_ISSUANCE_DATE_LENGTH, '\0');
    serializedData += smileData.expiryDate.padEnd(constants.SELFRICA_EXPIRY_DATE_LENGTH, '\0');
    serializedData += smileData.fullName.padEnd(constants.SELFRICA_FULL_NAME_LENGTH, '\0');
    serializedData += smileData.dob.padEnd(constants.SELFRICA_DOB_LENGTH, '\0');
    serializedData += smileData.photoHash.padEnd(constants.SELFRICA_PHOTO_HASH_LENGTH, '\0');
    serializedData += smileData.phoneNumber.padEnd(constants.SELFRICA_PHONE_NUMBER_LENGTH, '\0');
    serializedData += smileData.document.padEnd(constants.SELFRICA_DOCUMENT_LENGTH, '\0');
    serializedData += smileData.gender.padEnd(constants.SELFRICA_GENDER_LENGTH, '\0');
    serializedData += smileData.address.padEnd(constants.SELFRICA_ADDRESS_LENGTH, '\0');

    return serializedData;
}

export type SelfricaRegisterInput = {
    data_padded: string[],
    s: string,
    Tx: string,
    Ty: string,
    pubKeyX: string,
    pubKeyY: string,
    r_inv: string[],
    secret: string,
}

export type SelfricaDiscloseInput = {
    data_padded: string[],
    compressed_disclose_sel: string[],
    merkle_root: string[],
    leaf_depth: string[],
    path: string[],
    siblings: string[],
    scope: string,
    forbidden_countries_list: string[],
    ofac_name_dob_smt_leaf_key: string[],
    ofac_name_dob_smt_root: string[],
    ofac_name_dob_smt_siblings: string[],
    ofac_name_yob_smt_leaf_key: string[],
    ofac_name_yob_smt_root: string[],
    ofac_name_yob_smt_siblings: string[],
    selector_ofac: string[],
    user_identifier: string,
    current_date: string[],
    majority_age_ASCII: number[],
    secret: string,
};

export type SelfricaDisclosePublicInput = {
    attestation_id: string,
    revealedData_packed: string[],
    forbidden_countries_list_packed: string[],
    nullifier: string,
    scope: string,
    user_identifier: string,
    current_date: string[],
    ofac_name_dob_smt_root: string,
    ofac_name_yob_smt_root: string,
}

export type Signature = {
    R: Point<bigint>,
    s: bigint
};

export interface PersonaData {
    country: string; // 3 bytes - ISO-3166-1 alpha-2
    idType: string; // 8 bytes - id-class (pp, dl, nric, tribalid)
    idNumber: string; // 32 bytes - identification-number
    documentNumber: string; // 32 bytes - document-number (may be blank)
    issuanceDate: string; // 8 bytes - issue-date as YYYYMMDD
    expiryDate: string; // 8 bytes - expiration-date as YYYYMMDD
    fullName: string; // 64 bytes - name-first + name-middle? + name-last
    dob: string; // 8 bytes - birthdate as YYYYMMDD
    addressSubdivision: string; // 24 bytes - address-subdivision
    addressPostalCode: string; // 12 bytes - address-postal-code
    photoHash: string; // 32 bytes - SHA-256 of stored ID image
    phoneNumber: string; // 12 bytes - E.164 format
    gender: string; // 1 byte - sex mapped to M/F/X/-
  }

  export const PersonaDataLimits = {
    country: PERSONA_COUNTRY_LENGTH,
    idType: PERSONA_ID_TYPE_LENGTH,
    idNumber: PERSONA_ID_NUMBER_LENGTH,
    documentNumber: PERSONA_DOCUMENT_NUMBER_LENGTH,
    issuanceDate: PERSONA_ISSUANCE_DATE_LENGTH,
    expiryDate: PERSONA_EXPIRATION_DATE_LENGTH,
    fullName: PERSONA_FULL_NAME_LENGTH,
    dob: PERSONA_DOB_LENGTH,
    addressSubdivision: PERSONA_ADDRESS_SUBDIVISION_LENGTH,
    addressPostalCode: PERSONA_ADDRESS_POSTAL_CODE_LENGTH,
    photoHash: PERSONA_PHOTO_HASH_LENGTH,
    phoneNumber: PERSONA_PHONE_NUMBER_LENGTH,
    gender: PERSONA_GENDER_LENGTH,
  };
