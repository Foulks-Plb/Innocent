pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/pedersen.circom";
include "../../node_modules/circomlib/circuits/sha256/sha256.circom";
include "merkleTree.circom";

// computes Pedersen(nullifier + secret)
template CommitmentHasher() {
    signal input nullifier;
    signal input secret;
    signal input feesGroth; // feesGroth when the deposit was made
    signal input share; // Share in pool
    signal output commitment;
    signal output nullifierHash;
    signal output appCommitment; // Hash final (commitment + feesGroth + share)

    component commitmentHasher = Pedersen(496);
    component nullifierHasher = Pedersen(248);
    component nullifierBits = Num2Bits(248);
    component secretBits = Num2Bits(248);
    nullifierBits.in <== nullifier;
    secretBits.in <== secret;


    for (var i = 0; i < 248; i++) {
        nullifierHasher.in[i] <== nullifierBits.out[i];
        commitmentHasher.in[i] <== nullifierBits.out[i];
        commitmentHasher.in[i + 248] <== secretBits.out[i];
        log(secretBits.out[i]);
    }

    // Conversion bits
    component commitmentBits = Num2Bits(256);
    component feesGrothBits = Num2Bits(256);
    component shareBits = Num2Bits(256);

    commitmentBits.in <== commitmentHasher.out[0];
    feesGrothBits.in <== feesGroth;
    shareBits.in <== share;

    // Combinaison
    signal combined[768];
    for (var i = 0; i < 256; i++) {
        combined[i] <== commitmentBits.out[i];
        combined[i + 256] <== feesGrothBits.out[i];
        combined[i + 512] <== shareBits.out[i];
    }

    // Calcul SHA-256
    component appCommitmentHasher = Sha256(768);
    for (var i = 0; i < 768; i++) {
        appCommitmentHasher.in[i] <== combined[i];
    }

    commitment <== commitmentHasher.out[0];
    nullifierHash <== nullifierHasher.out[0];
    appCommitment <== appCommitmentHasher.out[0];
}

// Verifies that commitment that corresponds to given secret and nullifier is included in the merkle tree of deposits
template Withdraw(levels) {
    signal input root;
    signal input nullifierHash;
    signal input recipient; // not taking part in any computations
    signal input relayer;  // not taking part in any computations
    signal input fee;      // not taking part in any computations
    signal input refund;   // not taking part in any computations
    signal input nullifier;
    signal input secret;
    signal input feesGroth;
    signal input share;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component hasher = CommitmentHasher();
    hasher.nullifier <== nullifier;
    hasher.secret <== secret;
    hasher.feesGroth <== feesGroth;
    hasher.share <== share;
    hasher.nullifierHash === nullifierHash;

    log(hasher.appCommitment);

    component tree = MerkleTreeChecker(levels);
    tree.leaf <== hasher.appCommitment; // use app commitment as leaf
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // Add hidden signals to make sure that tampering with recipient or fee will invalidate the snark proof
    // Most likely it is not required, but it's better to stay on the safe side and it only takes 2 constraints
    // Squares are used to prevent optimizer from removing those constraints
    signal recipientSquare;
    signal feeSquare;
    signal relayerSquare;
    signal refundSquare;
    recipientSquare <== recipient * recipient;
    feeSquare <== fee * fee;
    relayerSquare <== relayer * relayer;
    refundSquare <== refund * refund;
}

component main {public [root,nullifierHash,recipient,relayer,fee,refund]} = Withdraw(20);
