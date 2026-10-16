import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    console.log('Auth check:', { user, userError })
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', debug: { userError, user } }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log('Profile check:', { userId: user.id, profile, profileError })
    
    if (profileError || !profile || profile.role !== 'HR') {
      return new Response(JSON.stringify({ error: 'Forbidden: HR role required', debug: { userId: user.id, profile, profileError } }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const { action, ...params } = body

    let result

    switch (action) {
      case 'list': {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers()
        if (error) throw error
        result = data.users
        break
      }

      case 'create': {
        const { email, password, full_name, role, division } = params
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        })
        if (error) throw error

        const { error: profileError } = await supabaseAdmin.from('profiles').insert({
          id: data.user.id,
          email,
          full_name,
          role,
          division: role === 'Division' ? division : null,
        })
        if (profileError) throw profileError
        result = data.user
        break
      }

      case 'update': {
        const { id, email, full_name, role, division, password } = params
        const updateData: any = { email, full_name, role, division: role === 'Division' ? division : null }
        if (password) updateData.password = password

        const { error } = await supabaseAdmin.auth.admin.updateUserById(id, updateData)
        if (error) throw error

        const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
          id,
          email,
          full_name,
          role,
          division: role === 'Division' ? division : null,
        })
        if (profileError) throw profileError
        result = { success: true }
        break
      }

      case 'delete': {
        const { id } = params
        const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
        if (error) throw error
        result = { success: true }
        break
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})