import { useState, useMemo } from 'react'
import { detectAppealAxis, APPEAL_OPTIONS, getWinLose } from '../appealAxis'

export default function PlanTab({ rows, avgCvr, appealTags }) {
  const { win, lose } = useMemo(() => getWinLose(rows, avgCvr), [rows, avgCvr])

  const [form, setForm] = useState({ requestType: '類似', referenceCR: '', appealAxis: '', reason: '' })
  const [copied, setCopied] = useState(false)

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleAutoFill = () => {
    if (win.length === 0) return
    const topWin = [...win].sort((a, b) => b.cvr - a.cvr)[0]
    const axis = appealTags[topWin.id] !== undefined ? appealTags[topWin.id] : detectAppealAxis(topWin.assetName)
    setForm(prev => ({ ...prev, referenceCR: topWin.assetName, appealAxis: axis }))
  }

  const avgWinCVR = win.length > 0 ? win.reduce((s, r) => s + r.cvr, 0) / win.length : 0
  const loseCvrs = lose.filter(r => r.cv > 0)
  const avgLoseCVR = loseCvrs.length > 0 ? loseCvrs.reduce((s, r) => s + r.cvr, 0) / loseCvrs.length : 0

  const brief = useMemo(() => {
    const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
    return `【クリエイティブ依頼書】
作成日：${today}

■ 依頼種別：${form.requestType}
■ 参考CR：${form.referenceCR || '（未設定）'}
■ 訴求軸：${form.appealAxis || '（未設定）'}
■ 変更理由：${form.reason || '（未入力）'}

■ 分析データより
・全体平均CVR：${avgCvr.toFixed(2)}%
・勝ちパターン平均CVR：${avgWinCVR > 0 ? avgWinCVR.toFixed(2) + '%' : 'データなし'}
・負けパターン平均CVR：${avgLoseCVR > 0 ? avgLoseCVR.toFixed(2) + '%' : 'データなし'}

■ 制作メモ
・冒頭3秒以内に「${form.appealAxis || '訴求軸'}」を明示すること
・テキストは最小限にし視覚的に訴求する
・CTAボタンは画面下部に配置すること`
  }, [form, avgCvr, avgWinCVR, avgLoseCVR])

  const handleCopy = () => {
    navigator.clipboard.writeText(brief).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (rows.length === 0) {
    return <div className="tab-empty">CR分析タブでCSVをアップロードしてください</div>
  }

  return (
    <div className="tab-content">
      <div className="plan-grid">
        <div className="plan-form">
          <div className="plan-form-header">
            <h3>依頼書フォーム</h3>
            <button className="autofill-btn" onClick={handleAutoFill} disabled={win.length === 0}>
              ⚡ 勝ちパターンから自動入力
            </button>
          </div>

          <label className="form-label">依頼種別</label>
          <select className="form-input" value={form.requestType} onChange={e => set('requestType', e.target.value)}>
            {['類似', '新規', '修正'].map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          <label className="form-label">参考CR</label>
          <select className="form-input" value={form.referenceCR} onChange={e => set('referenceCR', e.target.value)}>
            <option value="">（選択してください）</option>
            {rows.map(r => <option key={r.id} value={r.assetName}>{r.assetName}</option>)}
          </select>

          <label className="form-label">訴求軸</label>
          <select className="form-input" value={form.appealAxis} onChange={e => set('appealAxis', e.target.value)}>
            <option value="">（選択してください）</option>
            {APPEAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          <label className="form-label">変更理由</label>
          <textarea
            className="form-textarea"
            value={form.reason}
            onChange={e => set('reason', e.target.value)}
            placeholder="変更・作成の理由を入力してください"
            rows={4}
          />
        </div>

        <div className="plan-preview">
          <div className="preview-header">
            <h3>依頼書プレビュー</h3>
            <button className="copy-btn" onClick={handleCopy}>
              {copied ? '✓ コピーしました' : '📋 コピー'}
            </button>
          </div>
          <pre className="brief-text">{brief}</pre>
        </div>
      </div>
    </div>
  )
}
