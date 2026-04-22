import { useMemo } from 'react'
import { detectAppealAxis, detectFormat, APPEAL_OPTIONS } from '../appealAxis'

function BarChart({ data, title }) {
  const max = Math.max(...data.map(d => d.value), 0.001)
  return (
    <div className="chart-card">
      <h3 className="chart-title">{title}</h3>
      {data.length === 0 ? (
        <p className="empty-note">データなし</p>
      ) : data.map(d => (
        <div key={d.label} className="bar-row">
          <span className="bar-label">{d.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="bar-val">
            {d.value.toFixed(2)}%
            <span className="bar-count"> ({d.count}件)</span>
          </span>
        </div>
      ))}
    </div>
  )
}

export default function CheckTab({ rows, appealTags, setAppealTags }) {
  const avgCvr = rows.length > 0 ? rows[0].avgCvr : 0

  const enriched = useMemo(() => rows.map(r => ({
    ...r,
    appealAxis: appealTags[r.id] !== undefined ? appealTags[r.id] : detectAppealAxis(r.assetName),
    format:     detectFormat(r.assetName),
  })), [rows, appealTags])

  const axisCvrData = useMemo(() => {
    const g = {}
    enriched.forEach(r => {
      if (!g[r.appealAxis]) g[r.appealAxis] = { sum: 0, count: 0 }
      g[r.appealAxis].sum += r.cvr
      g[r.appealAxis].count++
    })
    return Object.entries(g)
      .map(([label, { sum, count }]) => ({ label, value: sum / count, count }))
      .sort((a, b) => b.value - a.value)
  }, [enriched])

  const formatCvrData = useMemo(() => {
    const g = {}
    enriched.forEach(r => {
      if (!g[r.format]) g[r.format] = { sum: 0, count: 0 }
      g[r.format].sum += r.cvr
      g[r.format].count++
    })
    return Object.entries(g)
      .map(([label, { sum, count }]) => ({ label, value: sum / count, count }))
      .sort((a, b) => b.value - a.value)
  }, [enriched])

  if (rows.length === 0) {
    return <div className="tab-empty">CR分析タブでCSVをアップロードしてください</div>
  }

  return (
    <div className="tab-content">
      <div className="charts-row">
        <BarChart data={axisCvrData} title="訴求軸別 平均CVR" />
        <BarChart data={formatCvrData} title="フォーマット別 平均CVR" />
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>日</th>
              <th>クリエイティブアセット名</th>
              <th>訴求軸</th>
              <th>フォーマット</th>
              <th>CVR</th>
              <th>CV</th>
              <th>CPA</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map(row => (
              <tr key={row.id} className={row.cvr < avgCvr ? 'low-cvr' : ''}>
                <td>{row.date}</td>
                <td className="asset-name" title={row.assetName}>{row.assetName}</td>
                <td>
                  <select
                    className="axis-select"
                    value={row.appealAxis}
                    onChange={e => setAppealTags(prev => ({ ...prev, [row.id]: e.target.value }))}
                  >
                    {APPEAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td>{row.format}</td>
                <td>{row.cv === 0 ? '—' : row.cvr.toFixed(2) + '%'}</td>
                <td>{Math.round(row.cv).toLocaleString()}</td>
                <td>{row.cv === 0 || row.cpa == null ? '—' : row.cpa.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                <td>{Math.round(row.cost).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
