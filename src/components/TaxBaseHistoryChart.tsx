'use client';

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TaxBaseHistoryPoint } from '@/types/budget';

function compactCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function TaxBaseHistoryChart({ data }: { data: TaxBaseHistoryPoint[] }) {
  return (
    <div className="h-[380px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 16, right: 18, bottom: 8, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="fiscalYear" tick={{ fontSize: 12 }} />
          <YAxis
            yAxisId="value"
            tickFormatter={compactCurrency}
            tick={{ fontSize: 12 }}
            width={72}
          />
          <YAxis
            yAxisId="penny"
            orientation="right"
            tickFormatter={compactCurrency}
            tick={{ fontSize: 12 }}
            width={72}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              compactCurrency(value),
              name,
            ]}
            labelFormatter={(label, payload) =>
              `${label}${payload?.[0]?.payload?.revaluation ? ' · County revaluation' : ''}`
            }
          />
          <Legend />
          <Bar
            yAxisId="value"
            dataKey="taxablePropertyValue"
            name="Total taxable property"
            radius={[4, 4, 0, 0]}
          >
            {data.map((point) => (
              <Cell
                key={point.fiscalYear}
                fill={point.revaluation ? '#c4a43c' : '#2d5a27'}
              />
            ))}
          </Bar>
          <Line
            yAxisId="penny"
            type="monotone"
            dataKey="pennyValue"
            name="Value of one penny"
            stroke="#7c3aed"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
