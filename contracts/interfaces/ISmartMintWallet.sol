// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISmartMintWallet {
    event MintExecuted(uint256 indexed tokenId, address indexed escrow);
    event ETHReceived(address indexed from, uint256 amount);

    function escrowContract() external view returns (address);
    function nftContract() external view returns (address);
    function mintExecuted() external view returns (bool);
    function mintedTokenId() external view returns (uint256);

    function executeMint(bytes calldata mintData) external payable;
    function transferToEscrow(uint256 tokenId) external;
}
