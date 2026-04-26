export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { bus } = req.query
  if (!bus) return res.status(400).json({ error: 'bus number is required' })

  try {
    // Fetch main page (has AddMarker with lat/lon/heading) and refresh page (has stop/schedule)
    const [mainRes, refreshRes] = await Promise.all([
      fetch(`https://www.transsee.ca/fleetfind?a=octranspo&fleet=${encodeURIComponent(bus)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OC-Bus-Tracker/1.0)' },
      }),
      fetch(`https://www.transsee.ca/fleetfind?a=octranspo&fleet=${encodeURIComponent(bus)}&re=1`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OC-Bus-Tracker/1.0)' },
      }),
    ])

    const [mainHtml, refreshHtml] = await Promise.all([mainRes.text(), refreshRes.text()])

    // Parse AddMarker([lat,lon],"rank","color","txtColor",heading,status,"popup",false,"fleet","route")
    const markerRe = /AddMarker\(\[([0-9.-]+),([0-9.-]+)\],"[^"]*","[^"]*","[^"]*",([0-9-]+),[0-9-]+,"([^"]+)"[^,]*,[^,]*,"([^"]+)"/g
    const vehicles = []
    let m

    while ((m = markerRe.exec(mainHtml)) !== null) {
      const [, lat, lon, heading, popup, fleet] = m
      // parse route and headsign from popup HTML
      const routeMatch = popup.match(/([0-9]+-[^<]+)<br>going[^>]+>([^<]+)/)
      const route = routeMatch ? routeMatch[1].replace(/<[^>]+>/g, '').trim() : ''
      const headsign = routeMatch ? routeMatch[2].trim() : ''
      vehicles.push({
        fleet,
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        heading: parseInt(heading),
        route,
        headsign,
      })
    }

    // Find our specific bus in the list
    const vehicle = vehicles.find(v => v.fleet === bus) || vehicles[0]

    if (!vehicle) {
      return res.json({ ok: true, found: false, bus, message: 'Bus not currently active' })
    }

    // Parse refresh HTML for current stop and schedule status
    const busSection = refreshHtml.match(new RegExp(`id="${vehicle.fleet}"[^>]*>([\\s\\S]{1,600}?)(?:<p id=|$)`))
    let currentStop = null
    let scheduleStatus = null
    let lastSeen = null

    if (busSection) {
      const section = busSection[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

      // "aprchg Baseline 2b" or "at Mcarthur on Vanier"
      const stopMatch = section.match(/(aprchg|at|near)\s+([A-Z][^.]+?)(?:\s+Last seen|\s*$)/)
      if (stopMatch) currentStop = `${stopMatch[1]} ${stopMatch[2]}`.trim()

      // "6:19 behind" or "0:51 ahead"
      const schedMatch = section.match(/([0-9]+:[0-9]+)\s+(behind|ahead)/)
      if (schedMatch) scheduleStatus = `${schedMatch[1]} ${schedMatch[2]}`

      // "Last seen 1:03"
      const lastMatch = section.match(/Last seen\s+([0-9]+:[0-9]+)/)
      if (lastMatch) lastSeen = lastMatch[1]
    }

    const mapsUrl = `https://www.google.com/maps?q=${vehicle.lat},${vehicle.lon}`
    const transseeUrl = `https://www.transsee.ca/fleetfind?a=octranspo&fleet=${bus}`

    res.json({
      ok: true,
      found: true,
      bus,
      lat: vehicle.lat,
      lon: vehicle.lon,
      heading: vehicle.heading,
      route: vehicle.route,
      headsign: vehicle.headsign,
      currentStop,
      scheduleStatus,
      lastSeen,
      mapsUrl,
      transseeUrl,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
