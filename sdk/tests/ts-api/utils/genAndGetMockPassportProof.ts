import { poseidon2, poseidon6 } from 'poseidon-lite';
import {
  generateCircuitInputsDSC,
  generateCircuitInputsRegister,
  generateCircuitInputsVCandDisclose,
} from '@selfxyz/common/utils/circuits/generateInputs';
import { genMockPassportData } from '@selfxyz/common/utils/passports/genMockPassportData';
import { getCircuitNameFromPassportData } from '@selfxyz/common/utils/circuitNames';

import { handshakeAndGetUuid, getProofGeneratedUpdate, createRandomString } from './helper.js';

import { LeanIMT } from '@openpassport/zk-kit-lean-imt';
import { SMT } from '@openpassport/zk-kit-smt';
// @ts-ignore
import passportNojson from '@selfxyz/circuits/tests/consts/ofac/passportNoAndNationalitySMT.json';
// @ts-ignore
import nameAndDobjson from '@selfxyz/circuits/tests/consts/ofac/nameAndDobSMT.json';
// @ts-ignore
import nameAndYobjson from '@selfxyz/circuits/tests/consts/ofac/nameAndYobSMT.json';
import { CircuitSignals, groth16 } from 'snarkjs';
// @ts-ignore
import { CircuitArtifacts } from '@selfxyz/contracts/test/utils/types.js';
import { DSC_MEDIUM_URL, DSC_URL, REGISTER_MEDIUM_URL, REGISTER_URL } from './constant.js';

const dscCircuits: CircuitArtifacts = {
  dsc_sha256_rsa_65537_4096: {
    wasm: "../../../../circuits/build/dsc/dsc_sha256_rsa_65537_4096/dsc_sha256_rsa_65537_4096_js/dsc_sha256_rsa_65537_4096.wasm",
    zkey: "../../../../circuits/build/dsc/dsc_sha256_rsa_65537_4096/dsc_sha256_rsa_65537_4096_final.zkey",
    vkey: "../../../../circuits/build/dsc/dsc_sha256_rsa_65537_4096/dsc_sha256_rsa_65537_4096_vkey.json",
  },
};

export async function genAndGetMockPassportProof(hashFunction: string, sigAlg: string, domainParameter: string, keyLength: number) {

  const response = await fetch("http://tree.staging.self.xyz/csca");
  const data = await response.json() as any;

  const cscaTree = JSON.parse(data.data);

  const passportData = genMockPassportData(
    hashFunction,
    hashFunction,
    `${sigAlg}_${hashFunction}_${domainParameter}_${keyLength}` as any,
    "FRA",
    "000101",
    "300101",
    undefined,
    createRandomString(6)
  );

  const dscInputs = generateCircuitInputsDSC(passportData, cscaTree!);
  const dscCircuitName = getCircuitNameFromPassportData(passportData, "dsc");
  const dscUuid = await handshakeAndGetUuid(
    keyLength === 384 ? DSC_MEDIUM_URL : DSC_URL,
    dscInputs,
    "dsc",
    dscCircuitName
  );

  const dscData = await getProofGeneratedUpdate(dscUuid);
  //pretty print the circuit name
  console.log("\x1b[34m%s\x1b[0m", "dsc uuid:", dscUuid);
  console.log("\x1b[34m%s\x1b[0m", "circuit:", dscCircuitName);
  console.log(
    "\x1b[34m%s\x1b[0m",
    "witness generation duration:",
    //@ts-ignore
    (new Date(dscData.witness_generated_at) - new Date(dscData.created_at)) /
      1000,
    " seconds"
  );
  console.log(
    "\x1b[34m%s\x1b[0m",
    "proof   generation duration:",
    //@ts-ignore
    (new Date(dscData.proof_generated_at) -
      //@ts-ignore
      new Date(dscData.witness_generated_at)) /
      1000,
    " seconds"
  );

  const secret = poseidon6(
    createRandomString(6)
      .split("")
      .map((x) => BigInt(x.charCodeAt(0)))
  ).toString();

  const dscTree = await fetch("http://tree.staging.self.xyz/dsc");
  const serialized_dsc_tree: any = await dscTree.json();

  const registerInputs = generateCircuitInputsRegister(
    secret,
    passportData,
    serialized_dsc_tree.data as string
  );

  const registerCircuitName = getCircuitNameFromPassportData(
    passportData,
    "register"
  );

  const registerUuid = await handshakeAndGetUuid(
    keyLength === 384 ? REGISTER_MEDIUM_URL : REGISTER_URL,
    registerInputs,
    "register",
    registerCircuitName
  );
  const registerData = await getProofGeneratedUpdate(registerUuid);
  console.log("\x1b[34m%s\x1b[0m", "register uuid:", registerUuid);
  console.log("\x1b[34m%s\x1b[0m", "circuit:", registerCircuitName);
  console.log(
    "\x1b[34m%s\x1b[0m",
    "witness generation duration:",
    //@ts-ignore
    (new Date(registerData.witness_generated_at) -
      //@ts-ignore
      new Date(registerData.created_at)) /
      1000,
    " seconds"
  );
  console.log(
    "\x1b[34m%s\x1b[0m",
    "proof   generation duration:",
    //@ts-ignore
    (new Date(registerData.proof_generated_at) -
      //@ts-ignore
      new Date(registerData.witness_generated_at)) /
      1000,
    " seconds"
  );

  // const dscCircuitInputs: any = await generateCircuitInputsDSC(passportData, cscaTree);

  // const dscProof = await groth16.fullProve(
  //   dscCircuitInputs,
  //   dscCircuits["dsc_sha256_rsa_65537_4096"].wasm,
  //   dscCircuits["dsc_sha256_rsa_65537_4096"].zkey,
  // );





  return passportData;
}
