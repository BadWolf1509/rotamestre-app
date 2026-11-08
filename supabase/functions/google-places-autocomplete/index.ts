/* global Deno */

// Edge Function para Google Places Autocomplete — Places API (New)
// Evita CORS e mantém a chave server-side (secret GOOGLE_MAPS_API_KEY).
// Migrado dos endpoints legados em 2026-07-10: a chave atual é restrita à
// Places API (New) — projetos GCP novos não ativam mais a Places API legada.
// A resposta preserva o contrato legado ({ status, predictions[] }) que o app consome.
// Exige o JWT de um usuário logado (desde 26/10/2026): antes, sem verify_jwt e
// sem autenticação própria, era um proxy anônimo da chave Google.
// Teto diário por usuário (Migration 84, `consumir_cota_places`): 1000
// consultas/dia no dia de Brasília; esgotado → 429 OVER_QUERY_LIMIT com
// `predictions: []`, e o app cai no Photon. Publicar DEPOIS da migration.
// Falha ou demora do banco segue sem teto (fail-open, ver cotaPlaces.ts).
// Deploy: npx supabase functions deploy google-places-autocomplete --no-verify-jwt --project-ref xezslsyxjivunmhhyxtd

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  clienteDoUsuario,
  criarValidadorDeUsuario,
  exigirUsuario,
} from '../_shared/autenticacao.ts';
import { chavePublica } from '../_shared/chaves.ts';
import {
  consumirCotaPlaces,
  respostaCotaEsgotada,
} from '../_shared/cotaPlaces.ts';
import { CORS_PADRAO, jsonResponse, preflight } from '../_shared/http.ts';

// Endereço digitado não passa disso; texto maior é abuso ou erro.
const TAMANHO_MAXIMO_INPUT = 200;
const TAMANHO_MAXIMO_SESSION_TOKEN = 128;

/** O Authorization recebido corresponde a um usuário do Auth? */
const usuarioValido = criarValidadorDeUsuario(
  createClient,
  Deno.env.get('SUPABASE_URL') ?? '',
  chavePublica,
);

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
  const respostaPreflight = preflight(req);
  if (respostaPreflight) {
    return respostaPreflight;
  }

  const autenticacao = await exigirUsuario(req, usuarioValido, CORS_PADRAO);
  if (autenticacao instanceof Response) {
    return autenticacao;
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
      return jsonResponse(400, { error: 'Entrada inválida', predictions: [] });
    }

    if (!input || input.length < 3) {
      return jsonResponse(200, { predictions: [] });
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      console.error('[Places Autocomplete] GOOGLE_MAPS_API_KEY ausente');
      return jsonResponse(500, { error: 'Serviço indisponível' });
    }

    // Teto diário do usuário (Migration 84): conta só quando vai mesmo chamar
    // a Google. Falha ou demora do banco segue sem teto (fail-open).
    const cliente = clienteDoUsuario(
      createClient,
      Deno.env.get('SUPABASE_URL') ?? '',
      req.headers.get('Authorization') ?? '',
    );
    const cota = await consumirCotaPlaces(
      (funcao, args) => cliente.rpc(funcao, args),
      'autocomplete',
    );
    if (cota === 'esgotada') {
      return respostaCotaEsgotada(CORS_PADRAO, { predictions: [] });
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
        // Google lenta não prende a função até o limite dela: o abort cai no
        // catch abaixo (500) e o app usa o Photon.
        signal: AbortSignal.timeout(8000),
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
      return jsonResponse(400, {
        error: 'Erro na API de autocomplete',
        status: 'REQUEST_DENIED',
        predictions: [],
      });
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

    return jsonResponse(200, {
      predictions,
      status: predictions.length > 0 ? 'OK' : 'ZERO_RESULTS',
    });
  } catch (error) {
    console.error('[Places Autocomplete] Exception:', error);
    return jsonResponse(500, {
      error: 'Erro interno',
      status: 'INTERNAL_ERROR',
      predictions: [],
    });
  }
});
