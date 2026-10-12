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

function formatTooltip(value: number, name: string): string {
  return name === 'Tax rate'
    ? `$${value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')} per $100`
    : compactCurrency(value);
}

export default function TaxBaseHistoryChart({ data }: { data: TaxBaseHistoryPoint[] }) {
  return (
    <div className="h-[430px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 16, right: 12, bottom: 36, left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="fiscalYear"
            interval={0}
            angle={-35}
            textAnchor="end"
            height={58}
            tick={{ fontSize: 11 }}
          />
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
          <YAxis
            yAxisId="rate"
            orientation="right"
            domain={['dataMin - 0.05', 'dataMax + 0.05']}
            tickFormatter={(value: number) => `$${value.toFixed(2)}`}
            tick={{ fontSize: 12, fill: '#0f766e' }}
            width={58}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatTooltip(value, name),
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
                fill={point.revaluation ? '#9ca3af' : '#2d5a27'}
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
          <Line
            yAxisId="rate"
            type="stepAfter"
            dataKey="taxRate"
            name="Tax rate"
            stroke="#0f766e"
            strokeWidth={3}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
