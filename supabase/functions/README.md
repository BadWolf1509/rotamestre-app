# Supabase Edge Functions - RotaMestre

## ⚠️ Status: SUSPENDED (MVP)

As funções de otimização dinâmica de rotas (`google-directions` e `google-distance-matrix`) estão **temporariamente desabilitadas** devido ao alto custo das APIs do Google Maps.

**Custos estimados:**
- Distance Matrix API: $5-10 por 1000 requisições
- Directions API: $5 por 1000 requisições
- Com 100 motoristas ativos fazendo otimizações a cada 5 minutos = ~$300-500/mês

**Alternativas consideradas para futuro:**
1. Otimização client-side usando Haversine distance (grátis, menos preciso)
2. Otimização em batch 1x por dia em horário de baixo custo
3. Apenas para rotas com 5+ paradas
4. Cache de padrões de tráfego históricos

**Para reativar:**
1. Descomentar código em `app/motorista/inicio.tsx`
2. Deploy das Edge Functions conforme instruções abaixo
3. Monitorar custos no Google Cloud Console

---

## Funções Disponíveis

### 1. google-directions
Proxy para Google Directions API com otimização de waypoints.

**Endpoint:** `/functions/v1/google-directions`

**Uso:** Otimização de rotas com tráfego em tempo real

**Body:**
```json
{
  "origin": "lat,lng",
  "destination": "lat,lng",
  "waypoints": "optimize:true|lat1,lng1|lat2,lng2",
  "mode": "driving",
  "departureTime": "now"
}
```

### 2. google-distance-matrix
Proxy para Google Distance Matrix API.

**Endpoint:** `/functions/v1/google-distance-matrix`

**Uso:** Cálculo de distância e tempo com tráfego

**Body:**
```json
{
  "origins": "lat,lng",
  "destinations": "lat,lng",
  "mode": "driving",
  "departureTime": "now"
}
```

### 3. criar-motorista
Criação de motoristas via Admin API.

**Endpoint:** `/functions/v1/criar-motorista`

**Autenticação:** Requer token JWT de gestor

## Deploy

### Pré-requisitos
1. Instalar Supabase CLI:
```bash
npm install -g supabase
```

2. Login no Supabase:
```bash
supabase login
```

3. Link ao projeto:
```bash
supabase link --project-ref seu-project-id
```

### Configurar Variáveis de Ambiente

No dashboard do Supabase (Settings > Edge Functions), adicione:

- `GOOGLE_MAPS_API_KEY`: Sua chave da Google Maps API

### Deploy das Funções

**Deploy individual:**
```bash
# Google Directions
supabase functions deploy google-directions --no-verify-jwt

# Google Distance Matrix
supabase functions deploy google-distance-matrix --no-verify-jwt

# Criar Motorista (requer autenticação)
supabase functions deploy criar-motorista
```

**Deploy de todas:**
```bash
supabase functions deploy
```

### Verificar Deploy

```bash
# Listar funções
supabase functions list

# Ver logs
supabase functions logs google-directions
```

## Testes

### Testar localmente

```bash
# Iniciar servidor local
supabase functions serve

# Testar função
curl -i --location --request POST 'http://localhost:54321/functions/v1/google-directions' \
  --header 'Content-Type: application/json' \
  --data '{"origin":"-23.550520,-46.633308","destination":"-23.561684,-46.656139","mode":"driving"}'
```

### Testar em produção

```bash
curl -i --location --request POST 'https://seu-project.supabase.co/functions/v1/google-directions' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"origin":"-23.550520,-46.633308","destination":"-23.561684,-46.656139","mode":"driving"}'
```

## Notas Importantes

### CORS
Todas as funções incluem headers CORS para permitir chamadas do navegador:
```typescript
'Access-Control-Allow-Origin': '*'
```

### Autenticação
- `google-directions` e `google-distance-matrix`: **Não requerem autenticação** (`--no-verify-jwt`)
- `criar-motorista`: **Requer token JWT** de usuário autenticado com papel de gestor

### Custos
- Edge Functions: Gratuito até 500K invocações/mês
- Google Maps API: Cobrança por uso conforme [pricing do Google](https://mapsplatform.google.com/pricing/)

### Segurança
- A Google Maps API Key fica **server-side** e nunca é exposta ao cliente
- Recomenda-se adicionar rate limiting em produção
- Considere adicionar validação de origem (CORS mais restritivo)

## Troubleshooting

### Erro "Function not found"
```bash
# Verificar se função foi deployed
supabase functions list

# Re-deploy
supabase functions deploy google-directions --no-verify-jwt
```

### Erro "API Key not configured"
```bash
# Verificar variáveis de ambiente no dashboard:
# Settings > Edge Functions > GOOGLE_MAPS_API_KEY
```

### Erro CORS
- Verificar se headers CORS estão incluídos
- Verificar se método OPTIONS está sendo tratado
- Em desenvolvimento local, usar proxy ou desabilitar CORS temporariamente

## Referências
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Google Maps Directions API](https://developers.google.com/maps/documentation/directions)
- [Google Maps Distance Matrix API](https://developers.google.com/maps/documentation/distance-matrix)
