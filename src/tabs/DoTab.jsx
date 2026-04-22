import { useState, useMemo } from 'react'

const METRIC_OPTS = [
  { key: 'cvr', label: 'CVR',  higher: false, fmt: v => v.toFixed(2) + '%' },
  { key: 'cpa', label: 'CPA',  higher: true,  fmt: v => v == null ? '—' : v.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) },
  { key: 'ctr', label: 'CTR',  higher: false, fmt: v => v.toFixed(2) + '%' },
]
const COND_OPTS = [
  { key: 'avg50',  label: '平均の50%以下' },
  { key: 'avg',    label: '平均以下' },
  { key: 'avg2x',  label: '平均の2倍以上' },
]
const INCREASE_COND_OPTS = [
  { key: 'avg',    label: '平均以上' },
  { key: 'avg1_5', label: '平均の1.5倍以上' },
  { key: 'avg2x',  label: '平均の2倍以上' },
]
const COST_SCOPE_OPTS = [
  { key: 'all',    label: '全CR' },
  { key: 'top50',  label: 'コスト上位50%' },
  { key: 'top30',  label: 'コスト上位30%' },
]

function getThreshold(costs, scope) {
  if (scope === 'all') return 0
  const sorted = [...costs].sort((a, b) => a - b)
  if (scope === 'top50') return sorted[Math.floor(sorted.length * 0.5)] ?? 0
  return sorted[Math.floor(sorted.length * 0.7)] ?? 0
}

function avgVal(rows, key) {
  const vals = rows.map(r => r[key]).filter(v => v != null && !isNaN(v))
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
}

function meetsStopCond(val, avg, condKey, higherIsBetter) {
  // For stop: metric is bad (lower for CVR/CTR, higher for CPA)
  if (!higherIsBetter) {
    // CVR/CTR: stop when value is too low
    if (condKey === 'avg50') return val < avg * 0.5
    if (condKey === 'avg')   return val < avg
  } else {
    // CPA: stop when value is too high
    if (condKey === 'avg50') return val != null && val > avg * 2
    if (condKey === 'avg2x') return val != null && val > avg * 2
    if (condKey === 'avg')   return val != null && val > avg
  }
  return false
}

function meetsIncreaseCond(val, avg, condKey, higherIsBetter) {
  if (!higherIsBetter) {
    if (condKey === 'avg')    return val >= avg
    if (condKey === 'avg1_5') return val >= avg * 1.5
    if (condKey === 'avg2x')  return val >= avg * 2
  } else {
    // CPA: increase when value is low
    if (condKey === 'avg')    return val != null && val <= avg
    if (condKey === 'avg1_5') return val != null && val <= avg * (2 / 3)
    if (condKey === 'avg2x')  return val != null && val <= avg * 0.5
  }
  return false
}

function DoList({ title, subtitle, rows, doneTasks, onToggle, badge }) {
  return (
    <div className={`do-section do-${badge}`}>
      <div className="do-section-header">
        <h3>{title}</h3>
        <span className="do-subtitle">{subtitle}</span>
        <span className="do-count">{rows.length}件</span>
      </div>
      {rows.length === 0 ? (
        <p className="empty-note">該当するCRはありません</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>対応済み</th>
                <th>クリエイティブアセット名</th>
                <th>CVR</th>
                <th>CTR</th>
                <th>Cost</th>
                <th>CPA</th>
                <th>CV</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className={doneTasks.has(r.id) ? 'row-done' : ''}>
                  <td className="checkbox-cell">
                    <input type="checkbox" checked={doneTasks.has(r.id)} onChange={() => onToggle(r.id)} />
                  </td>
                  <td className="asset-name" title={r.assetName}>{r.assetName}</td>
                  <td>{r.cv === 0 ? '—' : r.cvr.toFixed(2) + '%'}</td>
                  <td>{r.ctr.toFixed(2) + '%'}</td>
                  <td>{Math.round(r.cost).toLocaleString()}</td>
                  <td>{r.cv === 0 || r.cpa == null ? '—' : r.cpa.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                  <td>{Math.round(r.cv).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function DoTab({ rows, avgCvr, doneTasks, setDoneTasks }) {
  const [stopMetric, setStopMetric]       = useState('cvr')
  const [stopCond, setStopCond]           = useState('avg50')
  const [increaseMetric, setIncMetric]    = useState('cvr')
  const [increaseCond, setIncreaseCond]   = useState('avg')
  const [costScope, setCostScope]         = useState('top50')

  const costs = useMemo(() => rows.map(r => r.cost), [rows])

  const { stopList, increaseList, watchList } = useMemo(() => {
    if (rows.length === 0) return { stopList: [], increaseList: [], watchList: [] }

    const costThreshold = getThreshold(costs, costScope)
    const scopedRows = rows.filter(r => r.cost >= costThreshold)

    const stopMeta  = METRIC_OPTS.find(m => m.key === stopMetric)
    const incMeta   = METRIC_OPTS.find(m => m.key === increaseMetric)

    const stopAvg   = stopMetric === 'cvr' ? avgCvr : avgVal(rows, stopMetric)
    const incAvg    = increaseMetric === 'cvr' ? avgCvr : avgVal(rows, increaseMetric)

    const stopSet     = new Set()
    const increaseSet = new Set()

    scopedRows.forEach(r => {
      const sv = r[stopMetric]
      const iv = r[increaseMetric]
      if (sv != null && meetsStopCond(sv, stopAvg, stopCond, stopMeta.higher)) stopSet.add(r.id)
      else if (iv != null && meetsIncreaseCond(iv, incAvg, increaseCond, incMeta.higher)) increaseSet.add(r.id)
    })

    return {
      stopList:     scopedRows.filter(r => stopSet.has(r.id)).sort((a, b) => b.cost - a.cost),
      increaseList: scopedRows.filter(r => increaseSet.has(r.id)).sort((a, b) => b.cost - a.cost),
      watchList:    scopedRows.filter(r => !stopSet.has(r.id) && !increaseSet.has(r.id)).sort((a, b) => b.cost - a.cost),
    }
  }, [rows, costs, avgCvr, stopMetric, stopCond, increaseMetric, increaseCond, costScope])

  const toggle = id => setDoneTasks(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  if (rows.length === 0) {
    return <div className="tab-empty">CR分析タブでCSVをアップロードしてください</div>
  }

  const stopMeta = METRIC_OPTS.find(m => m.key === stopMetric)
  const incMeta  = METRIC_OPTS.find(m => m.key === increaseMetric)
  const stopAvg  = stopMetric === 'cvr' ? avgCvr : avgVal(rows, stopMetric)
  const incAvg   = increaseMetric === 'cvr' ? avgCvr : avgVal(rows, increaseMetric)

  return (
    <div className="tab-content">
      {/* ── Filter controls ── */}
      <div className="do-filters">
        <div className="do-filter-group">
          <span className="do-filter-label">対象コスト：</span>
          <select className="axis-select" value={costScope} onChange={e => setCostScope(e.target.value)}>
            {COST_SCOPE_OPTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <div className="do-filter-group">
          <span className="do-filter-label stop-label">停止基準：</span>
          <select className="axis-select" value={stopMetric} onChange={e => setStopMetric(e.target.value)}>
            {METRIC_OPTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <select className="axis-select" value={stopCond} onChange={e => setStopCond(e.target.value)}>
            {(stopMeta.higher
              ? [{ key: 'avg',    label: '平均以上' }, { key: 'avg2x', label: '平均の2倍以上' }]
              : COND_OPTS
            ).map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <div className="do-filter-group">
          <span className="do-filter-label increase-label">増枠基準：</span>
          <select className="axis-select" value={increaseMetric} onChange={e => setIncMetric(e.target.value)}>
            {METRIC_OPTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <select className="axis-select" value={increaseCond} onChange={e => setIncreaseCond(e.target.value)}>
            {(incMeta.higher
              ? [{ key: 'avg',    label: '平均以下' }, { key: 'avg1_5', label: '平均の2/3以下' }, { key: 'avg2x', label: '平均の半分以下' }]
              : INCREASE_COND_OPTS
            ).map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <DoList
        title="🛑 停止推奨"
        subtitle={`${stopMeta.label}が${COND_OPTS.find(c => c.key === stopCond)?.label || stopCond}（平均 ${stopMeta.fmt(stopAvg)}）かつ${COST_SCOPE_OPTS.find(c => c.key === costScope)?.label}`}
        rows={stopList}
        doneTasks={doneTasks}
        onToggle={toggle}
        badge="stop"
      />
      <DoList
        title="📈 増枠推奨"
        subtitle={`${incMeta.label}が${INCREASE_COND_OPTS.find(c => c.key === increaseCond)?.label || increaseCond}（平均 ${incMeta.fmt(incAvg)}）かつ${COST_SCOPE_OPTS.find(c => c.key === costScope)?.label}`}
        rows={increaseList}
        doneTasks={doneTasks}
        onToggle={toggle}
        badge="increase"
      />
      <DoList
        title="👀 様子見"
        subtitle="停止・増枠いずれにも該当しないCR"
        rows={watchList}
        doneTasks={doneTasks}
        onToggle={toggle}
        badge="watch"
      />
    </div>
  )
}
