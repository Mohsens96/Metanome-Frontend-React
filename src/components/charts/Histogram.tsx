import React from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

export default function Histogram({
  data,
}: {
  data: Array<{ bucket: string; count: number }>
}) {
  const labels = data.map((d) => d.bucket)
  const counts = data.map((d) => d.count)
  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            label: 'Count',
            data: counts,
            backgroundColor: 'rgba(99, 102, 241, 0.6)',
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      }}
      height={200}
    />
  )
}
