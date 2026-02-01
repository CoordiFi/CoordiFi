// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract SmartMintWallet is IERC721Receiver {
    address public immutable escrowContract;
    address public immutable nftContract;
    bool public mintExecuted;
    uint256 public mintedTokenId;

    event MintExecuted(uint256 indexed tokenId, address indexed escrow);
    event ETHReceived(address indexed from, uint256 amount);

    error OnlyEscrow();
    error AlreadyMinted();
    error MintFailed();

    constructor(address _escrow, address _nft) {
        escrowContract = _escrow;
        nftContract = _nft;
    }

    function executeMint(bytes calldata mintData) external payable {
        if (msg.sender != escrowContract) revert OnlyEscrow();
        if (mintExecuted) revert AlreadyMinted();

        (bool success, ) = nftContract.call{value: msg.value}(mintData);
        if (!success) revert MintFailed();

        uint256 balance = IERC721(nftContract).balanceOf(address(this));
        require(balance > 0, "No NFT received");

        mintExecuted = true;
        emit MintExecuted(0, escrowContract);
    }

    function transferToEscrow(uint256 tokenId) external {
        if (msg.sender != escrowContract) revert OnlyEscrow();
        mintedTokenId = tokenId;
        IERC721(nftContract).safeTransferFrom(
            address(this),
            escrowContract,
            tokenId
        );
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    receive() external payable {
        emit ETHReceived(msg.sender, msg.value);
    }
}
