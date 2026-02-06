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

interface VisaTypeDataItem {
  name: string;
  count: number;
  fill: string;
}

interface VisaTypeChartProps {
  data: VisaTypeDataItem[];
}

export function VisaTypeChart({ data }: VisaTypeChartProps) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 20, bottom: 0, left: 50 }}
        >
          <XAxis type="number" allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={45}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-popover text-popover-foreground rounded-lg border border-border px-3 py-2 shadow-lg">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.count} case{item.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
