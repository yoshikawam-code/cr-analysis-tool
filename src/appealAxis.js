export const APPEAL_OPTIONS = [
  '価格', 'UGC', 'before_after', '比較',
  '機能', '限定', '口コミ', '新商品', 'ブランド', 'その他',
]

const RULES = [
  { tag: '価格',        re: /価格|値段|安い|お得|割引|セール|OFF|off|円引|無料/ },
  { tag: 'UGC',         re: /ugc|UGC|ユーザー投稿|口コミ動画|体験談/ },
  { tag: 'before_after', re: /before|after|ビフォー|アフター|before_after|beforeafter/i },
  { tag: '比較',        re: /比較|vs|VS|違い|差|対比/ },
  { tag: '機能',        re: /機能|効果|成分|特徴|品質|スペック|性能/ },
  { tag: '限定',        re: /限定|今だけ|期間|数量|残り|先着/ },
  { tag: '口コミ',      re: /口コミ|レビュー|実績|評判|ランキング/ },
  { tag: '新商品',      re: /新商品|新作|新発売|リニューアル|NEW/i },
  { tag: 'ブランド',    re: /ブランド|公式|正規/ },
]

export function detectAppealAxis(name) {
  for (const { tag, re } of RULES) {
    if (re.test(name)) return tag
  }
  return 'その他'
}

export function detectFormat(material, assetName) {
  const src = material || assetName || ''
  if (/\.(mp4|mov|webm)/i.test(src)) return '動画'
  if (/\.(jpg|jpeg|png|gif|webp)/i.test(src)) return '静止画'
  if (/静止画|画像|image|img|バナー|写真/i.test(assetName || '')) return '静止画'
  return '動画'
}

export function getWinLose(rows, avgMetric, metricKey = 'cvr') {
  if (rows.length === 0) return { win: [], lose: [], threshold: 0 }
  const costs = [...rows].map(r => r.cost).sort((a, b) => a - b)
  const top30idx = Math.floor(costs.length * 0.7)
  const threshold = costs[top30idx] ?? 0

  const topRows = rows.filter(r => r.cost >= threshold)
  return {
    win:  topRows.filter(r => r[metricKey] != null && r[metricKey] >= avgMetric),
    lose: topRows.filter(r => r[metricKey] != null && r[metricKey] < avgMetric),
    threshold,
  }
}
