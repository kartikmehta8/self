import { ethers } from "hardhat";

async function main() {
  console.log("\n🚀 Deploying SimpleProofOfHumanReceiver on Base Sepolia...");

  const MAILBOX = "0x6966b0E55883d49BFB24539356a2f8A673E02039"; // Base Sepolia
  const SOURCE_DOMAIN = 11142220; // Celo Sepolia

  const Receiver = await ethers.getContractFactory("SimpleProofOfHumanReceiver");
  const receiver = await Receiver.deploy(MAILBOX, SOURCE_DOMAIN);
  await receiver.waitForDeployment();

  const address = await receiver.getAddress();
  console.log("✅ Deployed at:", address);
  console.log("\n📝 Save this address for the Sender deployment!");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
