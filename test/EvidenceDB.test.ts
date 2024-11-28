import { ethers } from "hardhat";
import { expect } from "chai";

import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { LocalStorageDB, Merkletree, str2Bytes } from "@iden3/js-merkletree";

import { MERKLE_TREE_DEPTH } from "@/scripts/constants";

import { Reverter, getPoseidon, poseidonHash, getRoot, getOnChainProof } from "@test-helpers";

import { EvidenceDB } from "@ethers-v6";

import "mock-local-storage";

describe("EvidenceDB", () => {
  const reverter = new Reverter();

  let USER: SignerWithAddress;
  let REGISTRY: SignerWithAddress;

  let evidenceDB: EvidenceDB;

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
    evidenceDB = await EvidenceDB.deploy();

    await evidenceDB.__EvidenceDB_init(REGISTRY.address, MERKLE_TREE_DEPTH);

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

  describe("#Initialization", () => {
    it("should revert if trying to initialize twice", async () => {
      await expect(evidenceDB.__EvidenceDB_init(REGISTRY.address, MERKLE_TREE_DEPTH))
        .to.be.revertedWithCustomError(evidenceDB, "InvalidInitialization")
        .withArgs();
    });

    it("should correctly initialize the tree", async () => {
      expect(await evidenceDB.getEvidenceRegistry()).to.equal(REGISTRY.address);

      expect(await evidenceDB.getMaxHeight()).to.equal(MERKLE_TREE_DEPTH);
    });
  });

  describe("#Basic functionality", () => {
    it("should add element to the tree", async () => {
      expect(await evidenceDB.getRoot()).to.equal(ethers.ZeroHash);

      const value = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
      const key = poseidonHash(value);

      await evidenceDB.connect(REGISTRY).add(key, value);
      await localMerkleTree.add(BigInt(key), BigInt(value));

      expect(await evidenceDB.getValue(key)).to.equal(value);
      expect(await evidenceDB.getRoot()).to.equal(await getRoot(localMerkleTree));
      expect(getOnChainProof(await evidenceDB.getProof(key))).to.deep.equal(
        (await localMerkleTree.generateProof(BigInt(key))).proof,
      );
      expect(await evidenceDB.getSize()).to.equal(1);
    });

    it("should correctly build the tree with multiple elements", async () => {
      let key;
      let value;

      for (let i = 0; i < 10; i++) {
        value = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
        key = poseidonHash(value);

        await evidenceDB.connect(REGISTRY).add(key, value);
        await localMerkleTree.add(BigInt(key), BigInt(value));
      }

      expect(await evidenceDB.getValue(key!)).to.equal(value);
      expect(await evidenceDB.getRoot()).to.equal(await getRoot(localMerkleTree));
      expect(getOnChainProof(await evidenceDB.getProof(key!))).to.deep.equal(
        (await localMerkleTree.generateProof(BigInt(key!))).proof,
      );
    });

    it("should remove element from the tree", async () => {
      const value = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
      const key = poseidonHash(value);

      await evidenceDB.connect(REGISTRY).add(key, value);
      await evidenceDB.connect(REGISTRY).remove(key);

      expect(await evidenceDB.getValue(key)).to.equal(ethers.ZeroHash);
    });

    it("should update element in the tree", async () => {
      const value = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
      const key = poseidonHash(value);

      await evidenceDB.connect(REGISTRY).add(key, value);

      expect(await evidenceDB.getValue(key)).to.equal(value);

      const newValue = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
      await evidenceDB.connect(REGISTRY).update(key, newValue);

      expect(await evidenceDB.getValue(key)).to.equal(newValue);
    });

    it("should revert if trying to add/remove/update element in the try by not a registry", async () => {
      await expect(evidenceDB.add(ethers.ZeroHash, ethers.ZeroHash))
        .to.be.revertedWithCustomError(evidenceDB, "NotFromEvidenceRegistry")
        .withArgs(USER.address);
      await expect(evidenceDB.remove(ethers.ZeroHash))
        .to.be.revertedWithCustomError(evidenceDB, "NotFromEvidenceRegistry")
        .withArgs(USER.address);
      await expect(evidenceDB.update(ethers.ZeroHash, ethers.ZeroHash))
        .to.be.revertedWithCustomError(evidenceDB, "NotFromEvidenceRegistry")
        .withArgs(USER.address);
    });
  });
});
