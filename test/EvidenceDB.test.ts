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

  let USER: SignerWithAddress;
  let REGISTRY: SignerWithAddress;

  let merkleTree: EvidenceDB;

  let storage: LocalStorageDB;

  let localMerkleTree: Merkletree;

  before("setup", async () => {
    [USER, REGISTRY] = await ethers.getSigners();

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

    it("should correctly initialize the tree", async () => {
      expect(await merkleTree.getEvidenceRegistry()).to.equal(REGISTRY.address);
    });
  });

  describe("#Basic functionality", () => {
    it("should add element to the tree", async () => {
      expect(await merkleTree.getRoot()).to.equal(ethers.ZeroHash);

      const value = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
      const key = poseidonHash(value);

      await merkleTree.connect(REGISTRY).add(key, value);
      await localMerkleTree.add(BigInt(key), BigInt(value));

      expect(await merkleTree.getValue(key)).to.equal(value);
      expect(await merkleTree.getRoot()).to.equal(await getRoot(localMerkleTree));
      expect(getOnchainProof(await merkleTree.getProof(key))).to.deep.equal(
        (await localMerkleTree.generateProof(BigInt(key))).proof,
      );
      expect(await merkleTree.getSize()).to.equal(1);
    });

    it("should correctly build the tree with multiple elements", async () => {
      let key;
      let value;

      for (let i = 0; i < 10; i++) {
        value = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
        key = poseidonHash(value);

        await merkleTree.connect(REGISTRY).add(key, value);
        await localMerkleTree.add(BigInt(key), BigInt(value));
      }

      expect(await merkleTree.getValue(key!)).to.equal(value);
      expect(await merkleTree.getRoot()).to.equal(await getRoot(localMerkleTree));
      expect(getOnchainProof(await merkleTree.getProof(key!))).to.deep.equal(
        (await localMerkleTree.generateProof(BigInt(key!))).proof,
      );
    });

    it("should remove element from the tree", async () => {
      const value = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
      const key = poseidonHash(value);

      await merkleTree.connect(REGISTRY).add(key, value);
      await merkleTree.connect(REGISTRY).remove(key);

      expect(await merkleTree.getValue(key)).to.equal(ethers.ZeroHash);
    });

    it("should update element in the tree", async () => {
      const value = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
      const key = poseidonHash(value);

      await merkleTree.connect(REGISTRY).add(key, value);

      expect(await merkleTree.getValue(key)).to.equal(value);

      const newValue = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
      await merkleTree.connect(REGISTRY).update(key, newValue);

      expect(await merkleTree.getValue(key)).to.equal(newValue);
    });

    it("should revert if trying to add/remove/update element in the try by not a registry", async () => {
      await expect(merkleTree.add(ethers.ZeroHash, ethers.ZeroHash))
        .to.be.revertedWithCustomError(merkleTree, "NorFromEvidenceRegistry")
        .withArgs(USER.address);
      await expect(merkleTree.remove(ethers.ZeroHash))
        .to.be.revertedWithCustomError(merkleTree, "NorFromEvidenceRegistry")
        .withArgs(USER.address);
      await expect(merkleTree.update(ethers.ZeroHash, ethers.ZeroHash))
        .to.be.revertedWithCustomError(merkleTree, "NorFromEvidenceRegistry")
        .withArgs(USER.address);
    });
  });
});
