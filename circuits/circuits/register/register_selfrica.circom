pragma circom 2.1.9;

include "circomlib/circuits/bitify.circom";
include "../utils/selfrica/constants.circom";
include "../utils/passport/customHashers.circom";
include "../utils/selfrica/verifySignature.circom";

template REGISTER_SELFRICA() {
    var selfrica_length = SELFRICA_MAX_LENGTH();
    var country_length = COUNTRY_LENGTH();
    var compressed_bit_len = selfrica_length/2;

    signal input SmileID_data_padded[selfrica_length];

    //Args to verify Hash(smiledata) signature
    signal input s;
    signal input Tx;
    signal input Ty;
    signal input pubKeyX;
    signal input pubKeyY;
    signal input r_inv[4];
    signal input secret;

    signal output attestation_id <== 4;

    //Calculate msg_hash
    component msg_hasher = PackBytesAndPoseidon(selfrica_length);
    for (var i = 0; i < selfrica_length; i++) {
        msg_hasher.in[i] <== SmileID_data_padded[i];
    }

    //msg_hash bit decomposition
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

    //verify Hash(smiledata) signature
    component verifyIdCommSig = VERIFY_SELFRICA_SIGNATURE();
    verifyIdCommSig.s <== s;
    verifyIdCommSig.r_inv <== r_inv;
    verifyIdCommSig.msg_hash_limbs <== msg_hash_limbs;
    verifyIdCommSig.Tx <== Tx;
    verifyIdCommSig.Ty <== Ty;
    verifyIdCommSig.pubKeyX <== pubKeyX;
    verifyIdCommSig.pubKeyY <== pubKeyY;

    signal id_num[ID_NUMBER_LENGTH()];
    var idNumberIdx = ID_NUMBER_INDEX();
    for (var i = 0; i < ID_NUMBER_LENGTH(); i++) {
        id_num[i] <== SmileID_data_padded[idNumberIdx + i];
    }
    signal output nullifier <== PackBytesAndPoseidon(ID_NUMBER_LENGTH())(id_num);
    signal output commitment <== Poseidon(2)([secret, msg_hasher.out]);

    signal output pubkey_hash <== Poseidon(2)([pubKeyX, pubKeyY]);

}
