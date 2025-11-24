/**
 * Notifications Service Tests
 * Task #49 - 实现前端通知系统
 */

import {
  NotificationService,
  NotificationType,
  NotificationEvent,
  requestNotificationPermission,
  sendBrowserNotification,
} from '../notifications';

// Mock Notification API
const mockNotification = jest.fn();
Object.defineProperty(global, 'Notification', {
  value: mockNotification,
  writable: true,
});

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    service = new NotificationService();
  });

  describe('initialization', () => {
    it('creates a new notification service instance', () => {
      expect(service).toBeInstanceOf(NotificationService);
    });

    it('loads notification history from localStorage', () => {
      const history = [
        {
          id: '1',
          type: 'rebalance' as NotificationType,
          title: 'Rebalance Complete',
          message: 'Portfolio rebalanced',
          timestamp: Date.now(),
          read: false,
        },
      ];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(history));

      const newService = new NotificationService();
      expect(newService.getHistory()).toHaveLength(1);
    });
  });

  describe('addNotification', () => {
    it('adds a notification to history', () => {
      const notification: NotificationEvent = {
        id: '1',
        type: 'rebalance',
        title: 'Rebalance Complete',
        message: 'Portfolio rebalanced successfully',
        timestamp: Date.now(),
        read: false,
      };

      service.addNotification(notification);
      expect(service.getHistory()).toContainEqual(notification);
    });

    it('saves to localStorage after adding', () => {
      const notification: NotificationEvent = {
        id: '1',
        type: 'rebalance',
        title: 'Test',
        message: 'Test message',
        timestamp: Date.now(),
        read: false,
      };

      service.addNotification(notification);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('limits history to max 100 notifications', () => {
      for (let i = 0; i < 110; i++) {
        service.addNotification({
          id: `${i}`,
          type: 'rebalance',
          title: `Test ${i}`,
          message: 'Test',
          timestamp: Date.now(),
          read: false,
        });
      }

      expect(service.getHistory().length).toBeLessThanOrEqual(100);
    });
  });

  describe('markAsRead', () => {
    it('marks a notification as read', () => {
      const notification: NotificationEvent = {
        id: '1',
        type: 'rebalance',
        title: 'Test',
        message: 'Test',
        timestamp: Date.now(),
        read: false,
      };

      service.addNotification(notification);
      service.markAsRead('1');

      const updated = service.getHistory().find((n) => n.id === '1');
      expect(updated?.read).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('marks all notifications as read', () => {
      service.addNotification({
        id: '1',
        type: 'rebalance',
        title: 'Test 1',
        message: 'Test',
        timestamp: Date.now(),
        read: false,
      });
      service.addNotification({
        id: '2',
        type: 'pause',
        title: 'Test 2',
        message: 'Test',
        timestamp: Date.now(),
        read: false,
      });

      service.markAllAsRead();

      const allRead = service.getHistory().every((n) => n.read);
      expect(allRead).toBe(true);
    });
  });

  describe('getUnreadCount', () => {
    it('returns count of unread notifications', () => {
      service.addNotification({
        id: '1',
        type: 'rebalance',
        title: 'Test 1',
        message: 'Test',
        timestamp: Date.now(),
        read: false,
      });
      service.addNotification({
        id: '2',
        type: 'pause',
        title: 'Test 2',
        message: 'Test',
        timestamp: Date.now(),
        read: true,
      });

      expect(service.getUnreadCount()).toBe(1);
    });
  });

  describe('clearHistory', () => {
    it('clears all notifications', () => {
      service.addNotification({
        id: '1',
        type: 'rebalance',
        title: 'Test',
        message: 'Test',
        timestamp: Date.now(),
        read: false,
      });

      service.clearHistory();
      expect(service.getHistory()).toHaveLength(0);
    });
  });

  describe('deleteNotification', () => {
    it('deletes a specific notification', () => {
      service.addNotification({
        id: '1',
        type: 'rebalance',
        title: 'Test',
        message: 'Test',
        timestamp: Date.now(),
        read: false,
      });

      service.deleteNotification('1');
      expect(service.getHistory()).toHaveLength(0);
    });
  });

  describe('filterByType', () => {
    it('returns notifications filtered by type', () => {
      service.addNotification({
        id: '1',
        type: 'rebalance',
        title: 'Rebalance',
        message: 'Test',
        timestamp: Date.now(),
        read: false,
      });
      service.addNotification({
        id: '2',
        type: 'pause',
        title: 'Pause',
        message: 'Test',
        timestamp: Date.now(),
        read: false,
      });

      const rebalanceOnly = service.filterByType('rebalance');
      expect(rebalanceOnly).toHaveLength(1);
      expect(rebalanceOnly[0].type).toBe('rebalance');
    });
  });
});

describe('requestNotificationPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns granted when permission is granted', async () => {
    (Notification as unknown as { permission: string }).permission = 'default';
    (Notification as unknown as { requestPermission: jest.Mock }).requestPermission =
      jest.fn().mockResolvedValue('granted');

    const result = await requestNotificationPermission();
    expect(result).toBe('granted');
  });

  it('returns denied when permission is denied', async () => {
    (Notification as unknown as { permission: string }).permission = 'default';
    (Notification as unknown as { requestPermission: jest.Mock }).requestPermission =
      jest.fn().mockResolvedValue('denied');

    const result = await requestNotificationPermission();
    expect(result).toBe('denied');
  });

  it('returns current permission if already set', async () => {
    (Notification as unknown as { permission: string }).permission = 'granted';

    const result = await requestNotificationPermission();
    expect(result).toBe('granted');
  });
});

describe('sendBrowserNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Notification as unknown as { permission: string }).permission = 'granted';
  });

  it('creates a browser notification when permission is granted', () => {
    sendBrowserNotification('Test Title', 'Test body');
    expect(mockNotification).toHaveBeenCalledWith(
      'Test Title',
      expect.objectContaining({
        body: 'Test body',
      })
    );
  });

  it('does not create notification when permission is denied', () => {
    (Notification as unknown as { permission: string }).permission = 'denied';

    sendBrowserNotification('Test Title', 'Test body');
    expect(mockNotification).not.toHaveBeenCalled();
  });
});
