import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
import { z } from 'zod'

const RegistrationBodySchema = z.object({
  id: z.string().min(2).max(50).regex(/^[a-z][a-z0-9-]*$/, 'id must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1).max(100),
  description: z.string().min(10).max(2000),
  iframeUrl: z.string().url().startsWith('https://'),
  authType: z.literal('none'),
  tools: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().min(1).max(500),
        inputSchema: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1)
    .max(20),
  childSafetySelfCertified: z.literal(true).describe('Child safety self-certification is required'),
  childSafetyDescription: z.string().min(10).max(1000),
})

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
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

  // Parse and validate body
  let body: z.infer<typeof RegistrationBodySchema>
  try {
    const raw = await req.json()
    body = RegistrationBodySchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: err.issues }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Validate tool name prefix
  for (const tool of body.tools) {
    if (!tool.name.startsWith(`${body.id}_`)) {
      return new Response(
        JSON.stringify({
          error: `Tool name '${tool.name}' must be prefixed with '${body.id}_'`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Check for duplicate plugin ID
  const { data: existing } = await supabase.from('plugin_registrations').select('id').eq('id', body.id).single()

  if (existing) {
    return new Response(JSON.stringify({ error: `Plugin with id '${body.id}' already exists` }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Rate limit: max 5 pending per user
  const { count } = await supabase
    .from('plugin_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('submitted_by', userId)
    .eq('status', 'pending')

  if (count !== null && count >= 5) {
    return new Response(
      JSON.stringify({ error: 'Too many pending submissions. Wait for existing submissions to be reviewed.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Check for tool name collisions with approved plugins
  const { data: approvedPlugins } = await supabase
    .from('plugin_registrations')
    .select('id, tools')
    .eq('status', 'approved')

  if (approvedPlugins) {
    const existingToolNames = new Set<string>()
    for (const plugin of approvedPlugins) {
      const tools = plugin.tools as Array<{ name: string }>
      if (Array.isArray(tools)) {
        for (const t of tools) {
          existingToolNames.add(t.name)
        }
      }
    }
    for (const tool of body.tools) {
      if (existingToolNames.has(tool.name)) {
        return new Response(
          JSON.stringify({ error: `Tool name '${tool.name}' conflicts with an existing approved plugin` }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }
  }

  // Insert
  const { error: insertError } = await supabase.from('plugin_registrations').insert({
    id: body.id,
    name: body.name,
    description: body.description,
    iframe_url: body.iframeUrl,
    auth_type: body.authType,
    tools: body.tools,
    status: 'pending',
    child_safety_self_certified: body.childSafetySelfCertified,
    child_safety_description: body.childSafetyDescription,
    submitted_by: userId,
  })

  if (insertError) {
    console.error('Plugin registration insert error:', insertError)
    return new Response(JSON.stringify({ error: 'Failed to submit plugin registration' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true, status: 'pending' }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const config = {
  runtime: 'edge',
}
