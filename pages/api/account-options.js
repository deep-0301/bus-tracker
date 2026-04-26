export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const upstream = await fetch('https://oc-bus-tracker.vercel.app/api/account-options')
  const data = await upstream.json()
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.json(data)
}
