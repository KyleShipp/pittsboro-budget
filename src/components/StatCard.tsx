import { formatCurrency } from '@/lib/format';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
}

export default function StatCard({
  label,
  value,
  sub,
  trend,
  trendDirection = 'neutral',
}: StatCardProps) {
  const trendColor =
    trendDirection === 'up'
      ? 'text-green-600'
      : trendDirection === 'down'
        ? 'text-red-600'
        : 'text-gray-500';

  return (
    <div className="bg-white rounded-xl shadow-sm border p-5">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-sm text-gray-500 mt-0.5">{sub}</p>}
      {trend && (
        <p className={`text-sm mt-1 font-medium ${trendColor}`}>{trend}</p>
      )}
    </div>
  );
}
