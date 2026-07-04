import { LineChart, Line, ResponsiveContainer } from "recharts";

export default function Sparkline({ data, color = "var(--accent-blue)", height = 32 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={true} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function makeSpark(seed = 1, points = 12) {
  let v = 50;
  const out = [];
  for (let i = 0; i < points; i++) {
    v += Math.sin(i * seed) * 8 + (Math.random() - 0.5) * 6;
    out.push({ v: Math.max(10, v) });
  }
  return out;
}