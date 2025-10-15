import * as constants from './constants.js';

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

export type SelfricaCircuitInput = {
    SmileID_data_padded: string[],
    compressed_disclose_sel: string[],
    pubKey: string[],
    msg_sig: string[],
    id_num_sig: string[],
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
};

export type SelfricaPublicInput = {
    pubKeyX: string,
    pubKeyY: string,
    scope: string,
    ofac_name_dob_smt_root: string[],
    ofac_name_yob_smt_root: string[],
    attestation_id: string[],
}

export const getPublicInput = (input: SelfricaCircuitInput) => {
    return {
        pubKey: input.pubKey,
        msg_sig: input.msg_sig,
        id_num_sig: input.id_num_sig,
        ofac_name_dob_smt_root: input.ofac_name_dob_smt_root,
        ofac_name_yob_smt_root: input.ofac_name_yob_smt_root,
        attestation_id: ['4'],
    }
}
