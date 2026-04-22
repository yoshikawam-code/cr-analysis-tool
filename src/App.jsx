import { useState, useRef, useCallback } from 'react'
import './App.css'

const COLUMNS = [
  { key: 'date',      label: '日',                     sortable: false },
  { key: 'assetName', label: 'クリエイティブアセット名', sortable: false },
  { key: 'cvr',       label: 'CVR (%)',                sortable: true  },
  { key: 'ctr',       label: 'CTR (%)',                sortable: true  },
  { key: 'cpa',       label: 'CPA',                    sortable: true  },
  { key: 'score',     label: '優先スコア',               sortable: true  },
  { key: 'material',  label: '素材',                    sortable: false },
]

// CSV の1行をクォート対応でパース
function parseLine(line) {
  const result = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

function parseCSV(text) {
  // BOM 除去
  const clean = text.replace(/^﻿/, '')
  const lines = clean.trim().split(/\r?\n/)
  if (lines.length < 2) throw new Error('データが不足しています（ヘッダー行 + 1行以上必要）')

  const headers = parseLine(lines[0])
  const required = ['クリエイティブアセット名', 'コスト', 'インプレッション', 'コンバージョン', 'クリック（誘導先）']
  const missing = required.filter(r => !headers.includes(r))
  if (missing.length > 0) throw new Error(`必須列が見つかりません: ${missing.join(', ')}`)

  const idx = {
    date:        headers.indexOf('日'),
    assetName:   headers.indexOf('クリエイティブアセット名'),
    cost:        headers.indexOf('コスト'),
    impressions: headers.indexOf('インプレッション'),
    conversions: headers.indexOf('コンバージョン'),
    clicks:      headers.indexOf('クリック（誘導先）'),
    currency:    headers.indexOf('通貨'),
    material:    headers.indexOf('素材'),
  }

  // インデックスが -1 または範囲外の場合は空文字を返す
  const getCol = (cols, i) =>
    (i >= 0 && i < cols.length && cols[i] != null) ? cols[i] : ''

  // "-" や空文字は 0 扱い、桁区切りカンマを除去してからパース
  const toNum = v => {
    const s = getCol([v], 0).trim()
    if (s === '' || s === '-' || s === 'N/A') return 0
    return parseFloat(s.replace(/,/g, ''))
  }

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
  const rawRows = lines.slice(1).filter(l => {
    if (!l.trim()) return false
    const firstCol = parseLine(l)[0]
    return typeof firstCol === 'string' && DATE_RE.test(firstCol.trim())
  }).map((line, i) => {
    const cols = parseLine(line)
    const cost        = toNum(getCol(cols, idx.cost))
    const impressions = toNum(getCol(cols, idx.impressions))
    const conversions = toNum(getCol(cols, idx.conversions))
    const clicks      = toNum(getCol(cols, idx.clicks))

    if ([cost, impressions, conversions, clicks].some(isNaN)) {
      const names = ['コスト', 'インプレッション', 'コンバージョン', 'クリック（誘導先）']
      const bad = [cost, impressions, conversions, clicks]
        .map((v, j) => isNaN(v) ? names[j] : null).filter(Boolean)
      throw new Error(`${i + 2}行目: 数値の解析に失敗しました（列: ${bad.join(', ')}）`)
    }

    return {
      id:        i,
      date:      getCol(cols, idx.date),
      assetName: getCol(cols, idx.assetName),
      cost,
      cvr:      clicks > 0 ? (conversions / clicks) * 100 : 0,
      ctr:      impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpa:      conversions > 0 ? cost / conversions : null,
      currency: getCol(cols, idx.currency),
      material: getCol(cols, idx.material),
    }
  })

  if (rawRows.length === 0) throw new Error('有効なデータ行がありません')

  const avgCvr = rawRows.reduce((s, r) => s + r.cvr, 0) / rawRows.length

  return rawRows.map(r => ({
    ...r,
    score: r.cost * (avgCvr - r.cvr),
    avgCvr,
  }))
}

function SortIcon({ dir }) {
  if (!dir) return <span className="sort-indicator">⇅</span>
  return <span className="sort-indicator">{dir === 'asc' ? '↑' : '↓'}</span>
}

function VideoModal({ url, onClose }) {
  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        {isVideo ? (
          <video src={url} controls autoPlay className="modal-video" />
        ) : (
          <div className="modal-link-body">
            <p>動画URLを新しいタブで開きます</p>
            <a href={url} target="_blank" rel="noreferrer" className="upload-btn">
              開く ↗
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [rows, setRows]       = useState([])
  const [sortKey, setSortKey] = useState('score')
  const [sortDir, setSortDir] = useState('desc')
  const [error, setError]     = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [videoUrl, setVideoUrl] = useState(null)
  const inputRef = useRef()

  const loadFile = useCallback((file) => {
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      setError('CSVファイル（.csv）を選択してください')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        setRows(parseCSV(e.target.result))
        setError('')
      } catch (err) {
        setError(err.message)
        setRows([])
      }
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    loadFile(e.dataTransfer.files[0])
  }

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const avgCvr = rows.length > 0 ? rows[0].avgCvr : 0

  const sorted = [...rows].sort((a, b) =>
    sortDir === 'asc' ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>TikTok広告 CR分析ツール</h1>
        <p>CSVファイルをアップロードしてクリエイティブのパフォーマンスを確認できます</p>
      </header>

      <div
        className={`upload-zone${dragOver ? ' drag-over' : ''}`}
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="upload-icon">📊</div>
        <h2>CSVファイルをドロップ または クリックして選択</h2>
        <p>必須列: クリエイティブアセット名, コスト, インプレッション, コンバージョン, クリック（誘導先）</p>
        <button className="upload-btn" type="button">ファイルを選択</button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={e => loadFile(e.target.files[0])}
          onClick={e => e.stopPropagation()}
        />
      </div>

      {error && <div className="error-box">⚠ {error}</div>}

      {rows.length > 0 && (
        <section className="table-section">
          <div className="table-toolbar">
            <h2>結果 — {rows.length}件</h2>
            <div className="toolbar-right">
              <span className="cvr-legend">
                <span className="legend-dot" />
                平均CVR {avgCvr.toFixed(2)}% 未満は赤表示
              </span>
              <button className="reset-btn" onClick={() => { setRows([]); setError('') }}>
                リセット
              </button>
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {COLUMNS.map(col => (
                    <th
                      key={col.key}
                      className={col.sortable ? 'sortable' : ''}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    >
                      {col.label}
                      {col.sortable && <SortIcon dir={sortKey === col.key ? sortDir : null} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(row => (
                  <tr key={row.id} className={row.cvr < avgCvr ? 'low-cvr' : ''}>
                    <td>{row.date}</td>
                    <td className="asset-name" title={row.assetName}>{row.assetName}</td>
                    <td>{row.cvr.toFixed(2)}%</td>
                    <td>{row.ctr.toFixed(2)}%</td>
                    <td>{row.cpa != null ? `${Math.round(row.cpa).toLocaleString()}${row.currency || ''}` : '—'}</td>
                    <td><span className="score-badge">{row.score.toFixed(1)}</span></td>
                    <td>
                      {row.material ? (
                        <button className="video-btn" onClick={() => setVideoUrl(row.material)}>
                          ▶ 再生
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {videoUrl && <VideoModal url={videoUrl} onClose={() => setVideoUrl(null)} />}
    </div>
  )
}
