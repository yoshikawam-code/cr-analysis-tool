import { useState, useRef, useCallback } from 'react'
import './App.css'

const COLUMNS = [
  { key: 'crName', label: 'CR名', sortable: false },
  { key: 'cvr', label: 'CVR (%)', sortable: true },
  { key: 'ctr', label: 'CTR (%)', sortable: true },
  { key: 'cpa', label: 'CPA (円)', sortable: true },
  { key: 'score', label: '優先スコア', sortable: true },
]

const CVR_LOW_THRESHOLD = 1.0

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) throw new Error('データが不足しています（ヘッダー行 + 1行以上必要）')

  const headers = lines[0].split(',').map(h => h.trim())
  const required = ['CR名', 'CVR', 'CTR', 'CPA', '優先スコア']
  const missing = required.filter(r => !headers.includes(r))
  if (missing.length > 0) throw new Error(`必須列が見つかりません: ${missing.join(', ')}`)

  const idx = {
    crName: headers.indexOf('CR名'),
    cvr: headers.indexOf('CVR'),
    ctr: headers.indexOf('CTR'),
    cpa: headers.indexOf('CPA'),
    score: headers.indexOf('優先スコア'),
  }

  return lines.slice(1).filter(l => l.trim()).map((line, i) => {
    const cols = line.split(',').map(c => c.trim())
    const cvr = parseFloat(cols[idx.cvr])
    const ctr = parseFloat(cols[idx.ctr])
    const cpa = parseFloat(cols[idx.cpa])
    const score = parseFloat(cols[idx.score])
    if (isNaN(cvr) || isNaN(ctr) || isNaN(cpa) || isNaN(score)) {
      throw new Error(`${i + 2}行目: 数値の解析に失敗しました`)
    }
    return { id: i, crName: cols[idx.crName], cvr, ctr, cpa, score }
  })
}

function SortIcon({ dir }) {
  if (!dir) return <span className="sort-indicator">⇅</span>
  return <span className="sort-indicator">{dir === 'asc' ? '↑' : '↓'}</span>
}

export default function App() {
  const [rows, setRows] = useState([])
  const [sortKey, setSortKey] = useState('score')
  const [sortDir, setSortDir] = useState('desc')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
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
        const parsed = parseCSV(e.target.result)
        setRows(parsed)
        setError('')
      } catch (err) {
        setError(err.message)
        setRows([])
      }
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  const handleFileChange = (e) => loadFile(e.target.files[0])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    loadFile(e.dataTransfer.files[0])
  }

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const v = sortDir === 'asc' ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]
    return v
  })

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
        <p>必須列: CR名, CVR, CTR, CPA, 優先スコア</p>
        <button className="upload-btn" type="button">ファイルを選択</button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          onClick={(e) => e.stopPropagation()}
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
                CVR {CVR_LOW_THRESHOLD}% 未満は赤表示
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
                {sorted.length === 0 ? (
                  <tr><td colSpan={5} className="empty-state">データがありません</td></tr>
                ) : sorted.map(row => (
                  <tr key={row.id} className={row.cvr < CVR_LOW_THRESHOLD ? 'low-cvr' : ''}>
                    <td>{row.crName}</td>
                    <td>{row.cvr.toFixed(2)}%</td>
                    <td>{row.ctr.toFixed(2)}%</td>
                    <td>{row.cpa.toLocaleString()}円</td>
                    <td><span className="score-badge">{row.score.toFixed(1)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
