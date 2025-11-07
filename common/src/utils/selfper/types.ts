import { Point } from '@zk-kit/baby-jubjub';
import * as constants from './constants.js';

export type SelfperData = {
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

export const serializeSelfperData = (selfperData: SelfperData) => {
    //ensure max length of each field
    let serializedData = '';
    serializedData += selfperData.country.toUpperCase().padEnd(constants.SELFPER_COUNTRY_LENGTH, '\0');
    serializedData += selfperData.idType.toUpperCase().padEnd(constants.SELFPER_ID_TYPE_LENGTH, '\0');
    serializedData += selfperData.idNumber.padEnd(constants.SELFPER_ID_NUMBER_LENGTH, '\0');
    serializedData += selfperData.issuanceDate.padEnd(constants.SELFPER_ISSUANCE_DATE_LENGTH, '\0');
    serializedData += selfperData.expiryDate.padEnd(constants.SELFPER_EXPIRY_DATE_LENGTH, '\0');
    serializedData += selfperData.fullName.padEnd(constants.SELFPER_FULL_NAME_LENGTH, '\0');
    serializedData += selfperData.dob.padEnd(constants.SELFPER_DOB_LENGTH, '\0');
    serializedData += selfperData.photoHash.padEnd(constants.SELFPER_PHOTO_HASH_LENGTH, '\0');
    serializedData += selfperData.phoneNumber.padEnd(constants.SELFPER_PHONE_NUMBER_LENGTH, '\0');
    serializedData += selfperData.document.padEnd(constants.SELFPER_DOCUMENT_LENGTH, '\0');
    serializedData += selfperData.gender.padEnd(constants.SELFPER_GENDER_LENGTH, '\0');
    serializedData += selfperData.address.padEnd(constants.SELFPER_ADDRESS_LENGTH, '\0');

    return serializedData;
}

export type SelfperRegisterInput = {
    data_padded: string[],
    s: string,
    Tx: string,
    Ty: string,
    pubKeyX: string,
    pubKeyY: string,
    r_inv: string[],
    secret: string,
    attestation_id: string,
}

export type SelfperDiscloseInput = {
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
    attestation_id: string,
};

export type SelfperDisclosePublicInput = {
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
