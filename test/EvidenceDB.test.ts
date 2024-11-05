import { ethers } from "hardhat";
import { expect } from "chai";

import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { toBeHex } from "ethers";

import { Hash, LocalStorageDB, Merkletree, Proof, str2Bytes, verifyProof } from "@iden3/js-merkletree";

import { Reverter, getPoseidon, poseidonHash } from "@test-helpers";

import { EvidenceDB, IEvidenceDB } from "@ethers-v6";

import "mock-local-storage";

describe("EvidenceDB", () => {
  const reverter = new Reverter();

  const MERKLE_TREE_DEPTH = 20;

  let REGISTRY: SignerWithAddress;

  let merkleTree: EvidenceDB;

  let storage: LocalStorageDB;

  let localMerkleTree: Merkletree;

  before("setup", async () => {
    [REGISTRY] = await ethers.getSigners();

    const EvidenceDB = await ethers.getContractFactory("EvidenceDB", {
      libraries: {
        PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
        PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
      },
    });
    merkleTree = await EvidenceDB.deploy();

    await merkleTree.__EvidenceDB_init(REGISTRY.address, MERKLE_TREE_DEPTH);

    await reverter.snapshot();
  });

  beforeEach("setup", async () => {
    storage = new LocalStorageDB(str2Bytes(""));

    localMerkleTree = new Merkletree(storage, true, MERKLE_TREE_DEPTH);
  });

  afterEach("cleanup", async () => {
    await reverter.revert();

    localStorage.clear();
  });

  async function getRoot(tree: Merkletree): Promise<string> {
    return toBeHex((await tree.root()).bigInt(), 32);
  }

  function getOnchainProof(onchainProof: IEvidenceDB.ProofStructOutput): Proof {
    const modifiableArray = JSON.parse(JSON.stringify(onchainProof.siblings)).reverse() as string[];
    const reversedKey = modifiableArray.findIndex((value) => value !== ethers.ZeroHash);
    const lastKey = reversedKey !== -1 ? onchainProof.siblings.length - 1 - reversedKey : -1;

    const siblings = onchainProof.siblings
      .filter((value, key) => value != ethers.ZeroHash || key <= lastKey)
      .map((sibling: string) => new Hash(Hash.fromHex(sibling.slice(2)).value.reverse()));

    let nodeAux: { key: Hash; value: Hash } | undefined = undefined;

    if (onchainProof.auxExistence) {
      nodeAux = {
        key: new Hash(Hash.fromHex(onchainProof.auxKey.slice(2)).value.reverse()),
        value: new Hash(Hash.fromHex(onchainProof.auxValue.slice(2)).value.reverse()),
      };
    }

    return new Proof({
      siblings,
      existence: onchainProof.existence,
      nodeAux,
    });
  }

  describe("#Initialization", () => {
    it("should revert if trying to initialize twice", async () => {
      await expect(merkleTree.__EvidenceDB_init(REGISTRY.address, MERKLE_TREE_DEPTH))
        .to.be.revertedWithCustomError(merkleTree, "InvalidInitialization")
        .withArgs();
    });
  });

  describe("#Basic functionality", () => {
    it.only("should add element to the tree", async () => {
      expect(await merkleTree.getRoot()).to.equal(ethers.ZeroHash);

      const value = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
      const key = poseidonHash(value);

      await merkleTree.add(key, value);
      await localMerkleTree.add(BigInt(key), BigInt(value));

      expect(await merkleTree.getValue(key)).to.equal(value);
      expect(await merkleTree.getRoot()).to.equal(await getRoot(localMerkleTree));
    });
  });
});
