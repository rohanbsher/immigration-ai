'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion, useInView } from 'motion/react';
import { useRef } from 'react';

interface StatusChartProps {
  data: {
    name: string;
    value: number;
    color: string;
  }[];
  className?: string;
  showLegend?: boolean;
}

export function StatusChart({ data, className = '', showLegend = true }: StatusChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  const total = data.reduce((acc, item) => acc + item.value, 0);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
              animationBegin={0}
              animationDuration={1000}
              animationEasing="ease-out"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  const percentage = ((data.value / total) * 100).toFixed(0);
                  return (
                    <div className="bg-popover text-popover-foreground rounded-lg border border-border px-3 py-2 shadow-lg">
                      <p className="font-medium">{data.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {data.value} ({percentage}%)
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {showLegend && (
        <div className="mt-4 space-y-2">
          {data.map((item, index) => (
            <motion.div
              key={item.name}
              className="flex items-center justify-between text-sm"
              initial={{ opacity: 0, x: -10 }}
              animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
              transition={{ delay: 0.5 + index * 0.1, duration: 0.3 }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground">{item.name}</span>
              </div>
              <span className="font-medium text-foreground">{item.value}</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
