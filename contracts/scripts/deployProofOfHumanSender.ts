import { ethers } from "hardhat";

async function main() {
  console.log("\n🚀 Deploying SimpleProofOfHumanSender on Celo Sepolia...");

  const HUB = ethers.getAddress("0x6f3870041792498bd1E3D5F10924EC0f63c894f4"); // Your Hub on Celo Sepolia
  const MAILBOX = ethers.getAddress("0x20a0d441e31d83e678ff97e8fa13647ea53ab337"); // Celo Sepolia
  const RECEIVER = ethers.getAddress("0x9dc809bb06cBfEabf9C1a1549C956f2251c3aE82"); // Just deployed on Base
  const DEST_DOMAIN = 102613; // Base Sepolia domain
  const SCOPE_SEED = "hyperlane-proof-of-human";

  // Verification config V2 - simple proof of human (just verify valid passport)
  const config = {
    olderThan: 0, // No age requirement
    forbiddenCountries: [], // No country restrictions
    ofacEnabled: false, // No OFAC checking
  };

  const Sender = await ethers.getContractFactory("SimpleProofOfHumanSender");
  const sender = await Sender.deploy(
    HUB,
    SCOPE_SEED,
    config,
    MAILBOX,
    DEST_DOMAIN,
    RECEIVER
  );
  await sender.waitForDeployment();

  const address = await sender.getAddress();
  console.log("✅ Deployed at:", address);
  console.log("\n📋 Next steps:");
  console.log("1. Update frontend .env.local with this address");
  console.log("2. Fund Sender with native tokens for Hyperlane fees");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
