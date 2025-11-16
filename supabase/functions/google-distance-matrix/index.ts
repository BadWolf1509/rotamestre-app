/* global Deno */

// Edge Function para chamar Google Distance Matrix API (tráfego em tempo real)
// Deploy: supabase functions deploy google-distance-matrix --no-verify-jwt

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
    const { origins, destinations, mode = 'driving', departureTime = 'now' } = await req.json()

    if (!origins || !destinations) {
      return new Response(
        JSON.stringify({ error: 'Origins e destinations são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Construir URL da Google Distance Matrix API
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Google Maps API Key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const params = new URLSearchParams({
      origins,
      destinations,
      mode,
      key: apiKey,
      departure_time: departureTime,
      traffic_model: 'best_guess',
    })

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`

    // Fazer chamada à API do Google
    const response = await fetch(url)
    const data = await response.json()

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'Erro ao chamar Google Distance Matrix API', details: data }),
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
