# 📊 Plano de Melhoria de Cobertura de Testes

**Data:** 2025-11-16
**Cobertura Atual:** 17.84% statements | 19.77% branches | 16.93% functions | 17.7% lines
**Meta:** 70-80% de cobertura global

---

## 🎯 Objetivos

1. **Curto Prazo (1-2 semanas):** Aumentar cobertura para 40%
2. **Médio Prazo (1 mês):** Atingir 60% de cobertura
3. **Longo Prazo (2-3 meses):** Alcançar 70-80% de cobertura

---

## 📈 Análise da Cobertura Atual

### ✅ Áreas Bem Cobertas (>70%)

| Arquivo | Coverage | Status |
|---------|----------|--------|
| `src/utils/passwordValidation.ts` | 100% | ✅ Completo |
| `src/utils/toast.ts` | 100% | ✅ Completo |
| `src/utils/validation.ts` | 100% | ✅ Completo |
| `src/utils/responsive.ts` | 100% | ✅ Completo |
| `src/hooks/useAuth.ts` | 100% | ✅ Completo |
| `src/hooks/useUser.ts` | 100% | ✅ Completo |
| `src/hooks/useToast.ts` | 100% | ✅ Completo |
| `src/lib/auth.ts` | 97.14% | ✅ Quase completo |
| `src/hooks/useProfile.ts` | 90.69% | ✅ Bom |
| `src/components/DataTable.tsx` | 95% | ✅ Bom |
| `src/components/Modal.tsx` | 94.44% | ✅ Bom |
| `src/components/Toast.tsx` | 94.28% | ✅ Bom |
| `src/utils/phoneValidation.ts` | 92.59% | ✅ Bom |

### 🟡 Áreas com Cobertura Parcial (30-70%)

| Arquivo | Coverage | Prioridade | Complexidade |
|---------|----------|------------|--------------|
| `src/lib/storage.ts` | 55.93% | Alta | Média |
| `src/hooks/useBreakpoint.ts` | 70% | Média | Baixa |
| `src/components/AddressAutocomplete.tsx` | 62.96% | Alta | Média |
| `src/components/AlertDialog.tsx` | 58.33% | Média | Média |
| `src/components/ConfirmDialog.tsx` | 42.62% | Média | Média |
| `src/hooks/useLogoutConfirmation.tsx` | 40% | Baixa | Baixa |

### ❌ Áreas Críticas Sem Cobertura (0%)

#### **Prioridade ALTA - Lógica de Negócio**

| Arquivo | Linhas | Complexidade | Impacto |
|---------|--------|--------------|---------|
| `src/lib/google.ts` | 276 | Alta | Crítico |
| `src/lib/google.web.ts` | 353 | Alta | Crítico |
| `src/lib/navigation.ts` | 316 | Alta | Crítico |
| `src/services/dynamicRerouting.ts` | 546 | Muito Alta | Crítico |
| `src/services/locationTracking.ts` | 413 | Alta | Crítico |
| `src/services/performanceOptimizer.ts` | 480 | Muito Alta | Médio |
| `src/services/turnByTurnNavigation.ts` | 399 | Alta | Crítico |
| `src/context/RouteStatusContext.tsx` | 363 | Alta | Crítico |
| `src/hooks/usePerformance.ts` | 366 | Alta | Médio |
| `src/lib/offline.ts` | 234 | Média | Alto |
| `src/lib/utils.ts` | 261 | Média | Médio |

#### **Prioridade MÉDIA - Componentes UI Complexos**

| Arquivo | Linhas | Motivo da Prioridade |
|---------|--------|---------------------|
| `src/components/MapaWeb.tsx` | 293 | Componente crítico de visualização |
| `src/components/MapaRN.tsx` | 204 | Versão mobile do mapa |
| `src/components/OptimizedImage.tsx` | 307 | Performance crítica |
| `src/components/OptimizedList.tsx` | 353 | Performance crítica |
| `src/components/motorista/NavigationMode.tsx` | 449 | Funcionalidade core motorista |
| `src/components/motorista/TurnByTurnNavigation.tsx` | 429 | Navegação turn-by-turn |
| `src/components/IncidentReportWizard.tsx` | 536 | Workflow complexo |
| `src/components/PerformanceSettings.tsx` | 366 | Configurações importantes |

#### **Prioridade BAIXA - Componentes de Layout/UI**

- Todos os componentes em `components/desktop/`
- Todos os componentes em `components/mobile/`
- Todos os componentes em `components/gestor/dashboard/`
- Todos os componentes em `components/motorista/home/`
- `src/components/DevOverlay.tsx`
- `src/components/DevToolsInitializer.tsx`
- `src/components/CustomDrawerContent.tsx`

---

## 🚀 Plano de Ação por Fase

### **Fase 1: Quick Wins (1 semana) - Meta: 40%**

Focar em arquivos de **baixa complexidade** e **alto impacto**:

1. **Completar testes parciais:**
   - [ ] `src/lib/storage.ts` (55.93% → 80%)
   - [ ] `src/components/AddressAutocomplete.tsx` (62.96% → 85%)
   - [ ] `src/components/AlertDialog.tsx` (58.33% → 80%)
   - [ ] `src/hooks/useBreakpoint.ts` (70% → 90%)

2. **Adicionar testes básicos para utilitários:**
   - [ ] `src/utils/timeEstimation.ts` (0% → 70%)
   - [ ] `src/lib/offline.ts` - cenários básicos (0% → 40%)
   - [ ] `src/lib/utils.ts` - funções puras (0% → 50%)

3. **Hooks simples:**
   - [ ] `src/hooks/useLogoutConfirmation.tsx` (40% → 80%)
   - [ ] `src/hooks/useResponsive.ts` (0% → 70%)

**Estimativa:** 20-25 horas de trabalho
**Ganho de Cobertura:** +22-25%

### **Fase 2: Core Business Logic (2 semanas) - Meta: 60%**

Focar em **lógica de negócio crítica**:

1. **Serviços de Navegação e Roteamento:**
   - [ ] `src/lib/google.ts` - Testes com mocks da API (0% → 60%)
   - [ ] `src/lib/google.web.ts` - Versão web (0% → 60%)
   - [ ] `src/lib/navigation.ts` - Navegação básica (0% → 50%)
   - [ ] `src/services/dynamicRerouting.ts` - Cenários principais (0% → 40%)
   - [ ] `src/services/locationTracking.ts` - Tracking básico (0% → 40%)
   - [ ] `src/services/turnByTurnNavigation.ts` - Instruções (0% → 40%)

2. **Contextos e Estados:**
   - [ ] `src/context/RouteStatusContext.tsx` - Estados principais (0% → 50%)
   - [ ] `src/context/DrawerMenuContext.tsx` - Menu básico (0% → 60%)

3. **Hooks de Performance:**
   - [ ] `src/hooks/usePerformance.ts` - Métricas básicas (0% → 30%)

**Estimativa:** 40-50 horas de trabalho
**Ganho de Cobertura:** +18-20%

### **Fase 3: Componentes Complexos (3-4 semanas) - Meta: 70-80%**

Focar em **componentes críticos de UI**:

1. **Componentes de Mapa:**
   - [ ] `src/components/MapaWeb.tsx` (0% → 50%)
   - [ ] `src/components/MapaRN.tsx` (0% → 50%)
   - [ ] `src/components/motorista/TurnByTurnNavigation.tsx` (0% → 40%)

2. **Componentes de Performance:**
   - [ ] `src/components/OptimizedImage.tsx` (0% → 40%)
   - [ ] `src/components/OptimizedList.tsx` (0% → 40%)
   - [ ] `src/services/performanceOptimizer.ts` (0% → 40%)

3. **Workflows Complexos:**
   - [ ] `src/components/IncidentReportWizard.tsx` (0% → 40%)
   - [ ] `src/components/motorista/NavigationMode.tsx` (0% → 35%)
   - [ ] `src/components/motorista/OptimizationAlert.tsx` (0% → 35%)

4. **Dashboards:**
   - [ ] `components/gestor/dashboard/_hooks/useDashboardData.ts` (0% → 60%)
   - [ ] `components/gestor/dashboard/_components` - Componentes principais (0% → 30%)

**Estimativa:** 60-80 horas de trabalho
**Ganho de Cobertura:** +10-15%

---

## 🛠️ Estratégias de Teste

### 1. **Testes de Serviços e APIs**

```typescript
// Exemplo: src/lib/google.ts
describe('Google Maps API', () => {
  beforeEach(() => {
    // Mock fetch ou axios
    global.fetch = jest.fn();
  });

  it('deve calcular rota otimizada', async () => {
    // Arrange
    const mockResponse = { /* ... */ };
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => mockResponse
    });

    // Act
    const result = await calculateOptimizedRoute(waypoints);

    // Assert
    expect(result).toMatchSnapshot();
    expect(global.fetch).toHaveBeenCalledWith(/* ... */);
  });
});
```

### 2. **Testes de Componentes Complexos**

```typescript
// Exemplo: MapaWeb.tsx
describe('MapaWeb', () => {
  it('deve renderizar mapa com marcadores', () => {
    const { getByTestId } = render(
      <MapaWeb markers={mockMarkers} />
    );

    expect(getByTestId('map-container')).toBeInTheDocument();
    expect(getByTestId('marker-0')).toBeInTheDocument();
  });
});
```

### 3. **Testes de Hooks com Lógica Complexa**

```typescript
// Exemplo: usePerformance.ts
describe('usePerformance', () => {
  it('deve rastrear métricas de performance', () => {
    const { result } = renderHook(() => usePerformance());

    act(() => {
      result.current.startMeasure('test');
    });

    act(() => {
      result.current.endMeasure('test');
    });

    expect(result.current.metrics.test).toBeDefined();
  });
});
```

---

## 📊 Métricas de Sucesso

| Fase | Prazo | Cobertura Meta | Status |
|------|-------|----------------|--------|
| Fase 0 (Baseline) | - | 17.84% | ✅ Atual |
| Fase 1 (Quick Wins) | 1 semana | 40% | 🔄 Pendente |
| Fase 2 (Core Logic) | 2 semanas | 60% | ⏳ Aguardando |
| Fase 3 (Componentes) | 4 semanas | 75% | ⏳ Aguardando |

---

## 🎓 Boas Práticas

1. **Sempre escreva testes ANTES de refatorar código existente**
2. **Use snapshots com moderação** - Prefira assertions específicas
3. **Mock dependências externas** (APIs, Supabase, Google Maps)
4. **Teste casos de erro** e edge cases, não apenas happy path
5. **Mantenha testes isolados** - Cada teste deve ser independente
6. **Use descritivos nos nomes** dos testes: `deve fazer X quando Y`

---

## 📚 Recursos

- [Testing Library - Best Practices](https://testing-library.com/docs/guiding-principles)
- [Jest - Best Practices](https://jestjs.io/docs/tutorial-react-native)
- [React Native Testing](https://reactnative.dev/docs/testing-overview)

---

**Última Atualização:** 2025-11-16
**Responsável:** Equipe de Desenvolvimento
**Revisão:** Mensal
