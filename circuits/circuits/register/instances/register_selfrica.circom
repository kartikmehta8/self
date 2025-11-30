pragma circom 2.1.9;
include "../register_kyc.circom";

component main {public [attestation_id]} = REGISTER_KYC();
