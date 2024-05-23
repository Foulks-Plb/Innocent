## Circom c

# Compile
circom withdraw.circom --r1cs --wasm --sym --c

# Computing
node withdraw_js/generate_witness.js withdraw_js/withdraw.wasm input.json witness.wtns

# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```
