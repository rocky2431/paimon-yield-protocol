/**
 * NotificationHistory Component Tests
 * Task #49 - 实现前端通知系统
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationHistory } from '../NotificationHistory';

// Mock notifications data - defined as functions to avoid hoisting issues
const createMockNotifications = () => [
  {
    id: '1',
    type: 'rebalance' as const,
    title: 'Portfolio Rebalanced',
    message: 'Your portfolio has been rebalanced successfully.',
    timestamp: Date.now() - 3600000, // 1 hour ago
    read: false,
  },
  {
    id: '2',
    type: 'withdrawal' as const,
    title: 'Withdrawal Complete',
    message: 'Your withdrawal of $1,000 has been processed.',
    timestamp: Date.now() - 86400000, // 1 day ago
    read: true,
  },
  {
    id: '3',
    type: 'pause' as const,
    title: 'Emergency Pause',
    message: 'The vault has been paused for maintenance.',
    timestamp: Date.now() - 172800000, // 2 days ago
    read: false,
  },
];

// Mock service methods - will be populated before tests
const mockGetHistory = jest.fn();
const mockGetUnreadCount = jest.fn();
const mockMarkAsRead = jest.fn();
const mockMarkAllAsRead = jest.fn();
const mockClearHistory = jest.fn();
const mockDeleteNotification = jest.fn();
const mockSubscribe = jest.fn();

// Create mock service object
const mockService = {
  getHistory: mockGetHistory,
  getUnreadCount: mockGetUnreadCount,
  markAsRead: mockMarkAsRead,
  markAllAsRead: mockMarkAllAsRead,
  clearHistory: mockClearHistory,
  deleteNotification: mockDeleteNotification,
  subscribe: mockSubscribe,
};

// Mock the entire notifications module
jest.mock('../../lib/notifications', () => ({
  NotificationService: jest.fn(),
  getNotificationService: jest.fn(() => ({
    getHistory: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    clearHistory: jest.fn(),
    deleteNotification: jest.fn(),
    subscribe: jest.fn().mockReturnValue(() => {}),
  })),
  getNotificationTypeInfo: jest.fn((type: string) => {
    const typeInfo: Record<string, { label: string; color: string; icon: string }> = {
      rebalance: { label: 'Rebalance', color: 'text-blue-600 bg-blue-100', icon: '🔄' },
      withdrawal: { label: 'Withdrawal', color: 'text-green-600 bg-green-100', icon: '💰' },
      pause: { label: 'Emergency Pause', color: 'text-amber-600 bg-amber-100', icon: '⚠️' },
    };
    return typeInfo[type] || { label: type, color: 'text-gray-600 bg-gray-100', icon: '📌' };
  }),
}));

// Import mocked module to override
import * as notificationsModule from '../../lib/notifications';

describe('NotificationHistory', () => {
  let mockNotifications: ReturnType<typeof createMockNotifications>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNotifications = createMockNotifications();

    // Setup mock service return values
    mockGetHistory.mockReturnValue(mockNotifications);
    mockGetUnreadCount.mockReturnValue(2);
    mockSubscribe.mockReturnValue(() => {});

    // Override getNotificationService to return our controlled mock
    (notificationsModule.getNotificationService as jest.Mock).mockReturnValue(mockService);
  });

  describe('rendering', () => {
    it('renders the notification history with title', () => {
      render(<NotificationHistory />);
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    it('renders notification items', () => {
      render(<NotificationHistory />);
      expect(screen.getByText('Portfolio Rebalanced')).toBeInTheDocument();
      expect(screen.getByText('Withdrawal Complete')).toBeInTheDocument();
      // "Emergency Pause" appears both as title and as type label, so use getAllByText
      expect(screen.getAllByText('Emergency Pause').length).toBeGreaterThanOrEqual(1);
    });

    it('renders unread count badge', () => {
      render(<NotificationHistory />);
      expect(screen.getByTestId('unread-count')).toBeInTheDocument();
      expect(screen.getByTestId('unread-count')).toHaveTextContent('2');
    });
  });

  describe('notification display', () => {
    it('displays notification messages', () => {
      render(<NotificationHistory />);
      expect(screen.getByText(/rebalanced successfully/i)).toBeInTheDocument();
      expect(screen.getByText(/withdrawal of \$1,000/i)).toBeInTheDocument();
    });

    it('displays notification timestamps', () => {
      render(<NotificationHistory />);
      // Relative time should be displayed
      expect(screen.getByText(/1 hour ago/i)).toBeInTheDocument();
    });

    it('displays notification type icons', () => {
      render(<NotificationHistory />);
      expect(screen.getByTestId('icon-rebalance')).toBeInTheDocument();
      expect(screen.getByTestId('icon-withdrawal')).toBeInTheDocument();
      expect(screen.getByTestId('icon-pause')).toBeInTheDocument();
    });

    it('shows unread indicator for unread notifications', () => {
      render(<NotificationHistory />);
      const unreadIndicators = screen.getAllByTestId('unread-indicator');
      expect(unreadIndicators.length).toBe(2);
    });
  });

  describe('actions', () => {
    it('renders mark all as read button', () => {
      render(<NotificationHistory />);
      expect(screen.getByText('Mark all as read')).toBeInTheDocument();
    });

    it('renders clear all button', () => {
      render(<NotificationHistory />);
      expect(screen.getByText('Clear all')).toBeInTheDocument();
    });

    it('calls markAsRead when notification is clicked', () => {
      render(<NotificationHistory />);
      const notification = screen.getByText('Portfolio Rebalanced');
      fireEvent.click(notification);
      expect(mockMarkAsRead).toHaveBeenCalledWith('1');
    });

    it('calls markAllAsRead when mark all button is clicked', () => {
      render(<NotificationHistory />);
      const button = screen.getByText('Mark all as read');
      fireEvent.click(button);
      expect(mockMarkAllAsRead).toHaveBeenCalled();
    });

    it('calls clearHistory when clear all button is clicked', () => {
      render(<NotificationHistory />);
      const button = screen.getByText('Clear all');
      fireEvent.click(button);
      expect(mockClearHistory).toHaveBeenCalled();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no notifications', () => {
      mockGetHistory.mockReturnValue([]);
      mockGetUnreadCount.mockReturnValue(0);

      render(<NotificationHistory />);
      expect(screen.getByText(/No notifications/i)).toBeInTheDocument();
    });
  });

  describe('filtering', () => {
    it('renders filter buttons', () => {
      render(<NotificationHistory />);
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Unread')).toBeInTheDocument();
    });

    it('filters notifications when Unread filter is clicked', () => {
      render(<NotificationHistory />);

      // Click Unread filter
      const unreadFilter = screen.getByText('Unread');
      fireEvent.click(unreadFilter);

      // Should show only unread notifications (2)
      // Portfolio Rebalanced and Emergency Pause are unread
      expect(screen.getByText('Portfolio Rebalanced')).toBeInTheDocument();
      // "Emergency Pause" appears both as title and as type label, so use getAllByText
      expect(screen.getAllByText('Emergency Pause').length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('NotificationHistory - Exports', () => {
  it('exports NotificationHistory component', () => {
    expect(NotificationHistory).toBeDefined();
    expect(typeof NotificationHistory).toBe('function');
  });
});
