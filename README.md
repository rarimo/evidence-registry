[![npm](https://img.shields.io/npm/v/@rarimo/evidence-registry.svg)](https://www.npmjs.com/package/@rarimo/evidence-registry)

# ERC-7812 Reference Implementation

This EIP introduces an on-chain registry system for storing abstract statements, where the state of the system can be proven in zero knowledge without disclosing anything about these statements. Developers may use the singleton `EvidenceRegistry` contract to integrate custom business-specific registrars for statement processing and proving.

Link to the [ERC-7812](https://ethereum-magicians.org/t/erc-7812-zk-identity-registry/21624).

## Usage

You will find Solidity smart contracts implementation in the `contracts` directory and Circom circuits in the `circuits` directory.

Install all the required dependencies:

```bash
npm install
```

The proper tests have been written for both the smart contracts and circuits leveraging [hardhat-zkit](https://github.com/dl-solarity/hardhat-zkit).

To run the all the tests, execute:

```bash
npm run test-all
```

## Deployment

The `EvidenceRegistry` is deployed via a [deterministic factory](https://github.com/Arachnid/deterministic-deployment-proxy) to the address `0x781247B377c6D745d40798121Db9C52F3E5a7812`.

To reproduce the deployment on other chains, run `npx hardhat compile && npx hardhat run ./scripts/deploy.ts --network <network>`.

> [!IMPORTANT]
> Do not modify the code, lint solidity files, or update compiler / hardhat settings as this will change the smart contracts bytecode.

## Disclaimer

GLHF!
