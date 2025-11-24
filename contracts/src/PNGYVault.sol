// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAssetRegistry} from "./interfaces/IAssetRegistry.sol";
import {IOracleAdapter} from "./interfaces/IOracleAdapter.sol";
import {ISwapHelper} from "./interfaces/ISwapHelper.sol";

/// @title PNGYVault
/// @author Paimon Yield Protocol
/// @notice ERC4626-compliant tokenized vault for RWA yield aggregation
/// @dev Implements ERC4626 with access control, pausable, and reentrancy protection
contract PNGYVault is ERC4626, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // =============================================================================
    // Constants
    // =============================================================================

    /// @notice Role identifier for admin operations
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Role identifier for rebalancing operations
    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");

    /// @notice Minimum deposit amount (500 USDT with 18 decimals)
    uint256 public constant MIN_DEPOSIT = 500e18;

    /// @notice Maximum single withdrawal amount (100,000 USDT with 18 decimals)
    uint256 public constant MAX_WITHDRAWAL = 100_000e18;

    /// @notice Precision for share price calculations (1e18)
    uint256 public constant PRECISION = 1e18;

    /// @notice T+1 withdrawal delay (1 day)
    uint256 public constant WITHDRAWAL_DELAY = 1 days;

    /// @notice Instant withdrawal threshold (10,000 USDT)
    uint256 public constant INSTANT_WITHDRAWAL_LIMIT = 10_000e18;

    /// @notice Cache duration for RWA value calculation (5 minutes)
    uint256 public constant CACHE_DURATION = 5 minutes;

    /// @notice Maximum number of RWA assets in vault
    uint256 public constant MAX_RWA_ASSETS = 20;

    /// @notice Circuit breaker threshold in basis points (500 = 5%)
    uint256 public constant DEFAULT_CIRCUIT_BREAKER_THRESHOLD = 500;

    /// @notice Circuit breaker withdrawal limit when triggered (10,000 USDT)
    uint256 public constant CIRCUIT_BREAKER_LIMIT = 10_000e18;

    /// @notice Basis points denominator (10000 = 100%)
    uint256 public constant BASIS_POINTS = 10000;

    // =============================================================================
    // Structs
    // =============================================================================

    /// @notice Withdrawal request for T+1 queue
    struct WithdrawRequest {
        uint256 shares;
        uint256 assets;
        address receiver;
        uint256 requestTime;
        bool claimed;
    }

    /// @notice RWA asset holding in the vault
    struct RWAHolding {
        address tokenAddress;     // RWA token address
        uint256 targetAllocation; // Target allocation in basis points (10000 = 100%)
        bool isActive;            // Whether this holding is active
    }

    /// @notice Cached total assets value
    struct CachedValue {
        uint256 value;
        uint256 timestamp;
    }

    // =============================================================================
    // State Variables
    // =============================================================================

    /// @notice Total value of RWA assets under management (in asset decimals)
    uint256 private _totalManagedAssets;

    /// @notice Last time the vault NAV was updated
    uint256 public lastNavUpdate;

    /// @notice Emergency withdrawal enabled flag
    bool public emergencyWithdrawEnabled;

    /// @notice Counter for withdrawal request IDs
    uint256 private _withdrawRequestIdCounter;

    /// @notice Mapping from request ID to withdrawal request
    mapping(uint256 => WithdrawRequest) public withdrawRequests;

    /// @notice Mapping from user address to their pending request IDs
    mapping(address => uint256[]) public userWithdrawRequests;

    /// @notice Total shares locked in pending withdrawal requests
    uint256 public totalLockedShares;

    /// @notice Asset registry contract
    IAssetRegistry public assetRegistry;

    /// @notice Oracle adapter for price feeds
    IOracleAdapter public oracleAdapter;

    /// @notice Array of RWA holdings in the vault
    RWAHolding[] private _rwaHoldings;

    /// @notice Mapping from token address to holding index + 1 (0 means not found)
    mapping(address => uint256) private _holdingIndex;

    /// @notice Cached total RWA value for gas optimization
    CachedValue private _cachedRwaValue;

    /// @notice Circuit breaker threshold in basis points (500 = 5%)
    uint256 public circuitBreakerThreshold;

    /// @notice Reference NAV for circuit breaker calculation
    uint256 public referenceNav;

    /// @notice Whether circuit breaker is currently active
    bool public circuitBreakerActive;

    /// @notice Timestamp when circuit breaker was last triggered
    uint256 public circuitBreakerTriggeredAt;

    /// @notice SwapHelper for DEX integration
    ISwapHelper public swapHelper;

    /// @notice Default slippage for RWA swaps in basis points (100 = 1%)
    uint256 public defaultSwapSlippage;

    /// @notice Maximum allowed swap slippage (200 = 2%)
    uint256 public constant MAX_SWAP_SLIPPAGE = 200;

    // =============================================================================
    // Events
    // =============================================================================

    /// @notice Emitted when a deposit is processed
    event DepositProcessed(
        address indexed sender,
        address indexed receiver,
        uint256 assets,
        uint256 shares
    );

    /// @notice Emitted when a withdrawal is processed
    event WithdrawProcessed(
        address indexed sender,
        address indexed receiver,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    /// @notice Emitted when NAV is updated
    event NavUpdated(uint256 oldNav, uint256 newNav, uint256 timestamp);

    /// @notice Emitted when emergency mode is toggled
    event EmergencyModeChanged(bool enabled);

    /// @notice Emitted when a withdrawal request is created
    event WithdrawRequested(
        uint256 indexed requestId,
        address indexed owner,
        address receiver,
        uint256 shares,
        uint256 assets,
        uint256 claimableTime
    );

    /// @notice Emitted when a withdrawal request is claimed
    event WithdrawClaimed(
        uint256 indexed requestId,
        address indexed owner,
        address receiver,
        uint256 assets
    );

    /// @notice Emitted when an RWA asset is added to the vault
    event RWAAssetAdded(address indexed tokenAddress, uint256 targetAllocation);

    /// @notice Emitted when an RWA asset is removed from the vault
    event RWAAssetRemoved(address indexed tokenAddress);

    /// @notice Emitted when target allocation is updated
    event TargetAllocationUpdated(address indexed tokenAddress, uint256 oldAllocation, uint256 newAllocation);

    /// @notice Emitted when asset registry is updated
    event AssetRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

    /// @notice Emitted when oracle adapter is updated
    event OracleAdapterUpdated(address indexed oldOracle, address indexed newOracle);

    /// @notice Emitted when circuit breaker is triggered
    event CircuitBreakerTriggered(uint256 currentNav, uint256 referenceNav, uint256 dropBasisPoints);

    /// @notice Emitted when circuit breaker is reset
    event CircuitBreakerReset(uint256 newReferenceNav);

    /// @notice Emitted when circuit breaker threshold is updated
    event CircuitBreakerThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    /// @notice Emitted when swap helper is updated
    event SwapHelperUpdated(address indexed oldSwapHelper, address indexed newSwapHelper);

    /// @notice Emitted when default swap slippage is updated
    event DefaultSwapSlippageUpdated(uint256 oldSlippage, uint256 newSlippage);

    /// @notice Emitted when RWA tokens are purchased during deposit
    event RWATokensPurchased(address indexed token, uint256 usdtSpent, uint256 tokensReceived);

    /// @notice Emitted when RWA tokens are sold during withdrawal
    event RWATokensSold(address indexed token, uint256 tokensSold, uint256 usdtReceived);

    // =============================================================================
    // Errors
    // =============================================================================

    /// @notice Thrown when deposit amount is below minimum
    error DepositBelowMinimum(uint256 amount, uint256 minimum);

    /// @notice Thrown when withdrawal amount exceeds maximum
    error WithdrawalExceedsMaximum(uint256 amount, uint256 maximum);

    /// @notice Thrown when vault is paused
    error VaultPaused();

    /// @notice Thrown when caller is not authorized
    error Unauthorized();

    /// @notice Thrown when address is zero
    error ZeroAddress();

    /// @notice Thrown when amount is zero
    error ZeroAmount();

    /// @notice Thrown when withdrawal request not found
    error RequestNotFound(uint256 requestId);

    /// @notice Thrown when withdrawal delay not met
    error WithdrawalDelayNotMet(uint256 requestTime, uint256 currentTime, uint256 requiredDelay);

    /// @notice Thrown when request already claimed
    error RequestAlreadyClaimed(uint256 requestId);

    /// @notice Thrown when withdrawal exceeds instant limit
    error ExceedsInstantLimit(uint256 amount, uint256 limit);

    /// @notice Thrown when insufficient shares for withdrawal
    error InsufficientShares(uint256 available, uint256 required);

    /// @notice Thrown when RWA asset is already in vault
    error RWAAssetAlreadyAdded(address tokenAddress);

    /// @notice Thrown when RWA asset is not in vault
    error RWAAssetNotFound(address tokenAddress);

    /// @notice Thrown when RWA asset not registered in registry
    error RWAAssetNotRegistered(address tokenAddress);

    /// @notice Thrown when maximum RWA assets reached
    error MaxRWAAssetsReached(uint256 current, uint256 max);

    /// @notice Thrown when allocation exceeds 100%
    error InvalidAllocation(uint256 allocation);

    /// @notice Thrown when oracle or registry not configured
    error NotConfigured();

    /// @notice Thrown when circuit breaker is active and withdrawal exceeds limit
    error CircuitBreakerLimitExceeded(uint256 amount, uint256 limit);

    /// @notice Thrown when circuit breaker threshold is invalid
    error InvalidCircuitBreakerThreshold(uint256 threshold);

    /// @notice Thrown when reference NAV is not set
    error ReferenceNavNotSet();

    /// @notice Thrown when swap slippage is too high
    error SwapSlippageTooHigh(uint256 slippage, uint256 maxAllowed);

    /// @notice Thrown when RWA token swap fails
    error RWASwapFailed(address token, uint256 amount);

    // =============================================================================
    // Constructor
    // =============================================================================

    /// @notice Initialize the PNGY Vault
    /// @param asset_ The underlying asset (USDT)
    /// @param admin_ The initial admin address
    constructor(
        IERC20 asset_,
        address admin_
    )
        ERC4626(asset_)
        ERC20("Paimon Yield Token", "PNGY")
    {
        if (admin_ == address(0)) revert ZeroAddress();

        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);
        _grantRole(REBALANCER_ROLE, admin_);

        // Initialize state
        lastNavUpdate = block.timestamp;
        circuitBreakerThreshold = DEFAULT_CIRCUIT_BREAKER_THRESHOLD;
        defaultSwapSlippage = 100; // 1% default slippage
    }

    // =============================================================================
    // ERC4626 Overrides - View Functions
    // =============================================================================

    /// @notice Returns the total amount of underlying assets managed by the vault
    /// @dev Includes idle assets + legacy managed assets + aggregated RWA holdings
    /// @return Total assets in the vault
    function totalAssets() public view override returns (uint256) {
        // Idle assets in vault
        uint256 idleAssets = IERC20(asset()).balanceOf(address(this));

        // Legacy managed assets (for backwards compatibility)
        uint256 legacyManaged = _totalManagedAssets;

        // Aggregated RWA holdings value
        uint256 rwaValue = _getRWAValue();

        return idleAssets + legacyManaged + rwaValue;
    }

    /// @notice Get the aggregated value of all RWA holdings
    /// @dev Uses caching for gas optimization, returns cached value if fresh
    /// @return Total value of RWA holdings in underlying asset terms
    function _getRWAValue() internal view returns (uint256) {
        // If no oracle configured, return 0 (RWA tracking disabled)
        if (address(oracleAdapter) == address(0)) {
            return 0;
        }

        // Check if cached value is still fresh (and was actually set)
        if (_cachedRwaValue.timestamp != 0 &&
            _cachedRwaValue.timestamp + CACHE_DURATION > block.timestamp) {
            return _cachedRwaValue.value;
        }

        // Calculate fresh value
        return _calculateRWAValue();
    }

    /// @notice Calculate the total value of all RWA holdings
    /// @dev Iterates through holdings, fetches prices from oracle, converts to asset terms
    /// @return totalValue Total value in underlying asset (e.g., USDT) terms
    function _calculateRWAValue() internal view returns (uint256 totalValue) {
        uint256 length = _rwaHoldings.length;
        uint8 assetDecimals = IERC20Metadata(asset()).decimals();

        for (uint256 i = 0; i < length;) {
            RWAHolding memory holding = _rwaHoldings[i];

            if (holding.isActive) {
                // Get token balance held by vault
                uint256 balance = IERC20(holding.tokenAddress).balanceOf(address(this));

                if (balance > 0) {
                    // Get price from oracle (18 decimals)
                    uint256 price = oracleAdapter.getPrice(holding.tokenAddress);

                    // Get token decimals
                    uint8 tokenDecimals = IERC20Metadata(holding.tokenAddress).decimals();

                    // Calculate value: balance * price / 10^tokenDecimals
                    // Result is in 18 decimals (price decimals)
                    // Then normalize to asset decimals
                    uint256 value = (balance * price) / (10 ** tokenDecimals);

                    // Normalize to asset decimals if needed
                    if (assetDecimals < 18) {
                        value = value / (10 ** (18 - assetDecimals));
                    } else if (assetDecimals > 18) {
                        value = value * (10 ** (assetDecimals - 18));
                    }

                    totalValue += value;
                }
            }

            unchecked { ++i; }
        }
    }

    /// @notice Returns the maximum amount that can be deposited
    /// @param receiver The address receiving the shares
    /// @return Maximum deposit amount
    function maxDeposit(address receiver) public view override returns (uint256) {
        if (paused()) return 0;
        return super.maxDeposit(receiver);
    }

    /// @notice Returns the maximum amount that can be minted
    /// @param receiver The address receiving the shares
    /// @return Maximum mint amount
    function maxMint(address receiver) public view override returns (uint256) {
        if (paused()) return 0;
        return super.maxMint(receiver);
    }

    /// @notice Returns the maximum amount that can be withdrawn
    /// @param owner The address owning the shares
    /// @return Maximum withdrawal amount
    function maxWithdraw(address owner) public view override returns (uint256) {
        if (paused() && !emergencyWithdrawEnabled) return 0;
        uint256 ownerAssets = convertToAssets(balanceOf(owner));
        return ownerAssets > MAX_WITHDRAWAL ? MAX_WITHDRAWAL : ownerAssets;
    }

    /// @notice Returns the maximum shares that can be redeemed
    /// @param owner The address owning the shares
    /// @return Maximum redeem amount
    function maxRedeem(address owner) public view override returns (uint256) {
        if (paused() && !emergencyWithdrawEnabled) return 0;
        uint256 ownerShares = balanceOf(owner);
        uint256 maxWithdrawShares = convertToShares(MAX_WITHDRAWAL);
        return ownerShares > maxWithdrawShares ? maxWithdrawShares : ownerShares;
    }

    // =============================================================================
    // ERC4626 Overrides - Deposit/Withdraw
    // =============================================================================

    /// @notice Deposit assets and receive shares
    /// @param assets Amount of assets to deposit
    /// @param receiver Address to receive shares
    /// @return shares Amount of shares minted
    function deposit(
        uint256 assets,
        address receiver
    ) public override nonReentrant whenNotPaused returns (uint256 shares) {
        // Gas optimization: Check zero first (cheaper), then minimum
        if (assets == 0) revert ZeroAmount();
        if (assets < MIN_DEPOSIT) {
            revert DepositBelowMinimum(assets, MIN_DEPOSIT);
        }
        if (receiver == address(0)) revert ZeroAddress();

        shares = super.deposit(assets, receiver);

        // Purchase RWA tokens according to target allocations
        _purchaseRWATokens(assets);

        emit DepositProcessed(msg.sender, receiver, assets, shares);
    }

    /// @notice Mint shares by depositing assets
    /// @param shares Amount of shares to mint
    /// @param receiver Address to receive shares
    /// @return assets Amount of assets deposited
    function mint(
        uint256 shares,
        address receiver
    ) public override nonReentrant whenNotPaused returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        assets = previewMint(shares);
        if (assets < MIN_DEPOSIT) {
            revert DepositBelowMinimum(assets, MIN_DEPOSIT);
        }

        assets = super.mint(shares, receiver);

        // Purchase RWA tokens according to target allocations
        _purchaseRWATokens(assets);

        emit DepositProcessed(msg.sender, receiver, assets, shares);
    }

    /// @notice Withdraw assets by burning shares (instant for small amounts)
    /// @param assets Amount of assets to withdraw
    /// @param receiver Address to receive assets
    /// @param owner Address owning the shares
    /// @return shares Amount of shares burned
    /// @dev For amounts > INSTANT_WITHDRAWAL_LIMIT, use requestWithdraw instead
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override nonReentrant returns (uint256 shares) {
        if (paused() && !emergencyWithdrawEnabled) revert VaultPaused();
        if (assets == 0) revert ZeroAmount();
        if (assets > MAX_WITHDRAWAL) {
            revert WithdrawalExceedsMaximum(assets, MAX_WITHDRAWAL);
        }
        if (receiver == address(0)) revert ZeroAddress();
        // Enforce instant withdrawal limit (bypass in emergency mode)
        if (assets > INSTANT_WITHDRAWAL_LIMIT && !emergencyWithdrawEnabled) {
            revert ExceedsInstantLimit(assets, INSTANT_WITHDRAWAL_LIMIT);
        }
        // Circuit breaker check (bypass in emergency mode)
        if (circuitBreakerActive && !emergencyWithdrawEnabled) {
            if (assets > CIRCUIT_BREAKER_LIMIT) {
                revert CircuitBreakerLimitExceeded(assets, CIRCUIT_BREAKER_LIMIT);
            }
        }

        // Sell RWA tokens to obtain USDT if needed
        _sellRWATokens(assets);

        shares = super.withdraw(assets, receiver, owner);

        emit WithdrawProcessed(msg.sender, receiver, owner, assets, shares);
    }

    /// @notice Redeem shares for assets (instant for small amounts)
    /// @param shares Amount of shares to redeem
    /// @param receiver Address to receive assets
    /// @param owner Address owning the shares
    /// @return assets Amount of assets received
    /// @dev For amounts > INSTANT_WITHDRAWAL_LIMIT, use requestRedeem instead
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override nonReentrant returns (uint256 assets) {
        if (paused() && !emergencyWithdrawEnabled) revert VaultPaused();
        if (shares == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        uint256 previewedAssets = previewRedeem(shares);
        if (previewedAssets > MAX_WITHDRAWAL) {
            revert WithdrawalExceedsMaximum(previewedAssets, MAX_WITHDRAWAL);
        }
        // Enforce instant withdrawal limit (bypass in emergency mode)
        if (previewedAssets > INSTANT_WITHDRAWAL_LIMIT && !emergencyWithdrawEnabled) {
            revert ExceedsInstantLimit(previewedAssets, INSTANT_WITHDRAWAL_LIMIT);
        }
        // Circuit breaker check (bypass in emergency mode)
        if (circuitBreakerActive && !emergencyWithdrawEnabled) {
            if (previewedAssets > CIRCUIT_BREAKER_LIMIT) {
                revert CircuitBreakerLimitExceeded(previewedAssets, CIRCUIT_BREAKER_LIMIT);
            }
        }

        // Sell RWA tokens to obtain USDT if needed
        _sellRWATokens(previewedAssets);

        assets = super.redeem(shares, receiver, owner);

        emit WithdrawProcessed(msg.sender, receiver, owner, assets, shares);
    }

    // =============================================================================
    // T+1 Withdrawal Queue Functions
    // =============================================================================

    /// @notice Request a withdrawal (T+1 queue for large amounts)
    /// @param shares Amount of shares to redeem
    /// @param receiver Address to receive assets after delay
    /// @return requestId The ID of the withdrawal request
    function requestWithdraw(
        uint256 shares,
        address receiver
    ) external nonReentrant whenNotPaused returns (uint256 requestId) {
        if (shares == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        uint256 assets = previewRedeem(shares);
        if (assets > MAX_WITHDRAWAL) {
            revert WithdrawalExceedsMaximum(assets, MAX_WITHDRAWAL);
        }

        // Check user has enough shares (locked shares are already transferred to vault)
        uint256 userBalance = balanceOf(msg.sender);
        if (userBalance < shares) {
            revert InsufficientShares(userBalance, shares);
        }

        // Create request
        requestId = _withdrawRequestIdCounter++;
        withdrawRequests[requestId] = WithdrawRequest({
            shares: shares,
            assets: assets,
            receiver: receiver,
            requestTime: block.timestamp,
            claimed: false
        });

        userWithdrawRequests[msg.sender].push(requestId);
        totalLockedShares += shares;

        // Transfer shares to vault (lock them)
        _transfer(msg.sender, address(this), shares);

        emit WithdrawRequested(
            requestId,
            msg.sender,
            receiver,
            shares,
            assets,
            block.timestamp + WITHDRAWAL_DELAY
        );
    }

    /// @notice Claim a withdrawal request after delay
    /// @param requestId The ID of the withdrawal request
    function claimWithdraw(uint256 requestId) external nonReentrant {
        WithdrawRequest storage request = withdrawRequests[requestId];

        if (request.shares == 0) revert RequestNotFound(requestId);
        if (request.claimed) revert RequestAlreadyClaimed(requestId);

        uint256 claimableTime = request.requestTime + WITHDRAWAL_DELAY;
        if (block.timestamp < claimableTime) {
            revert WithdrawalDelayNotMet(request.requestTime, block.timestamp, WITHDRAWAL_DELAY);
        }

        request.claimed = true;
        totalLockedShares -= request.shares;

        // Recalculate assets at current share price (may have changed)
        uint256 currentAssets = previewRedeem(request.shares);

        // Burn the locked shares from vault and transfer assets
        _burn(address(this), request.shares);
        IERC20(asset()).safeTransfer(request.receiver, currentAssets);

        emit WithdrawClaimed(requestId, msg.sender, request.receiver, currentAssets);
    }

    /// @notice Get user's pending withdrawal request IDs
    /// @param user The user address
    /// @return requestIds Array of pending request IDs
    function getUserPendingRequests(address user) external view returns (uint256[] memory) {
        return userWithdrawRequests[user];
    }

    /// @notice Get user's total locked shares in pending requests
    /// @param user The user address
    /// @return locked Total locked shares
    function getUserLockedShares(address user) external view returns (uint256 locked) {
        return _getUserLockedShares(user);
    }

    /// @notice Internal function to calculate user's locked shares
    function _getUserLockedShares(address user) internal view returns (uint256 locked) {
        uint256[] memory requestIds = userWithdrawRequests[user];
        for (uint256 i = 0; i < requestIds.length; i++) {
            WithdrawRequest storage req = withdrawRequests[requestIds[i]];
            if (!req.claimed) {
                locked += req.shares;
            }
        }
    }

    // =============================================================================
    // Admin Functions
    // =============================================================================

    /// @notice Update the total managed assets (RWA value)
    /// @dev Only callable by rebalancer role
    /// @param newManagedAssets New total value of managed assets
    function updateManagedAssets(uint256 newManagedAssets) external onlyRole(REBALANCER_ROLE) {
        uint256 oldNav = totalAssets();
        _totalManagedAssets = newManagedAssets;
        uint256 newNav = totalAssets();

        lastNavUpdate = block.timestamp;

        emit NavUpdated(oldNav, newNav, block.timestamp);
    }

    /// @notice Pause the vault
    /// @dev Only callable by admin role
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /// @notice Unpause the vault
    /// @dev Only callable by admin role
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Enable or disable emergency withdrawals
    /// @dev Only callable by admin role
    /// @param enabled Whether emergency withdrawals are enabled
    function setEmergencyWithdraw(bool enabled) external onlyRole(ADMIN_ROLE) {
        emergencyWithdrawEnabled = enabled;
        emit EmergencyModeChanged(enabled);
    }

    /// @notice Set the asset registry contract
    /// @dev Only callable by admin role
    /// @param registry_ The new asset registry address
    function setAssetRegistry(address registry_) external onlyRole(ADMIN_ROLE) {
        address oldRegistry = address(assetRegistry);
        assetRegistry = IAssetRegistry(registry_);
        emit AssetRegistryUpdated(oldRegistry, registry_);
    }

    /// @notice Set the oracle adapter contract
    /// @dev Only callable by admin role
    /// @param oracle_ The new oracle adapter address
    function setOracleAdapter(address oracle_) external onlyRole(ADMIN_ROLE) {
        address oldOracle = address(oracleAdapter);
        oracleAdapter = IOracleAdapter(oracle_);
        emit OracleAdapterUpdated(oldOracle, oracle_);
    }

    /// @notice Set the swap helper contract for DEX integration
    /// @dev Only callable by admin role
    /// @param swapHelper_ The new swap helper address (can be zero to disable)
    function setSwapHelper(address swapHelper_) external onlyRole(ADMIN_ROLE) {
        address oldSwapHelper = address(swapHelper);
        swapHelper = ISwapHelper(swapHelper_);
        emit SwapHelperUpdated(oldSwapHelper, swapHelper_);
    }

    /// @notice Set the default swap slippage for RWA purchases/sales
    /// @dev Only callable by admin role
    /// @param slippage_ New default slippage in basis points (max 200 = 2%)
    function setDefaultSwapSlippage(uint256 slippage_) external onlyRole(ADMIN_ROLE) {
        if (slippage_ > MAX_SWAP_SLIPPAGE) {
            revert SwapSlippageTooHigh(slippage_, MAX_SWAP_SLIPPAGE);
        }

        uint256 oldSlippage = defaultSwapSlippage;
        defaultSwapSlippage = slippage_;
        emit DefaultSwapSlippageUpdated(oldSlippage, slippage_);
    }

    /// @notice Add an RWA asset to the vault holdings
    /// @dev Only callable by admin role. Asset must be registered in AssetRegistry.
    /// @param tokenAddress The RWA token address
    /// @param targetAllocation Target allocation in basis points (10000 = 100%)
    function addRWAAsset(
        address tokenAddress,
        uint256 targetAllocation
    ) external onlyRole(ADMIN_ROLE) {
        if (tokenAddress == address(0)) revert ZeroAddress();
        if (_holdingIndex[tokenAddress] != 0) revert RWAAssetAlreadyAdded(tokenAddress);
        if (_rwaHoldings.length >= MAX_RWA_ASSETS) {
            revert MaxRWAAssetsReached(_rwaHoldings.length, MAX_RWA_ASSETS);
        }
        if (targetAllocation > 10000) revert InvalidAllocation(targetAllocation);

        // Verify asset is registered in registry (if registry is configured)
        if (address(assetRegistry) != address(0)) {
            if (!assetRegistry.isRegistered(tokenAddress)) {
                revert RWAAssetNotRegistered(tokenAddress);
            }
        }

        _rwaHoldings.push(RWAHolding({
            tokenAddress: tokenAddress,
            targetAllocation: targetAllocation,
            isActive: true
        }));

        _holdingIndex[tokenAddress] = _rwaHoldings.length; // 1-indexed

        // Invalidate cache
        _cachedRwaValue.timestamp = 0;

        emit RWAAssetAdded(tokenAddress, targetAllocation);
    }

    /// @notice Remove an RWA asset from vault holdings
    /// @dev Only callable by admin role
    /// @param tokenAddress The RWA token address to remove
    function removeRWAAsset(address tokenAddress) external onlyRole(ADMIN_ROLE) {
        uint256 index = _holdingIndex[tokenAddress];
        if (index == 0) revert RWAAssetNotFound(tokenAddress);

        uint256 actualIndex = index - 1;
        uint256 lastIndex = _rwaHoldings.length - 1;

        // Move last element to removed position (if not already last)
        if (actualIndex != lastIndex) {
            RWAHolding memory lastHolding = _rwaHoldings[lastIndex];
            _rwaHoldings[actualIndex] = lastHolding;
            _holdingIndex[lastHolding.tokenAddress] = index;
        }

        _rwaHoldings.pop();
        delete _holdingIndex[tokenAddress];

        // Invalidate cache
        _cachedRwaValue.timestamp = 0;

        emit RWAAssetRemoved(tokenAddress);
    }

    /// @notice Update target allocation for an RWA asset
    /// @dev Only callable by admin role
    /// @param tokenAddress The RWA token address
    /// @param newAllocation New target allocation in basis points
    function updateTargetAllocation(
        address tokenAddress,
        uint256 newAllocation
    ) external onlyRole(ADMIN_ROLE) {
        uint256 index = _holdingIndex[tokenAddress];
        if (index == 0) revert RWAAssetNotFound(tokenAddress);
        if (newAllocation > 10000) revert InvalidAllocation(newAllocation);

        uint256 oldAllocation = _rwaHoldings[index - 1].targetAllocation;
        _rwaHoldings[index - 1].targetAllocation = newAllocation;

        emit TargetAllocationUpdated(tokenAddress, oldAllocation, newAllocation);
    }

    /// @notice Set RWA holding active status
    /// @dev Only callable by admin role
    /// @param tokenAddress The RWA token address
    /// @param active Whether the holding is active
    function setRWAAssetActive(
        address tokenAddress,
        bool active
    ) external onlyRole(ADMIN_ROLE) {
        uint256 index = _holdingIndex[tokenAddress];
        if (index == 0) revert RWAAssetNotFound(tokenAddress);

        _rwaHoldings[index - 1].isActive = active;

        // Invalidate cache
        _cachedRwaValue.timestamp = 0;
    }

    /// @notice Refresh the cached RWA value
    /// @dev Only callable by rebalancer role. Called after rebalancing operations.
    function refreshRWACache() external onlyRole(REBALANCER_ROLE) {
        _cachedRwaValue.value = _calculateRWAValue();
        _cachedRwaValue.timestamp = block.timestamp;
    }

    // =============================================================================
    // Circuit Breaker Functions
    // =============================================================================

    /// @notice Set the circuit breaker threshold
    /// @dev Only callable by admin role. Max threshold is 5000 (50%)
    /// @param newThreshold New threshold in basis points (e.g., 500 = 5%)
    function setCircuitBreakerThreshold(uint256 newThreshold) external onlyRole(ADMIN_ROLE) {
        if (newThreshold > 5000) revert InvalidCircuitBreakerThreshold(newThreshold);

        uint256 oldThreshold = circuitBreakerThreshold;
        circuitBreakerThreshold = newThreshold;

        emit CircuitBreakerThresholdUpdated(oldThreshold, newThreshold);
    }

    /// @notice Set the reference NAV for circuit breaker calculations
    /// @dev Only callable by admin role. Should be called when NAV is stable.
    /// @param newReferenceNav The new reference NAV value
    function setReferenceNav(uint256 newReferenceNav) external onlyRole(ADMIN_ROLE) {
        if (newReferenceNav == 0) revert ZeroAmount();
        referenceNav = newReferenceNav;
    }

    /// @notice Check if circuit breaker should be triggered based on current NAV
    /// @dev Compares current NAV to reference NAV and triggers if drop exceeds threshold
    function checkCircuitBreaker() external onlyRole(REBALANCER_ROLE) {
        if (referenceNav == 0) revert ReferenceNavNotSet();

        uint256 currentNav = totalAssets();

        // If NAV has dropped
        if (currentNav < referenceNav) {
            // Calculate drop in basis points: (referenceNav - currentNav) * 10000 / referenceNav
            uint256 dropBasisPoints = ((referenceNav - currentNav) * BASIS_POINTS) / referenceNav;

            if (dropBasisPoints >= circuitBreakerThreshold) {
                if (!circuitBreakerActive) {
                    circuitBreakerActive = true;
                    circuitBreakerTriggeredAt = block.timestamp;
                    emit CircuitBreakerTriggered(currentNav, referenceNav, dropBasisPoints);
                }
            }
        }
    }

    /// @notice Reset the circuit breaker and set new reference NAV
    /// @dev Only callable by admin role. Use after investigating and resolving the issue.
    function resetCircuitBreaker() external onlyRole(ADMIN_ROLE) {
        uint256 newReferenceNav = totalAssets();
        circuitBreakerActive = false;
        circuitBreakerTriggeredAt = 0;
        referenceNav = newReferenceNav;

        emit CircuitBreakerReset(newReferenceNav);
    }

    /// @notice Force activate circuit breaker manually
    /// @dev Only callable by admin role. Use in emergency situations.
    function activateCircuitBreaker() external onlyRole(ADMIN_ROLE) {
        if (!circuitBreakerActive) {
            circuitBreakerActive = true;
            circuitBreakerTriggeredAt = block.timestamp;

            uint256 currentNav = totalAssets();
            uint256 dropBasisPoints = 0;
            if (referenceNav > 0 && currentNav < referenceNav) {
                dropBasisPoints = ((referenceNav - currentNav) * BASIS_POINTS) / referenceNav;
            }

            emit CircuitBreakerTriggered(currentNav, referenceNav, dropBasisPoints);
        }
    }

    // =============================================================================
    // Internal Swap Functions
    // =============================================================================

    /// @notice Purchase RWA tokens according to target allocations
    /// @dev Called internally after deposit. Uses SwapHelper for DEX swaps.
    /// @param assets Amount of USDT available for purchasing RWA tokens
    function _purchaseRWATokens(uint256 assets) internal {
        // Skip if no swap helper configured
        if (address(swapHelper) == address(0)) return;

        // Skip if no RWA holdings
        uint256 holdingCount = _rwaHoldings.length;
        if (holdingCount == 0) return;

        // Calculate total target allocation
        uint256 totalAllocation;
        for (uint256 i = 0; i < holdingCount;) {
            if (_rwaHoldings[i].isActive) {
                totalAllocation += _rwaHoldings[i].targetAllocation;
            }
            unchecked { ++i; }
        }

        // Skip if no allocation
        if (totalAllocation == 0) return;

        address underlyingAsset = asset();

        // Approve SwapHelper to spend USDT
        IERC20(underlyingAsset).safeIncreaseAllowance(address(swapHelper), assets);

        // Purchase each RWA token according to allocation
        for (uint256 i = 0; i < holdingCount;) {
            RWAHolding memory holding = _rwaHoldings[i];

            if (holding.isActive && holding.targetAllocation > 0) {
                // Calculate amount to spend on this token
                uint256 amountToSpend = (assets * holding.targetAllocation) / totalAllocation;

                if (amountToSpend > 0) {
                    // Execute swap via SwapHelper
                    try swapHelper.buyRWAAsset(
                        underlyingAsset,
                        holding.tokenAddress,
                        amountToSpend,
                        defaultSwapSlippage
                    ) returns (uint256 tokensReceived) {
                        emit RWATokensPurchased(holding.tokenAddress, amountToSpend, tokensReceived);
                    } catch {
                        // Revert the entire transaction if swap fails
                        revert RWASwapFailed(holding.tokenAddress, amountToSpend);
                    }
                }
            }

            unchecked { ++i; }
        }

        // Invalidate RWA cache
        _cachedRwaValue.timestamp = 0;
    }

    /// @notice Sell RWA tokens to obtain USDT for withdrawal
    /// @dev Called internally before withdrawal. Sells proportionally from each holding.
    /// @param assetsNeeded Amount of USDT needed for withdrawal
    function _sellRWATokens(uint256 assetsNeeded) internal {
        // Skip if no swap helper configured
        if (address(swapHelper) == address(0)) return;

        // Check if we have enough idle USDT already
        uint256 idleBalance = IERC20(asset()).balanceOf(address(this));
        if (idleBalance >= assetsNeeded) return;

        uint256 shortfall = assetsNeeded - idleBalance;

        // Skip if no RWA holdings
        uint256 holdingCount = _rwaHoldings.length;
        if (holdingCount == 0) return;

        // Calculate total RWA value
        uint256 totalRwaValue = _calculateRWAValue();
        if (totalRwaValue == 0) return;

        address underlyingAsset = asset();

        // Sell proportionally from each holding
        for (uint256 i = 0; i < holdingCount;) {
            RWAHolding memory holding = _rwaHoldings[i];

            if (holding.isActive) {
                uint256 tokenBalance = IERC20(holding.tokenAddress).balanceOf(address(this));

                if (tokenBalance > 0) {
                    // Get token value
                    uint256 price = oracleAdapter.getPrice(holding.tokenAddress);
                    uint256 tokenValue = (tokenBalance * price) / 1e18;

                    // Calculate how much to sell (proportional to shortfall)
                    uint256 sellValue = (shortfall * tokenValue) / totalRwaValue;
                    uint256 tokensToSell = (sellValue * 1e18) / price;

                    // Don't sell more than we have
                    if (tokensToSell > tokenBalance) {
                        tokensToSell = tokenBalance;
                    }

                    if (tokensToSell > 0) {
                        // Approve SwapHelper
                        IERC20(holding.tokenAddress).safeIncreaseAllowance(address(swapHelper), tokensToSell);

                        // Execute swap
                        try swapHelper.sellRWAAsset(
                            holding.tokenAddress,
                            underlyingAsset,
                            tokensToSell,
                            defaultSwapSlippage
                        ) returns (uint256 usdtReceived) {
                            emit RWATokensSold(holding.tokenAddress, tokensToSell, usdtReceived);
                        } catch {
                            revert RWASwapFailed(holding.tokenAddress, tokensToSell);
                        }
                    }
                }
            }

            unchecked { ++i; }
        }

        // Invalidate RWA cache
        _cachedRwaValue.timestamp = 0;
    }

    // =============================================================================
    // View Functions
    // =============================================================================

    /// @notice Get the current share price (assets per share)
    /// @return Share price with PRECISION decimals
    function sharePrice() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return PRECISION;
        return totalAssets().mulDiv(PRECISION, supply);
    }

    /// @notice Get the total managed RWA assets
    /// @return Total managed assets
    function managedAssets() external view returns (uint256) {
        return _totalManagedAssets;
    }

    /// @notice Get all RWA holdings
    /// @return Array of RWA holdings
    function getRWAHoldings() external view returns (RWAHolding[] memory) {
        return _rwaHoldings;
    }

    /// @notice Get specific RWA holding by token address
    /// @param tokenAddress The token address
    /// @return The RWA holding data
    function getRWAHolding(address tokenAddress) external view returns (RWAHolding memory) {
        uint256 index = _holdingIndex[tokenAddress];
        if (index == 0) revert RWAAssetNotFound(tokenAddress);
        return _rwaHoldings[index - 1];
    }

    /// @notice Get the number of RWA holdings
    /// @return Count of RWA holdings
    function rwaHoldingCount() external view returns (uint256) {
        return _rwaHoldings.length;
    }

    /// @notice Check if an RWA asset is in vault holdings
    /// @param tokenAddress The token address to check
    /// @return True if asset is in holdings
    function isRWAHolding(address tokenAddress) external view returns (bool) {
        return _holdingIndex[tokenAddress] != 0;
    }

    /// @notice Get the current aggregated RWA value (fresh calculation)
    /// @return Total RWA value in underlying asset terms
    function getRWAValue() external view returns (uint256) {
        if (address(oracleAdapter) == address(0)) {
            return 0;
        }
        return _calculateRWAValue();
    }

    /// @notice Get cached RWA value info
    /// @return value Cached value
    /// @return timestamp When cached
    /// @return isFresh Whether cache is still valid
    function getCachedRWAValue() external view returns (uint256 value, uint256 timestamp, bool isFresh) {
        return (
            _cachedRwaValue.value,
            _cachedRwaValue.timestamp,
            _cachedRwaValue.timestamp != 0 &&
                _cachedRwaValue.timestamp + CACHE_DURATION > block.timestamp
        );
    }

    // =============================================================================
    // Required Overrides
    // =============================================================================

    /// @notice Check if contract supports an interface
    /// @param interfaceId The interface identifier
    /// @return True if interface is supported
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /// @notice Returns the number of decimals used for shares
    /// @return Number of decimals
    function decimals() public view override(ERC4626) returns (uint8) {
        return super.decimals();
    }
}
