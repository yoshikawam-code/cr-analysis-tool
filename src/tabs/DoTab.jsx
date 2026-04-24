import { useState, useMemo } from 'react'

const DEFAULT_KPI = { cvrMin: '', cvrMax: '', cpaMax: '', cpaMin: '', ctrMin: '', ctrMax: '' }

function buildConsultPrompt(stopList, increaseList) {
  const fmtRow = r => `・${r.assetName}：CVR ${r.cv === 0 ? '—' : r.cvr.toFixed(2) + '%'} / CTR ${r.ctr.toFixed(2)}% / CPA ${r.cv === 0 || r.cpa == null ? '—' : Math.round(r.cpa).toLocaleString() + '円'} / CV ${Math.round(r.cv)}`
  return `【配信状況アラート相談】
【停止推奨CR】
${stopList.slice(0, 8).map(fmtRow).join('\n') || 'なし'}

【増枠推奨CR】
${increaseList.slice(0, 8).map(fmtRow).join('\n') || 'なし'}

上記の配信状況について：
1. 停止・増枠の判断は適切か
2. 予算の再配分提案
3. 今週の優先アクション`
}

function numOrNull(s) {
  const v = parseFloat(s)
  return isNaN(v) ? null : v
}

function classify(row, kpi) {
  const cvrMin = numOrNull(kpi.cvrMin)
  const cvrMax = numOrNull(kpi.cvrMax)
  const cpaMin = numOrNull(kpi.cpaMin)
  const cpaMax = numOrNull(kpi.cpaMax)
  const ctrMin = numOrNull(kpi.ctrMin)
  const ctrMax = numOrNull(kpi.ctrMax)

  const isStop = (
    (cvrMin != null && row.cvr < cvrMin) ||
    (cpaMax != null && row.cpa != null && row.cpa > cpaMax) ||
    (ctrMin != null && row.ctr < ctrMin)
  )
  if (isStop) return 'stop'

  const isIncrease = (
    (cvrMax != null && row.cvr > cvrMax) ||
    (cpaMin != null && row.cpa != null && row.cpa < cpaMin) ||
    (ctrMax != null && row.ctr > ctrMax)
  )
  if (isIncrease) return 'increase'

  return 'watch'
}

function AlertList({ title, rows, doneTasks, onToggle, badge }) {
  if (rows.length === 0) return null
  return (
    <div className={`do-section do-${badge}`}>
      <div className="do-section-header">
        <h3>{title}</h3>
        <span className="do-count">{rows.length}件</span>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>対応済み</th>
              <th>クリエイティブアセット名</th>
              <th>CVR</th>
              <th>CTR</th>
              <th>CPA</th>
              <th>Cost</th>
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
                <td>{r.cv === 0 || r.cpa == null ? '—' : r.cpa.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                <td>{Math.round(r.cost).toLocaleString()}</td>
                <td>{Math.round(r.cv).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function DoTab({ rows, avgCvr, doneTasks, setDoneTasks }) {
  const [kpi, setKpi]       = useState(DEFAULT_KPI)
  const [copied, setCopied] = useState(false)

  const setK = (k, v) => setKpi(prev => ({ ...prev, [k]: v }))

  const hasKpi = Object.values(kpi).some(v => v !== '')

  const { stopList, increaseList, watchList } = useMemo(() => {
    if (!hasKpi || rows.length === 0) return { stopList: [], increaseList: [], watchList: rows }
    const stop = [], increase = [], watch = []
    rows.forEach(r => {
      const cat = classify(r, kpi)
      if (cat === 'stop') stop.push(r)
      else if (cat === 'increase') increase.push(r)
      else watch.push(r)
    })
    return { stopList: stop, increaseList: increase, watchList: watch }
  }, [rows, kpi, hasKpi])

  const toggle = id => setDoneTasks(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const handleConsult = () => {
    navigator.clipboard.writeText(buildConsultPrompt(stopList, increaseList)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  if (rows.length === 0) {
    return <div className="tab-empty">CR分析タブでCSVをアップロードしてください</div>
  }

  return (
    <div className="tab-content">
      {/* ── KPI Threshold Form ── */}
      <div className="kpi-form">
        <div className="kpi-form-header">
          <h3>KPI閾値設定</h3>
          <span className="kpi-form-hint">空欄の項目は判定に使用されません</span>
        </div>
        <div className="kpi-grid">
          <div className="kpi-group">
            <span className="kpi-group-label stop-label">CVR 停止基準（%未満）</span>
            <input className="kpi-input" type="number" step="0.1" min="0" placeholder="例: 1.0"
              value={kpi.cvrMin} onChange={e => setK('cvrMin', e.target.value)} />
          </div>
          <div className="kpi-group">
            <span className="kpi-group-label increase-label">CVR 増枠基準（%超）</span>
            <input className="kpi-input" type="number" step="0.1" min="0" placeholder="例: 3.0"
              value={kpi.cvrMax} onChange={e => setK('cvrMax', e.target.value)} />
          </div>
          <div className="kpi-group">
            <span className="kpi-group-label stop-label">CPA 停止基準（円超）</span>
            <input className="kpi-input" type="number" step="100" min="0" placeholder="例: 15000"
              value={kpi.cpaMax} onChange={e => setK('cpaMax', e.target.value)} />
          </div>
          <div className="kpi-group">
            <span className="kpi-group-label increase-label">CPA 増枠基準（円未満）</span>
            <input className="kpi-input" type="number" step="100" min="0" placeholder="例: 5000"
              value={kpi.cpaMin} onChange={e => setK('cpaMin', e.target.value)} />
          </div>
          <div className="kpi-group">
            <span className="kpi-group-label stop-label">CTR 停止基準（%未満）</span>
            <input className="kpi-input" type="number" step="0.1" min="0" placeholder="例: 0.5"
              value={kpi.ctrMin} onChange={e => setK('ctrMin', e.target.value)} />
          </div>
          <div className="kpi-group">
            <span className="kpi-group-label increase-label">CTR 増枠基準（%超）</span>
            <input className="kpi-input" type="number" step="0.1" min="0" placeholder="例: 2.0"
              value={kpi.ctrMax} onChange={e => setK('ctrMax', e.target.value)} />
          </div>
        </div>
        <div className="kpi-actions">
          <button className="reset-btn" onClick={() => setKpi(DEFAULT_KPI)}>リセット</button>
          {hasKpi && (
            <span className="kpi-summary">
              停止 {stopList.length}件 / 増枠 {increaseList.length}件 / 様子見 {watchList.length}件
            </span>
          )}
        </div>
      </div>

      {/* ── Consult button ── */}
      {hasKpi && (stopList.length + increaseList.length > 0) && (
        <div className="consult-row">
          <button className="consult-btn" onClick={handleConsult}>
            {copied ? '✓ コピーしました' : '🤖 Claudeに相談（プロンプトをコピー）'}
          </button>
        </div>
      )}

      {/* ── Alert lists ── */}
      {hasKpi ? (
        <>
          <AlertList title="🛑 停止推奨"    rows={stopList}     doneTasks={doneTasks} onToggle={toggle} badge="stop" />
          <AlertList title="📈 増枠推奨"    rows={increaseList} doneTasks={doneTasks} onToggle={toggle} badge="increase" />
          <AlertList title="👀 様子見"      rows={watchList}    doneTasks={doneTasks} onToggle={toggle} badge="watch" />
        </>
      ) : (
        <div className="kpi-placeholder">
          <p>KPI閾値を設定するとCRが自動分類されます</p>
          <p className="kpi-placeholder-hint">平均CVR: {avgCvr.toFixed(2)}% を参考に設定してください</p>
          <div className="table-wrapper" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>クリエイティブアセット名</th>
                  <th>CVR</th>
                  <th>CTR</th>
                  <th>CPA</th>
                  <th>Cost</th>
                  <th>CV</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].sort((a, b) => b.cost - a.cost).map(r => (
                  <tr key={r.id}>
                    <td className="asset-name" title={r.assetName}>{r.assetName}</td>
                    <td>{r.cv === 0 ? '—' : r.cvr.toFixed(2) + '%'}</td>
                    <td>{r.ctr.toFixed(2) + '%'}</td>
                    <td>{r.cv === 0 || r.cpa == null ? '—' : r.cpa.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    <td>{Math.round(r.cost).toLocaleString()}</td>
                    <td>{Math.round(r.cv).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
