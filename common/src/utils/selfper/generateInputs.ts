import { SMT } from '@openpassport/zk-kit-smt';
import {
  generateMerkleProof,
  generateSMTProof,
  getNameDobLeafSelfper,
  getNameYobLeafSelfper,
} from '../trees.js';
import {
  SelfperDiscloseInput,
  SelfperRegisterInput,
  serializeSelfperData,
  SelfperData,
} from './types.js';
import { findIndexInTree, formatInput } from '../circuits/generateInputs.js';
import {
  createSelfperSelector,
  SELFPER_MAX_LENGTH,
  SelfperField,
} from './constants.js';
import { poseidon2 } from 'poseidon-lite';
import { Base8, inCurve, mulPointEscalar, subOrder } from '@zk-kit/baby-jubjub';
import { signECDSA, verifyECDSA, verifyEffECDSA } from './ecdsa/ecdsa.js';
import { bigintTo64bitLimbs, getEffECDSAArgs, modInv, modulus } from './ecdsa/utils.js';
import { LeanIMT } from '@openpassport/zk-kit-lean-imt';
import { packBytesAndPoseidon } from '../hash.js';
import { COMMITMENT_TREE_DEPTH } from '../../constants/constants.js';

export const OFAC_DUMMY_INPUT: SelfperData = {
  country: 'KEN',
  idType: 'NATIONAL ID',
  idNumber: '12345678901234567890123456789012', //32 digits
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

export const NON_OFAC_DUMMY_INPUT: SelfperData = {
  country: 'KEN',
  idType: 'NATIONAL ID',
  idNumber: '12345678901234567890123456789012', //32 digits
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

export const createSelfperDiscloseSelFromFields = (fieldsToReveal: SelfperField[]): string[] => {
  const [lowResult, highResult] = createSelfperSelector(fieldsToReveal);
  return [lowResult.toString(), highResult.toString()];
};


export const generateMockSelfperRegisterInput = (secretKey?: bigint, ofac?: boolean, secret?: string, attestationId?: string) => {
  const selfperData = ofac ? OFAC_DUMMY_INPUT : NON_OFAC_DUMMY_INPUT;
  const serializedData = serializeSelfperData(selfperData).padEnd(SELFPER_MAX_LENGTH, '\0');

  const msgPadded = Array.from(serializedData, (x) => x.charCodeAt(0));

  const sk = secretKey ? secretKey : BigInt(Math.floor(Math.random() * Number(subOrder - 2n))) + 1n;

  const pk = mulPointEscalar(Base8, sk);
  console.assert(inCurve(pk), 'Point pk not on curve');
  console.assert(pk[0] != 0n && pk[1] != 0n, 'pk is zero');

  const sig = signECDSA(sk, msgPadded);
  console.assert(verifyECDSA(msgPadded, sig, pk) == true, 'Invalid signature');

  let { T, U } = getEffECDSAArgs(msgPadded, sig);
  console.assert(verifyEffECDSA(sig.s, T, U, pk) == true, 'Invalid signature');

  console.assert(sig.s < subOrder, ' s is greater than scalar field');
  console.assert(inCurve(T), 'Point T not on curve');
  console.assert(inCurve(U), 'Point U not on curve');

  const rInv = modInv(sig.R[0], subOrder);
  const rInvLimbs = bigintTo64bitLimbs(modulus(-rInv, subOrder));

  const selfperRegisterInput: SelfperRegisterInput = {
    data_padded: msgPadded.map((x) => x.toString()),
    s: sig.s.toString(),
    Tx: T[0].toString(),
    Ty: T[1].toString(),
    pubKeyX: pk[0].toString(),
    pubKeyY: pk[1].toString(),
    r_inv: rInvLimbs.map((x) => x.toString()),
    secret: secret || "1234",
    attestation_id: attestationId || '4',
  };

  return selfperRegisterInput;
};

export const generateCircuitInputsOfac = (data: SelfperData, smt: SMT, proofLevel: number) => {
  const name = data.fullName;
  const dob = data.dob;
  const yob = data.dob.slice(0, 4);

  const nameDobLeaf = getNameDobLeafSelfper(name, dob);
  const nameYobLeaf = getNameYobLeafSelfper(name, yob);

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

export const generateSelfperDiscloseInput = (
  ofac_input: boolean,
  nameDobSmt: SMT,
  nameYobSmt: SMT,
  identityTree: LeanIMT,
  ofac: boolean,
  scope: string,
  userIdentifier: string,
  fieldsToReveal?: SelfperField[],
  forbiddenCountriesList?: string[],
  minimumAge?: number,
  updateTree?: boolean,
  attestationId?: string,
  secret: string = "1234"
) => {
  const data = ofac_input ? OFAC_DUMMY_INPUT : NON_OFAC_DUMMY_INPUT;
  const serializedData = serializeSelfperData(data).padEnd(SELFPER_MAX_LENGTH, '\0');
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

  const nameDobInputs = generateCircuitInputsOfac(data, nameDobSmt, 2);
  const nameYobInputs = generateCircuitInputsOfac(data, nameYobSmt, 1);

  const fieldsToRevealFinal = fieldsToReveal || [];
  const compressed_disclose_sel = createSelfperDiscloseSelFromFields(fieldsToRevealFinal);

  const majorityAgeASCII = minimumAge
    ? minimumAge
        .toString()
        .padStart(3, '0')
        .split('')
        .map((x) => x.charCodeAt(0))
    : ['0', '0', '0'].map((x) => x.charCodeAt(0));

    const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '').split('');


    const circuitInput: SelfperDiscloseInput = {
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
    attestation_id: attestationId || '4',
  };

  return circuitInput;
};
