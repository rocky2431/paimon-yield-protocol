/**
 * Notifications Page
 * Task #49 - 实现前端通知系统
 */

import { NotificationHistory } from '@/components/NotificationHistory';

export default function NotificationsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto py-8 px-4">
        <NotificationHistory />
      </div>
    </main>
  );
}
