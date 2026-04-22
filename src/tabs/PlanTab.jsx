import { useState, useMemo } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import { detectAppealAxis, APPEAL_OPTIONS, getWinLose } from '../appealAxis'

export default function PlanTab({ rows, avgCvr, appealTags, actionMetric }) {
  const metric = actionMetric || 'cvr'

  const avgVal = useMemo(() => {
    if (metric === 'cvr') return avgCvr
    const vals = rows.map(r => r[metric]).filter(v => v != null && !isNaN(v))
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
  }, [rows, avgCvr, metric])

  const { win, lose } = useMemo(() => getWinLose(rows, avgVal, metric), [rows, avgVal, metric])

  const [form, setForm]     = useState({ requestType: '類似', referenceCR: '', appealAxis: '', reason: '' })
  const [copied, setCopied] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError]     = useState('')

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleAutoFill = () => {
    if (win.length === 0) return
    const topWin = [...win].sort((a, b) =>
      metric === 'cpa'
        ? (a.cpa ?? Infinity) - (b.cpa ?? Infinity)
        : (b[metric] ?? 0) - (a[metric] ?? 0)
    )[0]
    const axis = appealTags[topWin.id] !== undefined ? appealTags[topWin.id] : detectAppealAxis(topWin.assetName)
    setForm(prev => ({ ...prev, referenceCR: topWin.assetName, appealAxis: axis }))
  }

  const avgWinCVR  = win.length > 0  ? win.reduce((s, r)  => s + r.cvr, 0) / win.length  : 0
  const loseCvrs   = lose.filter(r => r.cv > 0)
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

  const handleAIGenerate = async () => {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      setAiError('環境変数 VITE_ANTHROPIC_API_KEY が設定されていません')
      return
    }
    setAiLoading(true)
    setAiError('')
    try {
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

      const winSummary = win.slice(0, 5).map(r =>
        `- ${r.assetName}（CVR: ${r.cvr.toFixed(2)}%, CPA: ${r.cpa != null ? Math.round(r.cpa).toLocaleString() : 'N/A'}）`
      ).join('\n')
      const loseSummary = lose.slice(0, 5).map(r =>
        `- ${r.assetName}（CVR: ${r.cvr.toFixed(2)}%, CPA: ${r.cpa != null ? Math.round(r.cpa).toLocaleString() : 'N/A'}）`
      ).join('\n')

      const prompt = `あなたはTikTok広告のクリエイティブ制作ディレクターです。以下のデータをもとに、次のCR依頼書の「変更理由」と「制作指示」を日本語で生成してください。

【勝ちパターン（上位30%コスト、${metric.toUpperCase()}が平均以上）】
${winSummary || 'なし'}

【負けパターン（上位30%コスト、${metric.toUpperCase()}が平均未満）】
${loseSummary || 'なし'}

【全体平均CVR】${avgCvr.toFixed(2)}%
【参考CR】${form.referenceCR || '未設定'}
【訴求軸】${form.appealAxis || '未設定'}
【依頼種別】${form.requestType}

以下の2項目を生成してください：
1. 変更理由（3行以内：勝ち/負けパターンの差を踏まえた理由）
2. 制作指示（箇条書き5項目：TikTok動画としての具体的な演出・構成の指示）

フォーマット：
【変更理由】
（ここに記入）

【制作指示】
・（指示1）
・（指示2）
・（指示3）
・（指示4）
・（指示5）`

      const response = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('')
      set('reason', text)
    } catch (err) {
      setAiError('AI生成エラー: ' + (err.message || String(err)))
    } finally {
      setAiLoading(false)
    }
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
              ⚡ 自動入力
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

          <label className="form-label">変更理由 / 制作指示</label>
          <div className="ai-row">
            <button
              className="ai-btn"
              onClick={handleAIGenerate}
              disabled={aiLoading}
            >
              {aiLoading ? '生成中...' : '✨ AI生成'}
            </button>
            {aiError && <span className="ai-error">{aiError}</span>}
          </div>
          <textarea
            className="form-textarea"
            value={form.reason}
            onChange={e => set('reason', e.target.value)}
            placeholder="変更・作成の理由を入力、またはAI生成ボタンで自動入力"
            rows={6}
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
