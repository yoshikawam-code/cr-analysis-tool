import { useMemo } from 'react'
import { detectAppealAxis, detectFormat, getWinLose } from '../appealAxis'

function PatternTable({ title, rows, badge }) {
  const sorted = useMemo(() => [...rows].sort((a, b) => b.cvr - a.cvr), [rows])
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

export default function ActionTab({ rows, avgCvr }) {
  const { win, lose } = useMemo(() => getWinLose(rows, avgCvr), [rows, avgCvr])

  const nextCRText = useMemo(() => {
    if (win.length === 0) return '勝ちパターンのデータがありません。コスト上位かつCVRが平均以上のCRが見つかりませんでした。'

    const axisCounts = {}
    win.forEach(r => {
      const axis = detectAppealAxis(r.assetName)
      axisCounts[axis] = (axisCounts[axis] || 0) + 1
    })
    const topAxis = Object.entries(axisCounts).sort((a, b) => b[1] - a[1])[0][0]

    const formatCounts = {}
    win.forEach(r => {
      const fmt = detectFormat(r.assetName)
      formatCounts[fmt] = (formatCounts[fmt] || 0) + 1
    })
    const topFormat = Object.entries(formatCounts).sort((a, b) => b[1] - a[1])[0][0]

    const topCVR = Math.max(...win.map(r => r.cvr))
    const avgWinCVR = win.reduce((s, r) => s + r.cvr, 0) / win.length
    const topCR = [...win].sort((a, b) => b.cvr - a.cvr)[0]

    return [
      `• 訴求軸：「${topAxis}」が最も成果を出しています（勝ちパターン ${axisCounts[topAxis]}件）`,
      `• フォーマット：「${topFormat}」が勝ちパターンの主流です`,
      `• 目標CVR：${avgWinCVR.toFixed(2)}%（最高 ${topCVR.toFixed(2)}%）以上を目指す`,
      `• ベンチマークCR：「${topCR.assetName}」`,
      `• 次に作るべきCR：${topAxis}を軸にした${topFormat}クリエイティブ`,
    ].join('\n')
  }, [win])

  if (rows.length === 0) {
    return <div className="tab-empty">CR分析タブでCSVをアップロードしてください</div>
  }

  return (
    <div className="tab-content">
      <div className="action-grid">
        <PatternTable title="✓ 勝ちパターン" rows={win} badge="win" />
        <PatternTable title="✗ 負けパターン" rows={lose} badge="lose" />
      </div>

      <div className="next-cr-box">
        <h3>次に作るべきCR要素</h3>
        <pre className="next-cr-text">{nextCRText}</pre>
      </div>
    </div>
  )
}
