export default async function handler(req, res) {
  const upstream = await fetch('https://oc-bus-tracker.vercel.app/api/account-options')
  const data = await upstream.json()
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.json(data)
}
