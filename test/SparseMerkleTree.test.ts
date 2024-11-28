import { toBeHex } from "ethers";
import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { LocalStorageDB, Merkletree, str2Bytes, verifyProof } from "@iden3/js-merkletree";

import { Reverter, getPoseidon, poseidonHash, getOnChainProof, getRoot } from "@test-helpers";

import { MERKLE_TREE_DEPTH } from "@/scripts/constants";

import { IEvidenceDB, SparseMerkleTreeMock } from "@ethers-v6";

import "mock-local-storage";
import { SparseMerkleTree } from "@/generated-types/ethers/contracts/mocks/SparseMerkleTreeMock";

describe("SparseMerkleTree", () => {
  const reverter = new Reverter();

  let USER1: SignerWithAddress;

  let merkleTree: SparseMerkleTreeMock;

  let storage: LocalStorageDB;

  let localMerkleTree: Merkletree;

  before("setup", async () => {
    [USER1] = await ethers.getSigners();

    const SparseMerkleTreeMock = await ethers.getContractFactory("SparseMerkleTreeMock", {
      libraries: {
        PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
        PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
      },
    });
    merkleTree = await SparseMerkleTreeMock.deploy();

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

  async function compareNodes(node: SparseMerkleTree.NodeStructOutput, key: bigint) {
    const localNode = await localMerkleTree.get(key);

    expect(node.key).to.equal(toBeHex(localNode.key, 32));
    expect(node.value).to.equal(toBeHex(localNode.value, 32));
  }

  describe("#Initialization", () => {
    it("should initialize tree with provided max depth", async () => {
      await merkleTree.initializeTree(MERKLE_TREE_DEPTH);

      expect(await merkleTree.getMaxDepth()).to.equal(MERKLE_TREE_DEPTH);
    });

    it("should not initialize twice", async () => {
      await merkleTree.initializeTree(MERKLE_TREE_DEPTH);

      await expect(merkleTree.initializeTree(MERKLE_TREE_DEPTH))
        .to.be.revertedWithCustomError(merkleTree, "TreeAlreadyInitialized")
        .withArgs();
    });

    it("should set Poseidon hasher", async () => {
      await merkleTree.setPoseidonHasher();

      expect(await merkleTree.isCustomHasherSet()).to.be.true;
    });

    it("should revert if trying to set incorrect max depth", async () => {
      await merkleTree.setMaxDepthTree(MERKLE_TREE_DEPTH);

      await expect(merkleTree.setMaxDepthTree(0))
        .to.be.revertedWithCustomError(merkleTree, "MaxDepthIsZero")
        .withArgs();

      await expect(merkleTree.setMaxDepthTree(MERKLE_TREE_DEPTH - 1))
        .to.be.revertedWithCustomError(merkleTree, "NewMaxDepthMustBeLarger")
        .withArgs(merkleTree.getMaxDepth(), MERKLE_TREE_DEPTH - 1);

      await expect(merkleTree.setMaxDepthTree(300))
        .to.be.revertedWithCustomError(merkleTree, "MaxDepthExceedsHardCap")
        .withArgs(300);
    });

    it("should set max depth bigger than the current one", async () => {
      await merkleTree.setMaxDepthTree(MERKLE_TREE_DEPTH);

      await merkleTree.setMaxDepthTree(MERKLE_TREE_DEPTH + 1);

      expect(await merkleTree.getMaxDepth()).to.equal(MERKLE_TREE_DEPTH + 1);
    });

    it("should revert if trying to call add/remove/update functions on non-initialized tree", async () => {
      const SparseMerkleTreeMock = await ethers.getContractFactory("SparseMerkleTreeMock", {
        libraries: {
          PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
          PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
        },
      });
      const newMerkleTree = await SparseMerkleTreeMock.deploy();

      await expect(newMerkleTree.add(ethers.ZeroHash, ethers.ZeroHash))
        .to.be.revertedWithCustomError(merkleTree, "TreeNotInitialized")
        .withArgs();

      await expect(newMerkleTree.remove(ethers.ZeroHash))
        .to.be.revertedWithCustomError(merkleTree, "TreeNotInitialized")
        .withArgs();

      await expect(newMerkleTree.update(ethers.ZeroHash, ethers.ZeroHash))
        .to.be.revertedWithCustomError(merkleTree, "TreeNotInitialized")
        .withArgs();
    });
  });

  describe("#Basic functionality", () => {
    beforeEach("setup", async () => {
      await merkleTree.initializeTree(MERKLE_TREE_DEPTH);
      await merkleTree.setPoseidonHasher();
    });

    it("should add one element to the tree and update root", async () => {
      const value = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
      const key = poseidonHash(value);

      expect(await merkleTree.getRoot()).to.equal(await getRoot(localMerkleTree));

      await merkleTree.add(key, value);
      await localMerkleTree.add(BigInt(key), BigInt(value));

      expect(await merkleTree.getRoot()).to.equal(await getRoot(localMerkleTree));
      expect(await merkleTree.getNodesCount()).to.equal(1);

      await compareNodes(await merkleTree.getNode(1), BigInt(key));
      await compareNodes(await merkleTree.getNodeByKey(key), BigInt(key));

      const onChainProof = getOnChainProof(await merkleTree.getProof(key));

      expect(await verifyProof(await localMerkleTree.root(), onChainProof, BigInt(key), BigInt(value))).to.be.true;
    });

    it("should revert when trying to set custom hasher on non-empty tree", async () => {
      await merkleTree.add(ethers.ZeroHash, ethers.ZeroHash);

      await expect(merkleTree.setPoseidonHasher())
        .to.be.revertedWithCustomError(merkleTree, "TreeIsNotEmpty")
        .withArgs();
    });

    it("should add several elements to the tree", async () => {
      for (let i = 1n; i < 20n; i++) {
        const value = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
        const key = poseidonHash(value);

        await merkleTree.add(key, value);
        await localMerkleTree.add(BigInt(key), BigInt(value));

        expect(await merkleTree.getRoot()).to.equal(await getRoot(localMerkleTree));

        await compareNodes(await merkleTree.getNodeByKey(key), BigInt(key));

        const onChainProof = getOnChainProof(await merkleTree.getProof(key));
        expect(await verifyProof(await localMerkleTree.root(), onChainProof, BigInt(key), BigInt(value))).to.be.true;
      }
    });

    it("should add and remove all elements from the tree", async () => {
      const keys: string[] = [];

      for (let i = 1n; i < 20n; i++) {
        const value = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
        const key = poseidonHash(value);

        await merkleTree.add(key, value);

        keys.push(key);
      }

      for (let i = 1n; i < 20n; i++) {
        const key = toBeHex(keys[Number(i) - 1], 32);

        await merkleTree.remove(key);
      }

      expect(await merkleTree.getRoot()).to.equal(ethers.ZeroHash);
      expect(await merkleTree.getNodesCount()).to.equal(0);
    });

    it("should maintain the property of idempotence", async () => {
      const keys: string[] = [];
      let proof: IEvidenceDB.ProofStructOutput = {} as any;

      for (let i = 1n; i < 20n; i++) {
        const value = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
        const key = poseidonHash(value);

        await merkleTree.add(key, value);

        if (i > 1n) {
          await merkleTree.remove(key);

          const hexKey = toBeHex(keys[Number(i - 2n)], 32);
          expect(await merkleTree.getProof(hexKey)).to.deep.equal(proof);

          await merkleTree.add(key, value);
        }

        proof = await merkleTree.getProof(key);

        keys.push(key);
      }

      for (let key of keys) {
        const hexKey = toBeHex(key, 32);
        const value = (await merkleTree.getNodeByKey(hexKey)).value;

        proof = await merkleTree.getProof(hexKey);

        await merkleTree.remove(hexKey);
        await merkleTree.add(hexKey, value);

        expect(await merkleTree.getProof(hexKey)).to.deep.equal(proof);
      }
    });

    it("should rebalance elements in Merkle Tree correctly", async () => {
      const expectedRoot = "0x2f9bbaa7ab83da6e8d1d8dd05bac16e65fa40b4f6455c1d2ee77e968dfc382dc";
      const keys = [toBeHex(7n, 32), toBeHex(1n, 32), toBeHex(5n, 32)];

      for (let key of keys) {
        await merkleTree.add(toBeHex(key, 32), key);
      }

      const oldRoot = await merkleTree.getRoot();

      expect(oldRoot).to.equal(expectedRoot);
      expect(await merkleTree.getNodesCount()).to.equal(6);

      for (let key of keys) {
        const hexKey = toBeHex(key, 32);

        await merkleTree.remove(hexKey);
        await merkleTree.add(hexKey, key);
      }

      expect(await merkleTree.getRoot()).to.equal(oldRoot);
      expect(await merkleTree.getNodesCount()).to.equal(6);
    });

    it("should not remove non-existent leaves", async () => {
      const keys = [toBeHex(7n, 32), toBeHex(1n, 32), toBeHex(5n, 32)];

      for (let key of keys) {
        await merkleTree.add(toBeHex(key, 32), key);
      }

      await expect(merkleTree.remove(toBeHex(8, 32)))
        .to.be.revertedWithCustomError(merkleTree, "NodeDoesNotExist")
        .withArgs(0);

      await expect(merkleTree.remove(toBeHex(9, 32)))
        .to.be.revertedWithCustomError(merkleTree, "LeafDoesNotMatch")
        .withArgs(toBeHex(1, 32), toBeHex(9, 32));
    });

    it("should update existing leaves", async () => {
      const keys = [];

      for (let i = 1n; i < 20n; i++) {
        const value = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
        const key = poseidonHash(value);

        await merkleTree.add(key, value);
        await localMerkleTree.add(BigInt(key), BigInt(value));

        keys.push(key);
      }

      for (let i = 1n; i < 20n; i++) {
        const value = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
        const key = keys[Number(i) - 1];

        await merkleTree.update(key, value);
        await localMerkleTree.update(BigInt(key), BigInt(value));

        expect(await merkleTree.getRoot()).to.equal(await getRoot(localMerkleTree));

        await compareNodes(await merkleTree.getNodeByKey(key), BigInt(key));

        const onChainProof = getOnChainProof(await merkleTree.getProof(key));
        expect(await verifyProof(await localMerkleTree.root(), onChainProof, BigInt(key), BigInt(value))).to.be.true;
      }
    });

    it("should not update non-existent leaves", async () => {
      const keys = [toBeHex(7n, 32), toBeHex(1n, 32), toBeHex(5n, 32)];

      for (let key of keys) {
        const hexKey = toBeHex(key, 32);

        await merkleTree.add(hexKey, key);
      }

      await expect(merkleTree.update(toBeHex(8, 32), toBeHex(1n, 32)))
        .to.be.revertedWithCustomError(merkleTree, "NodeDoesNotExist")
        .withArgs(0);

      await expect(merkleTree.update(toBeHex(9, 32), toBeHex(1n, 32)))
        .to.be.revertedWithCustomError(merkleTree, "LeafDoesNotMatch")
        .withArgs(toBeHex(1, 32), toBeHex(9, 32));
    });

    it("should generate empty proof on empty tree", async () => {
      const onChainProof = getOnChainProof(await merkleTree.getProof(toBeHex(1n, 32)));

      expect(onChainProof.allSiblings()).to.have.length(0);
    });

    it("should generate an empty proof for but with aux fields", async () => {
      await merkleTree.add(toBeHex(7n, 32), toBeHex(1n, 32));

      const onChainProof = await merkleTree.getProof(toBeHex(5n, 32));

      expect(onChainProof.auxKey).to.equal(7n);
      expect(onChainProof.auxValue).to.equal(1n);
      expect(onChainProof.auxExistence).to.equal(true);
      expect(onChainProof.existence).to.equal(false);
    });

    it("should generate non-membership proof (empty node and different node)", async () => {
      await localMerkleTree.add(3n, 15n); // key -> 0b011
      await localMerkleTree.add(7n, 15n); // key -> 0b111

      await merkleTree.add(toBeHex(3n, 32), toBeHex(15n, 32));
      await merkleTree.add(toBeHex(7n, 32), toBeHex(15n, 32));

      let onChainProof = getOnChainProof(await merkleTree.getProof(toBeHex(5n, 32)));
      expect(await verifyProof(await localMerkleTree.root(), onChainProof, 5n, 0n)).to.be.true;

      onChainProof = getOnChainProof(await merkleTree.getProof(toBeHex(15n, 32)));
      expect(await verifyProof(await localMerkleTree.root(), onChainProof, 15n, 15n)).to.be.true;
    });

    it("should revert if trying to add a node with the same key", async () => {
      const value = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
      const key = poseidonHash(value);

      await merkleTree.add(key, value);

      await expect(merkleTree.add(key, value))
        .to.be.revertedWithCustomError(merkleTree, "KeyAlreadyExists")
        .withArgs(key);
    });

    it("should revert if max depth is reached", async () => {
      const SparseMerkleTreeMock = await ethers.getContractFactory("SparseMerkleTreeMock", {
        libraries: {
          PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
          PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
        },
      });
      const newMerkleTree = await SparseMerkleTreeMock.deploy();

      await newMerkleTree.initializeTree(1);

      await newMerkleTree.add(toBeHex(1n, 32), toBeHex(1n, 32));
      await newMerkleTree.add(toBeHex(2n, 32), toBeHex(1n, 32));

      await expect(newMerkleTree.add(toBeHex(3n, 32), toBeHex(1n, 32)))
        .to.be.revertedWithCustomError(merkleTree, "MaxDepthReached")
        .withArgs();
    });

    it("should get empty Node by non-existing key", async () => {
      expect((await merkleTree.getNodeByKey(toBeHex(1n, 32))).nodeType).to.be.equal(0);

      await merkleTree.add(toBeHex(7n, 32), toBeHex(1n, 32));

      expect((await merkleTree.getNodeByKey(toBeHex(5n, 32))).nodeType).to.be.equal(0);
    });
  });
});
