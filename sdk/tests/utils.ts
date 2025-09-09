import { genAndInitMockPassportData, generateCircuitInputsRegister, getCircuitNameFromPassportData, PassportData } from "@selfxyz/common";
import { getProofGeneratedUpdate, handshakeAndGetUuid, runGenerateVcAndDiscloseRawProof } from "./ts-api/utils/helper.ts";
import { REGISTER_URL } from "./ts-api/utils/constant.ts";
import { hashEndpointWithScope } from "@selfxyz/common/utils/scope";
import { PublicSignals } from "snarkjs";
import axios from "axios";

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

async function registerMockPassport(secret: string): Promise<PassportData> {

  const passportData = genAndInitMockPassportData(
    "sha1",
    "sha1",
    "rsa_sha1_65537_4096",
    "FRA",
    "000101",
    "300101",
  );

  const dscTree = await axios.get("http://tree.staging.self.xyz/dsc");
  const serialized_dsc_tree = dscTree.data;

  //Register proof generation
  const registerInputs = generateCircuitInputsRegister(
    secret,
    passportData,
    serialized_dsc_tree.data
  );

  const registerCircuitName = getCircuitNameFromPassportData(
    passportData,
    "register"
  );

  //keyLength === 384 ? REGISTER_MEDIUM_URL : REGISTER_URL,
  const registerUuid = await handshakeAndGetUuid(
    REGISTER_URL,
    registerInputs,
    "register",
    registerCircuitName
  );

  const registerData = await getProofGeneratedUpdate(registerUuid);
  console.log(" Got register proof generated update:", registerData ? "SUCCESS" : "FAILED");
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


async function discloseProof(secret: string, attestationId: string, passportData: PassportData, scope: string) {
    const userDefinedData = "hello from the playground";

    return await runGenerateVcAndDiscloseRawProof(
        secret,
        attestationId,
        passportData,
        scope,
        userDefinedData,
    );
}

// API testing utilities
export async function callAPI(url: string, requestBody: any): Promise<APIResponse> {
    try {
        const response = await fetch(`${url}/api/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
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
            success: true
        };
    } catch (error: any) {
        return { status: 0, data: { error: error.message }, success: false };
    }
}

export function compareAPIs(tsResponse: APIResponse, goResponse: APIResponse, expectedStatus: number = 200, expectedKeywords: string[] = []): { passed: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!tsResponse.success) issues.push(`TS API unreachable: ${tsResponse.data.error}`);
    if (!goResponse.success) issues.push(`Go API unreachable: ${goResponse.data.error}`);
    if (issues.length) return { passed: false, issues };

    if (tsResponse.status !== goResponse.status) {
        issues.push(`Status mismatch: TS=${tsResponse.status}, Go=${goResponse.status}`);
    }
    if (tsResponse.status !== expectedStatus) {
        issues.push(`Expected status ${expectedStatus}, got TS=${tsResponse.status}, Go=${goResponse.status}`);
    }

    const tsResult = tsResponse.data?.result;
    const goResult = goResponse.data?.result;
    if (tsResult !== undefined && goResult !== undefined && tsResult !== goResult) {
        issues.push(`Result mismatch: TS=${tsResult}, Go=${goResult}`);
    }

    if (expectedKeywords.length > 0 && expectedStatus >= 400) {
        const tsMessage = tsResponse.data?.message || tsResponse.data?.error || '';
        const goMessage = goResponse.data?.message || goResponse.data?.error || '';

        for (const keyword of expectedKeywords) {
            const tsHasKeyword = tsMessage.toLowerCase().includes(keyword.toLowerCase());
            const goHasKeyword = goMessage.toLowerCase().includes(keyword.toLowerCase());

            if (!tsHasKeyword) {
                issues.push(`TS error message missing keyword "${keyword}": "${tsMessage}"`);
            }
            if (!goHasKeyword) {
                issues.push(`Go error message missing keyword "${keyword}": "${goMessage}"`);
            }
        }
    }

    return { passed: issues.length === 0, issues };
}

// Test data setup and management
let globalProofData: ProofData | null = null;
let globalPassportData: PassportData | null = null;

export async function setupTestData(): Promise<void> {
    const secret = "1234";
    const attestationId = "1";
    const scope = hashEndpointWithScope("http://localhost:3000", "self-playground");

    globalPassportData = await registerMockPassport(secret);
    const rawProofData = await discloseProof(secret, attestationId, globalPassportData, scope);

    globalProofData = {
        proof: {
            a: rawProofData.proof.pi_a.slice(0, 2),
            b: rawProofData.proof.pi_b.map(b => b.slice(0, 2)),
            c: rawProofData.proof.pi_c.slice(0, 2),
        },
        publicSignals: rawProofData.publicSignals
    };

}

export function getTestData() {
    if (!globalProofData) {
        throw new Error('Test data not initialized. Call setupTestData() first.');
    }

    const proof = globalProofData.proof;
    const publicSignals = globalProofData.publicSignals;
    // Format: destChainId(32 bytes) + userIdentifier(32 bytes) + userDefinedData
    // userDefinedData: "hello from the playground" = 68656c6c6f2066726f6d2074686520706c617967726f756e64
    const validUserContext = "000000000000000000000000000000000000000000000000000000000000a4ec00000000000000000000000094ba0db8a9db66979905784a9d6b2d286e55bd2768656c6c6f2066726f6d2074686520706c617967726f756e64";
    const invalidUserContext = "000000000000000000000000000000000000000000000000000000000000a4ec00000000000000000000000094ba0db8a9db66979905784a9d6b2d286e55bd2868656c6c6f2066726f6d2074686520706c617967726f756e64";

    return { proof, publicSignals, validUserContext, invalidUserContext };
}

export { registerMockPassport, discloseProof };
