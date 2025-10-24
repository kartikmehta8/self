pragma circom 2.1.9;

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

function PERSONA_COUNTRY_INDEX() {
    return 0;
}

function PERSONA_COUNTRY_LENGTH() {
    return 3;
}

function PERSONA_ID_TYPE_INDEX() {
    return PERSONA_COUNTRY_INDEX() + PERSONA_COUNTRY_LENGTH();
}

function PERSONA_ID_TYPE_LENGTH() {
    return 8;
}

function PERSONA_ID_NUMBER_INDEX() {
    return PERSONA_ID_TYPE_INDEX() + PERSONA_ID_TYPE_LENGTH();
}

function PERSONA_ID_NUMBER_LENGTH() {
    return 32;
}

function PERSONA_DOCUMENT_NUMBER_INDEX() {
    return PERSONA_ID_NUMBER_INDEX() + PERSONA_ID_NUMBER_LENGTH();
}

function PERSONA_DOCUMENT_NUMBER_LENGTH() {
    return 32;
}

function PERSONA_ISSUANCE_DATE_INDEX() {
    return PERSONA_DOCUMENT_NUMBER_INDEX() + PERSONA_DOCUMENT_NUMBER_LENGTH();
}

function PERSONA_ISSUANCE_DATE_LENGTH() {
    return 8;
}

function PERSONA_EXPIRATION_DATE_INDEX() {
    return PERSONA_ISSUANCE_DATE_INDEX() + PERSONA_ISSUANCE_DATE_LENGTH();
}

function PERSONA_EXPIRATION_DATE_LENGTH() {
    return 8;
}

function PERSONA_FULL_NAME_INDEX() {
    return PERSONA_EXPIRATION_DATE_INDEX() + PERSONA_EXPIRATION_DATE_LENGTH();
}

function PERSONA_FULL_NAME_LENGTH() {
    return 64;
}

function PERSONA_DOB_INDEX() {
    return PERSONA_FULL_NAME_INDEX() + PERSONA_FULL_NAME_LENGTH();
}

function PERSONA_DOB_LENGTH() {
    return 8;
}

function PERSONA_ADDRESS_SUBDIVISION_INDEX() {
    return PERSONA_DOB_INDEX() + PERSONA_DOB_LENGTH();
}

function PERSONA_ADDRESS_SUBDIVISION_LENGTH() {
    return 24;
}

function PERSONA_ADDRESS_POSTAL_CODE_INDEX() {
    return PERSONA_ADDRESS_SUBDIVISION_INDEX() + PERSONA_ADDRESS_SUBDIVISION_LENGTH();
}

function PERSONA_ADDRESS_POSTAL_CODE_LENGTH() {
    return 12;
}

function PERSONA_PHOTO_HASH_INDEX() {
    return PERSONA_ADDRESS_POSTAL_CODE_INDEX() + PERSONA_ADDRESS_POSTAL_CODE_LENGTH();
}

function PERSONA_PHOTO_HASH_LENGTH() {
    return 32;
}

function PERSONA_PHONE_NUMBER_INDEX() {
    return PERSONA_PHOTO_HASH_INDEX() + PERSONA_PHOTO_HASH_LENGTH();
}

function PERSONA_PHONE_NUMBER_LENGTH() {
    return 12;
}

function PERSONA_GENDER_INDEX() {
    return PERSONA_PHONE_NUMBER_INDEX() + PERSONA_PHONE_NUMBER_LENGTH();
}

function PERSONA_GENDER_LENGTH() {
    return 1;
}

function PERSONA_MAX_LENGTH() {
    return PERSONA_GENDER_INDEX() + PERSONA_GENDER_LENGTH();
}

function PERSONA_DATA_PADDED() {
    return 320;
}

function PERSONA_ID_PADDED() {
    return 64;
}
