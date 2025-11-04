import { SMT } from '@openpassport/zk-kit-smt';
import {
  generateMerkleProof,
  generateSMTProof,
  getNameDobLeafSelfricaPersona,
  getNameYobLeafSelfricaPersona,
} from '../trees.js';
import {
  PersonaData,
  PersonaDataLimits,
  SelfricaDiscloseInput,
  SelfricaRegisterInput,
  serializeSmileData,
  SmileData,
} from './types.js';
import { findIndexInTree, formatInput } from '../circuits/generateInputs.js';
import {
  createSelfricaSelector,
  SELFRICA_MAX_LENGTH,
  SelfricaField,
} from './constants.js';
import { poseidon2 } from 'poseidon-lite';
import { Base8, inCurve, mulPointEscalar, subOrder } from '@zk-kit/baby-jubjub';
import { signECDSA, verifyECDSA, verifyEffECDSA } from './ecdsa/ecdsa.js';
import { bigintTo64bitLimbs, getEffECDSAArgs, modInv, modulus } from './ecdsa/utils.js';
import { LeanIMT } from '@openpassport/zk-kit-lean-imt';
import { packBytesAndPoseidon } from '../hash.js';
import { COMMITMENT_TREE_DEPTH } from '../../constants/constants.js';
import { PERSONA_MAX_LENGTH } from './persona_constants.js';

export const OFAC_DUMMY_INPUT: SmileData = {
  country: 'KEN',
  idType: 'NATIONAL ID',
  idNumber: '12345678901234567890', //20 digits
  issuanceDate: '20200101',
  expiryDate: '20290101',
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
  idNumber: '12345678901234567890', //20 digits
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
};

export const OFAC_PERSONA_DUMMY_INPUT: PersonaData = {
  country: 'USA',
  idType: 'tribalid',
  idNumber: 'Y123ABC',
  documentNumber: '585225',
  issuanceDate: '20200728',
  expiryDate: '20300101',
  fullName: 'ABBAS ABU',
  dob: '19481210',
  addressSubdivision: 'CA',
  addressPostalCode: '94105',
  photoHash: '1234567890abcdef123',
  phoneNumber: '+12345678901',
  gender: 'M',
};


export const NON_OFAC_PERSONA_DUMMY_INPUT: PersonaData = {
  country: 'USA',
  idType: 'tribalid',
  idNumber: 'Y123ABC',
  documentNumber: '585225',
  issuanceDate: '20200728',
  expiryDate: '20300101',
  fullName: 'John Doe',
  dob: '19900101',
  addressSubdivision: 'CA',
  addressPostalCode: '94105',
  photoHash: '1234567890abcdef123',
  phoneNumber: '+12345678901',
  gender: 'M',
};




export const createSelfricaDiscloseSelFromFields = (fieldsToReveal: SelfricaField[]): string[] => {
  const [highResult, lowResult] = createSelfricaSelector(fieldsToReveal);
  return [highResult.toString(), lowResult.toString()];
};


export const generateMockSelfricaRegisterInput = (secretKey?: bigint, ofac?: boolean, secret?: string, isSelfrica: boolean = true) => {
  let serializedData: string;
  if (isSelfrica) {
     let smileData = ofac ? OFAC_DUMMY_INPUT : NON_OFAC_DUMMY_INPUT;
     serializedData = serializeSmileData(smileData).padEnd(SELFRICA_MAX_LENGTH, '\0');
  }
  else {
    const paddedData = validateAndPadPersonaData(ofac ? OFAC_PERSONA_DUMMY_INPUT : NON_OFAC_PERSONA_DUMMY_INPUT);
    serializedData = serializePersonaData(paddedData);
  }

  const msgPadded = Array.from(serializedData, (x) => x.charCodeAt(0));
  for (let i = 0; i < msgPadded.length; i++) {
    const val = msgPadded[i];
    if (typeof val !== 'number' || val < 0 || val > 255) {
      throw new Error(
        `Invalid byte value in msgPadded at index ${i}: ${val}`
      );
    }
  }

  const sk = secretKey ? secretKey : BigInt(subOrder - BigInt(Math.floor(Math.random() * 90098)));
  const pk = mulPointEscalar(Base8, sk);

  const sig = signECDSA(sk, msgPadded);
  console.assert(verifyECDSA(msgPadded, sig, pk) == true, 'Invalid signature');

  let { T, U } = getEffECDSAArgs(msgPadded, sig);
  console.assert(verifyEffECDSA(sig.s, T, U, pk) == true, 'Invalid signature');

  console.assert(sig.s < subOrder, ' s is greater than scalar field');
  console.assert(inCurve(T), 'Point T not on curve');
  console.assert(inCurve(U), 'Point U not on curve');

  const rInv = modInv(sig.R[0], subOrder);
  const rInvLimbs = bigintTo64bitLimbs(modulus(-rInv, subOrder));

  const selfricaRegisterInput: SelfricaRegisterInput = {
    data_padded: msgPadded.map((x) => x.toString()),
    s: sig.s.toString(),
    Tx: T[0].toString(),
    Ty: T[1].toString(),
    pubKeyX: pk[0].toString(),
    pubKeyY: pk[1].toString(),
    r_inv: rInvLimbs.map((x) => x.toString()),
    secret: secret || "1234",
  };

  return selfricaRegisterInput;
};

export const generateCircuitInputsOfac = (data: SmileData | PersonaData, smt: SMT, proofLevel: number, isSelfrica: boolean = true) => {
  const name = data.fullName;
  const dob = data.dob;
  const yob = data.dob.slice(0, 4);

  const nameDobLeaf = getNameDobLeafSelfricaPersona(name, dob, isSelfrica);
  const nameYobLeaf = getNameYobLeafSelfricaPersona(name, yob, isSelfrica);

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
  };
};

export const generateSelfricaDiscloseInput = (
  ofac_input: boolean,
  nameDobSmt: SMT,
  nameYobSmt: SMT,
  identityTree: LeanIMT,
  ofac: boolean,
  scope: string,
  userIdentifier: string,
  fieldsToReveal?: SelfricaField[],
  forbiddenCountriesList?: string[],
  minimumAge?: number,
  updateTree?: boolean,
  secret: string = "1234",
  isSelfrica: boolean = true
) => {
  let serializedData: string;
  let data: SmileData | PersonaData;
  if (isSelfrica) {
    data = ofac_input ? OFAC_DUMMY_INPUT : NON_OFAC_DUMMY_INPUT;
    serializedData = serializeSmileData(data).padEnd(SELFRICA_MAX_LENGTH, '\0');
  }
  else {
    data = ofac_input ? OFAC_PERSONA_DUMMY_INPUT : NON_OFAC_PERSONA_DUMMY_INPUT;
    const paddedData = validateAndPadPersonaData(data);
    serializedData = serializePersonaData(paddedData);
  }
  const msgPadded = Array.from(serializedData, (x) => x.charCodeAt(0));
  const commitment = poseidon2([secret, packBytesAndPoseidon(msgPadded)]);
  if (updateTree) {
    identityTree.insert(commitment);
  }
  const index = findIndexInTree(identityTree, commitment);
  const {
    siblings,
    path: merkle_path,
    leaf_depth,
  } = generateMerkleProof(identityTree, index, COMMITMENT_TREE_DEPTH);

  const nameDobInputs = generateCircuitInputsOfac(data, nameDobSmt, 2, isSelfrica);
  const nameYobInputs = generateCircuitInputsOfac(data, nameYobSmt, 1, isSelfrica);

  const fieldsToRevealFinal = fieldsToReveal || [];
  let compressed_disclose_sel: string[];

  if (isSelfrica) {
    compressed_disclose_sel = createSelfricaDiscloseSelFromFields(fieldsToRevealFinal);
  } else {
    // For PERSONA, we need to convert field names and use generatePersonaSelector
    const personaFields = fieldsToRevealFinal.map(field => {
      // Map SELFRICA field names to Persona field names
      const fieldMap: Record<string, string> = {
        'COUNTRY': 'country',
        'ID_TYPE': 'idType',
        'ID_NUMBER': 'idNumber',
        'DOCUMENT': 'documentNumber',
        'ISSUANCE_DATE': 'issuanceDate',
        'EXPIRY_DATE': 'expiryDate',
        'FULL_NAME': 'fullName',
        'DOB': 'dob',
        'ADDRESS': 'addressSubdivision', // Note: Persona uses addressSubdivision and addressPostalCode
        'PHOTO_HASH': 'photoHash',
        'PHONE_NUMBER': 'phoneNumber',
        'GENDER': 'gender',
      };
      return fieldMap[field] || field.toLowerCase();
    });

    const personaSelector = generatePersonaSelector(personaFields);
    // Compress the selector into 2 bigints (similar to SELFRICA)
    const compressedBitLen = Math.ceil(personaSelector.length / 2);
    const lowBits = personaSelector.slice(0, compressedBitLen).join('');
    const highBits = personaSelector.slice(compressedBitLen).join('');
    compressed_disclose_sel = [
      BigInt('0b' + lowBits).toString(),
      BigInt('0b' + highBits).toString()
    ];
  }

  const majorityAgeASCII = minimumAge
    ? minimumAge
        .toString()
        .padStart(3, '0')
        .split('')
        .map((x) => x.charCodeAt(0))
    : ['0', '0', '0'].map((x) => x.charCodeAt(0));

    const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '').split('');


    const circuitInput: SelfricaDiscloseInput = {
    data_padded: formatInput(msgPadded),
    compressed_disclose_sel: compressed_disclose_sel,
    scope: scope,
    merkle_root: formatInput(BigInt(identityTree.root)),
    leaf_depth: formatInput(leaf_depth),
    path: formatInput(merkle_path),
    siblings: formatInput(siblings),
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
    secret: secret,
  };

  return circuitInput;
};


//PERSONA


export function validateAndPadPersonaData(data: PersonaData): PersonaData {
  const result: PersonaData = {} as PersonaData;

  for (const [field, value] of Object.entries(data)) {
    const maxLength = PersonaDataLimits[field as keyof typeof PersonaDataLimits];

    if (maxLength && value.length > maxLength) {
      throw new Error(`Field '${field}' too long: ${value.length} > ${maxLength}`);
    }
    result[field as keyof PersonaData] = maxLength ? value.padEnd(maxLength, '\0') : value;
  }
  return result;
}

export function serializePersonaData(personaData: PersonaData): string {
  let serializedData = '';

  serializedData += personaData.country;
  serializedData += personaData.idType;
  serializedData += personaData.idNumber;
  serializedData += personaData.documentNumber;
  serializedData += personaData.issuanceDate;
  serializedData += personaData.expiryDate;
  serializedData += personaData.fullName;
  serializedData += personaData.dob;
  serializedData += personaData.addressSubdivision;
  serializedData += personaData.addressPostalCode;
  serializedData += personaData.photoHash;
  serializedData += personaData.phoneNumber;
  serializedData += personaData.gender;

  return serializedData;
}

export function generatePersonaSelector(fields: string[]): string[] {
  const validFields = Object.keys(PersonaDataLimits);
  const invalidFields = fields.filter((field) => !validFields.includes(field));

  if (invalidFields.length > 0) {
    throw new Error(
      `Invalid field(s): ${invalidFields.join(', ')}. Valid fields are: ${validFields.join(', ')}`
    );
  }

  const totalLength = PERSONA_MAX_LENGTH;
  const selector = new Array(totalLength).fill('0');
  let index = 0;

  for (const [field, length] of Object.entries(PersonaDataLimits)) {
    if (fields.includes(field)) {
      selector.fill('1', index, index + length);
    }
    index += length;
  }
  return selector;
}
