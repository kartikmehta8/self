import {
  genAndInitMockPassportData,
  generateCircuitInputsDSC,
  generateCircuitInputsRegister,
  getCircuitNameFromPassportData,
  PassportData,
  genMockIdDocAndInitDataParsing,
  prepareAadhaarDiscloseTestData,
  prepareAadhaarRegisterTestData,
  generateTestData,
  testCustomData,
  calculateUserIdentifierHash,
} from "@selfxyz/common";
import {
  getProofGeneratedUpdate,
  handshakeAndGetUuid,
  runGenerateVcAndDiscloseRawProof,
} from "./ts-api/utils/helper.ts";
import { DSC_URL, REGISTER_URL } from "./ts-api/utils/constant.ts";
import { hashEndpointWithScope } from "@selfxyz/common/utils/scope";
import { CircuitSignals, groth16, Groth16Proof, PublicSignals } from "snarkjs";
import axios from "axios";
import fs from "fs";
import path from "path";
import { LeanIMT } from '@openpassport/zk-kit-lean-imt';
import { fileURLToPath } from 'url';
import { SMT } from '@openpassport/zk-kit-smt';
import { poseidon2 } from 'poseidon-lite';
import nameAndDobAadhaarjson from '../../circuits/tests/consts/ofac/nameAndDobAadhaarSMT.json' with { type: 'json' };
import nameAndYobAadhaarjson from '../../circuits/tests/consts/ofac/nameAndYobAadhaarSMT.json' with { type: 'json' };
import { AADHAAR_MOCK_PRIVATE_KEY_PEM , AADHAAR_MOCK_PUBLIC_KEY_PEM} from "../../common/src/mock_certificates/aadhaar/mockAadhaarCert.ts";
import { prepareAadhaarDiscloseData, prepareAadhaarRegisterData, processQRData } from "../../common/dist/esm/src/utils/aadhaar/mockData";


// Create SMTs at module level
const nameAndDob_smt = new SMT(poseidon2, true);
nameAndDob_smt.import(nameAndDobAadhaarjson as any);

const nameAndYob_smt = new SMT(poseidon2, true);
nameAndYob_smt.import(nameAndYobAadhaarjson as any);


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const privateKeyPem = AADHAAR_MOCK_PRIVATE_KEY_PEM;

const publicKeyPem = AADHAAR_MOCK_PUBLIC_KEY_PEM

// const publicKeyPem = fs.readFileSync(
//   path.join(__dirname, '../../circuits/node_modules/anon-aadhaar-circuits/assets/testCertificate.pem'),
//   'utf8'
// );

// Types for API testing
export interface ProofData {
  proof: {
    a: string[];
    b: string[][];
    c: string[];
  };
  publicSignals: PublicSignals;
}

export interface APIResponse {
  status: number;
  data: any;
  success: boolean;
}

async function registerMockPassportOrEUid(
  secret: string,
  ispassport: boolean
): Promise<PassportData> {
  let passportData: any;
  let dscTree: any;
  let cscaTree: any;

  if (ispassport) {
    passportData = genAndInitMockPassportData(
      "sha1",
      "sha1",
      "rsa_sha1_65537_4096",
      "FRA",
      "000101",
      "300101"
    );
    dscTree = await axios.get("http://tree.staging.self.xyz/dsc");
    cscaTree = await axios.get("http://tree.staging.self.xyz/csca");
  } else {
    console.log("Generating EU ID card data");

    passportData =  genMockIdDocAndInitDataParsing({
      idType: 'mock_id_card',
      dgHashAlgo: `sha256`,
      eContentHashAlgo: `sha256`,
      signatureType:
        `rsa_sha256_65537_4096`,
    });
    dscTree = await axios.get("http://tree.staging.self.xyz/dsc-id");
    cscaTree = await axios.get("http://tree.staging.self.xyz/csca-id");
  }


  try {
    let dscCircuitName;
    let dscUuid ;

    const cscaTreeData = JSON.parse(cscaTree.data.data);
    const dscInputs = generateCircuitInputsDSC(passportData, cscaTreeData);
    if(ispassport){
      console.log("Generating DSC proof");
      dscCircuitName = getCircuitNameFromPassportData(passportData, "dsc");
      dscUuid = await handshakeAndGetUuid(
        DSC_URL,
        dscInputs,
        "dsc",
        dscCircuitName
      );
    } else {
      console.log("Generating DSC ID proof");
      dscCircuitName = getCircuitNameFromPassportData(passportData, "dsc");
      dscUuid = await handshakeAndGetUuid(
        DSC_URL,
        dscInputs,
        "dsc_id",
        dscCircuitName
      );
    }

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
 } catch (error) {
  console.log("DSC is already generated or failed to generate:", error);

 }


  const serialized_dsc_tree = dscTree.data;
  // Register proof generation
  const registerInputs = generateCircuitInputsRegister(
    secret,
    passportData,
    serialized_dsc_tree.data
  );

  const registerCircuitName = getCircuitNameFromPassportData(
    passportData,
    "register"
  );
  // Determine the correct proof type based on circuit name
  const proofType = registerCircuitName.startsWith("register_id_") ? "register_id" : "register";

  // keyLength === 384 ? REGISTER_MEDIUM_URL : REGISTER_URL,
  const registerUuid = await handshakeAndGetUuid(
    REGISTER_URL,
    registerInputs,
    proofType,
    registerCircuitName
  );
  const registerData = await getProofGeneratedUpdate(registerUuid);
  console.log(
    " Got register proof generated update:",
    registerData ? "SUCCESS" : "FAILED"
  );
  console.log("\x1b[34m%s\x1b[0m", "register uuid:", registerUuid);
  console.log("\x1b[34m%s\x1b[0m", "circuit:", registerCircuitName);
  console.log(
    "\x1b[34m%s\x1b[0m",
    "witness generation duration:",
    (new Date(registerData.witness_generated_at).getTime() -
      new Date(registerData.created_at).getTime()) /
      1000,
    " seconds"
  );
  console.log(
    "\x1b[34m%s\x1b[0m",
    "proof   generation duration:",
    (new Date(registerData.proof_generated_at).getTime() -
      new Date(registerData.witness_generated_at).getTime()) /
      1000,
    " seconds"
  );
  return passportData;
}

// API testing utilities
export async function callAPI(
  url: string,
  requestBody: any
): Promise<APIResponse> {
  try {
    const response = await fetch(`${url}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await response.text();
    let parsedData;
    try {
      parsedData = JSON.parse(data);
    } catch {
      parsedData = { rawResponse: data };
    }
    return {
      status: response.status,
      data: parsedData,
      success: true,
    };
  } catch (error: any) {
    return { status: 0, data: { error: error.message }, success: false };
  }
}

export function compareAPIs(
  tsResponse: APIResponse,
  goResponse: APIResponse,
  expectedStatus: number = 200,
  expectedKeywords: string[] = []
): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!tsResponse.success)
    issues.push(`TS API unreachable: ${tsResponse.data.error}`);
  if (!goResponse.success)
    issues.push(`Go API unreachable: ${goResponse.data.error}`);
  if (issues.length) return { passed: false, issues };

  if (tsResponse.status !== goResponse.status) {
    issues.push(
      `Status mismatch: TS=${tsResponse.status}, Go=${goResponse.status}`
    );
  }
  if (tsResponse.status !== expectedStatus) {
    issues.push(
      `Expected status ${expectedStatus}, got TS=${tsResponse.status}, Go=${goResponse.status}`
    );
  }

  const tsResult = tsResponse.data?.result;
  const goResult = goResponse.data?.result;
  if (
    tsResult !== undefined &&
    goResult !== undefined &&
    tsResult !== goResult
  ) {
    issues.push(`Result mismatch: TS=${tsResult}, Go=${goResult}`);
  }

  if (expectedKeywords.length > 0 && expectedStatus >= 400) {
    const tsMessage = tsResponse.data?.message || tsResponse.data?.error || "";
    const goMessage = goResponse.data?.message || goResponse.data?.error || "";

    for (const keyword of expectedKeywords) {
      const tsHasKeyword = tsMessage
        .toLowerCase()
        .includes(keyword.toLowerCase());
      const goHasKeyword = goMessage
        .toLowerCase()
        .includes(keyword.toLowerCase());

      if (!tsHasKeyword) {
        issues.push(
          `TS error message missing keyword "${keyword}": "${tsMessage}"`
        );
      }
      if (!goHasKeyword) {
        issues.push(
          `Go error message missing keyword "${keyword}": "${goMessage}"`
        );
      }
    }
  }

  return { passed: issues.length === 0, issues };
}

// Test data setup and management
let globalProofData: ProofData | null = null;
let globalPassportData: PassportData | null = null;

export async function setupTestData(
  attestationId: string,
): Promise<void> {
  const secret = "1234";
  const scope = hashEndpointWithScope(
    "http://localhost:3000",
    "self-playground"
  );

  globalPassportData = await registerMockPassportOrEUid(secret, attestationId == "1");

  console.log("Waiting for identity tree to sync...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  const rawProofData = await runGenerateVcAndDiscloseRawProof(
    secret,
    attestationId,
    globalPassportData,
    scope,
    "hello from the playground",
    {
      selectorOfac: "0",
    }
  );

  globalProofData = {
    proof: {
      a: rawProofData.proof.pi_a.slice(0, 2),
      b: rawProofData.proof.pi_b.map((b) => b.slice(0, 2)),
      c: rawProofData.proof.pi_c.slice(0, 2),
    },
    publicSignals: rawProofData.publicSignals,
  };
}

export async function setupTestDataAadhaar() {
  const timestamp = Date.now().toString();
  console.log("timestamp", timestamp);
  const qrdata = generateTestData({
    privKeyPem: privateKeyPem,
    data: testCustomData,
    timestamp
  });

  const inputs = await prepareAadhaarRegisterData(
    qrdata.testQRData,
    "1234",
    [publicKeyPem]
  );

    console.log("INputs generated");

  const registerUuid = await handshakeAndGetUuid(
    REGISTER_URL,
    inputs,
    "register_aadhaar",
    "register_aadhaar"
  );
  console.log("Register UUID:", registerUuid);

  const registerData = await getProofGeneratedUpdate(registerUuid);
  console.log(
    " Got register proof generated update:",
    registerData ? "SUCCESS" : "FAILED"
  );
  console.log("\x1b[34m%s\x1b[0m", "register uuid:", registerUuid);
  console.log("\x1b[34m%s\x1b[0m", "circuit:", "register_aadhaar");
  console.log(
    "\x1b[34m%s\x1b[0m",
    "witness generation duration:",
    (new Date(registerData.witness_generated_at).getTime() -
      new Date(registerData.created_at).getTime()) /
      1000,
    " seconds"
  );
  console.log(
    "\x1b[34m%s\x1b[0m",
    "proof   generation duration:",
    (new Date(registerData.proof_generated_at).getTime() -
      new Date(registerData.witness_generated_at).getTime()) /
      1000,
    " seconds"
  );
  console.log("Waiting for identity tree to sync...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  const scope = hashEndpointWithScope(
    "http://localhost:3000",
    "self-playground"
  );
  const userContextData = "hello from the playground";
  const userIdentifier= calculateUserIdentifierHash(42220, "94ba0DB8A9Db66979905784A9d6B2D286e55Bd27", userContextData);


  const merkleTree: any = new LeanIMT<bigint>((a, b) => poseidon2([a, b]), []);
  const identityTreeHeader = await fetch(
    "http://tree.staging.self.xyz/identity-aadhaar"
  );
  const identityTree = JSON.parse((await identityTreeHeader.json() as any).data).map(
    (x: string[]) => x.map((y: string) => BigInt(y))
  );
  merkleTree.insertMany(identityTree[0]);

  const discloseInputs = prepareAadhaarDiscloseData(
    qrdata.testQRData,
    merkleTree,
    nameAndDob_smt,
    nameAndYob_smt,
    scope,
    '1234',
    userIdentifier.toString(),
    {
      forbiddenCountriesListPacked: ['PAK', 'IRN']
    }
  );

  const __filenameHelper = fileURLToPath(import.meta.url);
  const __dirnameHelper = path.dirname(__filenameHelper);

  const wasmPath = path.resolve(__dirnameHelper, "ts-api/utils/assests/vc_and_disclose_aadhaar.wasm");
  const zkeyPath = path.resolve(__dirnameHelper, "ts-api/utils/assests/vc_and_disclose_aadhaar.zkey");
  const vKey = JSON.parse(fs.readFileSync(path.resolve(__dirnameHelper, "ts-api/utils/assests/verification_key_aadhaar.json"), "utf8"));

  const discloseProof = await groth16.fullProve(
    discloseInputs,
    wasmPath,
    zkeyPath
  );

  const isValid = await groth16.verify(vKey, discloseProof.publicSignals, discloseProof.proof);
  if (!isValid) {
    throw new Error("Generated disclose proof verification failed");
  }

  globalProofData = {
    proof: {
      a: discloseProof.proof.pi_a.slice(0, 2),
      b: discloseProof.proof.pi_b.map((b) => b.slice(0, 2)),
      c: discloseProof.proof.pi_c.slice(0, 2),
    },
    publicSignals: discloseProof.publicSignals,
  };

}
export function getProof() {
  if (!globalProofData) {
    throw new Error("Test data not initialized. Call setupTestData() first.");
  }
  const proof = globalProofData.proof;
  const publicSignals = globalProofData.publicSignals;

  return { proof, publicSignals };
}

// Format: destChainId(32 bytes) + userIdentifier(32 bytes) + userDefinedData
// userDefinedData: "hello from the playground" = 68656c6c6f2066726f6d2074686520706c617967726f756e64
export function getUserContextData() {
  return "000000000000000000000000000000000000000000000000000000000000a4ec00000000000000000000000094ba0db8a9db66979905784a9d6b2d286e55bd2768656c6c6f2066726f6d2074686520706c617967726f756e64";
}

export function getInvalidUserContextData() {
  return "000000000000000000000000000000000000000000000000000000000000a4ec00000000000000000000000094ba0db8a9db66979905784a9d6b2d286e55bd2868656c6c6f2066726f6d2074686520706c617967726f756e64";
}

export function getGlobalPassportData() {
  if (!globalPassportData) {
    throw new Error("Test data not initialized. Call setupTestData() first.");
  }
  return globalPassportData;
}

export { registerMockPassportOrEUid };
