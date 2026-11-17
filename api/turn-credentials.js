function respond(res, status, body) {
  res.setHeader('Cache-Control', 'no-store')
  return res.status(status).json(body)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return respond(res, 405, { error: 'Method not allowed.' })

  const authorization = req.headers.authorization || ''
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
  const meteredDomain = process.env.METERED_DOMAIN?.trim()
  const meteredApiKey = process.env.METERED_API_KEY?.trim()

  if (!accessToken) return respond(res, 401, { error: 'Sign in is required.' })
  if (!supabaseUrl || !supabaseKey || !meteredDomain || !meteredApiKey) {
    return respond(res, 503, { error: 'Video calling is not configured yet.' })
  }
  if (!/^[a-z0-9-]+\.metered\.live$/i.test(meteredDomain)) {
    return respond(res, 500, { error: 'TURN service configuration is invalid.' })
  }

  try {
    const userResponse = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken}` }
    })
    if (!userResponse.ok) return respond(res, 401, { error: 'Your session is invalid or expired.' })
    const user = await userResponse.json()

    const couplesUrl = new URL(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/couples`)
    couplesUrl.searchParams.set('select', 'id')
    couplesUrl.searchParams.set('limit', '1')
    couplesUrl.searchParams.set('or', `(partner_1_id.eq.${user.id},partner_2_id.eq.${user.id})`)
    const coupleResponse = await fetch(couplesUrl, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken}` }
    })
    if (!coupleResponse.ok) return respond(res, 502, { error: 'Could not verify couple membership.' })
    const couples = await coupleResponse.json()
    if (!Array.isArray(couples) || couples.length === 0) {
      return respond(res, 403, { error: 'Only couple members can request call credentials.' })
    }

    const credentialsUrl = new URL(`https://${meteredDomain}/api/v1/turn/credentials`)
    credentialsUrl.searchParams.set('apiKey', meteredApiKey)
    const credentialsResponse = await fetch(credentialsUrl, { signal: AbortSignal.timeout(10_000) })
    if (!credentialsResponse.ok) return respond(res, 502, { error: 'TURN service could not provide call credentials.' })
    const iceServers = await credentialsResponse.json()
    if (!Array.isArray(iceServers) || iceServers.length === 0
      || iceServers.some(server => !server || !(typeof server.urls === 'string' || Array.isArray(server.urls)))) {
      return respond(res, 502, { error: 'TURN service returned invalid call credentials.' })
    }

    return respond(res, 200, { iceServers })
  } catch {
    console.error('TURN credential endpoint request failed.')
    return respond(res, 502, { error: 'Could not prepare video call credentials. Please try again.' })
  }
}
