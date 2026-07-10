/* global Deno */

// Edge Function para Google Places Autocomplete — Places API (New)
// Evita CORS e mantém a chave server-side (secret GOOGLE_MAPS_API_KEY).
// Migrado dos endpoints legados em 2026-07-10: a chave atual é restrita à
// Places API (New) — projetos GCP novos não ativam mais a Places API legada.
// A resposta preserva o contrato legado ({ status, predictions[] }) que o app consome.
// Deploy: supabase functions deploy google-places-autocomplete --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface AutocompleteRequest {
  input: string;
  sessionToken?: string;
  locationBias?: { latitude: number; longitude: number };
}

interface PlaceSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as AutocompleteRequest;
    const { input, sessionToken, locationBias } = body;

    if (!input || input.length < 3) {
      return new Response(JSON.stringify({ predictions: [] }), {
        status: 200,
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

    // Places API (New): POST com body JSON (antes: GET com query params)
    const requestBody: Record<string, unknown> = {
      input,
      languageCode: 'pt-BR',
      regionCode: 'BR',
      includedRegionCodes: ['br'], // equivale ao components=country:br do legado
    };

    if (sessionToken) {
      requestBody.sessionToken = sessionToken;
    }

    // Location bias: prioriza resultados próximos (raio 50km, máximo da API)
    if (locationBias?.latitude && locationBias?.longitude) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: locationBias.latitude,
            longitude: locationBias.longitude,
          },
          radius: 50000,
        },
      };
    }

    const response = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify(requestBody),
      },
    );

    const data = await response.json();

    // Na New API, erros vêm como HTTP != 2xx com { error: { message, status } }
    if (!response.ok) {
      console.error(
        '[Places Autocomplete] Error:',
        response.status,
        data.error?.message,
      );
      return new Response(
        JSON.stringify({
          error: data.error?.message || 'Erro na API de autocomplete',
          status: data.error?.status || 'REQUEST_DENIED',
          predictions: [],
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Adaptar suggestions (New) para o contrato legado que o app consome
    const predictions: PlaceSuggestion[] = (data.suggestions || [])
      .map((s: any) => s.placePrediction)
      .filter(Boolean)
      .map((p: any) => ({
        place_id: p.placeId,
        description: p.text?.text || '',
        structured_formatting: {
          main_text: p.structuredFormat?.mainText?.text || p.text?.text || '',
          secondary_text: p.structuredFormat?.secondaryText?.text || '',
        },
      }));

    return new Response(
      JSON.stringify({
        predictions,
        status: predictions.length > 0 ? 'OK' : 'ZERO_RESULTS',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[Places Autocomplete] Exception:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        status: 'INTERNAL_ERROR',
        predictions: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
