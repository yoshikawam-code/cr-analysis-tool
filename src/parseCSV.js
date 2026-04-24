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

export function parseCSV(text) {
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
    material:    headers.indexOf('素材'),
    placement:   headers.indexOf('プレースメント'),
    cost:        headers.indexOf('コスト'),
    impressions: headers.indexOf('インプレッション'),
    conversions: headers.indexOf('コンバージョン'),
    clicks:      headers.indexOf('クリック（誘導先）'),
    currency:    headers.indexOf('通貨'),
  }

  const getCol = (cols, i) =>
    (i >= 0 && i < cols.length && cols[i] != null) ? cols[i] : ''

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
    const cols        = parseLine(line)
    const cost        = toNum(getCol(cols, idx.cost))
    const impressions = toNum(getCol(cols, idx.impressions))
    const cv          = toNum(getCol(cols, idx.conversions))
    const clicks      = toNum(getCol(cols, idx.clicks))

    if ([cost, impressions, cv, clicks].some(isNaN)) {
      const names = ['コスト', 'インプレッション', 'コンバージョン', 'クリック（誘導先）']
      const bad = [cost, impressions, cv, clicks]
        .map((v, j) => isNaN(v) ? names[j] : null).filter(Boolean)
      throw new Error(`${i + 2}行目: 数値の解析に失敗しました（列: ${bad.join(', ')}）`)
    }

    const placement = getCol(cols, idx.placement) || '—'
    return {
      id:          i,
      date:        getCol(cols, idx.date),
      assetName:   getCol(cols, idx.assetName),
      material:    getCol(cols, idx.material),
      placement,
      cost,
      impressions,
      cv,
      clicks,
      cvr:  cv > 0 && clicks > 0  ? (cv / clicks) * 100 : 0,
      ctr:  impressions > 0        ? (clicks / impressions) * 100 : 0,
      cpa:  cv > 0                 ? cost / cv : null,
      cpm:  impressions > 0        ? (cost / impressions) * 1000 : null,
      cpc:  clicks > 0             ? cost / clicks : null,
    }
  })

  if (rawRows.length === 0) throw new Error('有効なデータ行がありません')
  return rawRows
}
