// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

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
    }

    // =============================================================================
    // ERC4626 Overrides - View Functions
    // =============================================================================

    /// @notice Returns the total amount of underlying assets managed by the vault
    /// @dev Includes both idle assets and RWA assets
    /// @return Total assets in the vault
    function totalAssets() public view override returns (uint256) {
        // Idle assets in vault + managed RWA assets
        return IERC20(asset()).balanceOf(address(this)) + _totalManagedAssets;
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
