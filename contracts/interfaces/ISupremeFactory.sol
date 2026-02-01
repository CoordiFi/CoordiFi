// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISupremeFactory {
    function platformFeeBPS() external view returns (uint256);
    function feeCollector() external view returns (address);
    function recordSettlement(uint256 volume, uint256 fee) external;
}
