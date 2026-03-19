'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface ChannelData {
  name: string
  value: number
  color: string
}

interface ChannelBreakdownProps {
  data: ChannelData[]
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-surface-border rounded-lg shadow-lg p-3 text-xs">
        <p className="font-semibold text-gray-700">{payload[0].name}</p>
        <p style={{ color: payload[0].payload.color }}>{payload[0].value}%</p>
      </div>
    )
  }
  return null
}

export function ChannelBreakdown({ data }: ChannelBreakdownProps) {
  return (
    <div className="bg-white rounded-xl p-5 border border-surface-border shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">채널별 성과 분포</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2 text-xs text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
            <span className="truncate">{item.name}</span>
            <span className="font-semibold ml-auto">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
