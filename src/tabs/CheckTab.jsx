import { useState, useMemo } from 'react'
import { detectAppealAxis, detectFormat, APPEAL_OPTIONS } from '../appealAxis'
import { filterByPeriod, detectFatigue } from '../dateUtils'
import { aggregateByName } from '../aggregateUtils'

const PERIODS = ['全期間', '今月', '今週', '先週']
const METRICS = [
  { key: 'cvr', label: 'CVR (%)', fmt: v => v.toFixed(2) + '%', higher: true },
  { key: 'ctr', label: 'CTR (%)', fmt: v => v.toFixed(2) + '%', higher: true },
  { key: 'cpa', label: 'CPA',     fmt: v => v == null ? '—' : v.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), higher: false },
]

function avgM(arr, key) {
  const vals = arr.map(r => r[key]).filter(v => v != null && !isNaN(v) && v > 0)
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
}

function BarChart({ title, groups, metricFmt, higherBetter }) {
  const maxVal = Math.max(...groups.map(g => g.val), 0.0001)
  return (
    <div className="chart-card">
      <div className="chart-title">{title}</div>
      {groups.length === 0 ? (
        <p className="empty-note">データなし</p>
      ) : groups.map(g => (
        <div key={g.label} className="bar-row">
          <span className="bar-label" title={g.label}>{g.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(g.val / maxVal) * 100}%` }} />
          </div>
          <span className="bar-val">
            {metricFmt(g.val)}
            <span className="bar-count"> ({g.count}件)</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function buildAiPrompt(r) {
  return `【CR動画分析依頼】
CR名：${r.assetName}
動画URL：${r.material || '（URLなし）'}
指標：CVR ${r.cv === 0 ? '—' : r.cvr.toFixed(2) + '%'} / CTR ${r.ctr.toFixed(2)}% / CPA ${r.cv === 0 || r.cpa == null ? '—' : Math.round(r.cpa).toLocaleString() + '円'} / CV ${Math.round(r.cv)}件

以下を分析してください：
1. 冒頭3秒の内容
2. テロップ・訴求ワード
3. 訴求軸の分類（価格／UGC／比較／before-after／その他）
4. 強み・弱みの評価
5. 改善提案`
}

function CopyBtn({ text, label = 'AI精査' }) {
  const [copied, setCopied] = useState(false)
  const handleClick = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button className="ai-copy-btn" onClick={handleClick}>
      {copied ? '✓ コピー済み' : `🔍 ${label}`}
    </button>
  )
}

export default function CheckTab({ rows, appealTags, setAppealTags }) {
  const [period, setPeriod] = useState('全期間')
  const [metric, setMetric] = useState('cvr')

  const filtered   = useMemo(() => filterByPeriod(rows, period), [rows, period])
  const fatigueMap = useMemo(() => detectFatigue(rows), [rows])
  const metricDef  = METRICS.find(m => m.key === metric)

  // Aggregate raw rows by CR name for the table
  const crRows = useMemo(() => aggregateByName(filtered), [filtered])

  const axisGroups = useMemo(() => {
    const map = {}
    crRows.forEach(r => {
      const tag = appealTags[r.assetName] !== undefined ? appealTags[r.assetName] : detectAppealAxis(r.assetName)
      if (!map[tag]) map[tag] = []
      map[tag].push(r)
    })
    return Object.entries(map)
      .map(([label, arr]) => ({ label, val: avgM(arr, metric), count: arr.length }))
      .sort((a, b) => metricDef.higher ? b.val - a.val : a.val - b.val)
  }, [crRows, metric, appealTags, metricDef])

  const fmtGroups = useMemo(() => {
    const map = {}
    crRows.forEach(r => {
      const fmt = detectFormat(r.material, r.assetName)
      if (!map[fmt]) map[fmt] = []
      map[fmt].push(r)
    })
    return Object.entries(map)
      .map(([label, arr]) => ({ label, val: avgM(arr, metric), count: arr.length }))
      .sort((a, b) => metricDef.higher ? b.val - a.val : a.val - b.val)
  }, [crRows, metric, metricDef])

  const fatigued = useMemo(() =>
    Object.entries(fatigueMap).map(([name, metrics]) => ({ name, metrics })),
    [fatigueMap])

  if (rows.length === 0) {
    return <div className="tab-empty">CR分析タブでCSVをアップロードしてください</div>
  }

  return (
    <div className="tab-content">
      {/* ── Toolbar ── */}
      <div className="check-toolbar">
        <div className="period-btns">
          {PERIODS.map(p => (
            <button key={p} className={`period-btn${period === p ? ' active' : ''}`} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
        <div className="metric-selector">
          <span className="metric-label">指標：</span>
          {METRICS.map(m => (
            <button key={m.key} className={`metric-btn${metric === m.key ? ' active' : ''}`} onClick={() => setMetric(m.key)}>{m.label}</button>
          ))}
        </div>
      </div>

      {/* ── Charts ── */}
      <div className="charts-row">
        <BarChart title={`訴求軸別 ${metricDef.label}`} groups={axisGroups} metricFmt={metricDef.fmt} higherBetter={metricDef.higher} />
        <BarChart title={`フォーマット別 ${metricDef.label}`} groups={fmtGroups} metricFmt={metricDef.fmt} higherBetter={metricDef.higher} />
      </div>

      {/* ── Fatigue ── */}
      {fatigued.length > 0 && (
        <div className="fatigue-section">
          <h3 className="fatigue-title">疲弊検知 — 直近7日 vs 前7日で20%以上悪化</h3>
          <div className="fatigue-list">
            {fatigued.map(({ name, metrics }) => (
              <div key={name} className="fatigue-item">
                <span className="fatigue-name" title={name}>{name}</span>
                {metrics.map(m => <span key={m} className="fatigue-badge-pill">{m} 疲弊中</span>)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CR Table with AI精査ボタン ── */}
      <div className="table-wrapper" style={{ marginTop: 20 }}>
        <table>
          <thead>
            <tr>
              <th>クリエイティブアセット名</th>
              <th>訴求軸</th>
              <th>フォーマット</th>
              <th>CVR</th>
              <th>CTR</th>
              <th>CPA</th>
              <th>Cost</th>
              <th>CV</th>
              <th>AI精査</th>
            </tr>
          </thead>
          <tbody>
            {crRows.map(r => {
              const axis  = appealTags[r.assetName] !== undefined ? appealTags[r.assetName] : detectAppealAxis(r.assetName)
              const fmt   = detectFormat(r.material, r.assetName)
              const tired = fatigueMap[r.assetName]
              return (
                <tr key={r.id}>
                  <td className="asset-name" title={r.assetName}>
                    {r.assetName}
                    {tired && <span className="fatigue-badge-inline">疲弊</span>}
                  </td>
                  <td>
                    <select
                      className="axis-select"
                      value={axis}
                      onChange={e => setAppealTags(prev => ({ ...prev, [r.assetName]: e.target.value }))}
                    >
                      {APPEAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  <td>{fmt}</td>
                  <td>{r.cv === 0 ? '—' : r.cvr.toFixed(2) + '%'}</td>
                  <td>{r.ctr.toFixed(2) + '%'}</td>
                  <td>{r.cv === 0 || r.cpa == null ? '—' : r.cpa.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                  <td>{Math.round(r.cost).toLocaleString()}</td>
                  <td>{Math.round(r.cv).toLocaleString()}</td>
                  <td><CopyBtn text={buildAiPrompt(r)} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
