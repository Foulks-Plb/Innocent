# Circom c

## Compile
circom withdraw.circom --r1cs --wasm --sym --c

## Computing witness
node withdraw_js/generate_witness.js withdraw_js/withdraw.wasm input.json witness.wtns

## powers of tau
snarkjs powersoftau new bn128 18 pot12_0000.ptau -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
snarkjs groth16 setup withdraw.r1cs pot12_final.ptau withdraw_0000.zkey
snarkjs zkey contribute withdraw_0000.zkey withdraw_0001.zkey --name="1st Contributor Name" -v
snarkjs zkey export verificationkey withdraw_0001.zkey verification_key.json

## Generate proof
snarkjs groth16 prove withdraw_0001.zkey witness.wtns proof.json public.json

## Verify proof
snarkjs groth16 verify verification_key.json public.json proof.json

## Generate solidity verifier
snarkjs zkey export solidityverifier withdraw_0001.zkey verifier.sol
snarkjs generatecall

## Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```
