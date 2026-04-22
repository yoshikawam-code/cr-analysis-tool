import { useState, useRef, useCallback } from 'react'
import { parseCSV } from './parseCSV'
import CheckTab  from './tabs/CheckTab'
import ActionTab from './tabs/ActionTab'
import PlanTab   from './tabs/PlanTab'
import DoTab     from './tabs/DoTab'
import './App.css'

const TABS = ['CR分析', 'Check', 'Action', 'Plan', 'Do']

const CR_COLS = [
  { key: 'date',      label: '日',                     sortable: false },
  { key: 'assetName', label: 'クリエイティブアセット名', sortable: false },
  { key: 'cost',      label: 'Cost',                   sortable: true  },
  { key: 'cv',        label: 'CV',                     sortable: true  },
  { key: 'cvr',       label: 'CVR (%)',                sortable: true  },
  { key: 'ctr',       label: 'CTR (%)',                sortable: true  },
  { key: 'cpc',       label: 'CPC',                    sortable: true  },
  { key: 'cpm',       label: 'CPM',                    sortable: true  },
  { key: 'cpa',       label: 'CPA',                    sortable: true  },
  { key: 'score',     label: '優先スコア',               sortable: true  },
  { key: 'material',  label: '素材',                    sortable: false },
]

const fmtInt   = n => Math.round(n).toLocaleString('ja-JP')
const fmtMoney = n => n != null
  ? n.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  : '—'
const fmtPct   = n => n.toFixed(2) + '%'

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
            <a href={url} target="_blank" rel="noreferrer" className="upload-btn">開く ↗</a>
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab,   setActiveTab]   = useState('CR分析')
  const [rows,        setRows]        = useState([])
  const [appealTags,  setAppealTags]  = useState({})
  const [doneTasks,   setDoneTasks]   = useState(new Set())
  const [sortKey,     setSortKey]     = useState('score')
  const [sortDir,     setSortDir]     = useState('desc')
  const [error,       setError]       = useState('')
  const [dragOver,    setDragOver]    = useState(false)
  const [videoUrl,    setVideoUrl]    = useState(null)
  const inputRef = useRef()

  const loadFile = useCallback((file) => {
    if (!file) return
    if (!file.name.endsWith('.csv')) { setError('CSVファイル（.csv）を選択してください'); return }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        setRows(parseCSV(e.target.result))
        setAppealTags({})
        setError('')
      } catch (err) {
        setError(err.message)
        setRows([])
      }
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files[0]) }
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const avgCvr = rows.length > 0 ? rows[0].avgCvr : 0

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? 0
    const bv = b[sortKey] ?? 0
    return sortDir === 'asc' ? av - bv : bv - av
  })

  return (
    <div className="app">
      <header className="app-header">
        <h1>TikTok広告 CR分析ツール</h1>
        <p>CSVをアップロードしてクリエイティブのパフォーマンスを分析します</p>
      </header>

      <nav className="tab-nav">
        {TABS.map(t => (
          <button key={t} className={`tab-btn${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
            {t}
          </button>
        ))}
      </nav>

      {/* ── CR分析タブ ── */}
      {activeTab === 'CR分析' && (
        <>
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
            <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => loadFile(e.target.files[0])} onClick={e => e.stopPropagation()} />
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
                  <button className="reset-btn" onClick={() => { setRows([]); setError('') }}>リセット</button>
                </div>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      {CR_COLS.map(col => (
                        <th key={col.key} className={col.sortable ? 'sortable' : ''}
                          onClick={col.sortable ? () => handleSort(col.key) : undefined}>
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
                        <td>{fmtInt(row.cost)}</td>
                        <td>{fmtInt(row.cv)}</td>
                        <td>{row.cv === 0 ? '—' : fmtPct(row.cvr)}</td>
                        <td>{fmtPct(row.ctr)}</td>
                        <td>{fmtMoney(row.cpc)}</td>
                        <td>{fmtMoney(row.cpm)}</td>
                        <td>{row.cv === 0 ? '—' : fmtMoney(row.cpa)}</td>
                        <td><span className="score-badge">{row.score.toFixed(1)}</span></td>
                        <td>
                          {row.material
                            ? <button className="video-btn" onClick={() => setVideoUrl(row.material)}>▶ 再生</button>
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {activeTab === 'Check'  && <CheckTab  rows={rows} appealTags={appealTags} setAppealTags={setAppealTags} />}
      {activeTab === 'Action' && <ActionTab rows={rows} avgCvr={avgCvr} />}
      {activeTab === 'Plan'   && <PlanTab   rows={rows} avgCvr={avgCvr} appealTags={appealTags} />}
      {activeTab === 'Do'     && <DoTab     rows={rows} avgCvr={avgCvr} doneTasks={doneTasks} setDoneTasks={setDoneTasks} />}

      {videoUrl && <VideoModal url={videoUrl} onClose={() => setVideoUrl(null)} />}
    </div>
  )
}
