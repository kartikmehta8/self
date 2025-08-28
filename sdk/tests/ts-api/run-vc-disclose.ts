
import { hashEndpointWithScope } from "@selfxyz/common/utils/scope";
import { genAndInitMockPassportData } from "@selfxyz/common/utils/passports/genMockPassportData";
import { getProofGeneratedUpdate, handshakeAndGetUuid, runGenerateVcAndDiscloseRawProof } from "./utils/helper.js";
import { generateCircuitInputsRegister, getCircuitNameFromPassportData, DSC_TREE_URL_STAGING } from "@selfxyz/common";
import { REGISTER_MEDIUM_URL, REGISTER_URL } from "./utils/constant.js";

async function main() {
  const secret = "1234";
  const attestationId = "1";
  const scope = hashEndpointWithScope("http://localhost:3000", "self-playground");

  const passportData = genAndInitMockPassportData(
    "sha256",
    "sha256",
    "rsa_sha256_65537_4096" as any,
    "FRA",
    "000101",
    "300101",
  );
  console.log("passportData DONE");
  const dscTree = await fetch(DSC_TREE_URL_STAGING);
  const serialized_dsc_tree: any = await dscTree.json();
  console.log("serialized_dsc_tree DONE");

  const registerInputs = generateCircuitInputsRegister(
    secret,
    passportData,
    serialized_dsc_tree.data as string
  );
  console.log("registerInputs DONE");
  const registerCircuitName = getCircuitNameFromPassportData(
    passportData,
    "register"
  );
  console.log("registerCircuitName DONE");
  //keyLength === 384 ? REGISTER_MEDIUM_URL : REGISTER_URL,
  const registerUuid = await handshakeAndGetUuid(
    REGISTER_URL,
    registerInputs,
    "register",
    registerCircuitName
  );
  console.log("handshakeAndGetUuid DONE");
  const registerData = await getProofGeneratedUpdate(registerUuid);
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
  console.log("registerData DONE");
  await runGenerateVcAndDiscloseRawProof(
    secret,
    attestationId,
    passportData,
    scope,
    "",
  );

  console.log("Saved proof JSON to vc_and_disclose_proof.json");
}

main().catch((err) => {
  console.error("Failed to generate VC+Disclose proof:", err?.message ?? err);
  process.exit(1);
});
