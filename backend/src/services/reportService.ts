/**
 * Report Service
 * Task #58 - 实现 B2B 定制化报表导出
 *
 * Generates CSV reports for transaction history, net value changes, and yield details
 */

import { prisma } from './database.js';
import { formatUnits } from 'viem';

// =============================================================================
// Types
// =============================================================================

export type ReportType = 'transactions' | 'netvalue' | 'summary';

export interface ReportOptions {
  userAddress: string;
  reportType: ReportType;
  startDate?: Date;
  endDate?: Date;
}

export interface TransactionRow {
  date: string;
  type: string;
  amount: string;
  shares: string;
  sharePrice: string;
  txHash: string;
  blockNumber: string;
}

export interface NetValueRow {
  date: string;
  totalAssets: string;
  totalShares: string;
  sharePrice: string;
  apy: string;
}

export interface SummaryRow {
  metric: string;
  value: string;
}

// =============================================================================
// CSV Generation Helpers
// =============================================================================

/**
 * Escape CSV field value
 * Handles commas, quotes, and newlines
 */
function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convert array of objects to CSV string
 */
function toCSV<T extends Record<string, string>>(rows: T[], headers: string[]): string {
  const headerLine = headers.map(escapeCSVField).join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCSVField(row[h] || '')).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Format decimal from wei to human-readable string
 */
function formatDecimal(value: bigint | string, decimals = 18, precision = 6): string {
  const formatted = formatUnits(BigInt(value.toString()), decimals);
  const num = parseFloat(formatted);
  return num.toFixed(precision);
}

/**
 * Format date to ISO string (date only)
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format datetime to ISO string
 */
function formatDateTime(date: Date): string {
  return date.toISOString();
}

// =============================================================================
// Report Generators
// =============================================================================

/**
 * Generate transaction history CSV report
 */
export async function generateTransactionReport(
  userAddress: string,
  startDate?: Date,
  endDate?: Date
): Promise<string> {
  const normalizedAddress = userAddress.toLowerCase();

  const whereClause: {
    userAddress: string;
    timestamp?: { gte?: Date; lte?: Date };
  } = {
    userAddress: normalizedAddress,
  };

  if (startDate || endDate) {
    whereClause.timestamp = {};
    if (startDate) whereClause.timestamp.gte = startDate;
    if (endDate) whereClause.timestamp.lte = endDate;
  }

  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    orderBy: { timestamp: 'desc' },
  });

  const rows: TransactionRow[] = transactions.map((tx) => ({
    date: formatDateTime(tx.timestamp),
    type: tx.type,
    amount: formatDecimal(tx.amount.toString()),
    shares: formatDecimal(tx.shares.toString()),
    sharePrice: formatDecimal(tx.sharePrice.toString()),
    txHash: tx.txHash,
    blockNumber: tx.blockNumber.toString(),
  }));

  const headers = ['date', 'type', 'amount', 'shares', 'sharePrice', 'txHash', 'blockNumber'];
  return toCSV(rows, headers);
}

/**
 * Generate net value history CSV report
 */
export async function generateNetValueReport(
  startDate?: Date,
  endDate?: Date
): Promise<string> {
  const whereClause: {
    timestamp?: { gte?: Date; lte?: Date };
  } = {};

  if (startDate || endDate) {
    whereClause.timestamp = {};
    if (startDate) whereClause.timestamp.gte = startDate;
    if (endDate) whereClause.timestamp.lte = endDate;
  }

  const netValues = await prisma.netValue.findMany({
    where: whereClause,
    orderBy: { timestamp: 'desc' },
  });

  // Calculate APY for each data point
  const rows: NetValueRow[] = netValues.map((nv, index) => {
    let apy = '0.000000';

    if (index < netValues.length - 1) {
      const prevNv = netValues[index + 1];
      const currentPrice = Number(formatUnits(BigInt(nv.sharePrice.toString()), 18));
      const prevPrice = Number(formatUnits(BigInt(prevNv.sharePrice.toString()), 18));

      if (prevPrice > 0) {
        const timeDiffMs = nv.timestamp.getTime() - prevNv.timestamp.getTime();
        const yearMs = 365.25 * 24 * 60 * 60 * 1000;
        const periodsPerYear = yearMs / timeDiffMs;
        const periodReturn = (currentPrice - prevPrice) / prevPrice;
        const annualizedReturn = periodReturn * periodsPerYear * 100;
        apy = annualizedReturn.toFixed(6);
      }
    }

    return {
      date: formatDateTime(nv.timestamp),
      totalAssets: formatDecimal(nv.totalAssets.toString()),
      totalShares: formatDecimal(nv.totalShares.toString()),
      sharePrice: formatDecimal(nv.sharePrice.toString()),
      apy,
    };
  });

  const headers = ['date', 'totalAssets', 'totalShares', 'sharePrice', 'apy'];
  return toCSV(rows, headers);
}

/**
 * Generate summary report for a user
 */
export async function generateSummaryReport(
  userAddress: string,
  startDate?: Date,
  endDate?: Date
): Promise<string> {
  const normalizedAddress = userAddress.toLowerCase();

  // Get user position
  const position = await prisma.userPosition.findUnique({
    where: { userAddress: normalizedAddress },
  });

  // Get transaction stats
  const whereClause: {
    userAddress: string;
    timestamp?: { gte?: Date; lte?: Date };
  } = {
    userAddress: normalizedAddress,
  };

  if (startDate || endDate) {
    whereClause.timestamp = {};
    if (startDate) whereClause.timestamp.gte = startDate;
    if (endDate) whereClause.timestamp.lte = endDate;
  }

  const transactions = await prisma.transaction.findMany({
    where: whereClause,
  });

  // Calculate stats
  let totalDeposited = 0n;
  let totalWithdrawn = 0n;
  let depositCount = 0;
  let withdrawCount = 0;

  for (const tx of transactions) {
    if (tx.type === 'DEPOSIT') {
      totalDeposited += BigInt(tx.amount.toString());
      depositCount++;
    } else {
      totalWithdrawn += BigInt(tx.amount.toString());
      withdrawCount++;
    }
  }

  // Get latest net value for current share price
  const latestNetValue = await prisma.netValue.findFirst({
    orderBy: { timestamp: 'desc' },
  });

  // Calculate current value and yield
  const currentShares = position ? BigInt(position.shares.toString()) : 0n;
  const costBasis = position ? BigInt(position.costBasis.toString()) : 0n;
  const currentSharePrice = latestNetValue
    ? BigInt(latestNetValue.sharePrice.toString())
    : BigInt('1000000000000000000'); // 1e18 default

  const currentValue = (currentShares * currentSharePrice) / BigInt('1000000000000000000');
  const totalYield = currentValue > costBasis ? currentValue - costBasis : 0n;
  const yieldPercent =
    costBasis > 0n ? (Number(totalYield) / Number(costBasis)) * 100 : 0;

  const rows: SummaryRow[] = [
    { metric: 'Wallet Address', value: normalizedAddress },
    { metric: 'Report Period Start', value: startDate ? formatDate(startDate) : 'All Time' },
    { metric: 'Report Period End', value: endDate ? formatDate(endDate) : 'Current' },
    { metric: 'Total Deposits (USDT)', value: formatDecimal(totalDeposited.toString()) },
    { metric: 'Total Withdrawals (USDT)', value: formatDecimal(totalWithdrawn.toString()) },
    { metric: 'Net Deposits (USDT)', value: formatDecimal((totalDeposited - totalWithdrawn).toString()) },
    { metric: 'Deposit Transactions', value: depositCount.toString() },
    { metric: 'Withdrawal Transactions', value: withdrawCount.toString() },
    { metric: 'Current PNGY Shares', value: formatDecimal(currentShares.toString()) },
    { metric: 'Cost Basis (USDT)', value: formatDecimal(costBasis.toString()) },
    { metric: 'Current Value (USDT)', value: formatDecimal(currentValue.toString()) },
    { metric: 'Total Yield (USDT)', value: formatDecimal(totalYield.toString()) },
    { metric: 'Yield Percentage', value: `${yieldPercent.toFixed(2)}%` },
    { metric: 'Current Share Price', value: formatDecimal(currentSharePrice.toString()) },
    { metric: 'Report Generated', value: formatDateTime(new Date()) },
  ];

  const headers = ['metric', 'value'];
  return toCSV(rows, headers);
}

/**
 * Generate report based on type
 */
export async function generateReport(options: ReportOptions): Promise<string> {
  const { userAddress, reportType, startDate, endDate } = options;

  switch (reportType) {
    case 'transactions':
      return generateTransactionReport(userAddress, startDate, endDate);
    case 'netvalue':
      return generateNetValueReport(startDate, endDate);
    case 'summary':
      return generateSummaryReport(userAddress, startDate, endDate);
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
}

/**
 * Get suggested filename for report
 */
export function getReportFilename(
  reportType: ReportType,
  userAddress?: string,
  startDate?: Date,
  endDate?: Date
): string {
  const parts = ['paimon-yield'];
  parts.push(reportType);

  if (userAddress) {
    parts.push(userAddress.slice(0, 10));
  }

  if (startDate) {
    parts.push(formatDate(startDate));
  }

  if (endDate) {
    parts.push(formatDate(endDate));
  }

  parts.push(formatDate(new Date()));

  return `${parts.join('-')}.csv`;
}
