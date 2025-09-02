
import { hashEndpointWithScope } from "@selfxyz/common/utils/scope";
import { genAndInitMockPassportData } from "@selfxyz/common/utils/passports/genMockPassportData";
import { getProofGeneratedUpdate, handshakeAndGetUuid, runGenerateVcAndDiscloseRawProof } from "./utils/helper.js";
import { generateCircuitInputsDSC, generateCircuitInputsRegister, getCircuitNameFromPassportData } from "@selfxyz/common";
import { REGISTER_URL ,DSC_URL} from "./utils/constant.js";
import axios from "axios";



async function main() {
  const secret = "1234";
  const attestationId = "1";
  console.log("✅ Initialized constants - secret:", secret, "attestationId:", attestationId);

  const scope = hashEndpointWithScope("http://localhost:3000", "self-playground");
  console.log("✅ Generated scope hash:", scope);

  const passportData = genAndInitMockPassportData(
    "sha256",
    "sha256",
    "rsa_sha256_65537_4096" as any,
    "FRA",
    "000101",
    "300101",
  );
  console.log("✅ Generated mock passport data:", passportData ? "SUCCESS" : "FAILED");

  const dscTree = await axios.get("http://tree.staging.self.xyz/dsc");
  console.log("✅ Fetched DSC tree data:", dscTree.status, dscTree.statusText);
  const serialized_dsc_tree: any = dscTree.data;
  console.log("✅ Parsed DSC tree data:", serialized_dsc_tree ? "SUCCESS" : "FAILED");

  const response = await axios.get("http://tree.staging.self.xyz/csca");
  console.log("✅ Fetched CSCA tree data:", response.status, response.statusText);
  const data : any = response.data;
  console.log("✅ Parsed CSCA response data:", data ? "SUCCESS" : "FAILED");


  //DSC proof generation
  const cscaTree = JSON.parse(data.data);
  console.log("✅ Parsed CSCA tree from JSON:", cscaTree ? "SUCCESS" : "FAILED");

  const dscInputs = generateCircuitInputsDSC(passportData, cscaTree);
  console.log("✅ Generated DSC circuit inputs:", dscInputs ? "SUCCESS" : "FAILED");

  const dscCircuitName = getCircuitNameFromPassportData(passportData, "dsc");
  console.log("✅ Generated DSC circuit name:", dscCircuitName);

  const dscUuid = await handshakeAndGetUuid(
    DSC_URL,
    dscInputs,
    "dsc",
    dscCircuitName
  );
  console.log("✅ Completed DSC handshake, got UUID:", dscUuid);

  const dscData = await getProofGeneratedUpdate(dscUuid);
  console.log("✅ Got DSC proof generated update:", dscData ? "SUCCESS" : "FAILED");
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

  //Register proof generation
  const registerInputs = generateCircuitInputsRegister(
    secret,
    passportData,
    serialized_dsc_tree.data as string
  );
  console.log("✅ Generated register circuit inputs:", registerInputs ? "SUCCESS" : "FAILED");

  const registerCircuitName = getCircuitNameFromPassportData(
    passportData,
    "register"
  );
  console.log("✅ Generated register circuit name:", registerCircuitName);

  //keyLength === 384 ? REGISTER_MEDIUM_URL : REGISTER_URL,
  const registerUuid = await handshakeAndGetUuid(
    REGISTER_URL,
    registerInputs,
    "register",
    registerCircuitName
  );
  console.log("✅ Completed register handshake, got UUID:", registerUuid);

  const registerData = await getProofGeneratedUpdate(registerUuid);
  console.log("✅ Got register proof generated update:", registerData ? "SUCCESS" : "FAILED");
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

  await runGenerateVcAndDiscloseRawProof(
    secret,
    attestationId,
    passportData,
    scope,
    "",
  );
  console.log("✅ Completed VC and disclose proof generation");

  console.log("✅ Saved proof JSON to vc_and_disclose_proof.json");
}

main().catch((err) => {
  console.error("❌ FAILED to generate VC+Disclose proof:", err?.message ?? err);
  console.error("❌ Full error details:", err);
  process.exit(1);
});
