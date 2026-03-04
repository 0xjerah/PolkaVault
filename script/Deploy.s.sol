// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import {PolkaVault} from "../src/PolkaVault.sol";

contract DeployPolkaVault is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        PolkaVault vault = new PolkaVault();

        console.log("PolkaVault deployed at:", address(vault));
        console.log("Owner:", vault.owner());
        console.log("stDOT name:", vault.name());
        console.log("stDOT symbol:", vault.symbol());

        // Set unbonding period to 1 hour for testnet demo
        vault.setUnbondingPeriod(1 hours);
        console.log("Unbonding period set to 1 hour for testnet");

        vm.stopBroadcast();
    }
}
