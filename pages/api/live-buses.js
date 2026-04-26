import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { block } = req.query
  let query = supabase
    .from('live_bus_paddles')
    .select('block, route, bus_number, headsign, service_day, paddle_id, start_time, end_time')

  if (block) query = query.eq('block', block)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true, buses: data })
}
