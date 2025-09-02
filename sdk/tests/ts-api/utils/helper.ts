import { v4 } from "uuid";
// @ts-ignore
import WebSocket from "ws";
import elliptic from "elliptic";
import crypto from "crypto";
import cbor from "cbor";
import { aws_root_cert_pem } from "./assests/aws_root_pem.js";
import { Certificate } from "@fidm/x509";
import cose from "cose-js";
// @ts-ignore
import asn1 from "asn1.js";
import { io } from "socket.io-client";
import { WSS_URL } from "./constant.js";
import { PassportData } from "@selfxyz/common/types/passport";
import { LeanIMT } from "@openpassport/zk-kit-lean-imt";
import { SMT } from "@openpassport/zk-kit-smt";
import { CircuitSignals, groth16, Groth16Proof, PublicSignals } from "snarkjs";
import { generateCircuitInputsVCandDisclose } from "@selfxyz/common/utils/circuits/generateInputs";
import * as fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { poseidon2, poseidon3 } from "poseidon-lite";
import { ChildNodes } from "@openpassport/zk-kit-smt";
import { generateCommitment } from "@selfxyz/common/utils/passports/passport";
// @ts-ignore
import passportNojson from "@selfxyz/circuits/tests/consts/ofac/passportNoAndNationalitySMT.json";
// @ts-ignore
import nameAndDobjson from "@selfxyz/circuits/tests/consts/ofac/nameAndDobSMT.json";
// @ts-ignore
import nameAndYobjson from "@selfxyz/circuits/tests/consts/ofac/nameAndYobSMT.json";
import { calculateUserIdentifierHash } from "@selfxyz/common";

const { ec: EC } = elliptic;
const ec = new EC("p256");

const key1 = ec.genKeyPair();


export async function generateVcAndDiscloseRawProof(
  secret: string,
  attestationId: string,
  passportData: PassportData,
  scope: string,
  selectorDg1: string[] = new Array(88).fill("1"),
  selectorOlderThan: string | number = "1",
  merkletree: LeanIMT<bigint>,
  majority: string = "18",
  passportNo_smt: SMT,
  nameAndDob_smt: SMT,
  nameAndYob_smt: SMT,
  selectorOfac: string | number = "1",
  forbiddenCountriesList: string[] = ['PAK', 'IRN'],
  userIdentifier: string = "0000000000000000000000000000000000000000",
): Promise<{
  proof: Groth16Proof;
  publicSignals: PublicSignals;
}> {

  // Ensure selector length matches circuit expectation (selector_dg1[88])
  if (selectorDg1.length !== 88) {
    selectorDg1 = selectorDg1.slice(0, 88);
    if (selectorDg1.length < 88) {
      selectorDg1 = selectorDg1.concat(new Array(88 - selectorDg1.length).fill("0"));
    }
  }

  const vcAndDiscloseCircuitInputs: CircuitSignals = generateCircuitInputsVCandDisclose(
    secret,
    attestationId,
    passportData,
    scope,
    selectorDg1,
    selectorOlderThan,
    merkletree,
    majority,
    passportNo_smt,
    nameAndDob_smt,
    nameAndYob_smt,
    selectorOfac,
    forbiddenCountriesList,
    userIdentifier,
  );

  const __filenameHelper = fileURLToPath(import.meta.url);
  const __dirnameHelper = path.dirname(__filenameHelper);
  const wasmPath = path.resolve(__dirnameHelper, "assests/vc_and_disclose.wasm");
  const zkeyPath = path.resolve(__dirnameHelper, "assests/vc_and_disclose_00008.zkey");

  console.log("wasmPath", wasmPath);
  console.log("zkeyPath", zkeyPath);

  const vcAndDiscloseProof = await groth16.fullProve(
    vcAndDiscloseCircuitInputs,
    wasmPath,
    zkeyPath,
  );

  const vKey = JSON.parse(fs.readFileSync(path.resolve(__dirnameHelper, "assests/verification_key.json"), "utf8"));
  const isValid = await groth16.verify(vKey, vcAndDiscloseProof.publicSignals, vcAndDiscloseProof.proof);
  if (!isValid) {
    throw new Error("Generated register proof verification failed");
  }
  console.log("PROOF VERIFIED");


  fs.writeFileSync(
    `vc_and_disclose_proof.json`,
    JSON.stringify(vcAndDiscloseProof, null, 2)
  );

  return vcAndDiscloseProof;
}


function encryptAES256GCM(plaintext: string, key: Buffer<ArrayBuffer>) {
  const iv = crypto.randomBytes(12); // GCM standard uses a 12-byte IV

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    nonce: Array.from(Buffer.from(iv.toString("hex"), "hex")),
    cipher_text: Array.from(Buffer.from(encrypted, "hex")),
    auth_tag: Array.from(Buffer.from(authTag.toString("hex"), "hex")),
  };
}

export const handshakeAndGetUuid = async (
  wsUrl: string,
  inputs: any,
  proofType: "register" | "dsc" | "disclose",
  circuitName: string
): Promise<string> => {
  const pubkey =
    key1.getPublic().getX().toString("hex").padStart(64, "0") +
    key1.getPublic().getY().toString("hex").padStart(64, "0");

  const helloBody = {
    jsonrpc: "2.0",
    method: "openpassport_hello",
    id: 1,
    params: {
      user_pubkey: [4, ...Array.from(Buffer.from(pubkey, "hex"))],
      uuid: v4(),
    },
  };

  const ws = new WebSocket(wsUrl);

  ws.on("open", async () => {
    ws.send(JSON.stringify(helloBody));
  });

  return new Promise((resolve, reject) => {
    ws.on("message", async (data: any) => {
      let textDecoder = new TextDecoder();
      //@ts-ignore
      let result = JSON.parse(textDecoder.decode(Buffer.from(data)));
      if (result.result.attestation !== undefined) {
        const { userData, pubkey } = await verifyAttestation(
          result.result.attestation
        );
        //check if key1 is the same as userData
        const serverPubkey = pubkey!;
        const key2 = ec.keyFromPublic(serverPubkey, "hex");
        const sharedKey = key1.derive(key2.getPublic());

        const endpoint = {
          endpointType: "staging_celo",
          endpoint: "0x3Dd6fc52d2bA4221E02ae3A0707377B56FEA845a",
        };
        const encryptionData = encryptAES256GCM(
          JSON.stringify({
            type: proofType,
            onchain: true,
            ...endpoint,
            circuit: {
              name: circuitName,
              inputs: JSON.stringify(inputs),
            },
          }),
          Buffer.from(sharedKey.toString("hex").padStart(64, "0"), "hex")
        );
        const submitBody = {
          jsonrpc: "2.0",
          method: "openpassport_submit_request",
          id: 1,
          params: {
            uuid: result.result.uuid,
            ...encryptionData,
          },
        };
        ws.send(JSON.stringify(submitBody));
      } else {
        ws.close();

        resolve(result.result);
      }
    });
  });
};

const requiredFields = [
  "module_id",
  "digest",
  "timestamp",
  "pcrs",
  "certificate",
  "cabundle",
];

const ECPublicKeyASN = asn1.define("ECPublicKey", function () {
  // @ts-ignore
  this.seq().obj(
    // @ts-ignore
    this.key("algo")
      .seq()
      // @ts-ignore
      .obj(this.key("id").objid(), this.key("curve").objid()),
    // @ts-ignore
    this.key("pubKey").bitstr()
  );
});

const numberInRange = (start: number, end: number, value: number) => {
  return value > start && value <= end;
};

function derToPem(der: Buffer): string {
  const base64 =
    der
      .toString("base64")
      .match(/.{1,64}/g)
      ?.join("\n") ?? "";
  return `-----BEGIN CERTIFICATE-----\n${base64}\n-----END CERTIFICATE-----`;
}

const verifyCertChain = (rootPem: string, certChainStr: string[]): boolean => {
  const rootCert = Certificate.fromPEM(Buffer.from(rootPem));
  const certChainPartial = certChainStr.map((c) =>
    Certificate.fromPEM(Buffer.from(c))
  );
  const certChain = [rootCert, ...certChainPartial];

  for (let i = 1; i < certChain.length - 1; i++) {
    const isValid = certChain[i - 1].publicKey.verify(
      certChain[i].tbsCertificate.toDER(),
      certChain[i].signature,
      "sha384"
    );
    if (!isValid) {
      console.error(
        `Certificate at index ${i} is not properly signed by the next certificate.`
      );
      return false;
    }
  }
  return true;
};

export const verifyAttestation = async (attestation: Array<number>) => {
  const coseSign1 = await cbor.decodeFirst(Buffer.from(attestation));

  if (!Array.isArray(coseSign1) || coseSign1.length !== 4) {
    throw new Error("Invalid COSE_Sign1 format");
  }

  const [protectedHeader, unprotectedHeader, payload, signature] = coseSign1;

  const attestationDoc = (await cbor.decodeFirst(payload)) as AttestationDoc;

  for (const field of requiredFields) {
    //@ts-ignore
    if (!attestationDoc[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!(attestationDoc.module_id.length > 0)) {
    throw new Error("Invalid module_id");
  }
  if (!(attestationDoc.digest === "SHA384")) {
    throw new Error("Invalid digest");
  }

  if (!(attestationDoc.timestamp > 0)) {
    throw new Error("Invalid timestamp");
  }

  //for each key, value in pcts
  for (const [key, value] of attestationDoc.pcrs) {
    if (key < 0 || key >= 32) {
      throw new Error("Invalid pcr index");
    }

    if (![32, 48, 64].includes(value.length)) {
      throw new Error("Invalid pcr value length at: " + key);
    }
  }

  if (!(attestationDoc.cabundle.length > 0)) {
    throw new Error("Invalid cabundle");
  }

  for (let i = 0; i < attestationDoc.cabundle.length; i++) {
    if (!numberInRange(0, 1024, attestationDoc.cabundle[i].length)) {
      throw new Error("Invalid cabundle");
    }
  }

  if (attestationDoc.public_key) {
    if (!numberInRange(0, 1024, attestationDoc.public_key.length)) {
      throw new Error("Invalid public_key");
    }
  }

  if (attestationDoc.user_data) {
    if (!numberInRange(-1, 512, attestationDoc.user_data.length)) {
      throw new Error("Invalid user_data");
    }
  }

  if (attestationDoc.nonce) {
    if (!numberInRange(-1, 512, attestationDoc.nonce.length)) {
      throw new Error("Invalid nonce");
    }
  }

  const certChain = attestationDoc.cabundle.map((cert: Buffer) =>
    derToPem(cert)
  );

  const cert = derToPem(attestationDoc.certificate);

  if (!verifyCertChain(aws_root_cert_pem, [...certChain, cert])) {
    throw new Error("Invalid certificate chain");
  }

  const finalCert = Certificate.fromPEM(Buffer.from(cert));
  const publicKeyDer = finalCert.publicKeyRaw;
  const decoded = ECPublicKeyASN.decode(publicKeyDer, "der");
  const pubKeyBuffer = Buffer.from(decoded.pubKey.data);

  const x = pubKeyBuffer.subarray(1, 49).toString("hex");
  const y = pubKeyBuffer.subarray(49).toString("hex");

  const verifier = {
    key: {
      x,
      y,
    },
  };

  await cose.sign.verify(Buffer.from(attestation), verifier, {
    defaultType: 18,
  });

  return {
    userData: attestationDoc.user_data,
    pubkey: attestationDoc.public_key,
  };
};

type AttestationDoc = {
  module_id: string;
  digest: string;
  timestamp: number;
  pcrs: Map<number, Buffer>;
  certificate: Buffer;
  cabundle: Array<Buffer>;
  public_key: string | null;
  user_data: string | null;
  nonce: string | null;
};

export const getProofGeneratedUpdate = async (
  uuid: string
): Promise<{
  created_at: string;
  witness_generated_at: string;
  proof_generated_at: string;
}> => {
  console.log(`[getProofGeneratedUpdate] Initializing socket connection for UUID: ${uuid.substring(0, 8)}...`);

  const socket2 = io(WSS_URL, { transports: ["websocket"] });

  socket2.on("connect", () => {
    console.log(`[getProofGeneratedUpdate] Socket connected successfully. Subscribing to UUID: ${uuid.substring(0, 8)}...`);
    socket2.emit("subscribe", uuid);
  });

  socket2.on("disconnect", (reason: string) => {
    console.log(`[getProofGeneratedUpdate] Socket disconnected. Reason: ${reason}`);
  });

  socket2.on("error", (err: Error) => {
    console.error(`[getProofGeneratedUpdate] Socket.IO error:`, err);
  });

  socket2.on("connect_error", (err: Error) => {
    console.error(`[getProofGeneratedUpdate] Socket connection error:`, err);
  });

  return new Promise((resolve, reject) => {
    socket2.on("status", (data: {
      status: number;
      created_at?: string;
      witness_generated_at?: string;
      proof_generated_at?: string;
      request_id?: string;
      [key: string]: any;
    }) => {
        if (data.status === 3 || data.status === 5) {
          socket2.close();
          reject(`Proof generation failed:  ${data.request_id}`);
        } else if (data.status === 4) {
          socket2.close();
          resolve({
            created_at: data.created_at || "",
            witness_generated_at: data.witness_generated_at || "",
            proof_generated_at: data.proof_generated_at || ""
          });
        }
    });
  });
};

export const createRandomString = (length: number) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export async function runGenerateVcAndDiscloseRawProof(
  secret: string,
  attestationId: string,
  passportData: PassportData,
  scope: string,
  userContextData: string,
  options?: {
    selectorDg1?: string[];
    selectorOlderThan?: string | number;
    majority?: string;
    selectorOfac?: string | number;
    forbiddenCountriesList?: string[];
  },
) {
  const selectorDg1 = (options?.selectorDg1 && options.selectorDg1.length === 88)
    ? options.selectorDg1
    : new Array(88).fill("1");
  const selectorOlderThan = options?.selectorOlderThan ?? "1";
  const majority = options?.majority ?? "18";
  const selectorOfac = options?.selectorOfac ?? "1";
  const forbiddenCountriesList = options?.forbiddenCountriesList ?? ["PAK", "IRN"];
  const userIdentifier= calculateUserIdentifierHash(42220, "94ba0DB8A9Db66979905784A9d6B2D286e55Bd27", userContextData);

  const hashFunction = (a: bigint, b: bigint) => poseidon2([a, b]);
  const merkletree = new LeanIMT<bigint>(hashFunction);

  const commitment = generateCommitment(secret, attestationId, passportData);
  merkletree.insert(BigInt(commitment));

  const hash2 = (childNodes: ChildNodes) =>
    childNodes.length === 2 ? poseidon2(childNodes) : poseidon3(childNodes);

  const passportNo_smt = new SMT(hash2, true);
  const nameAndDob_smt = new SMT(hash2, true);
  const nameAndYob_smt = new SMT(hash2, true);

  passportNo_smt.import(passportNojson as any);
  nameAndDob_smt.import(nameAndDobjson as any);
  nameAndYob_smt.import(nameAndYobjson as any);

  return await generateVcAndDiscloseRawProof(
    secret,
    attestationId,
    passportData,
    scope,
    selectorDg1,
    selectorOlderThan,
    merkletree,
    majority,
    passportNo_smt,
    nameAndDob_smt,
    nameAndYob_smt,
    selectorOfac,
    forbiddenCountriesList,
    userIdentifier.toString(),
  );
}
