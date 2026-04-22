import { useMemo } from 'react'

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
                <th>Cost</th>
                <th>CPA</th>
                <th>CV</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className={doneTasks.has(r.id) ? 'row-done' : ''}>
                  <td className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={doneTasks.has(r.id)}
                      onChange={() => onToggle(r.id)}
                    />
                  </td>
                  <td className="asset-name" title={r.assetName}>{r.assetName}</td>
                  <td>{r.cv === 0 ? '—' : r.cvr.toFixed(2) + '%'}</td>
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
  const { stopList, increaseList } = useMemo(() => {
    if (rows.length === 0) return { stopList: [], increaseList: [] }
    const costs = [...rows].map(r => r.cost).sort((a, b) => a - b)
    const medianCost = costs[Math.floor(costs.length / 2)]
    return {
      stopList:     [...rows]
        .filter(r => r.cvr < avgCvr * 0.5 && r.cost >= medianCost)
        .sort((a, b) => b.cost - a.cost),
      increaseList: [...rows]
        .filter(r => r.cvr >= avgCvr && r.cost >= medianCost)
        .sort((a, b) => b.cvr - a.cvr),
    }
  }, [rows, avgCvr])

  const toggle = id => setDoneTasks(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  if (rows.length === 0) {
    return <div className="tab-empty">CR分析タブでCSVをアップロードしてください</div>
  }

  return (
    <div className="tab-content">
      <DoList
        title="🛑 停止推奨"
        subtitle={`CVRが平均の50%以下（< ${(avgCvr * 0.5).toFixed(2)}%）かつコスト上位`}
        rows={stopList}
        doneTasks={doneTasks}
        onToggle={toggle}
        badge="stop"
      />
      <DoList
        title="📈 増枠推奨"
        subtitle={`CVRが平均以上（≥ ${avgCvr.toFixed(2)}%）かつコスト上位・安定稼働中`}
        rows={increaseList}
        doneTasks={doneTasks}
        onToggle={toggle}
        badge="increase"
      />
    </div>
  )
}
