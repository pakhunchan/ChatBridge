import { createClient } from '@supabase/supabase-js'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim()

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data, error } = await supabase
    .from('plugin_registrations')
    .select('id, name, description, iframe_url, auth_type, tools')
    .eq('status', 'approved')

  if (error) {
    console.error('Failed to fetch approved plugins:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch plugins' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Map snake_case DB columns to camelCase PluginManifest shape
  const plugins = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    iframeUrl: row.iframe_url,
    authType: row.auth_type,
    tools: row.tools,
  }))

  return new Response(JSON.stringify({ plugins }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  })
}

export const config = {
  runtime: 'edge',
}
