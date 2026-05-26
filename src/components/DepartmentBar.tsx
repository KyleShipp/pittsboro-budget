'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatCurrency } from '@/lib/format';

const COLORS = [
  '#2d5a27', '#3b7a33', '#4e9c3f', '#6ab04c', '#81c784',
  '#a5d6a7', '#c8e6c9', '#dcedc8', '#f1f8e9', '#fafafa',
  '#c4a43c', '#d4b84e', '#e0c86a',
];

interface DepartmentBarProps {
  data: Array<{ name: string; total: number; id: string }>;
  onDeptClick?: (id: string) => void;
}

export default function DepartmentBar({ data, onDeptClick }: DepartmentBarProps) {
  const sorted = [...data].sort((a, b) => b.total - a.total);

  const CustomYTick = ({ x, y, payload }: any) => {
    const entry = sorted.find((d) => d.name === payload.value);
    return (
      <text
        x={x}
        y={y}
        dy={4}
        textAnchor="end"
        fontSize={12}
        fill="#374151"
        style={{ cursor: onDeptClick ? 'pointer' : 'default' }}
        onClick={() => entry && onDeptClick?.(entry.id)}
      >
        {payload.value}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, sorted.length * 38)}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 10, right: 30 }}>
        <XAxis
          type="number"
          tickFormatter={(v) => formatCurrency(v, true)}
          fontSize={12}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={180}
          tick={<CustomYTick />}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          labelStyle={{ fontWeight: 600 }}
        />
        <Bar
          dataKey="total"
          radius={[0, 4, 4, 0]}
          onClick={(entry) => onDeptClick?.(entry.id)}
          cursor={onDeptClick ? 'pointer' : 'default'}
        >
          {sorted.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
