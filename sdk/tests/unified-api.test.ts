import { expect } from 'chai';
import { describe } from 'mocha';
import { callAPI, compareAPIs, setupTestData, getTestData } from './utils.ts';

const TS_API_URL = "http://localhost:3000";
const GO_API_URL = "http://localhost:8080";

async function runTest(requestBody: any, expectedStatus: number = 200, expectedKeywords: string[] = []): Promise<void> {
    const [tsResponse, goResponse] = await Promise.all([
        callAPI(TS_API_URL, requestBody),
        callAPI(GO_API_URL, requestBody)
    ]);

    const result = compareAPIs(tsResponse, goResponse, expectedStatus, expectedKeywords);

    if (!result.passed) {
        expect.fail(`Test failed: ${result.issues.join('; ')}`);
    }
}


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
            await runTest(body, 500, ['context hash does not match', 'circuit']);
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
            await runTest(body, 500, ['Attestation ID', 'does not match', 'circuit']);
        });
    });
});
