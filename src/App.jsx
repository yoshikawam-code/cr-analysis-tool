import { useState, useRef, useCallback, useMemo } from 'react'
import { parseCSV } from './parseCSV'
import { aggregateByName, calcAvgCvr } from './aggregateUtils'
import CheckTab  from './tabs/CheckTab'
import ActionTab from './tabs/ActionTab'
import PlanTab   from './tabs/PlanTab'
import DoTab     from './tabs/DoTab'
import './App.css'

const TABS       = ['CR分析', 'Check', 'Action', 'Plan', 'Do']
const PLACEMENTS = ['全て', 'TikTok', 'Pangle', 'キュレーションAPP']

const CR_COLS = [
  { key: 'assetName', label: 'クリエイティブアセット名', sortable: false },
  { key: 'cv',        label: 'CV',       sortable: true },
  { key: 'cost',      label: 'Cost',     sortable: true },
  { key: 'cvr',       label: 'CVR (%)',  sortable: true },
  { key: 'ctr',       label: 'CTR (%)',  sortable: true },
  { key: 'cpc',       label: 'CPC',      sortable: true },
  { key: 'cpm',       label: 'CPM',      sortable: true },
  { key: 'cpa',       label: 'CPA',      sortable: true },
  { key: 'material',  label: '素材',     sortable: false },
]

const fmtInt   = n => Math.round(n).toLocaleString('ja-JP')
const fmtMoney = n => n != null
  ? n.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  : '—'
const fmtPct = n => n.toFixed(2) + '%'

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
  const [activeTab,     setActiveTab]     = useState('CR分析')
  const [rawRows,       setRawRows]       = useState([])
  const [appealTags,    setAppealTags]    = useState({})
  const [doneTasks,     setDoneTasks]     = useState(new Set())
  const [sortKey,       setSortKey]       = useState('cost')
  const [sortDir,       setSortDir]       = useState('desc')
  const [error,         setError]         = useState('')
  const [dragOver,      setDragOver]      = useState(false)
  const [videoUrl,      setVideoUrl]      = useState(null)
  const [actionMetric,  setActionMetric]  = useState('cvr')
  const [placement,     setPlacement]     = useState('全て')
  const [dateFrom,      setDateFrom]      = useState('')
  const [dateTo,        setDateTo]        = useState('')
  const inputRef = useRef()

  const loadFile = useCallback((file) => {
    if (!file) return
    if (!file.name.endsWith('.csv')) { setError('CSVファイル（.csv）を選択してください'); return }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const rows = parseCSV(e.target.result)
        setRawRows(rows)
        setAppealTags({})
        setDoneTasks(new Set())
        setError('')
      } catch (err) {
        setError(err.message)
        setRawRows([])
      }
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files[0]) }
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  // Placement-only filter (for Check tab which has its own period filter)
  const placementFiltered = useMemo(() =>
    placement === '全て' ? rawRows : rawRows.filter(r => r.placement === placement),
    [rawRows, placement])

  // Full filter (placement + date range) for CR分析 → aggregation
  const dateFiltered = useMemo(() => {
    let rows = placementFiltered
    if (dateFrom) rows = rows.filter(r => r.date >= dateFrom)
    if (dateTo)   rows = rows.filter(r => r.date <= dateTo)
    return rows
  }, [placementFiltered, dateFrom, dateTo])

  const aggregated = useMemo(() => aggregateByName(dateFiltered), [dateFiltered])
  const avgCvr     = useMemo(() => calcAvgCvr(aggregated), [aggregated])

  const sorted = useMemo(() => {
    return [...aggregated].sort((a, b) => {
      const av = a[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity)
      const bv = b[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity)
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [aggregated, sortKey, sortDir])

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

          {rawRows.length > 0 && (
            <section className="table-section">
              {/* ── Filters ── */}
              <div className="cr-filter-bar">
                <div className="placement-filter">
                  {PLACEMENTS.map(p => (
                    <button key={p} className={`placement-btn${placement === p ? ' active' : ''}`} onClick={() => setPlacement(p)}>{p}</button>
                  ))}
                </div>
                <div className="date-range-filter">
                  <label className="date-label">期間：</label>
                  <input type="date" className="date-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                  <span className="date-sep">〜</span>
                  <input type="date" className="date-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                  {(dateFrom || dateTo) && (
                    <button className="reset-btn" onClick={() => { setDateFrom(''); setDateTo('') }}>クリア</button>
                  )}
                </div>
              </div>

              <div className="table-toolbar">
                <h2>{aggregated.length}件のCR（{dateFiltered.length}行を合算）</h2>
                <div className="toolbar-right">
                  <span className="cvr-legend">
                    <span className="legend-dot" />
                    平均CVR {avgCvr.toFixed(2)}% 未満は赤表示
                  </span>
                  <button className="reset-btn" onClick={() => { setRawRows([]); setError(''); setDateFrom(''); setDateTo(''); setPlacement('全て') }}>リセット</button>
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
                        <td className="asset-name" title={row.assetName}>{row.assetName}</td>
                        <td>{fmtInt(row.cv)}</td>
                        <td>{fmtInt(row.cost)}</td>
                        <td>{row.cv === 0 ? '—' : fmtPct(row.cvr)}</td>
                        <td>{fmtPct(row.ctr)}</td>
                        <td>{fmtMoney(row.cpc)}</td>
                        <td>{fmtMoney(row.cpm)}</td>
                        <td>{row.cv === 0 ? '—' : fmtMoney(row.cpa)}</td>
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

      {activeTab === 'Check'  && <CheckTab  rows={placementFiltered} appealTags={appealTags} setAppealTags={setAppealTags} />}
      {activeTab === 'Action' && <ActionTab rows={aggregated} avgCvr={avgCvr} actionMetric={actionMetric} setActionMetric={setActionMetric} />}
      {activeTab === 'Plan'   && <PlanTab   rows={aggregated} avgCvr={avgCvr} appealTags={appealTags} actionMetric={actionMetric} />}
      {activeTab === 'Do'     && <DoTab     rows={aggregated} avgCvr={avgCvr} doneTasks={doneTasks} setDoneTasks={setDoneTasks} />}

      {videoUrl && <VideoModal url={videoUrl} onClose={() => setVideoUrl(null)} />}
    </div>
  )
}
