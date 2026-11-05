/* global Deno */

// Edge Function para Google Place Details — Places API (New)
// Obtém detalhes de um lugar (endereço, coordenadas) a partir do place_id.
// Migrado dos endpoints legados em 2026-07-10: a chave atual é restrita à
// Places API (New) — projetos GCP novos não ativam mais a Places API legada.
// A resposta preserva o contrato legado (logradouro/numero/bairro/...) que o app consome.
// Exige o JWT de um usuário logado (desde 26/10/2026): antes, sem verify_jwt e
// sem autenticação própria, era um proxy anônimo da chave Google.
// Deploy: npx supabase functions deploy google-place-details --no-verify-jwt --project-ref xezslsyxjivunmhhyxtd

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  criarValidadorDeUsuario,
  exigirUsuario,
} from '../_shared/autenticacao.ts';
import { chavePublica } from '../_shared/chaves.ts';
import { CORS_PADRAO, jsonResponse, preflight } from '../_shared/http.ts';

// place_id da Google tem dezenas a poucas centenas de caracteres.
const TAMANHO_MAXIMO_PLACE_ID = 512;
const TAMANHO_MAXIMO_SESSION_TOKEN = 128;

/** O Authorization recebido corresponde a um usuário do Auth? */
const usuarioValido = criarValidadorDeUsuario(
  createClient,
  Deno.env.get('SUPABASE_URL') ?? '',
  chavePublica,
);

interface PlaceDetailsRequest {
  placeId: string;
  sessionToken?: string;
}

serve(async (req) => {
  const respostaPreflight = preflight(req);
  if (respostaPreflight) {
    return respostaPreflight;
  }

  const naoAutorizado = await exigirUsuario(req, usuarioValido, CORS_PADRAO);
  if (naoAutorizado) {
    return naoAutorizado;
  }

  try {
    const body = (await req.json()) as PlaceDetailsRequest;
    const { placeId, sessionToken } = body;

    if (!placeId) {
      return jsonResponse(400, { error: 'placeId é obrigatório' });
    }

    if (
      typeof placeId !== 'string' ||
      placeId.length > TAMANHO_MAXIMO_PLACE_ID ||
      (sessionToken !== undefined &&
        (typeof sessionToken !== 'string' ||
          sessionToken.length > TAMANHO_MAXIMO_SESSION_TOKEN))
    ) {
      return jsonResponse(400, { error: 'Entrada inválida' });
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      console.error('[Place Details] GOOGLE_MAPS_API_KEY ausente');
      return jsonResponse(500, { error: 'Serviço indisponível' });
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
      return jsonResponse(400, {
        error: 'Erro ao obter detalhes do lugar',
        status: 'REQUEST_DENIED',
      });
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
      return jsonResponse(400, {
        error: 'Coordenadas não encontradas para este lugar',
        status: 'NO_COORDINATES',
      });
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

    return jsonResponse(200, placeDetails);
  } catch (error) {
    console.error('[Place Details] Exception:', error);
    return jsonResponse(500, {
      error: 'Erro interno',
      status: 'INTERNAL_ERROR',
    });
  }
});
