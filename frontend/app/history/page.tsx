import { TransactionHistory } from '@/components/TransactionHistory';

export const metadata = {
  title: 'Transaction History | Paimon Yield',
  description: 'View your deposit and withdrawal transaction history',
};

export default function HistoryPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <TransactionHistory className="max-w-4xl mx-auto" />
      </div>
    </main>
  );
}
