export const APPEAL_OPTIONS = [
  '価格訴求', '機能訴求', '限定訴求', '口コミ訴求',
  'ビフォーアフター', '新商品', 'ブランド', 'その他',
]

const RULES = [
  { tag: '価格訴求',        re: /価格|値段|安い|お得|割引|セール|OFF|off|円引|無料/ },
  { tag: '機能訴求',        re: /機能|効果|成分|特徴|品質|スペック|性能/ },
  { tag: '限定訴求',        re: /限定|今だけ|期間|数量|残り|先着/ },
  { tag: '口コミ訴求',      re: /口コミ|レビュー|体験|実績|評判|ランキング/ },
  { tag: 'ビフォーアフター', re: /before|after|ビフォー|アフター|変化|比較/i },
  { tag: '新商品',          re: /新商品|新作|新発売|リニューアル|NEW/i },
  { tag: 'ブランド',        re: /ブランド|公式|正規/ },
]

export function detectAppealAxis(name) {
  for (const { tag, re } of RULES) {
    if (re.test(name)) return tag
  }
  return 'その他'
}

export function detectFormat(name) {
  if (/静止画|画像|image|img|バナー|写真/i.test(name)) return '静止画'
  return '動画'
}

export function getWinLose(rows, avgCvr) {
  if (rows.length === 0) return { win: [], lose: [], medianCost: 0 }
  const sorted = [...rows].map(r => r.cost).sort((a, b) => a - b)
  const medianCost = sorted[Math.floor(sorted.length / 2)]
  return {
    win:        rows.filter(r => r.cvr >= avgCvr && r.cost >= medianCost),
    lose:       rows.filter(r => r.cvr < avgCvr && r.cost >= medianCost),
    medianCost,
  }
}
