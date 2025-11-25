import {
  createPublicClient,
  http,
  webSocket,
  parseAbiItem,
  type Log,
  type PublicClient,
  type WatchContractEventReturnType,
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { prisma } from './database';
import { env } from '../config/env';

// =============================================================================
// Types
// =============================================================================

export interface EventListenerConfig {
  vaultAddress: `0x${string}`;
  startBlock?: bigint;
  confirmations?: number;
  pollInterval?: number;
}

export interface ProcessedEvent {
  txHash: string;
  blockNumber: bigint;
  logIndex: number;
}

// =============================================================================
// ABI Definitions
// =============================================================================

const DEPOSIT_PROCESSED_EVENT = parseAbiItem(
  'event DepositProcessed(address indexed sender, address indexed receiver, uint256 assets, uint256 shares)'
);

const WITHDRAW_PROCESSED_EVENT = parseAbiItem(
  'event WithdrawProcessed(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)'
);

const REBALANCE_EXECUTED_EVENT = parseAbiItem(
  'event RebalanceExecuted(address[] sellAssets, uint256[] sellAmounts, uint256[] sellReceived, address[] buyAssets, uint256[] buyAmounts, uint256[] buyReceived, uint256 timestamp)'
);

export const PNGY_VAULT_ABI = [
  DEPOSIT_PROCESSED_EVENT,
  WITHDRAW_PROCESSED_EVENT,
  REBALANCE_EXECUTED_EVENT,
] as const;

// =============================================================================
// EventListener Class
// =============================================================================

export class EventListener {
  private httpClient: PublicClient;
  private wsClient: PublicClient | null = null;
  private config: Required<EventListenerConfig>;
  private isRunning = false;
  private unwatch: WatchContractEventReturnType | null = null;
  private lastProcessedBlock: bigint = 0n;
  private processedEvents: Set<string> = new Set();

  constructor(config: EventListenerConfig) {
    const chain = env.NODE_ENV === 'production' ? bsc : bscTestnet;
    const httpRpcUrl =
      env.NODE_ENV === 'production'
        ? env.BSC_MAINNET_RPC_URL
        : env.BSC_TESTNET_RPC_URL;
    const wsRpcUrl =
      env.NODE_ENV === 'production'
        ? env.BSC_MAINNET_WS_URL
        : env.BSC_TESTNET_WS_URL;

    this.httpClient = createPublicClient({
      chain,
      transport: http(httpRpcUrl),
    });

    if (wsRpcUrl) {
      this.wsClient = createPublicClient({
        chain,
        transport: webSocket(wsRpcUrl),
      });
    }

    this.config = {
      vaultAddress: config.vaultAddress,
      startBlock: config.startBlock ?? 0n,
      confirmations: config.confirmations ?? env.EVENT_LISTENER_CONFIRMATIONS,
      pollInterval: config.pollInterval ?? 15000, // 15 seconds (BSC block time ~3s)
    };
  }

  // ---------------------------------------------------------------------------
  // Public Methods
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[EventListener] Already running');
      return;
    }

    console.log('[EventListener] Starting event listener...');
    console.log(`[EventListener] Vault address: ${this.config.vaultAddress}`);
    console.log(`[EventListener] Confirmations required: ${this.config.confirmations}`);

    this.isRunning = true;

    // Load last processed block from database
    await this.loadLastProcessedBlock();

    // Sync historical events first
    await this.syncHistoricalEvents();

    // Start real-time watching (WebSocket if available, otherwise polling)
    if (this.wsClient) {
      console.log('[EventListener] Using WebSocket for real-time events');
      this.startWebSocketWatcher();
    } else {
      console.log('[EventListener] Using HTTP polling for events');
      this.startPolling();
    }
  }

  async stop(): Promise<void> {
    console.log('[EventListener] Stopping event listener...');
    this.isRunning = false;

    if (this.unwatch) {
      this.unwatch();
      this.unwatch = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Historical Event Sync
  // ---------------------------------------------------------------------------

  private async loadLastProcessedBlock(): Promise<void> {
    const lastTx = await prisma.transaction.findFirst({
      orderBy: { blockNumber: 'desc' },
      select: { blockNumber: true },
    });

    if (lastTx) {
      this.lastProcessedBlock = lastTx.blockNumber;
      console.log(`[EventListener] Resuming from block ${this.lastProcessedBlock}`);
    } else if (this.config.startBlock > 0n) {
      this.lastProcessedBlock = this.config.startBlock;
      console.log(`[EventListener] Starting from configured block ${this.lastProcessedBlock}`);
    }
  }

  private async syncHistoricalEvents(): Promise<void> {
    const currentBlock = await this.httpClient.getBlockNumber();
    const safeBlock = currentBlock - BigInt(this.config.confirmations);

    if (this.lastProcessedBlock >= safeBlock) {
      console.log('[EventListener] Already synced to latest safe block');
      return;
    }

    console.log(`[EventListener] Syncing from block ${this.lastProcessedBlock} to ${safeBlock}`);

    // Process in chunks to avoid RPC limits
    const CHUNK_SIZE = 10000n;
    let fromBlock = this.lastProcessedBlock + 1n;

    while (fromBlock <= safeBlock) {
      const toBlock = fromBlock + CHUNK_SIZE - 1n > safeBlock ? safeBlock : fromBlock + CHUNK_SIZE - 1n;

      await this.fetchAndProcessEvents(fromBlock, toBlock);
      fromBlock = toBlock + 1n;
    }

    this.lastProcessedBlock = safeBlock;
    console.log(`[EventListener] Historical sync complete at block ${safeBlock}`);
  }

  private async fetchAndProcessEvents(fromBlock: bigint, toBlock: bigint): Promise<void> {
    console.log(`[EventListener] Fetching events from ${fromBlock} to ${toBlock}`);

    // Fetch deposit events
    const depositLogs = await this.httpClient.getLogs({
      address: this.config.vaultAddress,
      event: DEPOSIT_PROCESSED_EVENT,
      fromBlock,
      toBlock,
    });

    // Fetch withdraw events
    const withdrawLogs = await this.httpClient.getLogs({
      address: this.config.vaultAddress,
      event: WITHDRAW_PROCESSED_EVENT,
      fromBlock,
      toBlock,
    });

    // Fetch rebalance events
    const rebalanceLogs = await this.httpClient.getLogs({
      address: this.config.vaultAddress,
      event: REBALANCE_EXECUTED_EVENT,
      fromBlock,
      toBlock,
    });

    // Process all events
    for (const log of depositLogs) {
      await this.processDepositEvent(log);
    }

    for (const log of withdrawLogs) {
      await this.processWithdrawEvent(log);
    }

    for (const log of rebalanceLogs) {
      await this.processRebalanceEvent(log);
    }
  }

  // ---------------------------------------------------------------------------
  // Real-time Event Watching
  // ---------------------------------------------------------------------------

  private startWebSocketWatcher(): void {
    if (!this.wsClient) return;

    // Watch for deposit events
    this.wsClient.watchContractEvent({
      address: this.config.vaultAddress,
      abi: PNGY_VAULT_ABI,
      eventName: 'DepositProcessed',
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.handleRealtimeEvent(log, 'deposit');
        }
      },
      onError: (error) => {
        console.error('[EventListener] WebSocket deposit watch error:', error);
        this.handleWatchError();
      },
    });

    // Watch for withdraw events
    this.wsClient.watchContractEvent({
      address: this.config.vaultAddress,
      abi: PNGY_VAULT_ABI,
      eventName: 'WithdrawProcessed',
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.handleRealtimeEvent(log, 'withdraw');
        }
      },
      onError: (error) => {
        console.error('[EventListener] WebSocket withdraw watch error:', error);
        this.handleWatchError();
      },
    });

    // Watch for rebalance events
    this.wsClient.watchContractEvent({
      address: this.config.vaultAddress,
      abi: PNGY_VAULT_ABI,
      eventName: 'RebalanceExecuted',
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.handleRealtimeEvent(log, 'rebalance');
        }
      },
      onError: (error) => {
        console.error('[EventListener] WebSocket rebalance watch error:', error);
        this.handleWatchError();
      },
    });
  }

  private async handleRealtimeEvent(log: Log, eventType: string): Promise<void> {
    const eventKey = `${log.transactionHash}-${log.logIndex}`;

    // Skip if already processed
    if (this.processedEvents.has(eventKey)) {
      return;
    }

    // Check confirmations
    const currentBlock = await this.httpClient.getBlockNumber();
    const confirmations = currentBlock - (log.blockNumber ?? 0n);

    if (confirmations < BigInt(this.config.confirmations)) {
      console.log(`[EventListener] Event ${eventKey} waiting for confirmations (${confirmations}/${this.config.confirmations})`);
      // Schedule reprocessing after delay
      setTimeout(async () => {
        await this.handleRealtimeEvent(log, eventType);
      }, 5000);
      return;
    }

    // Process the confirmed event
    this.processedEvents.add(eventKey);

    switch (eventType) {
      case 'deposit':
        await this.processDepositEvent(log);
        break;
      case 'withdraw':
        await this.processWithdrawEvent(log);
        break;
      case 'rebalance':
        await this.processRebalanceEvent(log);
        break;
    }
  }

  private handleWatchError(): void {
    console.log('[EventListener] Falling back to HTTP polling');
    this.wsClient = null;
    this.startPolling();
  }

  // ---------------------------------------------------------------------------
  // HTTP Polling Fallback
  // ---------------------------------------------------------------------------

  private startPolling(): void {
    const poll = async (): Promise<void> => {
      if (!this.isRunning) return;

      try {
        const currentBlock = await this.httpClient.getBlockNumber();
        const safeBlock = currentBlock - BigInt(this.config.confirmations);

        if (safeBlock > this.lastProcessedBlock) {
          await this.fetchAndProcessEvents(this.lastProcessedBlock + 1n, safeBlock);
          this.lastProcessedBlock = safeBlock;
        }
      } catch (error) {
        console.error('[EventListener] Polling error:', error);
      }

      if (this.isRunning) {
        setTimeout(poll, this.config.pollInterval);
      }
    };

    poll();
  }

  // ---------------------------------------------------------------------------
  // Event Processing
  // ---------------------------------------------------------------------------

  private async processDepositEvent(log: Log): Promise<void> {
    if (!log.transactionHash || log.blockNumber === null) return;

    const eventKey = `${log.transactionHash}-${log.logIndex}`;

    try {
      // Check if already exists
      const existing = await prisma.transaction.findUnique({
        where: { txHash: log.transactionHash },
      });

      if (existing) {
        console.log(`[EventListener] Deposit ${log.transactionHash} already exists`);
        return;
      }

      // Decode event args
      const args = (log as any).args;
      if (!args) return;

      const { sender, receiver, assets, shares } = args;

      // Get block timestamp
      const block = await this.httpClient.getBlock({ blockNumber: log.blockNumber });

      // Calculate share price at time of deposit
      const sharePrice = shares > 0n ? (assets * 10n ** 18n) / shares : 10n ** 18n;

      // Ensure user exists
      await this.ensureUserExists(receiver);

      // Insert transaction
      await prisma.transaction.create({
        data: {
          txHash: log.transactionHash,
          type: 'DEPOSIT',
          userAddress: receiver.toLowerCase(),
          amount: assets.toString(),
          shares: shares.toString(),
          sharePrice: sharePrice.toString(),
          blockNumber: log.blockNumber,
          timestamp: new Date(Number(block.timestamp) * 1000),
        },
      });

      // Update user position
      await this.updateUserPosition(receiver, shares, assets, true);

      console.log(`[EventListener] Processed deposit: ${log.transactionHash} (${assets} assets, ${shares} shares)`);
    } catch (error) {
      console.error(`[EventListener] Error processing deposit ${eventKey}:`, error);
    }
  }

  private async processWithdrawEvent(log: Log): Promise<void> {
    if (!log.transactionHash || log.blockNumber === null) return;

    const eventKey = `${log.transactionHash}-${log.logIndex}`;

    try {
      // Check if already exists
      const existing = await prisma.transaction.findUnique({
        where: { txHash: log.transactionHash },
      });

      if (existing) {
        console.log(`[EventListener] Withdraw ${log.transactionHash} already exists`);
        return;
      }

      // Decode event args
      const args = (log as any).args;
      if (!args) return;

      const { owner, receiver, assets, shares } = args;

      // Get block timestamp
      const block = await this.httpClient.getBlock({ blockNumber: log.blockNumber });

      // Calculate share price at time of withdrawal
      const sharePrice = shares > 0n ? (assets * 10n ** 18n) / shares : 10n ** 18n;

      // Ensure user exists
      await this.ensureUserExists(owner);

      // Insert transaction
      await prisma.transaction.create({
        data: {
          txHash: log.transactionHash,
          type: 'WITHDRAW',
          userAddress: owner.toLowerCase(),
          amount: assets.toString(),
          shares: shares.toString(),
          sharePrice: sharePrice.toString(),
          blockNumber: log.blockNumber,
          timestamp: new Date(Number(block.timestamp) * 1000),
        },
      });

      // Update user position
      await this.updateUserPosition(owner, shares, assets, false);

      console.log(`[EventListener] Processed withdraw: ${log.transactionHash} (${assets} assets, ${shares} shares)`);
    } catch (error) {
      console.error(`[EventListener] Error processing withdraw ${eventKey}:`, error);
    }
  }

  private async processRebalanceEvent(log: Log): Promise<void> {
    if (!log.transactionHash || log.blockNumber === null) return;

    try {
      // Decode event args
      const args = (log as any).args;
      if (!args) return;

      const { sellAssets, sellAmounts, sellReceived, buyAssets, buyAmounts, buyReceived, timestamp } = args;

      // Get block timestamp
      const block = await this.httpClient.getBlock({ blockNumber: log.blockNumber });
      const blockTimestamp = new Date(Number(block.timestamp) * 1000);

      // Record sell transactions
      for (let i = 0; i < sellAssets.length; i++) {
        const txHashUnique = `${log.transactionHash}-sell-${i}`;

        const existing = await prisma.rebalanceHistory.findUnique({
          where: { txHash: txHashUnique },
        });

        if (!existing) {
          await prisma.rebalanceHistory.create({
            data: {
              txHash: txHashUnique,
              type: 'SELL',
              fromAsset: sellAssets[i].toLowerCase(),
              toAsset: '0x55d398326f99059fF775485246999027B3197955', // USDT
              fromAmount: sellAmounts[i].toString(),
              toAmount: sellReceived[i].toString(),
              blockNumber: log.blockNumber,
              timestamp: blockTimestamp,
            },
          });
        }
      }

      // Record buy transactions
      for (let i = 0; i < buyAssets.length; i++) {
        const txHashUnique = `${log.transactionHash}-buy-${i}`;

        const existing = await prisma.rebalanceHistory.findUnique({
          where: { txHash: txHashUnique },
        });

        if (!existing) {
          await prisma.rebalanceHistory.create({
            data: {
              txHash: txHashUnique,
              type: 'BUY',
              fromAsset: '0x55d398326f99059fF775485246999027B3197955', // USDT
              toAsset: buyAssets[i].toLowerCase(),
              fromAmount: buyAmounts[i].toString(),
              toAmount: buyReceived[i].toString(),
              blockNumber: log.blockNumber,
              timestamp: blockTimestamp,
            },
          });
        }
      }

      console.log(`[EventListener] Processed rebalance: ${log.transactionHash}`);
    } catch (error) {
      console.error(`[EventListener] Error processing rebalance ${log.transactionHash}:`, error);
    }
  }

  // ---------------------------------------------------------------------------
  // Helper Methods
  // ---------------------------------------------------------------------------

  private async ensureUserExists(address: string): Promise<void> {
    const normalizedAddress = address.toLowerCase();

    await prisma.user.upsert({
      where: { address: normalizedAddress },
      update: {},
      create: { address: normalizedAddress },
    });
  }

  private async updateUserPosition(
    address: string,
    shares: bigint,
    assets: bigint,
    isDeposit: boolean
  ): Promise<void> {
    const normalizedAddress = address.toLowerCase();

    const existingPosition = await prisma.userPosition.findUnique({
      where: { userAddress: normalizedAddress },
    });

    if (existingPosition) {
      const currentShares = BigInt(existingPosition.shares.toString());
      const currentCostBasis = BigInt(existingPosition.costBasis.toString());

      const newShares = isDeposit ? currentShares + shares : currentShares - shares;
      const newCostBasis = isDeposit ? currentCostBasis + assets : currentCostBasis - assets;

      await prisma.userPosition.update({
        where: { userAddress: normalizedAddress },
        data: {
          shares: newShares.toString(),
          costBasis: newCostBasis > 0n ? newCostBasis.toString() : '0',
        },
      });
    } else if (isDeposit) {
      await prisma.userPosition.create({
        data: {
          userAddress: normalizedAddress,
          shares: shares.toString(),
          costBasis: assets.toString(),
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Chain Reorganization Handling
  // ---------------------------------------------------------------------------

  async handleReorg(reorgBlockNumber: bigint): Promise<void> {
    console.log(`[EventListener] Handling chain reorg at block ${reorgBlockNumber}`);

    // Remove transactions from reorged blocks
    await prisma.transaction.deleteMany({
      where: {
        blockNumber: { gte: reorgBlockNumber },
      },
    });

    // Remove rebalance history from reorged blocks
    await prisma.rebalanceHistory.deleteMany({
      where: {
        blockNumber: { gte: reorgBlockNumber },
      },
    });

    // Reset last processed block
    this.lastProcessedBlock = reorgBlockNumber - 1n;
    this.processedEvents.clear();

    // Re-sync from reorg point
    await this.syncHistoricalEvents();

    console.log(`[EventListener] Reorg handled, re-synced from block ${reorgBlockNumber}`);
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let eventListenerInstance: EventListener | null = null;

export function getEventListener(config?: EventListenerConfig): EventListener {
  if (!eventListenerInstance && config) {
    eventListenerInstance = new EventListener(config);
  }

  if (!eventListenerInstance) {
    throw new Error('EventListener not initialized. Call with config first.');
  }

  return eventListenerInstance;
}

export function createEventListener(config: EventListenerConfig): EventListener {
  eventListenerInstance = new EventListener(config);
  return eventListenerInstance;
}
