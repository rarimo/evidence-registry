// LICENSE: CC0-1.0
pragma circom 2.1.9;

include "SparseMerkleTree.circom";

template BuildIsolatedKey() {
    signal output isolatedKey;

    signal input address;
    signal input key;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== address;
    hasher.inputs[1] <== key;

    hasher.out ==> isolatedKey;
}

template EvidenceRegistrySMT(levels) {
    // Public Inputs
    signal input root;

    // Private Inputs
    signal input address;
    signal input key;

    signal input value;

    signal input siblings[levels];

    signal input auxKey;
    signal input auxValue;
    signal input auxIsEmpty;

    signal input isExclusion;

    // Build isolated key
    component isolatedKey = BuildIsolatedKey();
    isolatedKey.address <== address;
    isolatedKey.key <== key;

    // Verify Sparse Merkle Tree Proof
    component smtVerifier = SparseMerkleTree(levels);
    smtVerifier.siblings <== siblings;

    smtVerifier.key <== isolatedKey.isolatedKey;
    smtVerifier.value <== value;

    smtVerifier.auxKey <== auxKey;
    smtVerifier.auxValue <== auxValue;
    smtVerifier.auxIsEmpty <== auxIsEmpty;

    smtVerifier.isExclusion <== isExclusion;

    smtVerifier.root <== root;
}
