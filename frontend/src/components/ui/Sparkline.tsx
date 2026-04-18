interface SparklineProps {
  values: number[]
  color: string
  width?: number
  height?: number
  strokeWidth?: number
}

export function Sparkline({ values, color, width = 90, height = 28, strokeWidth = 1.75 }: SparklineProps) {
  if (!values?.length || values.length < 2) {
    return <svg width={width} height={height} />
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = width / (values.length - 1)
  const points = values
    .map((v, i) => `${(i * step).toFixed(2)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(2)}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" points={points} />
    </svg>
  )
}
