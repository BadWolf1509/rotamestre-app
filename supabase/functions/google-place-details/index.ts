/* global Deno */

// Edge Function para Google Place Details API
// Obtém detalhes de um lugar (endereço, coordenadas) a partir do place_id
// Deploy: supabase functions deploy google-place-details --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PlaceDetailsRequest {
  placeId: string
  sessionToken?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json() as PlaceDetailsRequest
    const { placeId, sessionToken } = body

    if (!placeId) {
      return new Response(
        JSON.stringify({ error: 'placeId é obrigatório' }),
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

    // Construir URL com parâmetros
    const params = new URLSearchParams({
      place_id: placeId,
      key: apiKey,
      language: 'pt-BR',
      fields: 'formatted_address,geometry,address_components',
    })

    if (sessionToken) {
      params.append('sessiontoken', sessionToken)
    }

    // Chamar Place Details API (REST)
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
    )

    const data = await response.json()

    // Verificar erros da API
    if (data.status !== 'OK') {
      console.error('[Place Details] Error:', data.status, data.error_message)
      return new Response(
        JSON.stringify({
          error: data.error_message || 'Erro ao obter detalhes do lugar',
          status: data.status,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = data.result
    const location = result.geometry?.location

    // Verificar se temos coordenadas válidas
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      console.error('[Place Details] Coordenadas não encontradas para o lugar:', placeId)
      return new Response(
        JSON.stringify({
          error: 'Coordenadas não encontradas para este lugar',
          status: 'NO_COORDINATES',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extrair componentes do endereço
    const addressComponents = result.address_components || []
    const getComponent = (type: string) => {
      const component = addressComponents.find((c: any) => c.types.includes(type))
      return component?.long_name || ''
    }

    const placeDetails = {
      logradouro: getComponent('route'),
      numero: getComponent('street_number'),
      bairro: getComponent('sublocality') || getComponent('neighborhood'),
      cidade: getComponent('locality') || getComponent('administrative_area_level_2'),
      estado: getComponent('administrative_area_level_1'),
      cep: getComponent('postal_code'),
      coordenadas: {
        latitude: location.lat,
        longitude: location.lng,
      },
      formatted_address: result.formatted_address || '',
    }

    return new Response(
      JSON.stringify(placeDetails),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[Place Details] Exception:', error)
    return new Response(
      JSON.stringify({ error: error.message, status: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
