import { prisma } from './database.js';
import type { TransactionType } from '@prisma/client';

// =============================================================================
// User Operations
// =============================================================================

export async function findOrCreateUser(address: string) {
  return prisma.user.upsert({
    where: { address: address.toLowerCase() },
    update: {},
    create: { address: address.toLowerCase() },
  });
}

export async function getUserPosition(address: string) {
  return prisma.userPosition.findUnique({
    where: { userAddress: address.toLowerCase() },
  });
}

// =============================================================================
// Transaction Operations
// =============================================================================

export interface CreateTransactionInput {
  txHash: string;
  type: TransactionType;
  userAddress: string;
  amount: bigint;
  shares: bigint;
  sharePrice: bigint;
  blockNumber: bigint;
  timestamp: Date;
}

export async function createTransaction(input: CreateTransactionInput) {
  const { txHash, type, userAddress, amount, shares, sharePrice, blockNumber, timestamp } = input;

  // Ensure user exists
  await findOrCreateUser(userAddress);

  return prisma.transaction.create({
    data: {
      txHash,
      type,
      userAddress: userAddress.toLowerCase(),
      amount: amount.toString(),
      shares: shares.toString(),
      sharePrice: sharePrice.toString(),
      blockNumber,
      timestamp,
    },
  });
}

export async function getRecentTransactions(limit = 10, offset = 0) {
  return prisma.transaction.findMany({
    take: limit,
    skip: offset,
    orderBy: { timestamp: 'desc' },
    include: {
      user: true,
    },
  });
}

export async function getUserTransactions(address: string, limit = 10, offset = 0) {
  return prisma.transaction.findMany({
    where: { userAddress: address.toLowerCase() },
    take: limit,
    skip: offset,
    orderBy: { timestamp: 'desc' },
  });
}

// =============================================================================
// Net Value Operations
// =============================================================================

export interface CreateNetValueInput {
  timestamp: Date;
  totalAssets: bigint;
  totalShares: bigint;
  sharePrice: bigint;
  blockNumber: bigint;
}

export async function createNetValue(input: CreateNetValueInput) {
  return prisma.netValue.create({
    data: {
      timestamp: input.timestamp,
      totalAssets: input.totalAssets.toString(),
      totalShares: input.totalShares.toString(),
      sharePrice: input.sharePrice.toString(),
      blockNumber: input.blockNumber,
    },
  });
}

export async function getLatestNetValue() {
  return prisma.netValue.findFirst({
    orderBy: { timestamp: 'desc' },
  });
}

export async function getNetValueHistory(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return prisma.netValue.findMany({
    where: {
      timestamp: { gte: since },
    },
    orderBy: { timestamp: 'asc' },
  });
}

// =============================================================================
// Asset Allocation Operations
// =============================================================================

export async function getActiveAllocations() {
  return prisma.assetAllocation.findMany({
    where: { isActive: true },
    orderBy: { allocation: 'desc' },
  });
}

export async function updateAssetAllocation(
  tokenAddress: string,
  data: {
    allocation?: number;
    balance?: bigint;
    valueUsd?: bigint;
    apy?: number;
  }
) {
  return prisma.assetAllocation.update({
    where: { tokenAddress: tokenAddress.toLowerCase() },
    data: {
      allocation: data.allocation,
      balance: data.balance?.toString(),
      valueUsd: data.valueUsd?.toString(),
      apy: data.apy,
    },
  });
}

// =============================================================================
// Rebalance History Operations
// =============================================================================

export async function getRecentRebalances(limit = 10) {
  return prisma.rebalanceHistory.findMany({
    take: limit,
    orderBy: { timestamp: 'desc' },
  });
}
