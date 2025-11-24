'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { contracts } from '@/lib/wagmi/config';
import { PNGY_VAULT_WITHDRAW_ABI, MAX_WITHDRAWAL, WITHDRAWAL_DELAY } from '@/lib/contracts/abis';
import { useWallet } from './WalletConnect';

// Transaction status type
type TxStatus = 'idle' | 'requesting' | 'requested' | 'claiming' | 'claimed' | 'error';

interface WithdrawFormProps {
  className?: string;
  onWithdrawSuccess?: (txHash: string) => void;
}

export function WithdrawForm({ className = '', onWithdrawSuccess }: WithdrawFormProps) {
  const { address, isConnected, isOnSupportedNetwork, refetchBalance } = useWallet();
  const chainId = useChainId();

  // Form state
  const [amount, setAmount] = useState<string>('');
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Get contract addresses
  const getVaultAddress = (): `0x${string}` | undefined => {
    if (!chainId) return undefined;
    const contractsForChain = contracts[chainId as keyof typeof contracts];
    return contractsForChain?.pngyVault;
  };
  const vaultAddress = getVaultAddress();

  // Parse amount to BigInt (18 decimals for PNGY shares)
  const parsedAmount = amount ? parseUnits(amount, 18) : BigInt(0);

  // Read PNGY balance
  const { data: pngyBalance, refetch: refetchPngyBalance } = useReadContract({
    address: vaultAddress,
    abi: PNGY_VAULT_WITHDRAW_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!vaultAddress && !!address,
    },
  });

  // Read locked shares
  const { data: lockedShares } = useReadContract({
    address: vaultAddress,
    abi: PNGY_VAULT_WITHDRAW_ABI,
    functionName: 'getUserLockedShares',
    args: address ? [address] : undefined,
    query: {
      enabled: !!vaultAddress && !!address,
    },
  });

  // Available balance (total - locked)
  const availableBalance = pngyBalance && lockedShares
    ? pngyBalance - lockedShares
    : pngyBalance ?? BigInt(0);

  // Preview redeem (get expected USDT)
  const { data: previewAssets, isLoading: isPreviewLoading } = useReadContract({
    address: vaultAddress,
    abi: PNGY_VAULT_WITHDRAW_ABI,
    functionName: 'previewRedeem',
    args: parsedAmount > 0 ? [parsedAmount] : undefined,
    query: {
      enabled: !!vaultAddress && parsedAmount > 0,
    },
  });

  // Check if vault is paused
  const { data: isPaused } = useReadContract({
    address: vaultAddress,
    abi: PNGY_VAULT_WITHDRAW_ABI,
    functionName: 'paused',
    query: {
      enabled: !!vaultAddress,
    },
  });

  // Get user's pending request IDs
  const { data: pendingRequestIds, refetch: refetchPendingRequests } = useReadContract({
    address: vaultAddress,
    abi: PNGY_VAULT_WITHDRAW_ABI,
    functionName: 'getUserPendingRequests',
    args: address ? [address] : undefined,
    query: {
      enabled: !!vaultAddress && !!address,
    },
  });

  // Write contract hooks
  const {
    data: requestHash,
    writeContract: requestWithdraw,
    isPending: isRequestPending,
    error: requestError,
    reset: resetRequest,
  } = useWriteContract();

  const {
    data: claimHash,
    writeContract: claimWithdraw,
    isPending: isClaimPending,
    error: claimError,
    reset: resetClaim,
  } = useWriteContract();

  // Wait for transaction receipts
  const { isLoading: isRequestConfirming, isSuccess: isRequestSuccess } =
    useWaitForTransactionReceipt({ hash: requestHash });

  const { isLoading: isClaimConfirming, isSuccess: isClaimSuccess } =
    useWaitForTransactionReceipt({ hash: claimHash });

  // Note: pendingRequests state is simplified - actual request details
  // would need to be fetched via multicall in a production implementation
  // For now, we display basic request info from the IDs

  // Validation
  const validateAmount = useCallback(() => {
    if (!amount || amount === '') return null;
    const parsed = parsedAmount;

    if (parsed <= BigInt(0)) {
      return 'Amount must be greater than 0';
    }
    if (availableBalance && parsed > availableBalance) {
      return 'Insufficient PNGY balance';
    }
    if (previewAssets && previewAssets > MAX_WITHDRAWAL) {
      return 'Exceeds maximum withdrawal ($100,000)';
    }
    return null;
  }, [amount, parsedAmount, availableBalance, previewAssets]);

  const validationError = validateAmount();
  const isValidAmount = !validationError && parsedAmount > 0;

  // Handle request withdraw
  const handleRequestWithdraw = async () => {
    if (!vaultAddress || !address) return;

    setTxStatus('requesting');
    setErrorMessage('');
    resetRequest();

    try {
      requestWithdraw({
        address: vaultAddress,
        abi: PNGY_VAULT_WITHDRAW_ABI,
        functionName: 'requestWithdraw',
        args: [parsedAmount, address],
      });
    } catch (err) {
      setTxStatus('error');
      setErrorMessage('Failed to initiate withdrawal request');
    }
  };

  // Handle claim withdraw
  const handleClaimWithdraw = async (requestId: bigint) => {
    if (!vaultAddress) return;

    setTxStatus('claiming');
    setErrorMessage('');
    resetClaim();

    try {
      claimWithdraw({
        address: vaultAddress,
        abi: PNGY_VAULT_WITHDRAW_ABI,
        functionName: 'claimWithdraw',
        args: [requestId],
      });
    } catch (err) {
      setTxStatus('error');
      setErrorMessage('Failed to claim withdrawal');
    }
  };

  // Effect: Handle request success
  useEffect(() => {
    if (isRequestSuccess && txStatus === 'requesting') {
      setTxStatus('requested');
      setAmount('');
      refetchPngyBalance();
      refetchPendingRequests();
      if (requestHash && onWithdrawSuccess) {
        onWithdrawSuccess(requestHash);
      }
    }
  }, [isRequestSuccess, txStatus, requestHash, onWithdrawSuccess, refetchPngyBalance, refetchPendingRequests]);

  // Effect: Handle claim success
  useEffect(() => {
    if (isClaimSuccess && txStatus === 'claiming') {
      setTxStatus('claimed');
      refetchBalance();
      refetchPngyBalance();
      refetchPendingRequests();
    }
  }, [isClaimSuccess, txStatus, refetchBalance, refetchPngyBalance, refetchPendingRequests]);

  // Effect: Handle errors
  useEffect(() => {
    if (requestError) {
      setTxStatus('error');
      setErrorMessage(requestError.message || 'Request failed');
    }
    if (claimError) {
      setTxStatus('error');
      setErrorMessage(claimError.message || 'Claim failed');
    }
  }, [requestError, claimError]);

  // Reset form
  const resetForm = () => {
    setAmount('');
    setTxStatus('idle');
    setErrorMessage('');
    resetRequest();
    resetClaim();
  };

  // Format balance
  const formatBalance = (value: bigint | undefined, decimals: number = 18) => {
    if (!value) return '0.00';
    return parseFloat(formatUnits(value, decimals)).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  };

  // Set max amount
  const handleSetMax = () => {
    if (availableBalance) {
      setAmount(formatUnits(availableBalance, 18));
    }
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-xl font-semibold mb-4">Withdraw</h2>
        <p className="text-gray-500 text-center py-8">
          Connect your wallet to withdraw
        </p>
      </div>
    );
  }

  // Wrong network
  if (!isOnSupportedNetwork) {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-xl font-semibold mb-4">Withdraw</h2>
        <p className="text-amber-600 text-center py-8">
          Please switch to BSC network to withdraw
        </p>
      </div>
    );
  }

  // Vault paused
  if (isPaused) {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-xl font-semibold mb-4">Withdraw</h2>
        <p className="text-red-600 text-center py-8">
          Withdrawals are temporarily paused
        </p>
      </div>
    );
  }

  // Success states
  if (txStatus === 'requested') {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-xl font-semibold mb-4">Withdrawal Requested!</h2>
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-2">Your withdrawal request has been submitted</p>
          <p className="text-gray-500 text-sm mb-4">
            You can claim your USDT after 24 hours (T+1)
          </p>
          {requestHash && (
            <a
              href={`https://bscscan.com/tx/${requestHash}`}
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
            Make Another Withdrawal
          </button>
        </div>
      </div>
    );
  }

  if (txStatus === 'claimed') {
    return (
      <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <h2 className="text-xl font-semibold mb-4">Withdrawal Claimed!</h2>
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">Your USDT has been sent to your wallet</p>
          {claimHash && (
            <a
              href={`https://bscscan.com/tx/${claimHash}`}
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
            Done
          </button>
        </div>
      </div>
    );
  }

  const isProcessing = isRequestPending || isRequestConfirming || isClaimPending || isClaimConfirming;

  return (
    <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      <h2 className="text-xl font-semibold mb-4">Withdraw</h2>

      {/* Amount Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          PNGY Amount
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.0001"
            disabled={isProcessing}
            className="w-full px-4 py-3 pr-24 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button
              onClick={handleSetMax}
              disabled={isProcessing}
              className="text-sky-500 hover:text-sky-600 text-sm font-medium disabled:text-gray-400"
            >
              MAX
            </button>
            <span className="text-gray-500">PNGY</span>
          </div>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-sm text-gray-500">
            Max: $100,000 USDT
          </span>
          <span className="text-sm text-gray-500">
            Available: {formatBalance(availableBalance)} PNGY
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
              {isPreviewLoading ? '...' : formatBalance(previewAssets)} USDT
            </span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-gray-600">Processing time</span>
            <span className="font-medium text-amber-600">T+1 (24 hours)</span>
          </div>
        </div>
      )}

      {/* T+1 Notice */}
      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-amber-800 text-sm font-medium">T+1 Withdrawal</p>
            <p className="text-amber-700 text-xs mt-1">
              Withdrawals require a 24-hour waiting period. You can claim your USDT after this time.
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && txStatus === 'error' && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Transaction Status */}
      {(txStatus === 'requesting' || txStatus === 'claiming') && (
        <div className="mb-4 p-3 bg-sky-50 border border-sky-200 rounded-lg">
          <div className="flex items-center gap-2">
            {isProcessing && (
              <svg className="animate-spin h-4 w-4 text-sky-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <span className="text-sky-700 text-sm">
              {txStatus === 'requesting' && (isRequestConfirming ? 'Confirming request...' : 'Requesting withdrawal...')}
              {txStatus === 'claiming' && (isClaimConfirming ? 'Confirming claim...' : 'Claiming withdrawal...')}
            </span>
          </div>
        </div>
      )}

      {/* Request Button */}
      <button
        onClick={handleRequestWithdraw}
        disabled={!isValidAmount || isProcessing}
        className="w-full py-3 px-4 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors mb-4"
      >
        {isRequestPending || isRequestConfirming ? 'Processing...' : 'Request Withdrawal'}
      </button>

      {/* Pending Withdrawals Section */}
      {pendingRequestIds && pendingRequestIds.length > 0 && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Pending Withdrawals ({pendingRequestIds.length})
          </h3>
          <div className="space-y-2">
            {pendingRequestIds.map((requestId, index) => (
              <div
                key={requestId.toString()}
                className="p-3 bg-gray-50 rounded-lg flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Request #{requestId.toString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    Check BSCScan for details
                  </p>
                </div>
                <button
                  onClick={() => handleClaimWithdraw(requestId)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white text-sm font-medium rounded transition-colors"
                >
                  Claim
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <p className="text-xs text-gray-500 mt-4 text-center">
        PNGY shares will be burned upon claiming. USDT amount may vary based on current NAV.
      </p>
    </div>
  );
}

export default WithdrawForm;
