export function parseDate(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function startOfWeek(d) {
  const day = new Date(d)
  const dow = day.getDay() // 0=Sun
  day.setDate(day.getDate() - dow)
  day.setHours(0, 0, 0, 0)
  return day
}

export function getDateRange(period) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (period === '今週') {
    const from = startOfWeek(today)
    const to = new Date(from)
    to.setDate(to.getDate() + 6)
    return { from, to }
  }
  if (period === '先週') {
    const thisWeek = startOfWeek(today)
    const to = new Date(thisWeek)
    to.setDate(to.getDate() - 1)
    const from = startOfWeek(to)
    return { from, to }
  }
  if (period === '今月') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    const to = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return { from, to }
  }
  return null // 全期間
}

export function filterByPeriod(rows, period) {
  if (period === '全期間') return rows
  const range = getDateRange(period)
  if (!range) return rows
  return rows.filter(r => {
    const d = parseDate(r.date)
    if (!d) return false
    return d >= range.from && d <= range.to
  })
}

export function detectFatigue(rows) {
  // Group by assetName, compare last 7 days vs prior 7 days
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day7 = new Date(today); day7.setDate(today.getDate() - 7)
  const day14 = new Date(today); day14.setDate(today.getDate() - 14)

  const byName = {}
  rows.forEach(r => {
    const d = parseDate(r.date)
    if (!d) return
    if (!byName[r.assetName]) byName[r.assetName] = { recent: [], prior: [] }
    if (d >= day7) byName[r.assetName].recent.push(r)
    else if (d >= day14) byName[r.assetName].prior.push(r)
  })

  const avg = (arr, key) => {
    const vals = arr.map(r => r[key]).filter(v => v != null && !isNaN(v))
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  }

  const results = {}
  Object.entries(byName).forEach(([name, { recent, prior }]) => {
    if (recent.length === 0 || prior.length === 0) return
    const metrics = ['ctr', 'cvr', 'cpa']
    const fatigued = []
    metrics.forEach(m => {
      const r = avg(recent, m)
      const p = avg(prior, m)
      if (r == null || p == null || p === 0) return
      const degraded = m === 'cpa'
        ? (r - p) / p >= 0.2   // CPA higher = worse
        : (p - r) / p >= 0.2   // CVR/CTR lower = worse
      if (degraded) fatigued.push(m.toUpperCase())
    })
    if (fatigued.length > 0) results[name] = fatigued
  })
  return results // { assetName: ['CTR', 'CVR'] }
}
