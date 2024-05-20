import { ethers } from "hardhat";
import { groth16 } from "snarkjs";
import verificationKey from "../circuits/withdraw/verification_key.json";
import { expect } from "chai";
import { randomBytes } from "crypto";
// @ts-ignore TS7016
import * as ffjs from "ffjavascript";
// @ts-ignore TS7016
import * as circomlibjs from "circomlibjs";
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

describe("Innocent V2", function () {
  describe("Test proof", function () {
    it("Generate & Verify proof", async function () {
      // DEPLOY smart contracts verifier
      const facotry = await ethers.getContractFactory("Groth16VerifierV2");
      const verifier = await facotry.deploy();

      const tree = new MerkleTree(20);

      const deposit = await generateDeposit();

      tree.insert(deposit.commitment);
      const { pathElements, pathIndices } = tree.path(0);

      // Circuit input
      const input = {
        root: tree.root(),
        nullifierHash: deposit.nullifierHash,
        relayer: "1007541003127319737265648226243546348715409454172",
        recipient: "654891529983040929899847612532402103775912841596",
        fee: 10,
        refund: 0,
        nullifier: deposit.nullifier,
        secret: deposit.secret,
        pathElements: pathElements,
        pathIndices: pathIndices,
      };

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
    });
  });
});
