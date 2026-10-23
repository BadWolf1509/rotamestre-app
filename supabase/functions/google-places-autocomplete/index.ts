/* global Deno */

// Edge Function para Google Places Autocomplete — Places API (New)
// Evita CORS e mantém a chave server-side (secret GOOGLE_MAPS_API_KEY).
// Migrado dos endpoints legados em 2026-07-10: a chave atual é restrita à
// Places API (New) — projetos GCP novos não ativam mais a Places API legada.
// A resposta preserva o contrato legado ({ status, predictions[] }) que o app consome.
// Exige o JWT de um usuário logado (desde 26/10/2026): antes, sem verify_jwt e
// sem autenticação própria, era um proxy anônimo da chave Google.
// Deploy: npx supabase functions deploy google-places-autocomplete --no-verify-jwt --project-ref xezslsyxjivunmhhyxtd

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { exigirUsuario } from '../_shared/autenticacao.ts';
import { chavePublica } from '../_shared/chaves.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// Endereço digitado não passa disso; texto maior é abuso ou erro.
const TAMANHO_MAXIMO_INPUT = 200;
const TAMANHO_MAXIMO_SESSION_TOKEN = 128;

/** O Authorization recebido corresponde a um usuário do Auth? */
async function usuarioValido(authorization: string): Promise<boolean> {
  const cliente = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    chavePublica(),
    {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  const {
    data: { user },
    error,
  } = await cliente.auth.getUser();
  return !error && !!user;
}

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

  const naoAutorizado = await exigirUsuario(req, usuarioValido, corsHeaders);
  if (naoAutorizado) {
    return naoAutorizado;
  }

  try {
    const body = (await req.json()) as AutocompleteRequest;
    const { input, sessionToken, locationBias } = body;

    if (
      (input !== undefined && typeof input !== 'string') ||
      (input?.length ?? 0) > TAMANHO_MAXIMO_INPUT ||
      (sessionToken !== undefined &&
        (typeof sessionToken !== 'string' ||
          sessionToken.length > TAMANHO_MAXIMO_SESSION_TOKEN))
    ) {
      return new Response(
        JSON.stringify({ error: 'Entrada inválida', predictions: [] }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (!input || input.length < 3) {
      return new Response(JSON.stringify({ predictions: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      console.error('[Places Autocomplete] GOOGLE_MAPS_API_KEY ausente');
      return new Response(JSON.stringify({ error: 'Serviço indisponível' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
        // A mensagem da Google fica no log acima; para fora, só o genérico.
        JSON.stringify({
          error: 'Erro na API de autocomplete',
          status: 'REQUEST_DENIED',
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
        error: 'Erro interno',
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
