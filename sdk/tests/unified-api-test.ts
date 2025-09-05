#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import { hashEndpointWithScope } from "@selfxyz/common/utils/scope";
import { registerMockPassport, discloseProof } from './utils.ts';
import { PassportData } from "@selfxyz/common";
import { PublicSignals } from "snarkjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TS_API_URL = "http://localhost:3000";
const GO_API_URL = "http://localhost:8080";
const VERIFY_ENDPOINT = "/api/verify";

// Types for test data
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

interface TestCase {
    name: string;
    body: any;
    expectedStatus: number;
    expectedKeywords: string[];
}

// Global test data
let globalProofData: ProofData | null = null;
let globalPassportData: PassportData | null = null;

// Simple API call function
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

// Compare two API responses
function compareAPIs(testName: string, tsResponse: APIResponse, goResponse: APIResponse, expectedStatus: number = 200, expectedKeywords: string[] = []): { passed: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check connectivity
    if (!tsResponse.success) issues.push(`TS API unreachable: ${tsResponse.data.error}`);
    if (!goResponse.success) issues.push(`Go API unreachable: ${goResponse.data.error}`);
    if (issues.length) return { passed: false, issues };

    // Compare status codes
    if (tsResponse.status !== goResponse.status) {
        issues.push(`Status mismatch: TS=${tsResponse.status}, Go=${goResponse.status}`);
    }
    if (tsResponse.status !== expectedStatus) {
        issues.push(`Expected status ${expectedStatus}, got TS=${tsResponse.status}, Go=${goResponse.status}`);
    }

    // Compare results
    const tsResult = tsResponse.data?.result;
    const goResult = goResponse.data?.result;
    if (tsResult !== undefined && goResult !== undefined && tsResult !== goResult) {
        issues.push(`Result mismatch: TS=${tsResult}, Go=${goResult}`);
    }

    // Check error message keywords (for error cases)
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


// Setup function to register passport and generate proof
async function setupTestData() {
    console.log('🔧 Setting up test data...');

    const secret = "1234";
    const attestationId = "1";
    const scope = hashEndpointWithScope("http://localhost:3000", "self-playground");

    // Register mock passport and get passport data
    console.log('📋 Registering mock passport...');
    globalPassportData = await registerMockPassport(secret);

    // Generate disclose proof using the same passport data
    console.log('🔑 Generating disclose proof...');
    const rawProofData = await discloseProof(secret, attestationId, globalPassportData, scope);

    // Convert proof format from pi_a/pi_b/pi_c to a/b/c
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

function createTestCases(): TestCase[] {
    if (!globalProofData) {
        throw new Error('Test data not initialized. Call setupTestData() first.');
    }

    const proof = globalProofData.proof;
    const publicSignals = globalProofData.publicSignals;

    const validUserContext = "000000000000000000000000000000000000000000000000000000000000a4ec00000000000000000000000094ba0db8a9db66979905784a9d6b2d286e55bd27";
    const invalidUserContext = "000000000000000000000000000000000000000000000000000000000000a4ec00000000000000000000000094ba0db8a9db66979905784a9d6b2d286e55bd28";

    return [
        {
            name: 'Valid Proof Verification',
            body: { attestationId: 1, proof: proof, publicSignals: publicSignals, userContextData: validUserContext },
            expectedStatus: 200,
            expectedKeywords: []
        },
        {
            name: 'Invalid User Context',
            body: { attestationId: 1, proof: proof, publicSignals: publicSignals, userContextData: invalidUserContext },
            expectedStatus: 500,
            expectedKeywords: ['context hash']
        },
        {
            name: 'Invalid Scope',
            body: {
                attestationId: 1,
                proof: proof,
                publicSignals: publicSignals.map((sig, i) => i === 19 ? "17121382998761176299335602807450250650083579600718579431641003529012841023067" : sig),
                userContextData: validUserContext
            },
            expectedStatus: 500,
            expectedKeywords: ['Scope']
        },
        {
            name: 'Invalid Merkle Root',
            body: {
                attestationId: 1,
                proof: proof,
                publicSignals: publicSignals.map((sig, i) => i === 9 ? "9656656992379025128519272376477139373854042233370909906627112932049610896732" : sig),
                userContextData: validUserContext
            },
            expectedStatus: 500,
            expectedKeywords: ['Onchain root']
        },
        {
            name: 'Attestation ID Mismatch',
            body: {
                attestationId: 2,
                proof: proof,
                publicSignals: publicSignals,
                userContextData: validUserContext
            },
            expectedStatus: 500,
            expectedKeywords: ['Attestation ID', 'does not match']
        }
    ];
}

// Run a single test
async function runTest(testName: string, requestBody: any, expectedStatus: number = 200, expectedKeywords: string[] = []): Promise<boolean> {
    console.log(`\n ${testName}`);

    const [tsResponse, goResponse] = await Promise.all([
        callAPI(TS_API_URL, requestBody),
        callAPI(GO_API_URL, requestBody)
    ]);

    const result = compareAPIs(testName, tsResponse, goResponse, expectedStatus, expectedKeywords);

    if (result.passed) {
        console.log(` PASS`);
    } else {
        console.log(` FAIL:`);
        result.issues.forEach(issue => console.log(`   - ${issue}`));
    }

    return result.passed;
}

// Main execution
async function main() {
    console.log('Self SDK API Comparison Test\n');

    await setupTestData();
    const testCases = createTestCases();
    let passed = 0, failed = 0;

    for (const testCase of testCases) {
        const success = await runTest(testCase.name, testCase.body, testCase.expectedStatus, testCase.expectedKeywords);
        success ? passed++ : failed++;
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    console.log(failed === 0 ? 'All tests passed!' : 'Some tests failed');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch((error: any) => {
    console.error(` error: ${error}`);
    process.exit(1);
});
