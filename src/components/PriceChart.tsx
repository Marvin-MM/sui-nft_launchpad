import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const data = [
  { epoch: 10, price: 1.2 },
  { epoch: 11, price: 1.5 },
  { epoch: 12, price: 1.4 },
  { epoch: 13, price: 1.8 },
  { epoch: 14, price: 2.1 },
  { epoch: 15, price: 1.9 },
  { epoch: 16, price: 2.5 },
  { epoch: 17, price: 2.3 },
  { epoch: 18, price: 2.8 },
  { epoch: 19, price: 3.2 },
];

export default function PriceChart() {
  return (
    <div className="w-full h-[300px] mt-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis 
            dataKey="epoch" 
            stroke="rgba(255,255,255,0.2)" 
            fontSize={10} 
            tickLine={false}
            axisLine={false}
            label={{ value: 'Epoch', position: 'insideBottom', offset: -5, fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
          />
          <YAxis 
            stroke="rgba(255,255,255,0.2)" 
            fontSize={10} 
            tickLine={false}
            axisLine={false}
            label={{ value: 'SUI', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
          />
          <Tooltip 
            contentStyle={{ 
              background: '#1a1a1a', 
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              fontSize: '12px',
              color: '#fff'
            }}
            itemStyle={{ color: '#8b5cf6' }}
          />
          <Area 
            type="monotone" 
            dataKey="price" 
            stroke="#8b5cf6" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorPrice)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
