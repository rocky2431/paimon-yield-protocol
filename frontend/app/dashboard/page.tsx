import { Dashboard } from '@/components/Dashboard';

export const metadata = {
  title: 'Dashboard | Paimon Yield',
  description: 'View your PNGY holdings, net value, and accumulated yield',
};

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <Dashboard className="max-w-4xl mx-auto" />
      </div>
    </main>
  );
}
