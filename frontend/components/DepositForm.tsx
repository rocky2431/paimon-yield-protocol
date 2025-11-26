'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useEstimateGas,
} from 'wagmi';
import { parseUnits, formatUnits, encodeFunctionData } from 'viem';
import { contracts } from '@/lib/wagmi/config';
import { ERC20_ABI, PNGY_VAULT_ABI, MIN_DEPOSIT } from '@/lib/contracts/abis';
import { useWallet } from './WalletConnect';
import { useDebounce } from '@/lib/performance/hooks';

// Transaction status type
type TxStatus = 'idle' | 'approving' | 'approved' | 'depositing' | 'success' | 'error';

interface DepositFormProps {
  className?: string;
  onDepositSuccess?: (txHash: string, shares: bigint) => void;
}

export function DepositForm({ className = '', onDepositSuccess }: DepositFormProps) {
  const { address, isConnected, usdtBalance, usdtDecimals, isOnSupportedNetwork, refetchBalance } = useWallet();
  const chainId = useChainId();

  // Form state
  const [amount, setAmount] = useState<string>('');
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Debounce amount for contract calls (300ms) - INP optimization
  const debouncedAmount = useDebounce(amount, 300);

  // Get contract addresses for current chain
  const getContractAddresses = () => {
    if (!chainId) return null;
    const contractsForChain = contracts[chainId as keyof typeof contracts];
    return contractsForChain || null;
  };
  const contractAddresses = getContractAddresses();
  const vaultAddress = contractAddresses?.pngyVault;
  const usdtAddress = contractAddresses?.usdt;

  // Parse amount to BigInt (use debounced for contract calls, immediate for UI)
  const parsedAmount = amount ? parseUnits(amount, usdtDecimals) : BigInt(0);
  const debouncedParsedAmount = debouncedAmount ? parseUnits(debouncedAmount, usdtDecimals) : BigInt(0);

  // Read USDT allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdtAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && vaultAddress ? [address, vaultAddress] : undefined,
    query: {
      enabled: !!address && !!usdtAddress && !!vaultAddress,
    },
  });

  // Preview deposit (get expected shares) - uses debounced amount to reduce RPC calls
  const { data: previewShares, isLoading: isPreviewLoading } = useReadContract({
    address: vaultAddress,
    abi: PNGY_VAULT_ABI,
    functionName: 'previewDeposit',
    args: debouncedParsedAmount > 0 ? [debouncedParsedAmount] : undefined,
    query: {
      enabled: !!vaultAddress && debouncedParsedAmount > 0,
    },
  });

  // Check if vault is paused
  const { data: isPaused } = useReadContract({
    address: vaultAddress,
    abi: PNGY_VAULT_ABI,
    functionName: 'paused',
    query: {
      enabled: !!vaultAddress,
    },
  });

  // Write contract hooks
  const {
    data: approveHash,
    writeContract: approveUsdt,
    isPending: isApprovePending,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();

  const {
    data: depositHash,
    writeContract: depositToVault,
    isPending: isDepositPending,
    error: depositError,
    reset: resetDeposit,
  } = useWriteContract();

  // Wait for transaction receipts
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({
      hash: approveHash,
    });

  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess, data: depositReceipt } =
    useWaitForTransactionReceipt({
      hash: depositHash,
    });

  // Gas estimation for deposit - uses debounced amount to reduce RPC calls
  const { data: estimatedGas } = useEstimateGas({
    to: vaultAddress,
    data: vaultAddress && address && debouncedParsedAmount > 0
      ? encodeFunctionData({
          abi: PNGY_VAULT_ABI,
          functionName: 'deposit',
          args: [debouncedParsedAmount, address],
        })
      : undefined,
    query: {
      enabled: !!vaultAddress && !!address && debouncedParsedAmount > 0 && (allowance ?? BigInt(0)) >= debouncedParsedAmount,
    },
  });

  // Check if amount needs approval
  const needsApproval = allowance !== undefined && parsedAmount > 0 && allowance < parsedAmount;

  // Validation
  const validateAmount = useCallback(() => {
    if (!amount || amount === '') return null;
    const parsed = parsedAmount;

    if (parsed < MIN_DEPOSIT) {
      return 'Minimum deposit is 500 USDT';
    }
    if (usdtBalance && parsed > usdtBalance) {
      return 'Insufficient USDT balance';
    }
    return null;
  }, [amount, parsedAmount, usdtBalance]);

  const validationError = validateAmount();
  const isValidAmount = !validationError && parsedAmount > 0;

  // Handle approve
  const handleApprove = async () => {
    if (!usdtAddress || !vaultAddress) return;

    setTxStatus('approving');
    setErrorMessage('');
    resetApprove();

    try {
      approveUsdt({
        address: usdtAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [vaultAddress, parsedAmount],
      });
    } catch (err) {
      setTxStatus('error');
      setErrorMessage('Failed to initiate approval');
    }
  };

  // Handle deposit
  const handleDeposit = async () => {
    if (!vaultAddress || !address) return;

    setTxStatus('depositing');
    setErrorMessage('');
    resetDeposit();

    try {
      depositToVault({
        address: vaultAddress,
        abi: PNGY_VAULT_ABI,
        functionName: 'deposit',
        args: [parsedAmount, address],
      });
    } catch (err) {
      setTxStatus('error');
      setErrorMessage('Failed to initiate deposit');
    }
  };

  // Effect: Handle approval success
  useEffect(() => {
    if (isApproveSuccess && txStatus === 'approving') {
      setTxStatus('approved');
      refetchAllowance();
    }
  }, [isApproveSuccess, txStatus, refetchAllowance]);

  // Effect: Handle deposit success
  useEffect(() => {
    if (isDepositSuccess && txStatus === 'depositing') {
      setTxStatus('success');
      refetchBalance();
      refetchAllowance();
      if (depositHash && previewShares && onDepositSuccess) {
        onDepositSuccess(depositHash, previewShares);
      }
    }
  }, [isDepositSuccess, txStatus, depositHash, previewShares, onDepositSuccess, refetchBalance, refetchAllowance]);

  // Effect: Handle errors
  useEffect(() => {
    if (approveError) {
      setTxStatus('error');
      setErrorMessage(approveError.message || 'Approval failed');
    }
    if (depositError) {
      setTxStatus('error');
      setErrorMessage(depositError.message || 'Deposit failed');
    }
  }, [approveError, depositError]);

  // Reset form
  const resetForm = () => {
    setAmount('');
    setTxStatus('idle');
    setErrorMessage('');
    resetApprove();
    resetDeposit();
  };

  // Format balance for display
  const formatBalance = (value: bigint | undefined, decimals: number = 18) => {
    if (!value) return '0.00';
    return parseFloat(formatUnits(value, decimals)).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Format gas estimate
  const formatGas = (gas: bigint | undefined) => {
    if (!gas) return '--';
    return gas.toString();
  };

  // Set max amount
  const handleSetMax = () => {
    if (usdtBalance) {
      setAmount(formatUnits(usdtBalance, usdtDecimals));
    }
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-xl font-semibold mb-4">Deposit USDT</h2>
        <p className="text-gray-500 text-center py-8">
          Connect your wallet to deposit
        </p>
      </div>
    );
  }

  // Wrong network
  if (!isOnSupportedNetwork) {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-xl font-semibold mb-4">Deposit USDT</h2>
        <p className="text-amber-600 text-center py-8">
          Please switch to BSC network to deposit
        </p>
      </div>
    );
  }

  // Vault paused
  if (isPaused) {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-xl font-semibold mb-4">Deposit USDT</h2>
        <p className="text-red-600 text-center py-8">
          Deposits are temporarily paused
        </p>
      </div>
    );
  }

  // Success state
  if (txStatus === 'success') {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-xl font-semibold mb-4">Deposit Successful!</h2>
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-gray-600 mb-2">You deposited {amount} USDT</p>
          <p className="text-gray-500 text-sm mb-4">
            Received: {formatBalance(previewShares)} PNGY
          </p>
          {depositHash && (
            <a
              href={`https://bscscan.com/tx/${depositHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-500 hover:text-sky-600 text-sm"
            >
              View on BSCScan
            </a>
          )}
          <button
            onClick={resetForm}
            className="mt-6 w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors"
          >
            Make Another Deposit
          </button>
        </div>
      </div>
    );
  }

  const isProcessing = isApprovePending || isApproveConfirming || isDepositPending || isDepositConfirming;

  return (
    <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      <h2 className="text-xl font-semibold mb-4">Deposit USDT</h2>

      {/* Amount Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="500"
            step="0.01"
            disabled={isProcessing}
            className="w-full px-4 py-3 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button
              onClick={handleSetMax}
              disabled={isProcessing}
              className="text-sky-500 hover:text-sky-600 text-sm font-medium disabled:text-gray-400"
            >
              MAX
            </button>
            <span className="text-gray-500">USDT</span>
          </div>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-sm text-gray-500">
            Min: 500 USDT
          </span>
          <span className="text-sm text-gray-500">
            Balance: {formatBalance(usdtBalance, usdtDecimals)} USDT
          </span>
        </div>
        {validationError && (
          <p className="text-red-500 text-sm mt-1">{validationError}</p>
        )}
      </div>

      {/* Preview */}
      {isValidAmount && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">You will receive</span>
            <span className="font-medium">
              {isPreviewLoading ? '...' : formatBalance(previewShares)} PNGY
            </span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-gray-600">Estimated Gas</span>
            <span className="font-medium text-gray-500">
              ~{formatGas(estimatedGas)} units
            </span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && txStatus === 'error' && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Transaction Status */}
      {(txStatus === 'approving' || txStatus === 'approved' || txStatus === 'depositing') && (
        <div className="mb-4 p-3 bg-sky-50 border border-sky-200 rounded-lg">
          <div className="flex items-center gap-2">
            {isProcessing && (
              <svg className="animate-spin h-4 w-4 text-sky-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <span className="text-sky-700 text-sm">
              {txStatus === 'approving' && (isApproveConfirming ? 'Confirming approval...' : 'Approving USDT...')}
              {txStatus === 'approved' && 'Approved! Ready to deposit'}
              {txStatus === 'depositing' && (isDepositConfirming ? 'Confirming deposit...' : 'Depositing...')}
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {needsApproval && txStatus !== 'approved' && (
          <button
            onClick={handleApprove}
            disabled={!isValidAmount || isProcessing}
            className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isApprovePending || isApproveConfirming ? 'Approving...' : 'Approve USDT'}
          </button>
        )}

        <button
          onClick={handleDeposit}
          disabled={!isValidAmount || needsApproval && txStatus !== 'approved' || isProcessing}
          className="w-full py-3 px-4 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {isDepositPending || isDepositConfirming ? 'Depositing...' : 'Deposit'}
        </button>
      </div>

      {/* Info */}
      <p className="text-xs text-gray-500 mt-4 text-center">
        Deposits are processed instantly. PNGY tokens represent your share of the vault.
      </p>
    </div>
  );
}

export default DepositForm;
