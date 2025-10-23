import { SMT } from '@openpassport/zk-kit-smt';
import {
  generateMerkleProof,
  generateSMTProof,
  getNameDobLeafSelfrica,
  getNameYobLeafSelfrica,
} from '../trees.js';
import {
  SelfricaDiscloseInput,
  SelfricaRegisterInput,
  serializeSmileData,
  SmileData,
} from './types.js';
import { findIndexInTree, formatInput } from '../circuits/generateInputs.js';
import { sha256Pad } from '@zk-email/helpers/dist/sha-utils.js';
import {
  createSelfricaSelector,
  SELFRICA_DOB_INDEX,
  SELFRICA_DOB_LENGTH,
  SELFRICA_FULL_NAME_INDEX,
  SELFRICA_FULL_NAME_LENGTH,
  SELFRICA_MAX_LENGTH,
  SelfricaField,
} from './constants.js';
import { generateRSAKeyPair, signRSA, verifyRSA } from './rsa.js';
import forge from 'node-forge';
import { splitToWords } from '../bytes.js';
import { poseidon16, poseidon2 } from 'poseidon-lite';
import { Base8, inCurve, mulPointEscalar, subOrder } from '@zk-kit/baby-jubjub';
import { signECDSA, verifyECDSA, verifyEffECDSA } from './ecdsa/ecdsa.js';
import { bigintTo64bitLimbs, getEffECDSAArgs, modInv, modulus } from './ecdsa/utils.js';
import { LeanIMT } from '@openpassport/zk-kit-lean-imt';
import { packBytesAndPoseidon } from '../hash.js';
import { COMMITMENT_TREE_DEPTH } from '../../constants/constants.js';

export const splitDiscloseSel = (disclose_sel: string[]): string[] => {
  if (disclose_sel.length !== SELFRICA_MAX_LENGTH) {
    throw new Error(
      `disclose_sel must have length ${SELFRICA_MAX_LENGTH}, got ${disclose_sel.length}`
    );
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

export const generateSelfricaRegisterInput = (ofac?: boolean) => {
  let smileData = ofac ? OFAC_DUMMY_INPUT : NON_OFAC_DUMMY_INPUT;
  const serialized = serializeSmileData(smileData).padEnd(SELFRICA_MAX_LENGTH, '\0');
  const msgPadded = Array.from(serialized, (x) => x.charCodeAt(0));
  for (let i = 0; i < msgPadded.length; i++) {
    const val = msgPadded[i];
    if (typeof val !== 'number' || val < 0 || val > 255) {
      throw new Error(
        `Invalid byte value in msgPadded at index ${i}: ${val}`
      );
    }
  }

  const sk = BigInt(subOrder - BigInt(Math.floor(Math.random() * 90098)));
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
    SmileID_data_padded: msgPadded.map((x) => x.toString()),
    s: sig.s.toString(),
    Tx: T[0].toString(),
    Ty: T[1].toString(),
    pubKeyX: pk[0].toString(),
    pubKeyY: pk[1].toString(),
    r_inv: rInvLimbs.map((x) => x.toString()),
  };

  return selfricaRegisterInput;
};

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
  };
};

export const generateSelfricaDiscloseInput = (
  smileData: SmileData,
  nameDobSmt: SMT,
  nameYobSmt: SMT,
  identityTree: LeanIMT,
  ofac: boolean,
  scope: string,
  userIdentifier: string,
  fieldsToReveal?: SelfricaField[],
  forbiddenCountriesList?: string[],
  minimumAge?: number,
  updateTree?: boolean
) => {
  const serialized = serializeSmileData(smileData).padEnd(SELFRICA_MAX_LENGTH, '\0');
  const msgPadded = Array.from(serialized, (x) => x.charCodeAt(0));
  const commitment = packBytesAndPoseidon(msgPadded);
  if (updateTree) {
    identityTree.insert(BigInt(commitment));
  }
  const index = findIndexInTree(identityTree, BigInt(commitment));
  const {
    siblings,
    path: merkle_path,
    leaf_depth,
  } = generateMerkleProof(identityTree, index, COMMITMENT_TREE_DEPTH);

  const nameDobInputs = generateCircuitInputsOfac(smileData, nameDobSmt, 2);
  const nameYobInputs = generateCircuitInputsOfac(smileData, nameYobSmt, 1);

  const fieldsToRevealFinal = fieldsToReveal || [];
  const compressed_disclose_sel = createDiscloseSelFromFields(fieldsToRevealFinal);

  const majorityAgeASCII = minimumAge
    ? minimumAge
        .toString()
        .padStart(3, '0')
        .split('')
        .map((x) => x.charCodeAt(0))
    : ['0', '0', '0'].map((x) => x.charCodeAt(0));

    const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '').split('');


    const circuitInput: SelfricaDiscloseInput = {
    SmileID_data_padded: formatInput(msgPadded),
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
  };

  return circuitInput;
};


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
  const { publicKey, privateKey } =
    privateKeyIn && publicKeyIn
      ? { publicKey: publicKeyIn, privateKey: privateKeyIn }
      : generateRSAKeyPair();

  const fullName = serializedRealData.slice(
    SELFRICA_FULL_NAME_INDEX,
    SELFRICA_FULL_NAME_INDEX + SELFRICA_FULL_NAME_LENGTH
  );
  const dob = serializedRealData.slice(
    SELFRICA_DOB_INDEX,
    SELFRICA_DOB_INDEX + SELFRICA_DOB_LENGTH
  );

  const smileData = {
    fullName,
    dob,
  } as unknown as SmileData;

  const nameDobInputs = generateCircuitInputsOfac(smileData, nameDobSmt, 2);
  const nameYobInputs = generateCircuitInputsOfac(smileData, nameYobSmt, 1);

  // Sign with RSA
  const rsaSig = signRSA(msg, privateKey);
  console.assert(verifyRSA(msg, rsaSig, publicKey) == true, 'Invalid RSA signature');

  // Convert RSA signature to limbs for circuit input
  const sigBigInt = BigInt('0x' + rsaSig.toString('hex'));

  // Sign nullifier with RSA
  const idNumber = Buffer.from(msgArray.slice(30, 30 + 20));
  const nullifierRsaSig = signRSA(idNumber, privateKey);
  console.assert(
    verifyRSA(idNumber, nullifierRsaSig, publicKey) == true,
    'Invalid nullifier RSA signature'
  );

  // Convert nullifier RSA signature to limbs
  const nullifierSigBigInt = BigInt('0x' + nullifierRsaSig.toString('hex'));

  // Extract RSA modulus and exponent from PEM formatted public key
  const publicKeyObject = forge.pki.publicKeyFromPem(publicKey);
  const realRsaModulus = BigInt('0x' + publicKeyObject.n.toString(16));

  const [msgPadded, _] = sha256Pad(msg, 320);

  // Create disclose_sel array and split it into two decimal numbers
  // Use provided fields or default to revealing all fields
  const fieldsToRevealFinal = fieldsToReveal || [
    'COUNTRY',
    'ID_TYPE',
    'ID_NUMBER',
    'ISSUANCE_DATE',
    'EXPIRY_DATE',
    'FULL_NAME',
    'DOB',
    'PHOTO_HASH',
    'PHONE_NUMBER',
    'DOCUMENT',
    'GENDER',
    'ADDRESS',
  ];
  const compressed_disclose_sel = createDiscloseSelFromFields(fieldsToRevealFinal).reverse();

  //generate the current date
  const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '').split('');


  // const circuitInput: SelfricaCircuitInput = {
  //   SmileID_data_padded: formatInput(msgPadded),
  //   compressed_disclose_sel: compressed_disclose_sel,
  //   scope: scope || '0',
  //   forbidden_countries_list: forbiddenCountriesList || [...Array(120)].map((x) => '0'),
  //   ofac_name_dob_smt_leaf_key: nameDobInputs.smt_leaf_key,
  //   ofac_name_dob_smt_root: nameDobInputs.smt_root,
  //   ofac_name_dob_smt_siblings: nameDobInputs.smt_siblings,
  //   ofac_name_yob_smt_leaf_key: nameYobInputs.smt_leaf_key,
  //   ofac_name_yob_smt_root: nameYobInputs.smt_root,
  //   ofac_name_yob_smt_siblings: nameYobInputs.smt_siblings,
  //   selector_ofac: ofac ? ['1'] : ['0'],
  //   user_identifier: userIdentifier || '1234567890',
  //   current_date: currentDate,
  //   majority_age_ASCII: ['0', '2', '0'].map((x) => x.charCodeAt(0)),
  // };

  // return circuitInput;
};

export const pubkeyCommitment = (pubkey: forge.pki.rsa.PublicKey) => {
  const modulusHex = pubkey.n.toString(16);
  const realRsaModulus = BigInt('0x' + modulusHex);

  const pubkeyParts = splitToWords(realRsaModulus, 121, 17);

  const firstPosiedonPart = poseidon16(pubkeyParts.slice(0, 16));
  const pubkeyCommitment = poseidon2([firstPosiedonPart, pubkeyParts[16]]);

  return pubkeyCommitment;
};
