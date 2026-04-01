/* global Deno */

// Edge Function para Google Places Autocomplete API (Nova API)
// Evita CORS e não depende da JavaScript API estar carregada no cliente
// Deploy: supabase functions deploy google-places-autocomplete --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as AutocompleteRequest;
    const { input, sessionToken, locationBias } = body;

    if (!input || input.length < 3) {
      return new Response(JSON.stringify({ predictions: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Google Maps API Key não configurada" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Construir URL com parâmetros
    const params = new URLSearchParams({
      input,
      key: apiKey,
      language: "pt-BR",
      components: "country:br",
    });

    if (sessionToken) {
      params.append("sessiontoken", sessionToken);
    }

    // Location bias: prioritize results near the given coordinates (50km radius)
    if (locationBias?.latitude && locationBias?.longitude) {
      params.append(
        "location",
        `${locationBias.latitude},${locationBias.longitude}`,
      );
      params.append("radius", "50000"); // 50km in meters
    }

    // Chamar Places Autocomplete API (REST)
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
    );

    const data = await response.json();

    // Verificar erros da API
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error(
        "[Places Autocomplete] Error:",
        data.status,
        data.error_message,
      );
      return new Response(
        JSON.stringify({
          error: data.error_message || "Erro na API de autocomplete",
          status: data.status,
          predictions: [],
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Transformar predictions para formato esperado
    const predictions: PlaceSuggestion[] = (data.predictions || []).map(
      (prediction: any) => ({
        place_id: prediction.place_id,
        description: prediction.description,
        structured_formatting: {
          main_text: prediction.structured_formatting?.main_text || "",
          secondary_text:
            prediction.structured_formatting?.secondary_text || "",
        },
      }),
    );

    return new Response(JSON.stringify({ predictions, status: data.status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Places Autocomplete] Exception:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        status: "INTERNAL_ERROR",
        predictions: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
