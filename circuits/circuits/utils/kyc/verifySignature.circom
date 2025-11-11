pragma circom 2.1.9;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/escalarmulfix.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/compconstant.circom";
include "circomlib/circuits/comparators.circom";
include "@openpassport/zk-email-circuits/lib/bigint.circom";
include "./babyEcdsa.circom";
include "../crypto/bigInt/bigInt.circom";

template VERIFY_KYC_SIGNATURE(){

    signal input s;
    signal input neg_r_inv[4];
    signal input msg_hash_limbs[4];
    signal input Tx;
    signal input Ty;
    signal input pubKeyX;
    signal input pubKeyY;


    var SUBGROUP_ORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041; //(251 bits)
    var BASE8[2] = [
            5299619240641551281634865583518297030282874472190772894086521144482721001553,
            16950150798460657717958625567821834550301663161624707787222815936182638968203
        ];

    component computes2bits = Num2Bits(254);
    computes2bits.in <== s;

    // asserts s is a 251 bit number
    for(var i = 0; i < 3; i++){
        computes2bits.out[251 + i] === 0;
    }


    // Check s should be less than SUBGROUPT_ORDER - 1
    component compConst = CompConstant(SUBGROUP_ORDER - 1);
    compConst.in <== computes2bits.out;
    compConst.out === 0;

    // Check if s is 0
    signal is_s_zero <== IsZero()(s);
    is_s_zero === 0;


    signal scalar_mod[4];
   // SUBGROUP ORDER in limbs
    scalar_mod[0] <== 7454187305358665457;
    scalar_mod[1] <== 12339561404529962506;
    scalar_mod[2] <== 3965992003123030795;
    scalar_mod[3] <== 435874783350371333;

    //range check on neg_r_inv[i] < 2 ^ 64
    component range_check_neg_r_inv[4];
    for(var i = 0; i < 4; i++){
        range_check_neg_r_inv[i] = Num2Bits(64);
        range_check_neg_r_inv[i].in <== neg_r_inv[i];
    }

    //Check is - r_inv < scalar_mod
    component scalar_range_check = BigLessThan(64,4);
    scalar_range_check.a <== neg_r_inv;
    scalar_range_check.b <== scalar_mod;
    scalar_range_check.out === 1 ;

    //msg_hash % SUBORDER
    component msgReduced = BigMultModP(64, 4, 4, 4);
    for(var i = 0; i < 4; i++){
        msgReduced.in1[i]<== msg_hash_limbs[i];
        if(i == 0) {
            msgReduced.in2[i]<== 1;
        }
        else{
            msgReduced.in2[i]<== 0;
        }
        msgReduced.modulus[i]<== scalar_mod[i];
    }

    // calculates (- r_inv * msg_hash) % SUBGROUP_ORDER
    component neg_r_inv_msg_hash = BabyScalarMul();
    for(var i = 0 ;i < 4 ;i++) {
        neg_r_inv_msg_hash.in1[i] <== neg_r_inv[i];
        neg_r_inv_msg_hash.in2[i] <== msgReduced.mod[i];
    }

    signal neg_r_inv_msg_hash_bits[256];
    component num2bits[4];

   // convert neg_r_inv_msg_hash limbs to bits
    for (var i = 0; i < 4; i++){
        num2bits[i]= Num2Bits(64);
        num2bits[i].in <== neg_r_inv_msg_hash.out[i];
        for(var j = 0; j < 64; j++){
            neg_r_inv_msg_hash_bits[i * 64 +j] <== num2bits[i].out[j];
        }
    }


    component mulFix = EscalarMulFix(254, BASE8);
    for (var i = 0; i < 254; i++) {
        mulFix.e[i] <== neg_r_inv_msg_hash_bits[i];
    }

    component ecdsa = BabyJubJubECDSA();
    ecdsa.Tx <== Tx;
    ecdsa.Ty <== Ty;
    ecdsa.Ux <== mulFix.out[0];
    ecdsa.Uy <== mulFix.out[1];
    ecdsa.s <== s;

    ecdsa.pubKeyX === pubKeyX;
    ecdsa.pubKeyY === pubKeyY;

}


template BabyScalarMul(){
    signal input in1[4];
    signal input in2[4];

    signal output out[4];

    signal scalar_mod[4];
   //2736030358979909402780800718157159386076813972158567259200215660948447373041(SUBGROUP ORDER)
    scalar_mod[0] <== 7454187305358665457;
    scalar_mod[1] <== 12339561404529962506;
    scalar_mod[2] <== 3965992003123030795;
    scalar_mod[3] <== 435874783350371333;

    component mulmod = BigMultModP(64,4,4,4);

    for(var i = 0; i < 4; i++){
        mulmod.in1[i]<== in1[i];
        mulmod.in2[i]<== in2[i];
        mulmod.modulus[i]<== scalar_mod[i];
    }
    for(var i = 0; i < 4 ; i++){
        out[i] <== mulmod.mod[i];
    }

}
