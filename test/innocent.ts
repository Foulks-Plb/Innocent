
import { Contract } from "ethers";
import { ethers } from "hardhat";
import { randomBytes } from "crypto";
//@ts-ignore TS7016
import * as snarkjs from "snarkjs";
import fs from "fs";
const circomlib = require("circomlib");
const MerkleTree = require("fixed-merkle-tree");
const stringifyBigInts =
  require("websnark/tools/stringifybigint").stringifyBigInts;
const websnarkUtils = require("websnark/src/utils");
const buildGroth16 = require('websnark/src/groth16');
const bigInt = snarkjs.bigInt;

describe("Innocent", function () {
  let tree: any;
  const levels = 20;
  const denomination = 100;
  const fee = 10;
  const refund = 0; // ?

  // Contract
  let ERC20Innocent: Contract;
  let verifier: Contract;
  let hasher: Contract;
  let ERC20: Contract;

  // Circuit
  let circuitW: any;

  // Utils crypto
  const proving_key = fs.readFileSync(
    "build/circuits/withdraw_proving_key.bin"
  ).buffer;

  const toFixedHex = (number: number, length = 32) =>
    "0x" +
    bigInt(number)
      .toString(16)
      .padStart(length * 2, "0");
  const rbigint = (nbytes: any) =>
    snarkjs.bigInt.leBuff2int(randomBytes(nbytes));
  const pedersenHash = async (data: any) => {
    return circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0];
  };

  const getRandomRecipient = () => rbigint(20);

  async function generateDeposit() {
    let deposit: any = {
      secret: rbigint(31),
      nullifier: rbigint(31),
    };
    const preimage = Buffer.concat([
      deposit.nullifier.leInt2Buff(31),
      deposit.secret.leInt2Buff(31),
    ]);
    deposit.commitment = await pedersenHash(preimage);
    return deposit;
  }

  describe("Deployment", function () {
    it("Set UP", async function () {
      tree = new MerkleTree(levels);
      const accounts = await ethers.getSigners();
      const relayer = accounts[1];
      const groth16 = await buildGroth16();

      // Deploy contract
      const HasherF = (await ethers.getContractFactory("Hasher")) as any;
      hasher = await HasherF.deploy();

      const VerifierF = (await ethers.getContractFactory("Verifier")) as any;
      verifier = await VerifierF.deploy();

      const ERC20F = (await ethers.getContractFactory("ERC20Mock")) as any;
      ERC20 = await ERC20F.deploy();

      const ERC20InnocentF = (await ethers.getContractFactory(
        "ERC20Innocent"
      )) as any;
      ERC20Innocent = await ERC20InnocentF.deploy(
        await verifier.getAddress(),
        await hasher.getAddress(),
        denomination,
        levels,
        await ERC20.getAddress()
      );

      const deposit1 = await generateDeposit();

      await ERC20.approve(await ERC20Innocent.getAddress(), denomination * 10);
      await ERC20.mint(accounts[0].address, denomination * 10);

      tree.insert(deposit1.commitment);
      await ERC20Innocent.deposit(toFixedHex(deposit1.commitment));

      const { pathElements, pathIndices } = tree.path(0);

      // Circuit input
      const input = stringifyBigInts({
        // public
        root: tree.root(),
        nullifierHash: await pedersenHash(deposit1.nullifier.leInt2Buff(31)),
        relayer: relayer.address, // for fee
        recipient: relayer.address, // to send the funds
        fee,
        refund,

        // private
        nullifier: deposit1.nullifier,
        secret: deposit1.secret,
        pathElements: pathElements,
        pathIndices: pathIndices,
      });

      console.log("Generating proof...");
      circuitW = require("../build/circuits/withdraw.json");
      const proofData = await websnarkUtils.genWitnessAndProve(
        groth16,
        input,
        circuitW,
        proving_key
      );

      const inputData = websnarkUtils.toSolidityInput(proofData);
      const args = [
        toFixedHex(input.root),
        toFixedHex(input.nullifierHash),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ];

      await ERC20Innocent.withdraw(inputData.proof, ...args);
    });
  });
});
