pragma circom 2.1.9;

include "circomlib/circuits/bitify.circom";
include "../utils/selfper/constants.circom";
include "../utils/passport/customHashers.circom";
include "../utils/selfper/verifySignature.circom";


template REGISTER_SELFPER() {

    var max_length = SELFPER_MAX_LENGTH();
    var country_length = COUNTRY_LENGTH();
    var id_number_length = ID_NUMBER_LENGTH();
    var idNumberIdx = ID_NUMBER_INDEX();

    var compressed_bit_len = max_length/2;

    signal input data_padded[max_length];

    signal input s;
    signal input Tx;
    signal input Ty;
    signal input pubKeyX;
    signal input pubKeyY;
    signal input r_inv[4];
    signal input secret;
    signal input attestation_id;

    //Calculate msg_hash
    component msg_hasher = PackBytesAndPoseidon(max_length);
    for (var i = 0; i < max_length; i++) {
        msg_hasher.in[i] <== data_padded[i];
    }

    //msg_hash bit decomposition
    //TODO: should we add msg_hash_bits [254] & [255] == 0?
    component bit_decompose = Num2Bits(256);
    bit_decompose.in <== msg_hasher.out;
    signal msg_hash_bits[256] <== bit_decompose.out;


    signal msg_hash_limbs[4];
    component bits2Num[4];

    // Convert msg_hash_bits (little-endian) to 4 LE limbs
    for (var i = 0; i < 4; i++) {
        bits2Num[i] = Bits2Num(64);
        for (var j = 0; j < 64; j++) {
            bits2Num[i].in[j] <== msg_hash_bits[i * 64 + j];
        }
        msg_hash_limbs[i] <== bits2Num[i].out;
    }


    component verifyIdCommSig = VERIFY_SELFPER_SIGNATURE();
    verifyIdCommSig.s <== s;
    verifyIdCommSig.r_inv <== r_inv;
    verifyIdCommSig.msg_hash_limbs <== msg_hash_limbs;
    verifyIdCommSig.Tx <== Tx;
    verifyIdCommSig.Ty <== Ty;
    verifyIdCommSig.pubKeyX <== pubKeyX;
    verifyIdCommSig.pubKeyY <== pubKeyY;

    signal id_num[id_number_length];
    for (var i = 0; i < id_number_length; i++) {
        id_num[i] <== data_padded[idNumberIdx + i];
    }
    signal output nullifier <== PackBytesAndPoseidon(id_number_length)(id_num);
    signal output commitment <== Poseidon(2)([secret, msg_hasher.out]);

    signal output pubkey_hash <== Poseidon(2)([pubKeyX, pubKeyY]);

}

component main {public [attestation_id]} = REGISTER_SELFPER();
