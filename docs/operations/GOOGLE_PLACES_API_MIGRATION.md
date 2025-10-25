# 📋 Google Places API - Plano de Migração

## ⚠️ Deprecation Notice

**Data:** Março 2025
**API Afetada:** `google.maps.places.PlacesService`
**Nova API:** `google.maps.places.Place`

### Status Atual

- ✅ PlacesService continua **totalmente funcional**
- ✅ Sem prazo de descontinuação definido
- ✅ Mínimo **12 meses de aviso** será dado
- 🟡 Receberá apenas bug fixes críticos
- 🟡 Bugs existentes não serão corrigidos

---

## 🔍 Código Afetado

### Arquivo: `src/lib/google.web.ts`

#### 1. AutocompleteService (linha 74)
```typescript
// ATUAL (PlacesService)
autocompleteService = new google.maps.places.AutocompleteService();
```

**Uso:** Buscar sugestões de endereços enquanto usuário digita

#### 2. PlacesService (linha 118)
```typescript
// ATUAL (PlacesService)
const div = document.createElement('div');
placesService = new google.maps.places.PlacesService(div);
```

**Uso:** Obter detalhes completos do lugar (coordenadas, endereço completo)

---

## 🎯 Estratégia de Migração

### Fase 1: AGORA - Manter Atual ✅
**Status:** Implementado
**Prazo:** N/A

**Ações:**
- ✅ Código atual funcional e testado
- ✅ Documentação criada
- ✅ Monitorar avisos no console

**Motivo:** Foco em produto e usuários, API atual totalmente suportada.

---

### Fase 2: MONITORAMENTO (3-6 meses)
**Status:** Pendente
**Prazo:** Verificar trimestralmente

**Ações:**
- [ ] Verificar anúncios da Google sobre data de descontinuação
- [ ] Monitorar documentação da nova API Place
- [ ] Buscar exemplos de migração na comunidade
- [ ] Avaliar complexidade da migração

**Links:**
- Deprecation: https://developers.google.com/maps/legacy
- Migration Guide: https://developers.google.com/maps/documentation/javascript/places-migration-overview

---

### Fase 3: PLANEJAMENTO (Quando Google anunciar data)
**Status:** Futuro
**Prazo:** 6 meses antes da descontinuação

**Ações:**
- [ ] Criar branch de migração
- [ ] Estudar nova API Place em detalhes
- [ ] Identificar breaking changes
- [ ] Criar testes de comparação
- [ ] Planejar downtime (se necessário)

---

### Fase 4: IMPLEMENTAÇÃO
**Status:** Futuro
**Prazo:** 3-4 meses antes da descontinuação

#### 4.1. Migrar `autocompleteAddress()`

**ANTES:**
```typescript
const autocompleteService = new google.maps.places.AutocompleteService();
autocompleteService.getPlacePredictions(request, callback);
```

**DEPOIS (Exemplo - verificar documentação atualizada):**
```typescript
// Nova API Place - Autocomplete
const { Place } = await google.maps.importLibrary("places");
const request = { input: query, language: 'pt-BR' };
const { suggestions } = await Place.searchByText(request);
```

#### 4.2. Migrar `getPlaceDetails()`

**ANTES:**
```typescript
const placesService = new google.maps.places.PlacesService(div);
placesService.getDetails({ placeId, fields }, callback);
```

**DEPOIS (Exemplo - verificar documentação atualizada):**
```typescript
// Nova API Place - Details
const { Place } = await google.maps.importLibrary("places");
const place = new Place({ id: placeId });
await place.fetchFields({ fields: ['displayName', 'location', 'formattedAddress'] });
```

---

### Fase 5: TESTES E DEPLOY
**Status:** Futuro
**Prazo:** 2 meses antes da descontinuação

**Ações:**
- [ ] Testes unitários
- [ ] Testes de integração
- [ ] Testes E2E no autocomplete
- [ ] Testes de performance
- [ ] Comparar resultados (antiga vs nova API)
- [ ] Deploy em staging
- [ ] Testes com usuários beta
- [ ] Deploy em produção

---

## 📊 Checklist de Migração

### Pré-requisitos
- [ ] Google anunciou data de descontinuação
- [ ] Faltam 6+ meses para descontinuação
- [ ] Produto está estável em produção
- [ ] Time tem capacidade dedicada
- [ ] Documentação da nova API está madura

### Desenvolvimento
- [ ] Branch de migração criada
- [ ] Código migrado para nova API Place
- [ ] Testes atualizados
- [ ] Documentação atualizada
- [ ] Code review completo

### Testes
- [ ] Testes unitários passando
- [ ] Testes E2E passando
- [ ] Teste de autocomplete funcional
- [ ] Teste de obtenção de coordenadas
- [ ] Performance comparável ou melhor
- [ ] Testes em staging

### Deploy
- [ ] Deploy em produção
- [ ] Monitoramento de erros
- [ ] Rollback plan documentado
- [ ] Comunicação com usuários (se necessário)

---

## 🔗 Links Úteis

- **Deprecation Notice:** https://developers.google.com/maps/legacy
- **Migration Guide:** https://developers.google.com/maps/documentation/javascript/places-migration-overview
- **Place Class:** https://developers.google.com/maps/documentation/javascript/reference/place
- **PlacesService (atual):** https://developers.google.com/maps/documentation/javascript/reference/places-service

---

## 📝 Notas

### Impacto no Projeto

**Baixo impacto:**
- Apenas 2 funções afetadas
- Código bem isolado em `google.web.ts`
- Sem impacto em usuário final
- Migração é transparente

**Esforço estimado:**
- Desenvolvimento: 4-8 horas
- Testes: 4-8 horas
- Deploy e monitoramento: 2-4 horas
- **Total:** 10-20 horas

### Custo

- ✅ Sem custo adicional
- ✅ Nova API usa mesmo modelo de pricing
- ✅ Sem necessidade de trocar API key

---

## ⚠️ Outros Avisos de Deprecation (Não Afetam o Projeto)

### google.maps.Marker → AdvancedMarkerElement

**Warning no console:**
```
As of February 21st, 2024, google.maps.Marker is deprecated.
Please use google.maps.marker.AdvancedMarkerElement instead.
```

**Status:** ✅ **IGNORAR - Não afeta nosso código**

**Motivo:**
- Busca completa no projeto: **zero ocorrências** de `google.maps.Marker`
- Warning vem de biblioteca externa ou Google Maps SDK
- Não temos controle sobre isso
- **Nenhuma ação necessária**

**Se futuramente implementarmos markers:**
- Usar `AdvancedMarkerElement` desde o início
- Guia: https://developers.google.com/maps/documentation/javascript/advanced-markers/migration

---

## ✅ Conclusão

**Decisão:** Migração para Place API **CONCLUÍDA** ✅

**Places API Status:** Migrado em 24/10/2025
**Marker API Status:** Não usado no código (ignorar warning)

**Revisar em:** N/A (migração completa)

**Responsável:** Time de Desenvolvimento

**Última atualização:** 24/10/2025 22:30
