'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  NotificationService,
  NotificationEvent,
  NotificationType,
  getNotificationTypeInfo,
  getNotificationService,
} from '@/lib/notifications';

type FilterType = 'all' | 'unread';

interface NotificationHistoryProps {
  className?: string;
}

export function NotificationHistory({ className = '' }: NotificationHistoryProps) {
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<FilterType>('all');
  const [service] = useState(() => getNotificationService());

  // Load notifications
  const loadNotifications = useCallback(() => {
    setNotifications(service.getHistory());
    setUnreadCount(service.getUnreadCount());
  }, [service]);

  // Subscribe to changes
  useEffect(() => {
    loadNotifications();
    const unsubscribe = service.subscribe(loadNotifications);
    return unsubscribe;
  }, [service, loadNotifications]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter((n) => !n.read);
    }
    return notifications;
  }, [notifications, filter]);

  // Handle mark as read
  const handleMarkAsRead = (id: string) => {
    service.markAsRead(id);
  };

  // Handle mark all as read
  const handleMarkAllAsRead = () => {
    service.markAllAsRead();
  };

  // Handle clear all
  const handleClearAll = () => {
    service.clearHistory();
  };

  // Handle delete notification
  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    service.deleteNotification(id);
  };

  // Format relative time
  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Notifications</h2>
          {unreadCount > 0 && (
            <span
              data-testid="unread-count"
              className="px-2 py-0.5 text-xs font-medium text-white bg-sky-500 rounded-full"
            >
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
            className="text-sm text-sky-600 hover:text-sky-700 disabled:text-gray-400"
          >
            Mark all as read
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={handleClearAll}
            disabled={notifications.length === 0}
            className="text-sm text-gray-600 hover:text-gray-700 disabled:text-gray-400"
          >
            Clear all
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </FilterButton>
        <FilterButton active={filter === 'unread'} onClick={() => setFilter('unread')}>
          Unread
        </FilterButton>
      </div>

      {/* Notification List */}
      {filteredNotifications.length === 0 ? (
        <div className="text-center py-12">
          <BellIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={handleMarkAsRead}
              onDelete={handleDelete}
              formatTime={formatRelativeTime}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Filter Button Component
interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterButton({ active, onClick, children }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-sky-100 text-sky-700'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

// Notification Item Component
interface NotificationItemProps {
  notification: NotificationEvent;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  formatTime: (timestamp: number) => string;
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  formatTime,
}: NotificationItemProps) {
  const typeInfo = getNotificationTypeInfo(notification.type);

  return (
    <div
      onClick={() => onMarkAsRead(notification.id)}
      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
        notification.read
          ? 'bg-white border-gray-100 hover:bg-gray-50'
          : 'bg-sky-50 border-sky-100 hover:bg-sky-100'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span
          data-testid={`icon-${notification.type}`}
          className="text-xl"
        >
          {typeInfo.icon}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-gray-900">{notification.title}</h3>
            {!notification.read && (
              <span
                data-testid="unread-indicator"
                className="w-2 h-2 bg-sky-500 rounded-full"
              />
            )}
          </div>
          <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${typeInfo.color}`}>
              {typeInfo.label}
            </span>
            <span className="text-xs text-gray-400">{formatTime(notification.timestamp)}</span>
          </div>
        </div>

        {/* Delete Button */}
        <button
          onClick={(e) => onDelete(notification.id, e)}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Icons
function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

export default NotificationHistory;
