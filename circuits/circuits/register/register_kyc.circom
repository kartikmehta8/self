pragma circom 2.1.9;

include "circomlib/circuits/bitify.circom";
include "../utils/kyc/constants.circom";
include "../utils/passport/customHashers.circom";



template REGISTER_KYC() {

    var max_length = KYC_MAX_LENGTH();
    var country_length = COUNTRY_LENGTH();
    var id_number_length = ID_NUMBER_LENGTH();
    var idNumberIdx = ID_NUMBER_INDEX();

    signal input data_padded[max_length];
    signal input tee_secret;
    signal input user_secret;
    signal input attestation_id;

    //Calculate msg_hash
    component msg_hasher = PackBytesAndPoseidon(max_length);
    for (var i = 0; i < max_length; i++) {
        msg_hasher.in[i] <== data_padded[i];
    }

    //msg_hash bit decomposition
    component bit_decompose = Num2Bits(256);
    bit_decompose.in <== msg_hasher.out;
    signal msg_hash_bits[256] <== bit_decompose.out;

    signal id_num[id_number_length];
    for (var i = 0; i < id_number_length; i++) {
        id_num[i] <== data_padded[idNumberIdx + i];
    }

    signal output nullifier <== PackBytesAndPoseidon(id_number_length)(id_num);
    signal output commitment <== Poseidon(2)([user_secret, msg_hasher.out]);
    signal output tee_secret_hash <== Poseidon(1)([tee_secret]);

}

component main {public [attestation_id]} = REGISTER_KYC();
