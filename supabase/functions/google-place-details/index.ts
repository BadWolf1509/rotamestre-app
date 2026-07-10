/* global Deno */

// Edge Function para Google Place Details — Places API (New)
// Obtém detalhes de um lugar (endereço, coordenadas) a partir do place_id.
// Migrado dos endpoints legados em 2026-07-10: a chave atual é restrita à
// Places API (New) — projetos GCP novos não ativam mais a Places API legada.
// A resposta preserva o contrato legado (logradouro/numero/bairro/...) que o app consome.
// Deploy: supabase functions deploy google-place-details --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface PlaceDetailsRequest {
  placeId: string;
  sessionToken?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as PlaceDetailsRequest;
    const { placeId, sessionToken } = body;

    if (!placeId) {
      return new Response(JSON.stringify({ error: 'placeId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Google Maps API Key não configurada' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Places API (New): GET /v1/places/{placeId} com FieldMask no header
    const params = new URLSearchParams({
      languageCode: 'pt-BR',
      regionCode: 'BR',
    });

    // sessionToken fecha a sessão de billing iniciada no autocomplete
    if (sessionToken) {
      params.append('sessionToken', sessionToken);
    }

    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${params.toString()}`,
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'formattedAddress,location,addressComponents',
        },
      },
    );

    const data = await response.json();

    // Na New API, erros vêm como HTTP != 2xx com { error: { message, status } }
    if (!response.ok) {
      console.error(
        '[Place Details] Error:',
        response.status,
        data.error?.message,
      );
      return new Response(
        JSON.stringify({
          error: data.error?.message || 'Erro ao obter detalhes do lugar',
          status: data.error?.status || 'REQUEST_DENIED',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const location = data.location;

    // Verificar se temos coordenadas válidas
    if (
      !location ||
      typeof location.latitude !== 'number' ||
      typeof location.longitude !== 'number'
    ) {
      console.error(
        '[Place Details] Coordenadas não encontradas para o lugar:',
        placeId,
      );
      return new Response(
        JSON.stringify({
          error: 'Coordenadas não encontradas para este lugar',
          status: 'NO_COORDINATES',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Extrair componentes do endereço (New API: longText no lugar de long_name)
    const addressComponents = data.addressComponents || [];
    const getComponent = (type: string) => {
      const component = addressComponents.find((c: any) =>
        c.types?.includes(type),
      );
      return component?.longText || '';
    };

    const placeDetails = {
      logradouro: getComponent('route'),
      numero: getComponent('street_number'),
      bairro:
        getComponent('sublocality_level_1') ||
        getComponent('sublocality') ||
        getComponent('neighborhood'),
      cidade:
        getComponent('locality') || getComponent('administrative_area_level_2'),
      estado: getComponent('administrative_area_level_1'),
      cep: getComponent('postal_code'),
      coordenadas: {
        latitude: location.latitude,
        longitude: location.longitude,
      },
      formatted_address: data.formattedAddress || '',
    };

    return new Response(JSON.stringify(placeDetails), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Place Details] Exception:', error);
    return new Response(
      JSON.stringify({ error: error.message, status: 'INTERNAL_ERROR' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
