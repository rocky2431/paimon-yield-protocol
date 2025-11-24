// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {AssetRegistry} from "../src/AssetRegistry.sol";
import {OracleAdapter} from "../src/OracleAdapter.sol";
import {SwapHelper} from "../src/SwapHelper.sol";
import {RebalanceStrategy} from "../src/RebalanceStrategy.sol";
import {PNGYVault} from "../src/PNGYVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20
/// @notice Simple mock ERC20 for testnet deployment
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title MockOracle
/// @notice Simple mock oracle for testnet
contract MockOracle {
    mapping(address => uint256) public prices;
    mapping(address => uint256) public timestamps;

    function setPrice(address asset, uint256 price) external {
        prices[asset] = price;
        timestamps[asset] = block.timestamp;
    }

    function getPrice(address asset) external view returns (uint256) {
        return prices[asset];
    }

    function getPriceWithTimestamp(address asset) external view returns (uint256, uint256) {
        return (prices[asset], timestamps[asset]);
    }

    function isPriceStale(address) external pure returns (bool) {
        return false;
    }
}

/// @title MockPancakeRouter
/// @notice Simple mock router for testnet
contract MockPancakeRouter {
    mapping(bytes32 => uint256) public exchangeRates;

    function setExchangeRate(address tokenIn, address tokenOut, uint256 rate) external {
        bytes32 key = keccak256(abi.encodePacked(tokenIn, tokenOut));
        exchangeRates[key] = rate;
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts) {
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;

        for (uint256 i = 0; i < path.length - 1; i++) {
            bytes32 key = keccak256(abi.encodePacked(path[i], path[i + 1]));
            uint256 rate = exchangeRates[key];
            if (rate == 0) rate = 1e18; // Default 1:1
            amounts[i + 1] = (amounts[i] * rate) / 1e18;
        }
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 /* deadline */
    ) external returns (uint256[] memory amounts) {
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;

        for (uint256 i = 0; i < path.length - 1; i++) {
            bytes32 key = keccak256(abi.encodePacked(path[i], path[i + 1]));
            uint256 rate = exchangeRates[key];
            if (rate == 0) rate = 1e18;
            amounts[i + 1] = (amounts[i] * rate) / 1e18;
        }

        require(amounts[path.length - 1] >= amountOutMin, "Slippage exceeded");

        // Transfer tokens
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        IERC20(path[path.length - 1]).transfer(to, amounts[path.length - 1]);

        return amounts;
    }

    function WETH() external pure returns (address) {
        return address(0);
    }
}

/// @title DeployScript
/// @notice Deployment script for Paimon Yield Protocol
contract DeployScript is Script {
    // Deployed contract addresses
    AssetRegistry public assetRegistry;
    OracleAdapter public oracleAdapter;
    SwapHelper public swapHelper;
    RebalanceStrategy public rebalanceStrategy;
    PNGYVault public vault;

    // Mock contracts for testnet
    MockERC20 public usdt;
    MockERC20 public rwaToken1;
    MockERC20 public rwaToken2;
    MockOracle public mockOracle;
    MockPancakeRouter public mockRouter;

    // Configuration
    address public admin;
    uint256 public constant DEFAULT_SLIPPAGE = 100; // 1%
    uint256 public constant APY_SENSITIVITY = 50; // 50%
    uint256 public constant INITIAL_MINT = 10_000_000e18; // 10M tokens

    function run() external {
        // Load private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        admin = vm.addr(deployerPrivateKey);

        console2.log("Deployer address:", admin);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy in order
        _deployMockTokens();
        _deployMockInfrastructure();
        _deployProtocol();
        _configureProtocol();
        _setupInitialState();

        vm.stopBroadcast();

        // Log deployment addresses
        _logDeployment();
    }

    function _deployMockTokens() internal {
        console2.log("\n=== Deploying Mock Tokens ===");

        usdt = new MockERC20("Tether USD", "USDT", 18);
        console2.log("USDT deployed:", address(usdt));

        rwaToken1 = new MockERC20("RWA Bond Token", "RWAB", 18);
        console2.log("RWA Token 1 (Bond) deployed:", address(rwaToken1));

        rwaToken2 = new MockERC20("RWA Stock Token", "RWAS", 18);
        console2.log("RWA Token 2 (Stock) deployed:", address(rwaToken2));
    }

    function _deployMockInfrastructure() internal {
        console2.log("\n=== Deploying Mock Infrastructure ===");

        mockOracle = new MockOracle();
        console2.log("Mock Oracle deployed:", address(mockOracle));

        mockRouter = new MockPancakeRouter();
        console2.log("Mock Router deployed:", address(mockRouter));
    }

    function _deployProtocol() internal {
        console2.log("\n=== Deploying Protocol Contracts ===");

        // 1. Asset Registry
        assetRegistry = new AssetRegistry(admin);
        console2.log("AssetRegistry deployed:", address(assetRegistry));

        // 2. Oracle Adapter
        oracleAdapter = new OracleAdapter(admin);
        console2.log("OracleAdapter deployed:", address(oracleAdapter));

        // 3. Swap Helper
        swapHelper = new SwapHelper(address(mockRouter), admin, DEFAULT_SLIPPAGE);
        console2.log("SwapHelper deployed:", address(swapHelper));

        // 4. Rebalance Strategy
        rebalanceStrategy = new RebalanceStrategy(admin, APY_SENSITIVITY);
        console2.log("RebalanceStrategy deployed:", address(rebalanceStrategy));

        // 5. PNGY Vault
        vault = new PNGYVault(IERC20(address(usdt)), admin);
        console2.log("PNGYVault deployed:", address(vault));
    }

    function _configureProtocol() internal {
        console2.log("\n=== Configuring Protocol ===");

        // Configure Oracle prices (1:1 with USD)
        mockOracle.setPrice(address(rwaToken1), 1e18); // $1
        mockOracle.setPrice(address(rwaToken2), 2e18); // $2
        console2.log("Oracle prices configured");

        // Configure exchange rates (bidirectional)
        mockRouter.setExchangeRate(address(usdt), address(rwaToken1), 1e18);
        mockRouter.setExchangeRate(address(usdt), address(rwaToken2), 0.5e18); // 2 USDT = 1 RWA2
        mockRouter.setExchangeRate(address(rwaToken1), address(usdt), 1e18);
        mockRouter.setExchangeRate(address(rwaToken2), address(usdt), 2e18);
        console2.log("Exchange rates configured");

        // Register assets in AssetRegistry
        assetRegistry.registerAsset(
            address(rwaToken1),
            AssetRegistry.AssetType.TOKENIZED_BOND,
            address(mockOracle)
        );
        assetRegistry.registerAsset(
            address(rwaToken2),
            AssetRegistry.AssetType.TOKENIZED_STOCK,
            address(mockOracle)
        );
        console2.log("Assets registered in AssetRegistry");

        // Configure Vault
        vault.setAssetRegistry(address(assetRegistry));
        vault.setOracleAdapter(address(oracleAdapter));
        vault.setSwapHelper(address(swapHelper));
        console2.log("Vault configured with dependencies");

        // Add RWA assets to Vault (50% each)
        vault.addRWAAsset(address(rwaToken1), 5000); // 50%
        vault.addRWAAsset(address(rwaToken2), 5000); // 50%
        console2.log("RWA assets added to Vault");

        // Configure OracleAdapter to use mock oracle
        // Parameters: asset, primaryOracle, backupOracle, stalenessThreshold (0 = use global default)
        oracleAdapter.configureOracle(address(rwaToken1), address(mockOracle), address(0), 0);
        oracleAdapter.configureOracle(address(rwaToken2), address(mockOracle), address(0), 0);
        console2.log("OracleAdapter configured");
    }

    function _setupInitialState() internal {
        console2.log("\n=== Setting Up Initial State ===");

        // Mint tokens for testing
        usdt.mint(admin, INITIAL_MINT);
        usdt.mint(address(mockRouter), INITIAL_MINT); // Router needs tokens for swaps
        rwaToken1.mint(address(mockRouter), INITIAL_MINT);
        rwaToken2.mint(address(mockRouter), INITIAL_MINT);
        console2.log("Initial tokens minted");

        // Approve vault
        usdt.approve(address(vault), type(uint256).max);
        console2.log("USDT approved for Vault");
    }

    function _logDeployment() internal view {
        console2.log("\n========================================");
        console2.log("DEPLOYMENT COMPLETE");
        console2.log("========================================");
        console2.log("\nToken Addresses:");
        console2.log("  USDT:", address(usdt));
        console2.log("  RWA Bond:", address(rwaToken1));
        console2.log("  RWA Stock:", address(rwaToken2));
        console2.log("\nInfrastructure:");
        console2.log("  Mock Oracle:", address(mockOracle));
        console2.log("  Mock Router:", address(mockRouter));
        console2.log("\nProtocol Contracts:");
        console2.log("  AssetRegistry:", address(assetRegistry));
        console2.log("  OracleAdapter:", address(oracleAdapter));
        console2.log("  SwapHelper:", address(swapHelper));
        console2.log("  RebalanceStrategy:", address(rebalanceStrategy));
        console2.log("  PNGYVault:", address(vault));
        console2.log("\nAdmin:", admin);
        console2.log("========================================\n");
    }
}
