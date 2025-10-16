import { SMT } from "@openpassport/zk-kit-smt";
import { generateSMTProof, getNameDobLeafSelfrica, getNameYobLeafSelfrica } from "../trees.js";
import { SelfricaCircuitInput, serializeSmileData, SmileData } from "./types.js";
import { formatInput } from "../circuits/generateInputs.js";
import { sha256Pad } from '@zk-email/helpers/dist/sha-utils.js';
import { createSelfricaSelector, SELFRICA_DOB_INDEX, SELFRICA_DOB_LENGTH, SELFRICA_FULL_NAME_INDEX, SELFRICA_FULL_NAME_LENGTH, SELFRICA_MAX_LENGTH, SelfricaField } from "./constants.js";
import { generateRSAKeyPair, signRSA, verifyRSA } from "./rsa.js";
import forge from "node-forge";
import { splitToWords } from "../bytes.js";
import { poseidon16, poseidon2 } from "poseidon-lite";


export const splitDiscloseSel = (disclose_sel: string[]): string[] => {
    if (disclose_sel.length !== SELFRICA_MAX_LENGTH) {
        throw new Error(`disclose_sel must have length ${SELFRICA_MAX_LENGTH}, got ${disclose_sel.length}`);
    }

    // Split into two arrays of 133 bits each
    const disclose_sel_low_bits = disclose_sel.slice(0, 133);
    const disclose_sel_high_bits = disclose_sel.slice(133, 266);

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

export const createDiscloseSelFromFields = (fieldsToReveal: SelfricaField[]): string[] => {
    const [highResult, lowResult] = createSelfricaSelector(fieldsToReveal);
    return [highResult.toString(), lowResult.toString()];
};


export const OFAC_DUMMY_INPUT: SmileData = {
    country: 'KEN',
    idType: 'NATIONAL ID',
    idNumber: '1234567890',
    issuanceDate: '20200101',
    expiryDate: '20250101', //expiry date is 5 years from issuance date
    fullName: 'ABBAS ABU',
    dob: '19481210',
    photoHash: '1234567890',
    phoneNumber: '1234567890',
    document: 'ID',
    gender: 'Male',
    address: '1234567890',
    user_identifier: '1234567890',
    current_date: '20250101',
    majority_age_ASCII: '20',
    selector_older_than: '1',
};

export const NON_OFAC_DUMMY_INPUT: SmileData = {
    country: 'KEN',
    idType: 'NATIONAL ID',
    idNumber: '1234567890',
    issuanceDate: '20200101',
    expiryDate: '20290101',
    fullName: 'John Doe',
    dob: '19900101',
    photoHash: '1234567890',
    phoneNumber: '1234567890',
    document: 'ID',
    gender: 'Male',
    address: '1234567890',
    user_identifier: '1234567890',
    current_date: '20250101',
    majority_age_ASCII: '20',
    selector_older_than: '1',
}

export const generateCircuitInputsOfac = (smileData: SmileData, smt: SMT, proofLevel: number) => {
    const name = smileData.fullName;
    const dob = smileData.dob;
    const yob = smileData.dob.slice(0, 4);

    const nameDobLeaf = getNameDobLeafSelfrica(name, dob);
    const nameYobLeaf = getNameYobLeafSelfrica(name, yob);

    let root, closestleaf, siblings;
    if (proofLevel == 2) {
        ({ root, closestleaf, siblings } = generateSMTProof(smt, nameDobLeaf));
    } else if (proofLevel == 1) {
        ({ root, closestleaf, siblings } = generateSMTProof(smt, nameYobLeaf));
    } else {
        throw new Error('Invalid proof level');
    }

    return {
        smt_root: formatInput(root),
        smt_leaf_key: formatInput(closestleaf),
        smt_siblings: formatInput(siblings),
    }
}

export const generateCircuitInput = (nameDobSmt: SMT, nameYobSmt: SMT, ofac?: boolean, fieldsToReveal?: SelfricaField[]) => {
    let smileData = ofac ? OFAC_DUMMY_INPUT : NON_OFAC_DUMMY_INPUT;
    const msg = Buffer.from(serializeSmileData(smileData), 'utf8');
    const msgArray = Array.from(msg);

    // Generate RSA key pair
    const { publicKey, privateKey } = generateRSAKeyPair();

    const nameDobInputs = generateCircuitInputsOfac(smileData, nameDobSmt, 2);
    const nameYobInputs = generateCircuitInputsOfac(smileData, nameYobSmt, 1);

    const [msgPadded, _]= sha256Pad(msg, 320);

    // Sign with RSA
    const msg_rsaSig = signRSA(msg, privateKey);
    console.assert(verifyRSA(msg, msg_rsaSig, publicKey) == true, "Invalid RSA signature");

    // Convert RSA signature to limbs for circuit input
    const sigBigInt = BigInt('0x' + msg_rsaSig.toString('hex'));

    // Sign nullifier with RSA
    const idNumber = Buffer.from(msgArray.slice(30, 30 + 20));

    const id_num_rsaSig = signRSA(idNumber, privateKey);
    console.assert(verifyRSA(idNumber, id_num_rsaSig, publicKey) == true, "Invalid nullifier RSA signature");

    // Convert nullifier RSA signature to limbs
    const nullifierSigBigInt = BigInt('0x' + id_num_rsaSig.toString('hex'));

    // Extract RSA modulus and exponent from PEM formatted public key
    const publicKeyObject = forge.pki.publicKeyFromPem(publicKey);
    const rsaModulus = BigInt('0x' + publicKeyObject.n.toString(16));

    // Create disclose_sel array and split it into two decimal numbers
    // Use provided fields or default to revealing all fields
    const fieldsToRevealFinal = fieldsToReveal || [
        'COUNTRY', 'ID_TYPE', 'ID_NUMBER', 'ISSUANCE_DATE', 'EXPIRY_DATE',
        'FULL_NAME', 'DOB', 'PHOTO_HASH', 'PHONE_NUMBER', 'DOCUMENT', 'GENDER', 'ADDRESS'
    ];
    const compressed_disclose_sel = createDiscloseSelFromFields(fieldsToRevealFinal);

    const circuitInput: SelfricaCircuitInput = {
        SmileID_data_padded: formatInput(msgPadded),
        compressed_disclose_sel: compressed_disclose_sel,
        pubKey: splitToWords(rsaModulus, 121, 17),
        msg_sig: splitToWords(sigBigInt, 121, 17),
        scope: '0',
        id_num_sig: splitToWords(nullifierSigBigInt, 121, 17),
        forbidden_countries_list: [...Array(120)].map((x) => '0'),
        ofac_name_dob_smt_leaf_key: nameDobInputs.smt_leaf_key,
        ofac_name_dob_smt_root: nameDobInputs.smt_root,
        ofac_name_dob_smt_siblings: nameDobInputs.smt_siblings,
        ofac_name_yob_smt_leaf_key: nameYobInputs.smt_leaf_key,
        ofac_name_yob_smt_root: nameYobInputs.smt_root,
        ofac_name_yob_smt_siblings: nameYobInputs.smt_siblings,
        selector_ofac: ofac ? ['1'] : ['0'],
        user_identifier: '1234567890',
        current_date: ['2', '0', '2', '4', '0', '1', '0', '1'],
        majority_age_ASCII: ['0', '0', '1'].map((x) => x.charCodeAt(0)),
    }

    return circuitInput;
}

export const generateSelfricaInputWithOutSig = (
    serializedRealData: string,
    nameDobSmt: SMT,
    nameYobSmt: SMT,
    ofac: boolean,
    scope: string,
    userIdentifier: string,
    fieldsToReveal?: SelfricaField[],
    forbiddenCountriesList?: string[],
    minimumAge?: number,
) => {

    const msg = Buffer.from(serializedRealData, 'utf8');

    const fullName = serializedRealData.slice(SELFRICA_FULL_NAME_INDEX, SELFRICA_FULL_NAME_INDEX + SELFRICA_FULL_NAME_LENGTH);
    const dob = serializedRealData.slice(SELFRICA_DOB_INDEX, SELFRICA_DOB_INDEX + SELFRICA_DOB_LENGTH);

    const smileData = {
        fullName,
        dob,
    } as unknown as SmileData;

    const nameDobInputs = generateCircuitInputsOfac(smileData, nameDobSmt, 2);
    const nameYobInputs = generateCircuitInputsOfac(smileData, nameYobSmt, 1);

    const [msgPadded, _] = sha256Pad(msg, 320);

    const fieldsToRevealFinal = fieldsToReveal || [];
    const compressed_disclose_sel = createDiscloseSelFromFields(fieldsToRevealFinal).reverse();

    //generate the current date
    const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '').split("");

    const majorityAgeASCII = minimumAge ? minimumAge.toString().split("").map((x) => x.charCodeAt(0)) : ['0', '0', '0'].map((x) => x.charCodeAt(0));
    const circuitInput: SelfricaCircuitInput = {
        SmileID_data_padded: formatInput(msgPadded),
        compressed_disclose_sel: compressed_disclose_sel,
        pubKey: [],
        msg_sig: [],
        id_num_sig: [],
        scope: scope,
        forbidden_countries_list: forbiddenCountriesList || [...Array(120)].map((x) => '0'),
        ofac_name_dob_smt_leaf_key: nameDobInputs.smt_leaf_key,
        ofac_name_dob_smt_root: nameDobInputs.smt_root,
        ofac_name_dob_smt_siblings: nameDobInputs.smt_siblings,
        ofac_name_yob_smt_leaf_key: nameYobInputs.smt_leaf_key,
        ofac_name_yob_smt_root: nameYobInputs.smt_root,
        ofac_name_yob_smt_siblings: nameYobInputs.smt_siblings,
        selector_ofac: ofac ? ['1'] : ['0'],
        user_identifier: userIdentifier,
        current_date: currentDate,
        majority_age_ASCII: majorityAgeASCII,
    }

    return circuitInput;
}

export const generateSelfricaInputWithSig = (
    pubkeyBase64: string,
    msgSigBase64: string,
    idNumSigBase64: string,
    serializedRealData: string,
    nameDobSmt: SMT,
    nameYobSmt: SMT,
    ofac: boolean,
    scope: string,
    userIdentifier: string,
    fieldsToReveal?: SelfricaField[],
    forbiddenCountriesList?: string[],
    minimumAge?: number,
) => {
    const msg = Buffer.from(serializedRealData, 'utf8');

    const fullName = serializedRealData.slice(SELFRICA_FULL_NAME_INDEX, SELFRICA_FULL_NAME_INDEX + SELFRICA_FULL_NAME_LENGTH);
    const dob = serializedRealData.slice(SELFRICA_DOB_INDEX, SELFRICA_DOB_INDEX + SELFRICA_DOB_LENGTH);

    const smileData = {
        fullName,
        dob,
    } as unknown as SmileData;

    const nameDobInputs = generateCircuitInputsOfac(smileData, nameDobSmt, 2);
    const nameYobInputs = generateCircuitInputsOfac(smileData, nameYobSmt, 1);

    const [msgPadded, _] = sha256Pad(msg, 320);

    const pubkeyBuffer = Buffer.from(pubkeyBase64, 'base64');
    const pubkeyBigInt = BigInt('0x' + pubkeyBuffer.toString('hex'));

    const msgSigBuffer = Buffer.from(msgSigBase64, 'base64');
    const msgSigBigInt = BigInt('0x' + msgSigBuffer.toString('hex'));

    const idNumSigBuffer = Buffer.from(idNumSigBase64, 'base64');
    const idNumSigBigInt = BigInt('0x' + idNumSigBuffer.toString('hex'));

    const fieldsToRevealFinal = fieldsToReveal || [];
    const compressed_disclose_sel = createDiscloseSelFromFields(fieldsToRevealFinal).reverse();

    const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '').split("");

    const majorityAgeASCII = minimumAge ? minimumAge.toString().split("").map((x) => x.charCodeAt(0)) : ['0', '0', '0'].map((x) => x.charCodeAt(0));

    const circuitInput: SelfricaCircuitInput = {
        SmileID_data_padded: formatInput(msgPadded),
        compressed_disclose_sel: compressed_disclose_sel,
        pubKey: splitToWords(pubkeyBigInt, 121, 17),
        msg_sig: splitToWords(msgSigBigInt, 121, 17),
        id_num_sig: splitToWords(idNumSigBigInt, 121, 17),
        scope: scope,
        forbidden_countries_list: forbiddenCountriesList || [...Array(120)].map((x) => '0'),
        ofac_name_dob_smt_leaf_key: nameDobInputs.smt_leaf_key,
        ofac_name_dob_smt_root: nameDobInputs.smt_root,
        ofac_name_dob_smt_siblings: nameDobInputs.smt_siblings,
        ofac_name_yob_smt_leaf_key: nameYobInputs.smt_leaf_key,
        ofac_name_yob_smt_root: nameYobInputs.smt_root,
        ofac_name_yob_smt_siblings: nameYobInputs.smt_siblings,
        selector_ofac: ofac ? ['1'] : ['0'],
        user_identifier: userIdentifier,
        current_date: currentDate,
        majority_age_ASCII: majorityAgeASCII,
    }

    return circuitInput;
}

export const generateCircuitInputWithRealData = (
    serializedRealData: string,
    nameDobSmt: SMT,
    nameYobSmt: SMT,
    ofac?: boolean,
    privateKeyIn?: string,
    publicKeyIn?: string,
    fieldsToReveal?: SelfricaField[],
    scope?: string,
    userIdentifier?: string,
    forbiddenCountriesList?: string[]
) => {
    const msg = Buffer.from(serializedRealData, 'utf8');
    const msgArray = Array.from(msg); // Convert buffer to array of bytes for circuit input

    // Generate RSA key pair for real data (or use fixed key for deterministic results)
    const { publicKey, privateKey } = privateKeyIn && publicKeyIn ? { publicKey: publicKeyIn, privateKey: privateKeyIn } : generateRSAKeyPair();

    const fullName = serializedRealData.slice(SELFRICA_FULL_NAME_INDEX, SELFRICA_FULL_NAME_INDEX + SELFRICA_FULL_NAME_LENGTH);
    const dob = serializedRealData.slice(SELFRICA_DOB_INDEX, SELFRICA_DOB_INDEX + SELFRICA_DOB_LENGTH);

    const smileData = {
        fullName,
        dob,
    } as unknown as SmileData;

    const nameDobInputs = generateCircuitInputsOfac(smileData, nameDobSmt, 2);
    const nameYobInputs = generateCircuitInputsOfac(smileData, nameYobSmt, 1);

    // Sign with RSA
    const rsaSig = signRSA(msg, privateKey);
    console.assert(verifyRSA(msg, rsaSig, publicKey) == true, "Invalid RSA signature");

    // Convert RSA signature to limbs for circuit input
    const sigBigInt = BigInt('0x' + rsaSig.toString('hex'));

    // Sign nullifier with RSA
    const idNumber = Buffer.from(msgArray.slice(30, 30 + 20));
    const nullifierRsaSig = signRSA(idNumber, privateKey);
    console.assert(verifyRSA(idNumber, nullifierRsaSig, publicKey) == true, "Invalid nullifier RSA signature");

    // Convert nullifier RSA signature to limbs
    const nullifierSigBigInt = BigInt('0x' + nullifierRsaSig.toString('hex'));

    // Extract RSA modulus and exponent from PEM formatted public key
    const publicKeyObject = forge.pki.publicKeyFromPem(publicKey);
    const realRsaModulus = BigInt('0x' + publicKeyObject.n.toString(16));

    const [msgPadded, _] = sha256Pad(msg, 320);

    // Create disclose_sel array and split it into two decimal numbers
    // Use provided fields or default to revealing all fields
    const fieldsToRevealFinal = fieldsToReveal || [
        'COUNTRY', 'ID_TYPE', 'ID_NUMBER', 'ISSUANCE_DATE', 'EXPIRY_DATE',
        'FULL_NAME', 'DOB', 'PHOTO_HASH', 'PHONE_NUMBER', 'DOCUMENT', 'GENDER', 'ADDRESS'
    ];
    const compressed_disclose_sel = createDiscloseSelFromFields(fieldsToRevealFinal).reverse();

    //generate the current date
    const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '').split("");

    console.log('currentDate', currentDate);

    const circuitInput: SelfricaCircuitInput = {
        SmileID_data_padded: formatInput(msgPadded),
        compressed_disclose_sel: compressed_disclose_sel,
        pubKey: splitToWords(realRsaModulus, 121, 17),
        msg_sig: splitToWords(sigBigInt, 121, 17),
        id_num_sig: splitToWords(nullifierSigBigInt, 121, 17),
        scope: scope || '0',
        forbidden_countries_list: forbiddenCountriesList || [...Array(120)].map((x) => '0'),
        ofac_name_dob_smt_leaf_key: nameDobInputs.smt_leaf_key,
        ofac_name_dob_smt_root: nameDobInputs.smt_root,
        ofac_name_dob_smt_siblings: nameDobInputs.smt_siblings,
        ofac_name_yob_smt_leaf_key: nameYobInputs.smt_leaf_key,
        ofac_name_yob_smt_root: nameYobInputs.smt_root,
        ofac_name_yob_smt_siblings: nameYobInputs.smt_siblings,
        selector_ofac: ofac ? ['1'] : ['0'],
        user_identifier: userIdentifier || '1234567890',
        current_date: currentDate,
        majority_age_ASCII: ['0', '2', '0'].map((x) => x.charCodeAt(0)),
    }

    return circuitInput;
}

export const pubkeyCommitment = (pubkey: forge.pki.rsa.PublicKey) => {
    const modulusHex = pubkey.n.toString(16);
    const realRsaModulus = BigInt('0x' + modulusHex);

    const pubkeyParts = splitToWords(realRsaModulus, 121, 17);

    const firstPosiedonPart = poseidon16(pubkeyParts.slice(0, 16));
    const pubkeyCommitment = poseidon2([firstPosiedonPart, pubkeyParts[16]]);

    return pubkeyCommitment;
}
