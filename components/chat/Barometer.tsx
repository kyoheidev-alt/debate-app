"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

/**
 * Half-pie barometer that mimics an election-night gauge.
 * Pro fills from the left (blue), Con from the right (red).
 */
export function Barometer({ pro, con }: { pro: number; con: number }) {
  const total = pro + con;
  const proPct = total > 0 ? Math.round((pro / total) * 100) : 50;
  const conPct = total > 0 ? 100 - proPct : 50;

  // When there are zero votes show a neutral 50/50 gauge.
  const data =
    total > 0
      ? [
          { name: "pro", value: pro },
          { name: "con", value: con },
        ]
      : [
          { name: "pro", value: 1 },
          { name: "con", value: 1 },
        ];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-[140px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              startAngle={180}
              endAngle={0}
              innerRadius="55%"
              outerRadius="100%"
              dataKey="value"
              stroke="none"
              isAnimationActive={false}
            >
              <Cell fill="#2563eb" />
              <Cell fill="#dc2626" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
          <span className="heading-serif text-2xl font-bold text-ink">
            {pro}:{con}
          </span>
        </div>
      </div>
      <div className="flex w-full items-center justify-between text-xs">
        <div className="flex flex-col items-start">
          <span className="font-bold text-pro-light">賛成</span>
          <span className="text-muted">
            {pro}人 ({proPct}%)
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-bold text-con-light">反対</span>
          <span className="text-muted">
            {con}人 ({conPct}%)
          </span>
        </div>
      </div>
    </div>
  );
}
