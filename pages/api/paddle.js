export default async function handler(req, res) {
  const { block } = req.query
  if (!block) return res.status(400).json({ error: 'block is required' })

  const upstream = await fetch(
    `https://oc-bus-tracker.vercel.app/api/paddle?block=${encodeURIComponent(block)}`
  )
  const data = await upstream.json()
  res.json(data)
}
