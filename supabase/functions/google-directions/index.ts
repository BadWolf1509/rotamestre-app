/* global Deno */

// Edge Function para chamar Google Routes API (migrado da Directions API)
// IMPORTANTE: Directions API deprecada em 01/03/2025
// Deploy: supabase functions deploy google-directions --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Field mask para otimizar custos (Basic tier: $5 CPM vs $15 CPM)
const ROUTES_API_FIELD_MASK = [
  'routes.duration',
  'routes.distanceMeters',
  'routes.polyline.encodedPolyline',
  'routes.legs.duration',
  'routes.legs.distanceMeters',
  'routes.legs.startLocation',
  'routes.legs.endLocation',
  'routes.legs.polyline.encodedPolyline',
  'routes.optimizedIntermediateWaypointIndex',
].join(',')

interface RouteRequest {
  origin: string | { latitude: number; longitude: number }
  destination: string | { latitude: number; longitude: number }
  waypoints?: Array<{ latitude: number; longitude: number }>
  optimize?: boolean
}

/**
 * Converte string "lat,lng" para objeto de coordenadas
 */
function parseCoordinates(coord: string | { latitude: number; longitude: number }): { latitude: number; longitude: number } {
  if (typeof coord === 'object') {
    return coord
  }

  const [lat, lng] = coord.split(',').map(Number)
  return { latitude: lat, longitude: lng }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json() as RouteRequest
    const { origin, destination, waypoints, optimize = true } = body

    if (!origin || !destination) {
      return new Response(
        JSON.stringify({ error: 'Origin e destination são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Google Maps API Key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse coordenadas
    const originCoords = parseCoordinates(origin)
    const destCoords = parseCoordinates(destination)

    // Construir request body para Routes API
    const requestBody: Record<string, unknown> = {
      origin: {
        location: {
          latLng: {
            latitude: originCoords.latitude,
            longitude: originCoords.longitude,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destCoords.latitude,
            longitude: destCoords.longitude,
          },
        },
      },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      computeAlternativeRoutes: false,
      languageCode: 'pt-BR',
      units: 'METRIC',
    }

    // Adicionar waypoints se existirem
    if (waypoints && waypoints.length > 0) {
      requestBody.intermediates = waypoints.map((wp) => ({
        location: {
          latLng: {
            latitude: wp.latitude,
            longitude: wp.longitude,
          },
        },
      }))

      // Habilitar otimização de waypoints
      requestBody.optimizeWaypointOrder = optimize
    }

    // Chamar Routes API (POST ao invés de GET)
    const response = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': ROUTES_API_FIELD_MASK,
        },
        body: JSON.stringify(requestBody),
      }
    )

    const data = await response.json()

    // Verificar erros da API
    if (data.error) {
      console.error('[Routes API] Error:', data.error)
      return new Response(
        JSON.stringify({
          error: 'Erro ao chamar Google Routes API',
          details: data.error,
          status: data.error.status || 'UNKNOWN_ERROR',
        }),
        { status: response.status || 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar se tem rotas - retornar 200 com estrutura de erro para manter consistência
    if (!data.routes || data.routes.length === 0) {
      return new Response(
        JSON.stringify({
          routes: [],
          error: {
            code: 404,
            message: 'Nenhuma rota encontrada entre os pontos especificados',
            status: 'ZERO_RESULTS',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    console.error('[Routes API] Exception:', error)
    return new Response(
      JSON.stringify({ error: error.message, status: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
