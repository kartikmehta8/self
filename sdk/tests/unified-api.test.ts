import { expect } from 'chai';
import { describe } from 'mocha';
import { callAPI, compareAPIs, setupTestData, getTestData, getGlobalPassportData, getUserContextData, getInvalidUserContextData } from './utils.ts';
import { getRevealedDataBytes } from '../core/src/utils/proof.js';
import { packBytes } from '../../common/src/utils/bytes.js';
import { runGenerateVcAndDiscloseRawProof } from './ts-api/utils/helper.ts';
import { hashEndpointWithScope } from '@selfxyz/common';


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

    const validUserContext = getUserContextData();
    const invalidUserContext = getInvalidUserContextData();
    before(async () => {
        await setupTestData();
    });

    describe('API Verification Tests', function () {
        it('should verify valid proof successfully', async function () {
            const { proof, publicSignals } = getTestData();
            const body = {
                attestationId: 1,
                proof: proof,
                publicSignals: publicSignals,
                userContextData: validUserContext
            };
            await runTest(body, 200, []);
        });

        it('should reject invalid user context', async function () {
            const { proof, publicSignals } = getTestData();
            const body = {
                attestationId: 1,
                proof: proof,
                publicSignals: publicSignals,
                userContextData: invalidUserContext
            };
            await runTest(body, 500, ['context hash does not match', 'circuit']);
        });

        it('should reject invalid scope', async function () {
            const { proof, publicSignals } = getTestData();
            const body = {
                attestationId: 1,
                proof: proof,
                publicSignals: publicSignals.map((sig, i) => i === 19 ? "17121382998761176299335602807450250650083579600718579431641003529012841023067" : sig),
                userContextData: validUserContext
            };
            await runTest(body, 500, ['Scope']);
        });

        it('should reject invalid merkle root', async function () {
            const { proof, publicSignals } = getTestData();
            const body = {
                attestationId: 1,
                proof: proof,
                publicSignals: publicSignals.map((sig, i) => i === 9 ? "9656656992379025128519272376477139373854042233370909906627112932049610896732" : sig),
                userContextData: validUserContext
            };
            await runTest(body, 500, ['Onchain root']);
        });

        it('should reject attestation ID mismatch', async function () {
            const { proof, publicSignals } = getTestData();
            const body = {
                attestationId: 2,
                proof: proof,
                publicSignals: publicSignals,
                userContextData: validUserContext
            };
            await runTest(body, 500, ['Attestation ID', 'does not match', 'circuit']);
        });

        it('should reject forbidden countries list mismatch', async function () {
            const { proof, publicSignals } = getTestData();
            // For attestation ID 1 (Passport), forbidden countries list packed indices are 3-6
            // We modify the forbidden countries list to include UAE and AUS instead of PAK and IRN
            // UAE, AUS packed value: '91625632383317' (calculated using packForbiddenCountriesList(['UAE', 'AUS']))
            const modifiedPublicSignals = publicSignals.map((sig, i) => {
                if (i === 3) return "91625632383317";
                return sig;
            });

            const body = {
                attestationId: 1, // Using passport attestation ID
                proof: proof,
                publicSignals: modifiedPublicSignals,
                userContextData: validUserContext
            };

            await runTest(body, 500, ['Forbidden countries', 'does not match', 'circuit']);
        });

        it('should reject minimum age mismatch', async function () {
            const { proof, publicSignals } = getTestData();

            // Get the current revealed data bytes
            const currentBytes = getRevealedDataBytes(1, publicSignals); // attestationId = 1

            // Modify the minimum age bytes (positions 88-89)
            // Config expects age 18, we'll change it to age 25 to create mismatch
            // Age 25 in ASCII: "2" = 50, "5" = 53
            const modifiedBytes = [...currentBytes];
            modifiedBytes[88] = 50; // "2"
            modifiedBytes[89] = 53; // "5"

            const packedData = packBytes(modifiedBytes);

            // Replace the revealed data packed signals (indices 0-2) with modified ones
            const modifiedPublicSignals = [
                ...packedData.map(p => p.toString()),
                ...publicSignals.slice(3)
            ];

            const body = {
                attestationId: 1,
                proof: proof,
                publicSignals: modifiedPublicSignals,
                userContextData: validUserContext
            };

            await runTest(body, 500, ['Minimum age', 'does not match', 'circuit', '25']);
        });

        it('should reject OFAC mismatch', async function () {
            const scope = hashEndpointWithScope("http://localhost:3000", "self-playground");
            const rawProofData = await runGenerateVcAndDiscloseRawProof("1234", "1", getGlobalPassportData(), scope, "hello from the playground", {
                selectorOfac: "1"
            });
            const body = {
                attestationId: 1,
                proof: rawProofData.proof,
                publicSignals: rawProofData.publicSignals,
                userContextData: validUserContext
            };
            await runTest(body, 500, ['OFAC check is not allowed', 'Passport number', 'Name and DOB', 'Name and YOB']);
        });

        it('should reject ConfigID not found', async function () {
            const { proof, publicSignals } = getTestData();
            let userContextData = validUserContext;
            userContextData = userContextData.slice(0, -1) + "7";
            const body = {
                attestationId: 1,
                proof: proof,
                publicSignals: publicSignals,
                userContextData: userContextData
            };
            await runTest(body, 500, ['Config Id not found']);
        });
        it('should reject Config not found', async function () {
            const { proof, publicSignals } = getTestData();
            let userContextData = validUserContext;
            userContextData = userContextData.slice(0, -1) + "5";
            const body = {
                attestationId: 1,
                proof: proof,
                publicSignals: publicSignals,
                userContextData: userContextData
            };
            await runTest(body, 500, ['Config not found']);
        });

        it('should reject future timestamp', async function () {
            const { proof, publicSignals } = getTestData();

            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 3);

            const year = futureDate.getFullYear().toString();
            const month = (futureDate.getMonth() + 1).toString().padStart(2, '0');
            const day = futureDate.getDate().toString().padStart(2, '0');

            const yy = year.slice(-2);
            const mm = month;
            const dd = day;

            const modifiedPublicSignals = publicSignals.map((signal, index) => {
                switch (index) {
                    case 10: return yy[0];
                    case 11: return yy[1];
                    case 12: return mm[0];
                    case 13: return mm[1];
                    case 14: return dd[0];
                    case 15: return dd[1];
                    default: return signal;
                }
            });

            const body = {
                attestationId: 1,
                proof: proof,
                publicSignals: modifiedPublicSignals,
                userContextData: validUserContext
            };

            await runTest(body, 500, ['Circuit timestamp is in the future']);
        });

        it('should reject old timestamp', async function () {
            const { proof, publicSignals } = getTestData();

            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 3);

            const year = pastDate.getFullYear().toString();
            const month = (pastDate.getMonth() + 1).toString().padStart(2, '0');
            const day = pastDate.getDate().toString().padStart(2, '0');

            const yy = year.slice(-2);
            const mm = month;
            const dd = day;

            const modifiedPublicSignals = publicSignals.map((signal, index) => {
                switch (index) {
                    case 10: return yy[0];
                    case 11: return yy[1];
                    case 12: return mm[0];
                    case 13: return mm[1];
                    case 14: return dd[0];
                    case 15: return dd[1];
                    default: return signal;
                }
            });

            const body = {
                attestationId: 1,
                proof: proof,
                publicSignals: modifiedPublicSignals,
                userContextData: validUserContext
            };

            await runTest(body, 500, ['Circuit timestamp is too old']);
        });



    });
});
