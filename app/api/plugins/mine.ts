import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET?.trim()

  if (!supabaseUrl || !supabaseServiceKey || !supabaseJwtSecret) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let userId: string
  try {
    const token = authHeader.slice(7)
    const secret = new TextEncoder().encode(supabaseJwtSecret)
    const { payload } = await jwtVerify(token, secret, { issuer: 'supabase' })
    if (!payload.sub) throw new Error('No sub claim')
    userId = payload.sub
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data, error } = await supabase
    .from('plugin_registrations')
    .select('id, name, status, reviewer_notes, reviewed_at, created_at, updated_at')
    .eq('submitted_by', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch user plugins:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch submissions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const plugins = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    reviewerNotes: row.reviewer_notes,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  return new Response(JSON.stringify({ plugins }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const config = {
  runtime: 'edge',
}
