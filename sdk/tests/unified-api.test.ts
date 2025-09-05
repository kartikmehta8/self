import { expect } from 'chai';
import { describe } from 'mocha';
import { hashEndpointWithScope } from "@selfxyz/common/utils/scope";
import { registerMockPassport, discloseProof } from './utils.ts';
import { PassportData } from "@selfxyz/common";
import { PublicSignals } from "snarkjs";


const TS_API_URL = "http://localhost:3000";
const GO_API_URL = "http://localhost:8080";
const VERIFY_ENDPOINT = "/api/verify";

interface ProofData {
    proof: {
        a: string[];
        b: string[][];
        c: string[];
    };
    publicSignals: PublicSignals;
}

interface APIResponse {
    status: number;
    data: any;
    success: boolean;
}


let globalProofData: ProofData | null = null;
let globalPassportData: PassportData | null = null;

async function callAPI(url: string, requestBody: any): Promise<APIResponse> {
    try {
        const response = await fetch(`${url}${VERIFY_ENDPOINT}`, {
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

function compareAPIs(testName: string, tsResponse: APIResponse, goResponse: APIResponse, expectedStatus: number = 200, expectedKeywords: string[] = []): { passed: boolean; issues: string[] } {
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


async function setupTestData() {

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

    console.log(' Test data setup complete');
}

// Test data getters
function getTestData() {
    if (!globalProofData) {
        throw new Error('Test data not initialized. Call setupTestData() first.');
    }

    const proof = globalProofData.proof;
    const publicSignals = globalProofData.publicSignals;
    const validUserContext = "000000000000000000000000000000000000000000000000000000000000a4ec00000000000000000000000094ba0db8a9db66979905784a9d6b2d286e55bd27";
    const invalidUserContext = "000000000000000000000000000000000000000000000000000000000000a4ec00000000000000000000000094ba0db8a9db66979905784a9d6b2d286e55bd28";

    return { proof, publicSignals, validUserContext, invalidUserContext };
}

// Run a single test (for use in it() blocks)
async function runTest(requestBody: any, expectedStatus: number = 200, expectedKeywords: string[] = []): Promise<void> {
    const [tsResponse, goResponse] = await Promise.all([
        callAPI(TS_API_URL, requestBody),
        callAPI(GO_API_URL, requestBody)
    ]);

    const result = compareAPIs('', tsResponse, goResponse, expectedStatus, expectedKeywords);

    if (!result.passed) {
        expect.fail(`Test failed: ${result.issues.join('; ')}`);
    }
}

// Mocha style test suite
describe('Self SDK API Comparison Tests', function () {
    this.timeout(0);

    before(async () => {
        await setupTestData();
    });

    describe('API Verification Tests', function () {
        it('should verify valid proof successfully', async function () {
            const { proof, publicSignals, validUserContext } = getTestData();
            const body = {
                attestationId: 1,
                proof: proof,
                publicSignals: publicSignals,
                userContextData: validUserContext
            };
            await runTest(body, 200, []);
        });

        it('should reject invalid user context', async function () {
            const { proof, publicSignals, invalidUserContext } = getTestData();
            const body = {
                attestationId: 1,
                proof: proof,
                publicSignals: publicSignals,
                userContextData: invalidUserContext
            };
            await runTest(body, 500, ['context hash']);
        });

        it('should reject invalid scope', async function () {
            const { proof, publicSignals, validUserContext } = getTestData();
            const body = {
                attestationId: 1,
                proof: proof,
                publicSignals: publicSignals.map((sig, i) => i === 19 ? "17121382998761176299335602807450250650083579600718579431641003529012841023067" : sig),
                userContextData: validUserContext
            };
            await runTest(body, 500, ['Scope']);
        });

        it('should reject invalid merkle root', async function () {
            const { proof, publicSignals, validUserContext } = getTestData();
            const body = {
                attestationId: 1,
                proof: proof,
                publicSignals: publicSignals.map((sig, i) => i === 9 ? "9656656992379025128519272376477139373854042233370909906627112932049610896732" : sig),
                userContextData: validUserContext
            };
            await runTest(body, 500, ['Onchain root']);
        });

        it('should reject attestation ID mismatch', async function () {
            const { proof, publicSignals, validUserContext } = getTestData();
            const body = {
                attestationId: 2,
                proof: proof,
                publicSignals: publicSignals,
                userContextData: validUserContext
            };
            await runTest(body, 500, ['Attestation ID', 'does not match']);
        });
    });
});
