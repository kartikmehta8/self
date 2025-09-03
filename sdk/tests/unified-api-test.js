#!/usr/bin/env node

// Simplified API comparison test for TypeScript vs Go APIs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TS_API_URL = "http://localhost:3000";
const GO_API_URL = "http://localhost:8080";
const VERIFY_ENDPOINT = "/api/verify";

// Simple API call function
async function callAPI(url, requestBody) {
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
    } catch (error) {
        return { status: 0, data: { error: error.message }, success: false };
    }
}

// Compare two API responses
function compareAPIs(testName, tsResponse, goResponse, expectedStatus = 200) {
    const issues = [];

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

    return { passed: issues.length === 0, issues };
}

// Run a single test
async function runTest(testName, requestBody, expectedStatus = 200) {
    console.log(`\n🧪 ${testName}`);

    const [tsResponse, goResponse] = await Promise.all([
        callAPI(TS_API_URL, requestBody),
        callAPI(GO_API_URL, requestBody)
    ]);

    const result = compareAPIs(testName, tsResponse, goResponse, expectedStatus);

    if (result.passed) {
        console.log(`✅ PASS`);
    } else {
        console.log(`❌ FAIL:`);
        result.issues.forEach(issue => console.log(`   - ${issue}`));
    }

    return result.passed;
}

// Load test data and create test cases
function loadTestData() {
    try {
        const proofDataPath = path.join(__dirname, 'ts-api', 'vc_and_disclose_proof.json');
        return JSON.parse(fs.readFileSync(proofDataPath, 'utf8'));
    } catch (error) {
        console.error(`❌ Error loading test data: ${error.message}`);
        process.exit(1);
    }
}

function createTestCases() {
    const proofData = loadTestData();
    const validUserContext = "000000000000000000000000000000000000000000000000000000000000a4ec00000000000000000000000094ba0db8a9db66979905784a9d6b2d286e55bd27";
    const invalidUserContext = "000000000000000000000000000000000000000000000000000000000000a4ec00000000000000000000000094ba0db8a9db66979905784a9d6b2d286e55bd28";

    return [
        {
            name: 'Valid Proof Verification',
            body: { attestationId: 1, proof: proofData.proof, publicSignals: proofData.publicSignals, userContextData: validUserContext },
            expectedStatus: 200
        },
        {
            name: 'Invalid User Context',
            body: { attestationId: 1, proof: proofData.proof, publicSignals: proofData.publicSignals, userContextData: invalidUserContext },
            expectedStatus: 500
        },
        {
            name: 'Invalid Scope',
            body: {
                attestationId: 1,
                proof: proofData.proof,
                publicSignals: proofData.publicSignals.map((sig, i) => i === 19 ? "17121382998761176299335602807450250650083579600718579431641003529012841023067" : sig),
                userContextData: validUserContext
            },
            expectedStatus: 500
        }
    ];
}

// Main execution
async function main() {
    console.log(' Self SDK API Comparison Test\n');

    const testCases = createTestCases();
    let passed = 0, failed = 0;

    for (const testCase of testCases) {
        const success = await runTest(testCase.name, testCase.body, testCase.expectedStatus);
        success ? passed++ : failed++;
    }

    console.log(`\n Results: ${passed} passed, ${failed} failed`);
    console.log(failed === 0 ? '🎉 All tests passed!' : ' Some tests failed');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
    console.error(` error: ${error}`);
    process.exit(1);
});
