/* global Deno */

// Edge Function para chamar Google Directions API (otimização de rotas)
// Deploy: supabase functions deploy google-directions --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { origin, destination, waypoints, mode = 'driving', departureTime = 'now' } = await req.json()

    if (!origin || !destination) {
      return new Response(
        JSON.stringify({ error: 'Origin e destination são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Construir URL da Google Directions API
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Google Maps API Key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const params = new URLSearchParams({
      origin,
      destination,
      mode,
      key: apiKey,
      departure_time: departureTime,
      traffic_model: 'best_guess',
    })

    if (waypoints) {
      params.append('waypoints', waypoints)
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`

    // Fazer chamada à API do Google
    const response = await fetch(url)
    const data = await response.json()

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'Erro ao chamar Google Directions API', details: data }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
