pragma circom 2.1.9;

include "../photohash_passport.circom";

component main { public [ merkle_root, attestation_id ] } = RevealDG2Hash(160, 160, 384, 555 ,33);
