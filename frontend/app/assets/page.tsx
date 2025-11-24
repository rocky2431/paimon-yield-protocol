/**
 * RWA Assets Page
 * Task #48 - 实现 RWA 资产详情页面
 */

import { AssetDetails } from '@/components/AssetDetails';

export default function AssetsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8">
        <AssetDetails />
      </div>
    </main>
  );
}
