import { useState, useMemo } from 'react'
import { detectAppealAxis, detectFormat, getWinLose } from '../appealAxis'

const METRIC_OPTS = [
  { key: 'cvr', label: 'CVR',  fmt: v => v.toFixed(2) + '%' },
  { key: 'cpa', label: 'CPA',  fmt: v => v == null ? '—' : v.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) },
  { key: 'ctr', label: 'CTR',  fmt: v => v.toFixed(2) + '%' },
]
const STORAGE_KEY = 'cr_action_patterns'

function avgM(rows, key) {
  const vals = rows.map(r => r[key]).filter(v => v != null && !isNaN(v))
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
}

function buildAiPrompt(win, lose, metric) {
  const fmtRow = r => `・${r.assetName}：CVR ${r.cv === 0 ? '—' : r.cvr.toFixed(2) + '%'} / CTR ${r.ctr.toFixed(2)}% / CPA ${r.cv === 0 || r.cpa == null ? '—' : Math.round(r.cpa).toLocaleString() + '円'} / CV ${Math.round(r.cv)}`
  return `【次のCR要素提案依頼】
【勝ちパターン（コスト上位30%・${metric.toUpperCase()}が平均以上）】
${win.slice(0, 8).map(fmtRow).join('\n') || 'なし'}

【負けパターン（コスト上位30%・${metric.toUpperCase()}が平均未満）】
${lose.slice(0, 8).map(fmtRow).join('\n') || 'なし'}

上記をもとに以下を提案してください：
1. 次に作るべきCR要素（訴求軸・フォーマット・構成）
2. 類似展開すべきCRとその理由
3. 避けるべき要素`
}

function PatternTable({ title, rows, badge, metricKey }) {
  const sorted = useMemo(() =>
    [...rows].sort((a, b) =>
      metricKey === 'cpa'
        ? (a[metricKey] ?? Infinity) - (b[metricKey] ?? Infinity)
        : (b[metricKey] ?? 0) - (a[metricKey] ?? 0)
    ), [rows, metricKey])

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
  const [copied,  setCopied]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  const metricDef = METRIC_OPTS.find(m => m.key === actionMetric) ?? METRIC_OPTS[0]

  const avgVal = useMemo(() => {
    if (actionMetric === 'cvr') return avgCvr
    return avgM(rows, actionMetric)
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

    const avgWinVal = avgM(win, actionMetric)
    const lines = [
      `• 訴求軸：「${topAxis}」が最も成果（勝ちパターン ${axisCounts[topAxis]}件）`,
      `• フォーマット：「${topFmt}」が主流`,
    ]
    if (actionMetric === 'cvr') {
      lines.push(`• 目標CVR：${avgWinVal.toFixed(2)}%（最高 ${Math.max(...win.map(r => r.cvr)).toFixed(2)}%）以上`)
    } else if (actionMetric === 'cpa') {
      lines.push(`• 目標CPA：${Math.round(avgWinVal).toLocaleString()}円 以下`)
    } else {
      lines.push(`• 目標CTR：${avgWinVal.toFixed(2)}%（最高 ${Math.max(...win.map(r => r.ctr)).toFixed(2)}%）以上`)
    }
    lines.push(`• ベンチマーク：「${topCR.assetName}」`)
    lines.push(`• 次CR：${topAxis}を軸にした${topFmt}クリエイティブ`)
    return lines.join('\n')
  }, [win, actionMetric])

  const savedInfo = useMemo(() => {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      return data
    } catch { return null }
  }, [saved]) // re-read after save

  const handleCopyAI = () => {
    navigator.clipboard.writeText(buildAiPrompt(win, lose, actionMetric)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const handleSave = () => {
    const data = {
      savedAt:  new Date().toISOString(),
      metric:   actionMetric,
      avgVal,
      win:  win.map(r  => ({ assetName: r.assetName, cvr: r.cvr, ctr: r.ctr, cpa: r.cpa, cost: r.cost, cv: r.cv })),
      lose: lose.map(r => ({ assetName: r.assetName, cvr: r.cvr, ctr: r.ctr, cpa: r.cpa, cost: r.cost, cv: r.cv })),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    setSaved(s => !s) // trigger re-read of savedInfo
  }

  if (rows.length === 0) {
    return <div className="tab-empty">CR分析タブでCSVをアップロードしてください</div>
  }

  return (
    <div className="tab-content">
      <div className="action-toolbar">
        <span className="metric-label">基準指標：</span>
        <select className="axis-select" value={actionMetric} onChange={e => setActionMetric(e.target.value)}>
          {METRIC_OPTS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <span className="action-toolbar-note">コスト上位30% かつ 指標が平均比較</span>
        <div className="action-toolbar-right">
          <button className="ai-ask-btn" onClick={handleCopyAI}>
            {copied ? '✓ コピーしました' : '🤖 AIに聞く（プロンプトをコピー）'}
          </button>
          <button className="save-pattern-btn" onClick={handleSave}>
            💾 今週分として保存
          </button>
          {savedInfo && (
            <span className="saved-info">
              最終保存: {new Date(savedInfo.savedAt).toLocaleDateString('ja-JP')}（{savedInfo.metric.toUpperCase()}基準 / 勝ち{savedInfo.win.length}件・負け{savedInfo.lose.length}件）
            </span>
          )}
        </div>
      </div>

      <div className="action-grid">
        <PatternTable title="✓ 勝ちパターン" rows={win}  badge="win"  metricKey={actionMetric} />
        <PatternTable title="✗ 負けパターン" rows={lose} badge="lose" metricKey={actionMetric} />
      </div>

      <div className="next-cr-box">
        <h3>次に作るべきCR要素</h3>
        <pre className="next-cr-text">{nextCRText}</pre>
      </div>
    </div>
  )
}
