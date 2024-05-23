import { ethers } from "hardhat";
import { groth16 } from "snarkjs";
import { expect } from "chai";
import { randomBytes } from "crypto";
// @ts-ignore TS7016
import * as ffjs from "ffjavascript";
// @ts-ignore TS7016
import * as circomlibjs from "circomlibjs";
import verificationKey from "../circuits/withdraw/verification_key.json";
const MerkleTree = require("fixed-merkle-tree");

const rbigint = (nbytes: number) => ffjs.utils.leBuff2int(randomBytes(nbytes));

export function toFixedHex(value: any, length = 32) {
  return "0x" + value.toString(16).padStart(length * 2, "0");
}

async function generateDeposit() {
  let deposit: any = {
    secret: rbigint(31),
    nullifier: rbigint(31),
  };
  const preimage = Buffer.concat([
    ffjs.utils.leInt2Buff(deposit.nullifier, 31),
    ffjs.utils.leInt2Buff(deposit.secret, 31),
  ]);
  deposit.commitment = await pedersenHash(preimage);

  deposit.appCommitment =
    BigInt(
      ethers.solidityPackedSha256(
        ["uint256", "uint256", "uint256"],
        [deposit.commitment, 100, 20]
      )
    ) % FIELD_SIZE;
  deposit.nullifierHash = await pedersenHash(
    ffjs.utils.leInt2Buff(deposit.nullifier, 31)
  );
  return deposit;
}

const pedersenHash = async (data: any) => {
  const babyJubJub = await circomlibjs.buildBabyjub();
  const pedersenHash = await circomlibjs.buildPedersenHash();
  return babyJubJub.F.toObject(
    babyJubJub.unpackPoint(Buffer.from(pedersenHash.hash(data)))[0]
  );
};

const FIELD_SIZE = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

let accounts: any;
let hasher: any;
let verifier: any;
let ERC20: any;
let ERC20Innocent: any;

describe("Innocent V2", function () {
  describe("Test proof", function () {
    const denomination = 100;

    this.beforeAll(async function () {
      accounts = await ethers.getSigners();

      // Deploy contract
      const HasherF = (await ethers.getContractFactory("Hasher")) as any;
      hasher = await HasherF.deploy();

      const verifierF = await ethers.getContractFactory("Groth16VerifierV2");
      verifier = await verifierF.deploy();

      const ERC20F = (await ethers.getContractFactory("ERC20Mock")) as any;
      ERC20 = await ERC20F.deploy();

      const ERC20InnocentF = (await ethers.getContractFactory(
        "ERC20Innocent"
      )) as any;
      ERC20Innocent = await ERC20InnocentF.deploy(
        await verifier.getAddress(),
        await hasher.getAddress(),
        denomination,
        20,
        await ERC20.getAddress()
      );
    });

    it("Generate fake ERC20", async function () {
      await ERC20.approve(await ERC20Innocent.getAddress(), denomination * 10);
      await ERC20.mint(accounts[0].address, denomination * 10);
    });

    it("Generate proof & Withdraw", async function () {
      const tree = new MerkleTree(20);

      const deposit = await generateDeposit();

      await ERC20Innocent.deposit(toFixedHex(deposit.commitment));
      console.log(toFixedHex(deposit.appCommitment));
      tree.insert(deposit.appCommitment);

      const { pathElements, pathIndices } = tree.path(0);

      // Circuit input
      const input = {
        root: tree.root(),
        nullifierHash: deposit.nullifierHash,
        relayer: accounts[0].address,
        recipient: accounts[0].address,
        fee: 10,
        refund: 0,
        nullifier: deposit.nullifier,
        secret: deposit.secret,
        pathElements: pathElements,
        pathIndices: pathIndices,
        feesGroth: 100,
        share: 20,
      };

      console.log("Input", input);

      return;
      console.log("Generating proof...");
      const { proof, publicSignals } = await groth16.fullProve(
        input,
        "./circuits/withdraw/withdraw.wasm",
        "./circuits/withdraw/withdraw_0001.zkey"
      );
      console.log("Proof generated!");

      console.log("Verify Proof!");
      const isValid = await groth16.verify(
        verificationKey,
        publicSignals,
        proof
      );
      expect(isValid).to.be.true;

      const callData = await groth16.exportSolidityCallData(
        proof,
        publicSignals
      );
      const args = JSON.parse("[" + callData + "]");
      const verify = await verifier.verifyProof(
        args[0],
        args[1],
        args[2],
        publicSignals
      );
      expect(verify).to.be.true;

      console.log("On Chain call");
      await ERC20Innocent.withdraw(
        {
          _pA: args[0],
          _pB: args[1],
          _pC: args[2],
        },
        args[3][0],
        args[3][1],
        input.relayer,
        input.recipient,
        input.fee,
        input.refund
      );
    });
  });
});
