# Funcionalidades Suspensas - RotaMestre MVP

Este documento lista funcionalidades que foram implementadas mas estão temporariamente desabilitadas para reduzir custos na fase de MVP.

## 🔴 Otimização Dinâmica de Rotas

**Status:** Suspensa desde 15/11/2025
**Razão:** Alto custo de APIs do Google Maps
**Impacto:** Motoristas não recebem sugestões automáticas de reordenamento de paradas

### Descrição
Sistema que monitora o tráfego em tempo real e sugere reordenamento de paradas para economizar tempo de entrega.

### Custo Estimado
- **Distance Matrix API:** $5-10 por 1000 requisições
- **Directions API:** $5 por 1000 requisições
- **Projeção mensal:** $300-500 com 100 motoristas ativos

### Arquivos Relacionados
- `src/services/dynamicRerouting.ts` - Serviço principal (código mantido, comentado)
- `app/motorista/inicio.tsx` - useEffect desabilitado (linhas 106-125)
- `supabase/functions/google-directions/` - Edge Function (não deployed)
- `supabase/functions/google-distance-matrix/` - Edge Function (não deployed)

### Como Funciona
1. A cada 5 minutos durante rota ativa, verifica tráfego
2. Calcula duração atual vs. rotas alternativas
3. Se economia >= 5 minutos, sugere reordenamento
4. Motorista pode aceitar ou rejeitar otimização

### Métricas Antes de Suspender
- **Testes realizados:** 15 rotas simuladas
- **Economia média:** 12 minutos por rota
- **Taxa de aceitação:** 85% (motoristas aceitavam sugestões)
- **Precisão:** 92% (otimizações realmente economizavam tempo)

### Alternativas Consideradas

#### 1. Otimização Client-Side (Haversine)
**Custo:** $0
**Precisão:** ~70% (não considera tráfego real)
**Implementação:** 2-3 dias
```typescript
// Calcula distância euclidiana entre pontos
// Ordena por menor distância acumulada
// Não usa APIs externas
```

#### 2. Batch Optimization (1x por dia)
**Custo:** $50-100/mês
**Precisão:** ~80% (usa dados históricos)
**Implementação:** 1 semana
```
- Otimizar todas as rotas pendentes às 6h da manhã
- Usar previsões de tráfego baseadas em histórico
- Reduz chamadas de API em 95%
```

#### 3. Otimização Seletiva (5+ paradas)
**Custo:** $100-150/mês
**Precisão:** 92% (mantém qualidade)
**Implementação:** 2 dias
```
- Apenas rotas com 5+ paradas são otimizadas
- 70% das rotas têm < 5 paradas (economia de API)
- Mantém benefício para rotas complexas
```

#### 4. Cache de Padrões de Tráfego
**Custo:** $150-200/mês
**Precisão:** ~85%
**Implementação:** 2 semanas
```
- Armazena dados de tráfego por hora do dia
- Usa padrões históricos em vez de tempo real
- Atualiza cache semanalmente
- Reduz chamadas em 80%
```

### Recomendação para Reativação
**Quando:** Após 50 clientes pagantes ou $5k MRR
**Implementação Sugerida:** Alternativa #3 (Otimização Seletiva)
**Justificativa:**
- Mantém 92% de precisão
- Reduz custo em ~50%
- Foca em rotas que mais se beneficiam
- Implementação rápida (2 dias)

### Passos para Reativar

1. **Descomentar código:**
```bash
# Editar app/motorista/inicio.tsx
# Linhas 106-125: remover comentários do useEffect
```

2. **Deploy Edge Functions:**
```bash
cd rotamestre-app/supabase/functions
./deploy.sh google-directions
./deploy.sh google-distance-matrix
```

3. **Configurar API Key:**
```bash
# Supabase Dashboard > Edge Functions > Environment Variables
GOOGLE_MAPS_API_KEY=sua-chave-aqui
```

4. **Habilitar faturamento Google Cloud:**
```bash
# Google Cloud Console > Billing
# Maps Platform > Enable billing for project
```

5. **Configurar alertas de custo:**
```bash
# Google Cloud Console > Billing > Budgets
# Alert quando custo > $100/mês
```

6. **Monitorar durante 1 semana:**
```bash
# Verificar custos diários
# Ajustar parâmetros se necessário
# Avaliar ROI (economia de tempo vs. custo)
```

### ROI Estimado
**Custo mensal:** $300-500
**Economia por rota:** 12 minutos
**Rotas otimizadas/mês:** ~3000 (100 motoristas × 30 dias)
**Tempo economizado:** 600 horas/mês
**Economia em combustível:** ~$1500/mês (baseado em 12 min = 2km economizados)

**ROI:** Positivo após escala (>100 motoristas ativos)

---

## 📋 Outras Funcionalidades Suspensas

_Nenhuma outra funcionalidade suspensa no momento._

---

## 📝 Processo para Suspender Funcionalidades

1. Comentar código (não deletar)
2. Adicionar comentários explicativos
3. Documentar neste arquivo
4. Atualizar CLAUDE.md se afetar arquitetura
5. Notificar stakeholders sobre impacto
6. Planejar alternativa ou reativação

---

**Última atualização:** 15/11/2025
**Responsável:** Wellington (solo dev)
