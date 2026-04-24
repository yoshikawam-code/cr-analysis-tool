export function aggregateByName(rows) {
  const map = {}
  rows.forEach(r => {
    if (!map[r.assetName]) {
      map[r.assetName] = { assetName: r.assetName, material: '', cost: 0, impressions: 0, cv: 0, clicks: 0 }
    }
    const g = map[r.assetName]
    g.cost        += r.cost
    g.impressions += r.impressions
    g.cv          += r.cv
    g.clicks      += r.clicks
    if (r.material && !g.material) g.material = r.material
  })

  return Object.values(map).map((g, i) => ({
    id:          i,
    assetName:   g.assetName,
    material:    g.material,
    cost:        g.cost,
    impressions: g.impressions,
    cv:          g.cv,
    clicks:      g.clicks,
    cvr:  g.cv > 0 && g.clicks > 0  ? (g.cv / g.clicks) * 100 : 0,
    ctr:  g.impressions > 0          ? (g.clicks / g.impressions) * 100 : 0,
    cpa:  g.cv > 0                   ? g.cost / g.cv : null,
    cpm:  g.impressions > 0          ? (g.cost / g.impressions) * 1000 : null,
    cpc:  g.clicks > 0               ? g.cost / g.clicks : null,
  }))
}

export function calcAvgCvr(rows) {
  const totalCv     = rows.reduce((s, r) => s + r.cv, 0)
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0)
  return totalClicks > 0 ? (totalCv / totalClicks) * 100 : 0
}
