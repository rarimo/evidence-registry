import { ethers } from "ethers";

import { Poseidon } from "@iden3/js-crypto";

export function getIsolatedKey(address: string, key: string): string {
  return ethers.toBeHex(Poseidon.hash([BigInt(address), BigInt(key)]));
}
