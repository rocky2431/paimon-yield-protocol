/**
 * Notification Service
 * Task #49 - 实现前端通知系统
 */

// Notification types
export type NotificationType = 'rebalance' | 'withdrawal' | 'pause' | 'circuit_breaker' | 'deposit';

// Notification event interface
export interface NotificationEvent {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  data?: Record<string, unknown>;
}

// Storage key
const STORAGE_KEY = 'paimon_notifications';
const MAX_HISTORY = 100;

/**
 * Notification Service - Manages notification history and browser notifications
 */
export class NotificationService {
  private history: NotificationEvent[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load notification history from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load notifications from storage:', error);
      this.history = [];
    }
  }

  /**
   * Save notification history to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
    } catch (error) {
      console.error('Failed to save notifications to storage:', error);
    }
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Subscribe to notification changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Add a new notification
   */
  addNotification(notification: NotificationEvent): void {
    this.history.unshift(notification);

    // Limit history size
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(0, MAX_HISTORY);
    }

    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Get all notifications
   */
  getHistory(): NotificationEvent[] {
    return [...this.history];
  }

  /**
   * Get unread notification count
   */
  getUnreadCount(): number {
    return this.history.filter((n) => !n.read).length;
  }

  /**
   * Mark a notification as read
   */
  markAsRead(id: string): void {
    const notification = this.history.find((n) => n.id === id);
    if (notification) {
      notification.read = true;
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): void {
    this.history.forEach((n) => {
      n.read = true;
    });
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Delete a specific notification
   */
  deleteNotification(id: string): void {
    this.history = this.history.filter((n) => n.id !== id);
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Clear all notification history
   */
  clearHistory(): void {
    this.history = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Filter notifications by type
   */
  filterByType(type: NotificationType): NotificationEvent[] {
    return this.history.filter((n) => n.type === type);
  }

  /**
   * Get notifications filtered by read status
   */
  filterByRead(read: boolean): NotificationEvent[] {
    return this.history.filter((n) => n.read === read);
  }
}

/**
 * Request browser notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission !== 'default') {
    return Notification.permission;
  }

  return await Notification.requestPermission();
}

/**
 * Send a browser notification
 */
export function sendBrowserNotification(
  title: string,
  body: string,
  options?: NotificationOptions
): void {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  new Notification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    ...options,
  });
}

/**
 * Create notification from contract event
 */
export function createNotificationFromEvent(
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown>
): NotificationEvent {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    title,
    message,
    timestamp: Date.now(),
    read: false,
    data,
  };
}

/**
 * Get notification type display info
 */
export function getNotificationTypeInfo(type: NotificationType): {
  label: string;
  color: string;
  icon: string;
} {
  const typeInfo: Record<NotificationType, { label: string; color: string; icon: string }> = {
    rebalance: {
      label: 'Rebalance',
      color: 'text-blue-600 bg-blue-100',
      icon: '🔄',
    },
    withdrawal: {
      label: 'Withdrawal',
      color: 'text-green-600 bg-green-100',
      icon: '💰',
    },
    deposit: {
      label: 'Deposit',
      color: 'text-emerald-600 bg-emerald-100',
      icon: '📥',
    },
    pause: {
      label: 'Emergency Pause',
      color: 'text-amber-600 bg-amber-100',
      icon: '⚠️',
    },
    circuit_breaker: {
      label: 'Circuit Breaker',
      color: 'text-red-600 bg-red-100',
      icon: '🚨',
    },
  };

  return typeInfo[type] || { label: type, color: 'text-gray-600 bg-gray-100', icon: '📌' };
}

// Singleton instance
let serviceInstance: NotificationService | null = null;

/**
 * Get the notification service singleton
 */
export function getNotificationService(): NotificationService {
  if (!serviceInstance) {
    serviceInstance = new NotificationService();
  }
  return serviceInstance;
}

export default NotificationService;
