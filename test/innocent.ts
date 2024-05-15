import { Contract } from "ethers";
const MerkleTree = require("fixed-merkle-tree");
import { ethers } from "hardhat";
import { randomBytes } from "crypto";
import fs from "fs";
const circomlib = require("circomlib");
const snarkjs = require("snarkjs");

const stringifyBigInts =
  require("websnark/tools/stringifybigint").stringifyBigInts;
const unstringifyBigInts = require("websnark/tools/stringifybigint").unstringifyBigInts;
const websnarkUtils = require("websnark/src/utils");
const buildGroth16 = require("websnark/src/groth16");
const bigInt = snarkjs.bigInt;

describe("Innocent", function () {
  let tree: any;
  const levels = 20;
  const denomination = 100;
  const fee = 10;
  const refund = 0; // ?

  // Contract
  let ERC20Tornado: Contract;
  let verifier: Contract;
  let hasher: Contract;
  let ERC20: Contract;

  // Circuit
  let circuitW: any;

  // Utils crypto
  const proving_key = fs.readFileSync(
    "build/circuits/withdraw_proving_key.bin"
  ).buffer;
  const witness = fs.readFileSync("build/circuits/witness.json");
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

      const ERC20TornadoF = (await ethers.getContractFactory(
        "ERC20Tornado"
      )) as any;
      ERC20Tornado = await ERC20TornadoF.deploy(
        await verifier.getAddress(),
        await hasher.getAddress(),
        denomination,
        levels,
        await ERC20.getAddress()
      );

      const deposit1 = await generateDeposit();

      await ERC20.approve(await ERC20Tornado.getAddress(), denomination * 10);
      await ERC20.mint(accounts[0].address, denomination * 10);

      console.log(await ERC20.balanceOf(accounts[0].address));

      tree.insert(deposit1.commitment);

      console.log(toFixedHex(deposit1.commitment));
      await ERC20Tornado.deposit(toFixedHex(deposit1.commitment));

      console.log(await ERC20.balanceOf(accounts[0].address));

      const { pathElements, pathIndices } = tree.path(0);

      circuitW = require("../build/circuits/withdraw.json");

      // Circuit input
      // const input = stringifyBigInts({
      //   // public
      //   root: tree.root(),
      //   nullifierHash: await pedersenHash(deposit1.nullifier.leInt2Buff(31)),
      //   relayer: getRandomRecipient(), // relayer.address, // for fee
      //   recipient: getRandomRecipient(), // relayer.address, // to send the funds
      //   fee,
      //   refund,

      //   // private
      //   nullifier: deposit1.nullifier,
      //   secret: deposit1.secret,
      //   pathElements: pathElements,
      //   pathIndices: pathIndices,
      // });
      const input = {
        root: "14742856939716671848187704823288728685496731151468693957147091870453464986187",
        nullifierHash:
          "4223734878682561537668938943625891239493649540949835748024180426725704333416",
        relayer: "1007541003127319737265648226243546348715409454172",
        recipient: "654891529983040929899847612532402103775912841596",
        fee: 10,
        refund: 0,
        nullifier:
          "427831889929453771858091645589414833331666198793188109283358106222843136700",
        secret:
          "59882929749521293172156869593675750378523428216069724269670627875966046451",
        pathElements: [
          "21663839004416932945382355908790599225266501822907911457504978515578255421292",
          "16923532097304556005972200564242292693309333953544141029519619077135960040221",
          "7833458610320835472520144237082236871909694928684820466656733259024982655488",
          "14506027710748750947258687001455876266559341618222612722926156490737302846427",
          "4766583705360062980279572762279781527342845808161105063909171241304075622345",
          "16640205414190175414380077665118269450294358858897019640557533278896634808665",
          "13024477302430254842915163302704885770955784224100349847438808884122720088412",
          "11345696205391376769769683860277269518617256738724086786512014734609753488820",
          "17235543131546745471991808272245772046758360534180976603221801364506032471936",
          "155962837046691114236524362966874066300454611955781275944230309195800494087",
          "14030416097908897320437553787826300082392928432242046897689557706485311282736",
          "12626316503845421241020584259526236205728737442715389902276517188414400172517",
          "6729873933803351171051407921027021443029157982378522227479748669930764447503",
          "12963910739953248305308691828220784129233893953613908022664851984069510335421",
          "8697310796973811813791996651816817650608143394255750603240183429036696711432",
          "9001816533475173848300051969191408053495003693097546138634479732228054209462",
          "13882856022500117449912597249521445907860641470008251408376408693167665584212",
          "6167697920744083294431071781953545901493956884412099107903554924846764168938",
          "16572499860108808790864031418434474032816278079272694833180094335573354127261",
          "11544818037702067293688063426012553693851444915243122674915303779243865603077",
        ],
        pathIndices: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ],
      };

      console.log(input);

      console.log("Generate Proof...");
      const proofData = await websnarkUtils.genWitnessAndProve(
        groth16,
        input,
        circuitW,
        proving_key
      );

      const pkFile = "./build/circuits/withdraw_proving_key.json";
      const circuitFile = "./build/circuits/withdraw.json";
      const proofKey = 
        fs.readFileSync(pkFile, "utf8")
      ;

      const circuitDef = fs.readFileSync(circuitFile, "utf8");
      const circuit = new snarkjs.Circuit(circuitDef);
      const witness = circuit.calculateWitness(input);
      const { proof, publicSignals } = await snarkjs.groth.genProof(
        unstringifyBigInts(proofKey),
        unstringifyBigInts(witness)
      );
      console.log(proof);

      console.log("Proof generated !");
      console.log(proofData);
      const inputData = websnarkUtils.toSolidityInput(proofData);
      console.log(inputData);

      const args = [
        toFixedHex(input.root),
        toFixedHex(input.nullifierHash),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ];
      console.log(args);
      // const proofCLI = [
      // "0x2942e90832dd7be479c74dc8942f0fdd15f2ca10b4a15100e053f192e0ce1d14",
      // "0x2a357df2b833575f49dbed16501156b2c02fa5651b50baaea7069849dfbe5572"],
      // [
      //   ["0x0fbb32b1dd4473c598900f9dce8e1415a22545cee4e0bfb987e59b5ff7d55852", "0x2a5d0c9dbd74446dbda42703f5ab06f4335809536d89e12c8969c3b9dd7479c6"],
      //   ["0x241739ded55d11720420e8fbe8117894e8d41a6099e2623f8220cfbeaae3e09c", "0x1d975efc7bba1b9bae1204eab4f35a547bee20ccff22240b00fa17be0b9f1853"]
      // ],
      // ["0x071ebd1cabc17836468c3e584c0f16d7e5c9434d06bf770b6c7aa9176ac0fa1e", "0x2c201553837d3113c2d43c8a90ab12ea4b6dce1654c242df80051b19545451a3"],
      // ["0x2098294c651fe8987a00dd8e3d610209851dd8b403a0604e77486661dfae724b","0x09568c99e8a8a7a2777fa6d6f032e486e57d57c5a90f854cd9c292ca0577f868",
      // "0x00000000000000000000000072b65a12bdb6fb600d419a748b406f4daf70d17c","0x000000000000000000000000b07bb37d7eb5df64a8fa744a3328d44d6ea4b45c",
      // "0x000000000000000000000000000000000000000000000000000000000000000a","0x0000000000000000000000000000000000000000000000000000000000000000"]

      await ERC20Tornado.withdraw(inputData.proof, ...args);
      console.log(await ERC20.balanceOf(accounts[1].address));
    });
  });
});
