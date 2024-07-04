// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "./MerkleTreeWithHistory.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "hardhat/console.sol";

interface IVerifier {
    function verifyProof(
        uint[2] memory _pA,
        uint[2][2] memory _pB,
        uint[2] memory _pC,
        uint256[6] memory _input
    ) external returns (bool);
}

contract Innocent is MerkleTreeWithHistory, ReentrancyGuard, ERC4626 {
    struct IProof {
        uint[2] _pA;
        uint[2][2] _pB;
        uint[2] _pC;
    }

    IVerifier public immutable verifier;

    mapping(bytes32 => bool) public nullifierHashes;

    uint256 public denomination;

    mapping(bytes32 => bool) public commitments;

    event Deposit(
        bytes32 indexed commitment,
        uint32 leafIndex,
        uint256 timestamp
    );
    event Withdrawal(address to, bytes32 nullifierHash, uint256 fee);

    /**
    @dev The constructor
    @param _verifier the address of SNARK verifier for this contract
    @param _hasher the address of MiMC hash contract
    @param _denomination transfer amount for each deposit
    @param _merkleTreeHeight the height of deposits' Merkle Tree
  */
    constructor(
        IVerifier _verifier,
        IHasher _hasher,
        uint256 _denomination,
        uint32 _merkleTreeHeight,
        IERC20 _token
    )
        MerkleTreeWithHistory(_merkleTreeHeight, _hasher)
        ERC4626(_token)
        ERC20("Innocent", "INN")
    {
        require(_denomination > 0, "denomination should be greater than 0");
        verifier = _verifier;
        denomination = _denomination;
    }

    function depositAsset(
        bytes32 _commitment,
        uint256 asset
    ) external nonReentrant {
        uint256 shares = deposit(asset, address(this));

        bytes32 _commitmentApp = bytes32(
            uint256(sha256(abi.encodePacked(_commitment, shares))) % FIELD_SIZE
        );

        require(
            !commitments[_commitmentApp],
            "The commitment has been submitted"
        );

        uint32 insertedIndex = _insert(_commitmentApp);
        commitments[_commitmentApp] = true;

        emit Deposit(_commitmentApp, insertedIndex, block.timestamp);
    }

    /**
    @dev Withdraw a deposit from the contract. `proof` is a zkSNARK proof data, and input is an array of circuit public inputs
    `input` array consists of:
      - merkle root of all deposits in the contract
      - hash of unique deposit nullifier to prevent double spends
      - the recipient of funds
      - optional fee that goes to the transaction sender (usually a relay)
  */
    function withdrawAsset(
        IProof calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        address payable _recipient,
        address payable _relayer,
        uint256 _fee,
        uint256 _refund
    ) external payable nonReentrant {
        require(_fee <= denomination, "Fee exceeds transfer value");
        require(
            !nullifierHashes[_nullifierHash],
            "The note has been already spent"
        );
        require(isKnownRoot(_root), "Cannot find your merkle root"); // Make sure to use a recent one
        require(
            verifier.verifyProof(
                _proof._pA,
                _proof._pB,
                _proof._pC,
                [
                    uint256(_root),
                    uint256(_nullifierHash),
                    uint256(uint160(address(_recipient))),
                    uint256(uint160(address(_relayer))),
                    _fee,
                    _refund
                ]
            ),
            "Invalid withdraw proof"
        );

        // TODO
        redeem(20, msg.sender, address(this));
        nullifierHashes[_nullifierHash] = true;

        emit Withdrawal(_recipient, _nullifierHash, _fee);
    }

    /** @dev See {IERC4626-redeem}. */
    // Overide ERC4626 redeem function because owner is not the msg.sender and we cant need to check allowance
    function redeem(uint256 shares, address receiver, address owner) public virtual override returns (uint256) {
        uint256 maxShares = maxRedeem(owner);
        if (shares > maxShares) {
            revert ERC4626ExceededMaxRedeem(owner, shares, maxShares);
        }

        uint256 assets = previewRedeem(shares);
        _withdraw(owner, receiver, owner, assets, shares);

        return assets;
    }
}
