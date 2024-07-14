pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/pedersen.circom";
include "../../node_modules/circomlib/circuits/sha256/sha256.circom";
include "merkleTree.circom";

// computes Pedersen(nullifier + secret)
template CommitmentHasher() {
    signal input nullifier;
    signal input secret;
    signal output commitment;
    signal output nullifierHash;
    signal output appCommitment; // Hash final (commitment + shares)

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
    }

    commitment <== commitmentHasher.out[0];
    nullifierHash <== nullifierHasher.out[0];
}

// SHA-256 hash of the commitment to track fees and pool shares
template Sha256Hasher(length) {
    var SHA_LENGTH = 256;
    var inBits = SHA_LENGTH * length;

    signal input in[length];
    signal output hash;

    // Array to store all bits of inputs for SHA-256 input.
    var computedBits[inBits];

    // Convert each input into bits and store them in the `bits` array.
    for (var i = 0; i < length; i++) {
        var computedBitsInput[SHA_LENGTH] = Num2Bits(SHA_LENGTH)(in[i]);
        for (var j = 0; j < SHA_LENGTH; j++) {
            computedBits[(i * SHA_LENGTH) + (SHA_LENGTH - 1) - j] = computedBitsInput[j];
        }
    }

    // SHA-256 hash computation.
    var computedSha256Bits[SHA_LENGTH] = Sha256(inBits)(computedBits);

    // Convert SHA-256 output back to number.
    var computedBitsToNumInput[SHA_LENGTH];
    for (var i = 0; i < SHA_LENGTH; i++) {
        computedBitsToNumInput[i] = computedSha256Bits[(SHA_LENGTH - 1) - i];
    }
    var computedSha256Number = Bits2Num(256)(computedBitsToNumInput); 

    hash <== computedSha256Number;
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
    signal input shares;
    signal input commitmentNew; // new commitment
    signal input sharesWithdraw; // shares to withdraw
    signal input appCommitmentNew; // new commitment hash with shares added
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component hasher = CommitmentHasher();
    hasher.nullifier <== nullifier;
    hasher.secret <== secret;
    hasher.nullifierHash === nullifierHash;

    signal appCommitmentOld <== Sha256Hasher(2)([
        hasher.commitment,
        shares
    ]);

    component tree = MerkleTreeChecker(levels);
    tree.leaf <== appCommitmentOld; // use app commitment as leaf
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    signal sharesRemaining <== shares - sharesWithdraw;
    assert(sharesRemaining>=0);

    signal _appCommitmentNew <== Sha256Hasher(2)([
        commitmentNew,
        sharesRemaining
    ]);

    _appCommitmentNew === appCommitmentNew;

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

component main {public [root,nullifierHash,recipient,relayer,fee,refund,sharesWithdraw,appCommitmentNew]} = Withdraw(20);
