import { lazy, Suspense, type ComponentType } from 'react'
import type { ChartData, ChartOptions } from 'chart.js'

interface LineChartProps {
  'aria-label'?: string
  data: ChartData<'line'>
  options?: ChartOptions<'line'>
}

interface BarChartProps {
  'aria-label'?: string
  data: ChartData<'bar'>
  options?: ChartOptions<'bar'>
}

interface PieChartProps {
  'aria-label'?: string
  data: ChartData<'pie'>
  options?: ChartOptions<'pie'>
}

let chartRenderersPromise: Promise<typeof import('react-chartjs-2')> | undefined

function loadChartRenderers() {
  chartRenderersPromise ??= Promise.all([
    import('chart.js'),
    import('react-chartjs-2'),
  ]).then(([chartJs, renderers]) => {
    chartJs.Chart.register(
      chartJs.ArcElement,
      chartJs.BarElement,
      chartJs.BarController,
      chartJs.CategoryScale,
      chartJs.Filler,
      chartJs.Legend,
      chartJs.LinearScale,
      chartJs.LineController,
      chartJs.LineElement,
      chartJs.PointElement,
      chartJs.PieController,
      chartJs.Tooltip,
    )
    return renderers
  })
  return chartRenderersPromise
}

const LazyLine = lazy(() => loadChartRenderers().then((module) => ({ default: module.Line as ComponentType<LineChartProps> })))
const LazyBar = lazy(() => loadChartRenderers().then((module) => ({ default: module.Bar as ComponentType<BarChartProps> })))
const LazyPie = lazy(() => loadChartRenderers().then((module) => ({ default: module.Pie as ComponentType<PieChartProps> })))

function ChartFallback({ label }: { label?: string }) {
  return <div aria-label={label ? `${label} loading` : 'Chart loading'} className="grid h-full min-h-12 place-items-center border border-cs-border bg-cs-surface font-mono text-[10px] uppercase text-cs-muted" role="status">Loading chart…</div>
}

export function DeferredLineChart(props: LineChartProps) {
  return <Suspense fallback={<ChartFallback label={props['aria-label']} />}><LazyLine {...props} /></Suspense>
}

export function DeferredBarChart(props: BarChartProps) {
  return <Suspense fallback={<ChartFallback label={props['aria-label']} />}><LazyBar {...props} /></Suspense>
}

export function DeferredPieChart(props: PieChartProps) {
  return <Suspense fallback={<ChartFallback label={props['aria-label']} />}><LazyPie {...props} /></Suspense>
}
