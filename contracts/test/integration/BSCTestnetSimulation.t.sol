// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PNGYVault} from "../../src/PNGYVault.sol";
import {AssetRegistry} from "../../src/AssetRegistry.sol";
import {OracleAdapter} from "../../src/OracleAdapter.sol";
import {SwapHelper} from "../../src/SwapHelper.sol";
import {RebalanceStrategy} from "../../src/RebalanceStrategy.sol";
import {ERC20Mock} from "../mocks/ERC20Mock.sol";
import {MockPancakeRouter} from "../mocks/MockPancakeRouter.sol";
import {MockOracleAdapter} from "../mocks/MockOracleAdapter.sol";

/// @title BSC Testnet Simulation Test
/// @notice Simulates full BSC testnet deployment and validates all flows
contract BSCTestnetSimulationTest is Test {
    // =============================================================================
    // State - Protocol Contracts
    // =============================================================================

    PNGYVault public vault;
    AssetRegistry public assetRegistry;
    OracleAdapter public oracleAdapter;
    SwapHelper public swapHelper;
    RebalanceStrategy public rebalanceStrategy;

    // Mock infrastructure
    MockPancakeRouter public router;
    MockOracleAdapter public mockOracle;

    // Tokens
    ERC20Mock public usdt;
    ERC20Mock public rwaBond;
    ERC20Mock public rwaStock;

    // Addresses
    address public admin = makeAddr("admin");
    address public rebalancer = makeAddr("rebalancer");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");

    // Constants
    uint256 public constant INITIAL_BALANCE = 1_000_000e18;
    uint256 public constant MIN_DEPOSIT = 500e18;
    uint256 public constant DEFAULT_SLIPPAGE = 100; // 1%

    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");

    // Gas tracking
    uint256 public depositGas;
    uint256 public withdrawGas;
    uint256 public rebalanceGas;

    // =============================================================================
    // Setup
    // =============================================================================

    function setUp() public {
        // Set reasonable timestamp
        vm.warp(1700000000);

        // Deploy mock tokens
        usdt = new ERC20Mock("Tether USD", "USDT", 18);
        rwaBond = new ERC20Mock("RWA Bond Token", "RWAB", 18);
        rwaStock = new ERC20Mock("RWA Stock Token", "RWAS", 18);

        // Deploy mock infrastructure
        router = new MockPancakeRouter();
        mockOracle = new MockOracleAdapter();

        // Deploy protocol contracts
        vm.startPrank(admin);

        assetRegistry = new AssetRegistry(admin);
        oracleAdapter = new OracleAdapter(admin);
        swapHelper = new SwapHelper(address(router), admin, DEFAULT_SLIPPAGE);
        rebalanceStrategy = new RebalanceStrategy(admin, 50); // 50% APY sensitivity
        vault = new PNGYVault(IERC20(address(usdt)), admin);

        // Configure vault
        vault.setAssetRegistry(address(assetRegistry));
        vault.setOracleAdapter(address(mockOracle));
        vault.setSwapHelper(address(swapHelper));

        // Grant rebalancer role
        vault.grantRole(REBALANCER_ROLE, rebalancer);

        // Register assets
        assetRegistry.registerAsset(
            address(rwaBond),
            AssetRegistry.AssetType.TOKENIZED_BOND,
            address(mockOracle)
        );
        assetRegistry.registerAsset(
            address(rwaStock),
            AssetRegistry.AssetType.TOKENIZED_STOCK,
            address(mockOracle)
        );

        // Add RWA assets to vault
        vault.addRWAAsset(address(rwaBond), 6000);  // 60%
        vault.addRWAAsset(address(rwaStock), 4000); // 40%

        vm.stopPrank();

        // Configure oracle prices
        mockOracle.setPrice(address(rwaBond), 1e18);  // $1
        mockOracle.setPrice(address(rwaStock), 2e18); // $2

        // Configure exchange rates
        router.setExchangeRate(address(usdt), address(rwaBond), 1e18);
        router.setExchangeRate(address(usdt), address(rwaStock), 0.5e18);
        router.setExchangeRate(address(rwaBond), address(usdt), 1e18);
        router.setExchangeRate(address(rwaStock), address(usdt), 2e18);

        // Fund router
        usdt.mint(address(router), INITIAL_BALANCE * 100);
        rwaBond.mint(address(router), INITIAL_BALANCE * 100);
        rwaStock.mint(address(router), INITIAL_BALANCE * 100);

        // Fund users
        usdt.mint(user1, INITIAL_BALANCE);
        usdt.mint(user2, INITIAL_BALANCE);

        // User approvals
        vm.prank(user1);
        usdt.approve(address(vault), type(uint256).max);
        vm.prank(user2);
        usdt.approve(address(vault), type(uint256).max);
    }

    // =============================================================================
    // Full Flow Tests
    // =============================================================================

    function test_FullFlow_Deposit_Withdraw() public {
        console2.log("\n=== Full Flow Test: Deposit -> Withdraw ===\n");

        uint256 depositAmount = 10_000e18; // $10,000

        // === DEPOSIT ===
        console2.log("1. User deposits $10,000 USDT");
        uint256 usdtBefore = usdt.balanceOf(user1);

        vm.prank(user1);
        uint256 gasBefore = gasleft();
        uint256 shares = vault.deposit(depositAmount, user1);
        depositGas = gasBefore - gasleft();

        console2.log("   Shares received:", shares / 1e18);
        console2.log("   Gas used:", depositGas);

        // Verify RWA purchases
        uint256 bondBalance = rwaBond.balanceOf(address(vault));
        uint256 stockBalance = rwaStock.balanceOf(address(vault));
        console2.log("   Vault RWA Bond balance:", bondBalance / 1e18);
        console2.log("   Vault RWA Stock balance:", stockBalance / 1e18);

        assertGt(bondBalance, 0, "Should have purchased RWA bonds");
        assertGt(stockBalance, 0, "Should have purchased RWA stocks");

        // === CHECK NAV ===
        console2.log("\n2. Checking NAV and share price");
        uint256 totalAssets = vault.totalAssets();
        uint256 sharePrice = vault.sharePrice();
        console2.log("   Total assets:", totalAssets / 1e18);
        console2.log("   Share price:", sharePrice / 1e18);

        // === WITHDRAW ===
        console2.log("\n3. User withdraws 50% of shares");
        uint256 sharesToRedeem = shares / 2;

        vm.prank(user1);
        gasBefore = gasleft();
        uint256 assetsReceived = vault.redeem(sharesToRedeem, user1, user1);
        withdrawGas = gasBefore - gasleft();

        console2.log("   Assets received:", assetsReceived / 1e18);
        console2.log("   Gas used:", withdrawGas);

        uint256 usdtAfter = usdt.balanceOf(user1);
        console2.log("   User USDT balance change:", (usdtAfter - (usdtBefore - depositAmount)) / 1e18);

        assertGt(assetsReceived, 0, "Should receive assets");

        console2.log("\n=== Gas Summary ===");
        console2.log("   Deposit gas:", depositGas);
        console2.log("   Withdraw gas:", withdrawGas);
    }

    function test_Slippage_1K_Deposit() public {
        _testDepositWithAmount(1_000e18, "1K");
    }

    function test_Slippage_10K_Deposit() public {
        _testDepositWithAmount(10_000e18, "10K");
    }

    function test_Slippage_100K_Deposit() public {
        _testDepositWithAmount(100_000e18, "100K");
    }

    function _testDepositWithAmount(uint256 amount, string memory label) internal {
        console2.log("\n=== Slippage Test:", label, "===\n");

        // Fund user with enough
        usdt.mint(user1, amount);
        vm.prank(user1);
        usdt.approve(address(vault), amount);

        uint256 usdtBefore = usdt.balanceOf(user1);

        vm.prank(user1);
        uint256 gasBefore = gasleft();
        uint256 shares = vault.deposit(amount, user1);
        uint256 gasUsed = gasBefore - gasleft();

        console2.log("   Deposit amount:", amount / 1e18);
        console2.log("   Shares received:", shares / 1e18);
        console2.log("   Gas used:", gasUsed);

        // Check effective slippage (compare shares to deposit)
        uint256 shareValue = vault.convertToAssets(shares);
        uint256 slippageBps = ((amount - shareValue) * 10000) / amount;
        console2.log("   Effective slippage (bps):", slippageBps);

        // Slippage should be within acceptable range
        assertLt(slippageBps, 200, "Slippage should be under 2%");
    }

    // =============================================================================
    // Rebalance Flow Test
    // =============================================================================

    function test_Rebalance_Flow() public {
        console2.log("\n=== Rebalance Flow Test ===\n");

        // Setup: User deposits
        uint256 depositAmount = 50_000e18;
        vm.prank(user1);
        vault.deposit(depositAmount, user1);

        console2.log("Initial state after deposit:");
        console2.log("   RWA Bond balance:", rwaBond.balanceOf(address(vault)) / 1e18);
        console2.log("   RWA Stock balance:", rwaStock.balanceOf(address(vault)) / 1e18);

        // Execute rebalance: sell some bonds, buy more stocks
        address[] memory sellAssets = new address[](1);
        sellAssets[0] = address(rwaBond);

        uint256[] memory sellAmounts = new uint256[](1);
        sellAmounts[0] = 5000e18;

        address[] memory buyAssets = new address[](1);
        buyAssets[0] = address(rwaStock);

        uint256[] memory buyAmounts = new uint256[](1);
        buyAmounts[0] = 5000e18;

        // Note: Vault's rebalance function handles approvals internally via forceApprove
        // No manual approval needed here

        console2.log("\nExecuting rebalance...");
        vm.prank(rebalancer);
        uint256 gasBefore = gasleft();
        (uint256[] memory sellReceived, uint256[] memory buyReceived) = vault.rebalance(
            sellAssets,
            sellAmounts,
            buyAssets,
            buyAmounts
        );
        rebalanceGas = gasBefore - gasleft();

        console2.log("\nRebalance results:");
        console2.log("   USDT received from sell:", sellReceived[0] / 1e18);
        console2.log("   RWA Stock received:", buyReceived[0] / 1e18);
        console2.log("   Gas used:", rebalanceGas);

        console2.log("\nFinal state:");
        console2.log("   RWA Bond balance:", rwaBond.balanceOf(address(vault)) / 1e18);
        console2.log("   RWA Stock balance:", rwaStock.balanceOf(address(vault)) / 1e18);
    }

    // =============================================================================
    // Edge Case Tests
    // =============================================================================

    function test_MinDeposit() public {
        console2.log("\n=== Min Deposit Test ($500) ===\n");

        vm.prank(user1);
        uint256 shares = vault.deposit(MIN_DEPOSIT, user1);

        console2.log("   Min deposit:", MIN_DEPOSIT / 1e18);
        console2.log("   Shares received:", shares / 1e18);

        assertGt(shares, 0, "Should receive shares for min deposit");
    }

    function test_MaxWithdrawal() public {
        console2.log("\n=== Max Withdrawal Test ($100K limit) ===\n");

        // Deposit large amount
        uint256 largeDeposit = 200_000e18;
        usdt.mint(user1, largeDeposit);
        vm.prank(user1);
        usdt.approve(address(vault), largeDeposit);

        vm.prank(user1);
        uint256 shares = vault.deposit(largeDeposit, user1);

        // Try to withdraw more than max
        uint256 maxWithdrawal = vault.MAX_WITHDRAWAL();
        console2.log("   Max withdrawal limit:", maxWithdrawal / 1e18);

        // Should fail for over-limit withdrawal
        vm.prank(user1);
        vm.expectRevert();
        vault.withdraw(maxWithdrawal + 1, user1, user1);

        console2.log("   Over-limit withdrawal correctly rejected");
    }

    function test_MultipleUsers_Concurrent() public {
        console2.log("\n=== Multiple Users Concurrent Test ===\n");

        // User 1 deposits
        vm.prank(user1);
        uint256 shares1 = vault.deposit(10_000e18, user1);

        // User 2 deposits
        vm.prank(user2);
        uint256 shares2 = vault.deposit(20_000e18, user2);

        console2.log("   User1 shares:", shares1 / 1e18);
        console2.log("   User2 shares:", shares2 / 1e18);
        console2.log("   Total supply:", vault.totalSupply() / 1e18);

        // Verify proportional
        assertApproxEqRel(shares2, shares1 * 2, 0.01e18, "User2 should have ~2x shares");
    }

    // =============================================================================
    // Gas Report
    // =============================================================================

    function test_GasReport() public {
        console2.log("\n========================================");
        console2.log("GAS REPORT - BSC Testnet Simulation");
        console2.log("========================================\n");

        // Deposit gas
        vm.prank(user1);
        uint256 gasBefore = gasleft();
        vault.deposit(10_000e18, user1);
        uint256 depositGasUsed = gasBefore - gasleft();

        // Withdraw gas (instant)
        // Cache shares before prank to avoid consuming prank on balanceOf call
        uint256 sharesToRedeem = vault.balanceOf(user1) / 2;
        vm.prank(user1);
        gasBefore = gasleft();
        vault.redeem(sharesToRedeem, user1, user1);
        uint256 withdrawGasUsed = gasBefore - gasleft();

        // Rebalance gas (setup first)
        usdt.mint(user2, 50_000e18);
        vm.prank(user2);
        usdt.approve(address(vault), 50_000e18);
        vm.prank(user2);
        vault.deposit(50_000e18, user2);

        // Note: Vault's rebalance function handles approvals internally via forceApprove
        // No manual approval needed here

        address[] memory sellAssets = new address[](1);
        sellAssets[0] = address(rwaBond);
        uint256[] memory sellAmounts = new uint256[](1);
        sellAmounts[0] = 1000e18;
        address[] memory buyAssets = new address[](1);
        buyAssets[0] = address(rwaStock);
        uint256[] memory buyAmounts = new uint256[](1);
        buyAmounts[0] = 1000e18;

        vm.prank(rebalancer);
        gasBefore = gasleft();
        vault.rebalance(sellAssets, sellAmounts, buyAssets, buyAmounts);
        uint256 rebalanceGasUsed = gasBefore - gasleft();

        console2.log("Operation          | Gas Used");
        console2.log("-------------------+----------");
        console2.log("Deposit ($10K)     |", depositGasUsed);
        console2.log("Withdraw (50%)     |", withdrawGasUsed);
        console2.log("Rebalance          |", rebalanceGasUsed);
        console2.log("");

        // At BSC gas price (~5 gwei), estimate costs
        uint256 gasPrice = 5 gwei;
        console2.log("Estimated costs at 5 gwei:");
        console2.log("  Deposit: ", (depositGasUsed * gasPrice) / 1e15, "mBNB");
        console2.log("  Withdraw:", (withdrawGasUsed * gasPrice) / 1e15, "mBNB");
        console2.log("  Rebalance:", (rebalanceGasUsed * gasPrice) / 1e15, "mBNB");

        console2.log("\n========================================\n");
    }
}
