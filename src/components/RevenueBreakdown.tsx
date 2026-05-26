'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/lib/format';

const COLORS = [
  '#2d5a27', '#3b7a33', '#4e9c3f', '#6ab04c', '#81c784',
  '#c4a43c', '#d4b84e', '#e0c86a', '#a5d6a7', '#c8e6c9',
];

interface RevenueBreakdownProps {
  data: Array<{ category: string; amount: number }>;
}

export default function RevenueBreakdown({ data }: RevenueBreakdownProps) {
  const filtered = data.filter((d) => d.amount > 0).sort((a, b) => b.amount - a.amount);
  const total = filtered.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={filtered}
            dataKey="amount"
            nameKey="category"
            cx="50%"
            cy="50%"
            outerRadius={110}
            innerRadius={55}
            paddingAngle={2}
            label={false}
          >
            {filtered.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
        {filtered.map((d, i) => (
          <div key={d.category} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="truncate text-gray-700">{d.category}</span>
            <span className="ml-auto text-gray-500 tabular-nums">
              {((d.amount / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
