import { useState, useMemo } from 'react'
import { detectAppealAxis, APPEAL_OPTIONS, getWinLose } from '../appealAxis'

const STORAGE_KEY = 'cr_action_patterns'

function loadStoredPatterns() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
}

export default function PlanTab({ rows, avgCvr, appealTags, actionMetric }) {
  const metric = actionMetric || 'cvr'

  const avgVal = useMemo(() => {
    if (metric === 'cvr') return avgCvr
    const vals = rows.map(r => r[metric]).filter(v => v != null && !isNaN(v))
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
  }, [rows, avgCvr, metric])

  const { win, lose } = useMemo(() => getWinLose(rows, avgVal, metric), [rows, avgVal, metric])

  // Prefer current CSV data; fall back to localStorage if no data loaded
  const stored = rows.length === 0 ? loadStoredPatterns() : null
  const effectiveWin  = rows.length > 0 ? win  : (stored?.win  || [])
  const effectiveLose = rows.length > 0 ? lose : (stored?.lose || [])

  const topWin = useMemo(() => {
    if (effectiveWin.length === 0) return null
    return [...effectiveWin].sort((a, b) =>
      metric === 'cpa' ? (a.cpa ?? Infinity) - (b.cpa ?? Infinity) : (b[metric] ?? 0) - (a[metric] ?? 0)
    )[0]
  }, [effectiveWin, metric])

  const topAxis = topWin
    ? (appealTags[topWin.assetName] ?? detectAppealAxis(topWin.assetName))
    : ''

  const [form, setForm] = useState({
    requestType: '類似',
    referenceCR: '',
    appealAxis:  '',
    format:      '',
    duration:    '',
    opening3s:   '',
    caption:     '',
    other:       '',
  })
  const [copied, setCopied] = useState(false)

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleAutoFill = () => {
    if (!topWin) return
    setForm(prev => ({
      ...prev,
      referenceCR: topWin.assetName,
      appealAxis:  topAxis,
    }))
  }

  const brief = useMemo(() => {
    const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })

    const winLines  = effectiveWin.slice(0, 5).map(r =>
      `・${r.assetName}：CVR ${r.cvr?.toFixed(2) ?? '—'}% / CPA ${r.cpa != null ? Math.round(r.cpa).toLocaleString() + '円' : '—'} / CV ${Math.round(r.cv ?? 0)}`
    ).join('\n') || '（データなし）'
    const loseLines = effectiveLose.slice(0, 5).map(r =>
      `・${r.assetName}：CVR ${r.cvr?.toFixed(2) ?? '—'}% / CPA ${r.cpa != null ? Math.round(r.cpa).toLocaleString() + '円' : '—'} / CV ${Math.round(r.cv ?? 0)}`
    ).join('\n') || '（データなし）'

    const changeReason = form.referenceCR && effectiveLose.length > 0
      ? `負けパターンと比較して「${form.appealAxis || '訴求軸'}」に強みがある${form.referenceCR}を参考に制作`
      : '（未入力）'

    return `【CR制作依頼書】
依頼日：${today}
依頼種別：${form.requestType}
参考CR：${form.referenceCR || '（未設定）'}
訴求軸：${form.appealAxis || '（未設定）'}
変更理由：${changeReason}
制作指示：
・フォーマット：${form.format}
・尺：${form.duration}
・冒頭3秒：${form.opening3s}
・テロップ：${form.caption}
・その他：${form.other}

--- 分析データ ---
【勝ちパターン（コスト上位30%・${metric.toUpperCase()}が平均以上）】
${winLines}

【負けパターン（コスト上位30%・${metric.toUpperCase()}が平均未満）】
${loseLines}`
  }, [form, effectiveWin, effectiveLose, metric])

  const handleCopy = () => {
    navigator.clipboard.writeText(brief).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (rows.length === 0 && !stored) {
    return <div className="tab-empty">CR分析タブでCSVをアップロードしてください（またはActionタブでパターンを保存してください）</div>
  }

  return (
    <div className="tab-content">
      <div className="plan-grid">
        {/* ── Form ── */}
        <div className="plan-form">
          <div className="plan-form-header">
            <h3>依頼書フォーム</h3>
            <button className="autofill-btn" onClick={handleAutoFill} disabled={!topWin}>
              ⚡ 自動入力
            </button>
          </div>

          <label className="form-label">依頼種別</label>
          <select className="form-input" value={form.requestType} onChange={e => set('requestType', e.target.value)}>
            {['類似', '新規', '修正'].map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          <label className="form-label">参考CR</label>
          {rows.length > 0 ? (
            <select className="form-input" value={form.referenceCR} onChange={e => set('referenceCR', e.target.value)}>
              <option value="">（選択してください）</option>
              {effectiveWin.map((r, i) => <option key={i} value={r.assetName}>{r.assetName}</option>)}
            </select>
          ) : (
            <input className="form-input" value={form.referenceCR} onChange={e => set('referenceCR', e.target.value)} placeholder="CR名を入力" />
          )}

          <label className="form-label">訴求軸</label>
          <select className="form-input" value={form.appealAxis} onChange={e => set('appealAxis', e.target.value)}>
            <option value="">（選択してください）</option>
            {APPEAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          <label className="form-label">制作指示</label>
          {[
            ['format',    'フォーマット（例：縦型動画）'],
            ['duration',  '尺（例：15秒）'],
            ['opening3s', '冒頭3秒（例：価格テロップから始まる）'],
            ['caption',   'テロップ（例：〇〇円OFF大きく表示）'],
            ['other',     'その他'],
          ].map(([k, ph]) => (
            <input key={k} className="form-input" style={{ marginBottom: 4 }}
              value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} />
          ))}
        </div>

        {/* ── Preview ── */}
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
