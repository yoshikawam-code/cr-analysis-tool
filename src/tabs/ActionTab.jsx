import { useMemo } from 'react'
import { detectAppealAxis, detectFormat, getWinLose } from '../appealAxis'

const METRIC_OPTS = [
  { key: 'cvr', label: 'CVR',  fmt: v => v.toFixed(2) + '%' },
  { key: 'cpa', label: 'CPA',  fmt: v => v == null ? '—' : v.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) },
  { key: 'ctr', label: 'CTR',  fmt: v => v.toFixed(2) + '%' },
]

function avgMetric(rows, key) {
  const vals = rows.map(r => r[key]).filter(v => v != null && !isNaN(v))
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
}

function PatternTable({ title, rows, badge, metricKey, metricFmt }) {
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) =>
      metricKey === 'cpa'
        ? (a[metricKey] ?? Infinity) - (b[metricKey] ?? Infinity)
        : (b[metricKey] ?? 0) - (a[metricKey] ?? 0)
    )
  }, [rows, metricKey])

  return (
    <div className={`pattern-card pattern-${badge}`}>
      <h3 className="pattern-title">{title}</h3>
      <p className="pattern-count">{rows.length}件</p>
      {rows.length === 0 ? (
        <p className="empty-note">該当するCRはありません</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>クリエイティブアセット名</th>
                <th>CVR</th>
                <th>CTR</th>
                <th>Cost</th>
                <th>CPA</th>
                <th>CV</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.id}>
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

export default function ActionTab({ rows, avgCvr, actionMetric, setActionMetric }) {
  const metricDef = METRIC_OPTS.find(m => m.key === actionMetric) ?? METRIC_OPTS[0]

  const avgVal = useMemo(() => {
    if (actionMetric === 'cvr') return avgCvr
    return avgMetric(rows, actionMetric)
  }, [rows, avgCvr, actionMetric])

  const { win, lose } = useMemo(() =>
    getWinLose(rows, avgVal, actionMetric),
    [rows, avgVal, actionMetric])

  const nextCRText = useMemo(() => {
    if (win.length === 0) return '勝ちパターンのデータがありません。コスト上位30%かつ選択指標が平均以上のCRが見つかりませんでした。'

    const axisCounts = {}
    win.forEach(r => {
      const axis = detectAppealAxis(r.assetName)
      axisCounts[axis] = (axisCounts[axis] || 0) + 1
    })
    const topAxis = Object.entries(axisCounts).sort((a, b) => b[1] - a[1])[0][0]

    const fmtCounts = {}
    win.forEach(r => {
      const fmt = detectFormat(r.material, r.assetName)
      fmtCounts[fmt] = (fmtCounts[fmt] || 0) + 1
    })
    const topFmt = Object.entries(fmtCounts).sort((a, b) => b[1] - a[1])[0][0]

    const topCR = [...win].sort((a, b) =>
      actionMetric === 'cpa'
        ? (a[actionMetric] ?? Infinity) - (b[actionMetric] ?? Infinity)
        : (b[actionMetric] ?? 0) - (a[actionMetric] ?? 0)
    )[0]

    const avgWinVal = avgMetric(win, actionMetric)

    const lines = [
      `• 訴求軸：「${topAxis}」が最も成果を出しています（勝ちパターン ${axisCounts[topAxis]}件）`,
      `• フォーマット：「${topFmt}」が勝ちパターンの主流です`,
    ]
    if (actionMetric === 'cvr') {
      const best = Math.max(...win.map(r => r.cvr))
      lines.push(`• 目標CVR：${avgWinVal.toFixed(2)}%（最高 ${best.toFixed(2)}%）以上を目指す`)
    } else if (actionMetric === 'cpa') {
      lines.push(`• 目標CPA：${avgWinVal.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} 以下を目指す`)
    } else {
      const best = Math.max(...win.map(r => r.ctr))
      lines.push(`• 目標CTR：${avgWinVal.toFixed(2)}%（最高 ${best.toFixed(2)}%）以上を目指す`)
    }
    lines.push(`• ベンチマークCR：「${topCR.assetName}」`)
    lines.push(`• 次に作るべきCR：${topAxis}を軸にした${topFmt}クリエイティブ`)
    return lines.join('\n')
  }, [win, actionMetric])

  if (rows.length === 0) {
    return <div className="tab-empty">CR分析タブでCSVをアップロードしてください</div>
  }

  return (
    <div className="tab-content">
      <div className="action-toolbar">
        <span className="metric-label">基準指標：</span>
        <select
          className="axis-select"
          value={actionMetric}
          onChange={e => setActionMetric(e.target.value)}
        >
          {METRIC_OPTS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <span className="action-toolbar-note">（コスト上位30% かつ 指標が平均比較）</span>
      </div>

      <div className="action-grid">
        <PatternTable title="✓ 勝ちパターン" rows={win} badge="win" metricKey={actionMetric} metricFmt={metricDef.fmt} />
        <PatternTable title="✗ 負けパターン" rows={lose} badge="lose" metricKey={actionMetric} metricFmt={metricDef.fmt} />
      </div>

      <div className="next-cr-box">
        <h3>次に作るべきCR要素</h3>
        <pre className="next-cr-text">{nextCRText}</pre>
      </div>
    </div>
  )
}
