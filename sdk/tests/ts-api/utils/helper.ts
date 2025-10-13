import { v4 } from "uuid";
// @ts-ignore
import WebSocket from "ws";
import elliptic from "elliptic";
import crypto from "crypto";

import forge from 'node-forge';
// @ts-ignore

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
// @ts-ignore
import passportNojson from "@selfxyz/circuits/tests/consts/ofac/passportNoAndNationalitySMT.json";
// @ts-ignore
import nameAndDobjson from "@selfxyz/circuits/tests/consts/ofac/nameAndDobSMT.json";
// @ts-ignore
import nameAndYobjson from "@selfxyz/circuits/tests/consts/ofac/nameAndYobSMT.json";
// @ts-ignore
import nameAndDobjsonID from "@selfxyz/circuits/tests/consts/ofac/nameAndDobSMT_ID.json";
// @ts-ignore
import nameAndYobjsonID from "@selfxyz/circuits/tests/consts/ofac/nameAndYobSMT_ID.json";

import { calculateUserIdentifierHash } from "@selfxyz/common";
import { generateCommitment } from '@selfxyz/common/utils/passports/passport';

const { ec: EC } = elliptic;
const ec = new EC("p256");

const key1 = ec.genKeyPair();


export async function generateVcAndDiscloseRawProof(
  secret: string,
  attestationId: string,
  passportData: PassportData,
  scope: string,
  selectorDg1: string[],
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

  let vcAndDiscloseCircuitInputs: CircuitSignals;
  if(attestationId === "1"){
    vcAndDiscloseCircuitInputs = generateCircuitInputsVCandDisclose(
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
  }
  else {
     vcAndDiscloseCircuitInputs = generateCircuitInputsVCandDisclose(
      secret,
      attestationId,
      passportData,
      scope,
      selectorDg1,
      selectorOlderThan,
      merkletree,
      majority,
      null,
      nameAndDob_smt,
      nameAndYob_smt,
      selectorOfac,
      forbiddenCountriesList,
      userIdentifier,
    );
  }



  const __filenameHelper = fileURLToPath(import.meta.url);
  const __dirnameHelper = path.dirname(__filenameHelper);
  let wasmPath:any;
  let zkeyPath:any;
  let vKey:any;
  if(attestationId === "1"){
    wasmPath = path.resolve(__dirnameHelper, "assests/vc_and_disclose.wasm");
    zkeyPath = path.resolve(__dirnameHelper, "assests/vc_and_disclose_00008.zkey");
    vKey = JSON.parse(fs.readFileSync(path.resolve(__dirnameHelper, "assests/verification_key.json"), "utf8"));
  }
  else{
    wasmPath = path.resolve(__dirnameHelper, "assests/vc_and_disclose_id.wasm");
    zkeyPath = path.resolve(__dirnameHelper, "assests/vc_and_disclose_id.zkey");
    vKey = JSON.parse(fs.readFileSync(path.resolve(__dirnameHelper, "assests/verification_key_id.json"), "utf8"));
  }

  const vcAndDiscloseProof = await groth16.fullProve(
    vcAndDiscloseCircuitInputs,
    wasmPath,
    zkeyPath,
  );


  const isValid = await groth16.verify(vKey, vcAndDiscloseProof.publicSignals, vcAndDiscloseProof.proof);
  if (!isValid) {
    throw new Error("Generated disclose proof verification failed");
  }

  return vcAndDiscloseProof;
}

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
  let selectorDg1: string[];
  if(attestationId === "1"){
   selectorDg1 = (options?.selectorDg1 && options.selectorDg1.length === 88)
    ? options.selectorDg1
    : new Array(88).fill("1");
  }
  else{
    selectorDg1 = (options?.selectorDg1 && options.selectorDg1.length === 90)
    ? options.selectorDg1
    : new Array(90).fill("1");
  }
  const selectorOlderThan = options?.selectorOlderThan ?? "1";
  const majority = options?.majority ?? "18";
  const selectorOfac = options?.selectorOfac ?? "1";
  const forbiddenCountriesList = options?.forbiddenCountriesList ?? ["PAK", "IRN"];
  const userIdentifier= calculateUserIdentifierHash(42220, "94ba0DB8A9Db66979905784A9d6B2D286e55Bd27", userContextData);

  const merkleTree: any = new LeanIMT<bigint>((a, b) => poseidon2([a, b]), []);

  let identityTreeHeader: any;
  if(attestationId === "1"){
    identityTreeHeader = await fetch(
      "http://tree.staging.self.xyz/identity"
    );
  }
  else{
    identityTreeHeader = await fetch(
      "http://tree.staging.self.xyz/identity-id"
    );
  }

  const identityTree = JSON.parse((await identityTreeHeader.json() as any).data).map(
    (x: string[]) => x.map((y: string) => BigInt(y))
  );

  merkleTree.insertMany(identityTree[0]);

  // Insert test identity commitment
  const commitment = generateCommitment(secret, attestationId, passportData);
  merkleTree.insert(BigInt(commitment));

  const hash2 = (childNodes: ChildNodes) =>
    childNodes.length === 2 ? poseidon2(childNodes) : poseidon3(childNodes);

  const passportNo_smt = new SMT(hash2, true);
  const nameAndDob_smt = new SMT(hash2, true);
  const nameAndYob_smt = new SMT(hash2, true);

  passportNo_smt.import(passportNojson as any);
  if(attestationId === "1"){
    nameAndDob_smt.import(nameAndDobjson as any);
    nameAndYob_smt.import(nameAndYobjson as any);
  }
  else{
    nameAndDob_smt.import(nameAndDobjsonID as any);
    nameAndYob_smt.import(nameAndYobjsonID as any);
  }

  return await generateVcAndDiscloseRawProof(
    secret,
    attestationId,
    passportData,
    scope,
    selectorDg1,
    selectorOlderThan,
    merkleTree,
    majority,
    passportNo_smt,
    nameAndDob_smt,
    nameAndYob_smt,
    selectorOfac,
    forbiddenCountriesList,
    userIdentifier.toString(),
  );
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
  proofType: "register" | "dsc" | "disclose" | "register_id" ,
  circuitName: string
): Promise<string> => {
  const pubkey = key1.getPublic(true, "hex");

  const helloBody = {
    jsonrpc: "2.0",
    method: "openpassport_hello",
    id: 1,
    params: {
      user_pubkey: [...Array.from(Buffer.from(pubkey, "hex"))],
      uuid: v4(),
    },
  };

  const ws = new WebSocket(wsUrl);

  ws.on("open", async () => {
    ws.send(JSON.stringify(helloBody));
  });

  return new Promise((resolve, reject) => {
    ws.on("message", async (data) => {
      let textDecoder = new TextDecoder();
      //@ts-ignore
      let result = JSON.parse(textDecoder.decode(Buffer.from(data)));
      console.log(result);
      if (result.result.attestation !== undefined) {
        const { userPubkey, serverPubkey, imageHash, verified } = await validatePKIToken(
          Buffer.from(result.result.attestation).toString('utf-8')
        );
        //check if key1 is the same as userPubkey
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

export const getProofGeneratedUpdate = async (
  uuid: string
): Promise<{
  created_at: string;
  witness_generated_at: string;
  proof_generated_at: string;
}> => {
  const socket2 = io(WSS_URL, { transports: ["websocket"] });
  socket2.on("connect", () => {
    socket2.emit("subscribe", uuid);
  });
  socket2.on("error", (err) => {
    console.error("Socket.IO error:", err);
  });

  return new Promise((resolve, reject) => {
    socket2.on("status", (data) => {
      try {
        if (data.status === 3 || data.status === 5) {
          socket2.close();
          reject(`Proof generation failed:  ${data.request_id}`);
        } else if (data.status === 4) {
          socket2.close();
          resolve(data);
        }
      } catch (e) {
        console.error("Error parsing message:", e);
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

const GCP_ROOT_CERT = `
-----BEGIN CERTIFICATE-----
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
uyT5CnJulxSC5CT1
-----END CERTIFICATE-----
`;


function base64UrlDecodeToBytes(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return forge.util.decode64(padded);
}

function base64UrlDecodeToString(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return forge.util.decodeUtf8(forge.util.decode64(padded));
}

type PKICertificates = {
  leaf: forge.pki.Certificate;
  intermediate: forge.pki.Certificate;
  root: forge.pki.Certificate;
};

function extractCertificates(x5c: string[]): PKICertificates {
  const decode = (b64: string) =>
    forge.pki.certificateFromAsn1(forge.asn1.fromDer(forge.util.decode64(b64)));

  return {
    leaf: decode(x5c[0]),
    intermediate: decode(x5c[1]),
    root: decode(x5c[2]),
  };
}

function compareCertificates(cert1: forge.pki.Certificate, cert2: forge.pki.Certificate): boolean {
  const hash1 = forge.md.sha256
    .create()
    .update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert1)).getBytes())
    .digest()
    .toHex();
  const hash2 = forge.md.sha256
    .create()
    .update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert2)).getBytes())
    .digest()
    .toHex();
  return hash1 === hash2;
}

function verifyCertificateChain({ leaf, intermediate, root }: PKICertificates) {
  const caStore = forge.pki.createCaStore([intermediate, root]);

  forge.pki.verifyCertificateChain(caStore, [leaf], (vfd, depth, chain) => {
    if (!vfd) {
      throw new Error(`Certificate verification failed at depth ${depth}`);
    }
    return true;
  });

  [leaf, intermediate, root].forEach((cert) => {
    const now = new Date();
    if (now < cert.validity.notBefore || now > cert.validity.notAfter) {
      throw new Error('Certificate is not within validity period');
    }
  });
}

export function validatePKIToken(
  attestationToken: string,
  dev: boolean = true
): {
  userPubkey: Buffer;
  serverPubkey: Buffer;
  imageHash: string;
  verified: boolean;
} {
  // Decode JWT header
  const [encodedHeader, encodedPayload, encodedSignature] = attestationToken.split('.');
  const header = JSON.parse(forge.util.decodeUtf8(forge.util.decode64(encodedHeader)));
  if (header.alg !== 'RS256') throw new Error(`Invalid alg: ${header.alg}`);

  const x5c = header.x5c;
  if (!x5c || x5c.length !== 3) throw new Error('x5c header must contain exactly 3 certificates');
  const certificates = extractCertificates(x5c);
  const storedRootCert = forge.pki.certificateFromPem(GCP_ROOT_CERT);
  // Compare root certificate fingerprint
  if (!compareCertificates(storedRootCert, certificates.root)) {
    throw new Error('Root certificate does not match expected root');
  }
  verifyCertificateChain(certificates);
  // Verify JWT signature
  try {
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    // Decode signature (base64url → binary)
    const signatureBytes = base64UrlDecodeToBytes(encodedSignature); // string of binary bytes

    // Verify RS256 signature
    const md = forge.md.sha256.create();
    md.update(signingInput, 'utf8');
    const rsaPublicKey = certificates.leaf.publicKey as forge.pki.rsa.PublicKey; // cast to RSA type
    const verified = rsaPublicKey.verify(md.digest().bytes(), signatureBytes);
    if (!verified) throw new Error('Signature verification failed');

    const payloadStr = base64UrlDecodeToString(encodedPayload);
    const payload = JSON.parse(payloadStr);
    if (!dev) {
      if (payload.dbgstat !== 'disabled-since-boot') {
        throw new Error('Debug mode is enabled');
      }
    }
    return {
      verified: true,
      userPubkey: Buffer.from(payload.eat_nonce[0], 'base64'),
      serverPubkey: Buffer.from(payload.eat_nonce[1], 'base64'),
      //slice the sha256: prefix
      imageHash: payload.submods.container.image_digest.slice(7),
    };
  } catch (err) {
    console.error('TEE JWT signature verification failed:', err);
    return {
      verified: false,
      userPubkey: Buffer.from([]),
      serverPubkey: Buffer.from([]),
      imageHash: '',
    };
  }
}
