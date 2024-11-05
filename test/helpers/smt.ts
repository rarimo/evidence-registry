import { ethers, toBeHex } from "ethers";

import { Hash, Merkletree, Proof } from "@iden3/js-merkletree";

import { IEvidenceDB } from "@ethers-v6";

export async function getRoot(tree: Merkletree): Promise<string> {
  return toBeHex((await tree.root()).bigInt(), 32);
}

export function getOnChainProof(onchainProof: IEvidenceDB.ProofStructOutput): Proof {
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
