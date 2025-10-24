# 🔄 Análise de Gaps por Fluxo de Funcionalidade

**Data:** 24 de outubro de 2025
**Objetivo:** Mapear gaps críticos na ordem cronológica do fluxo de uso real do sistema

---

## 📖 Índice

1. [Visão Geral do Fluxo](#-visão-geral-do-fluxo)
2. [Fluxo do Gestor - Gaps Identificados](#-fluxo-do-gestor---gaps-identificados)
3. [Fluxo do Motorista - Gaps Identificados](#-fluxo-do-motorista---gaps-identificados)
4. [Matriz de Priorização](#-matriz-de-priorização)
5. [Plano de Implementação Sequencial](#-plano-de-implementação-sequencial)

---

## 🎯 Visão Geral do Fluxo

### **Jornada Completa do Sistema:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DO GESTOR                              │
├─────────────────────────────────────────────────────────────────┤
│ 1. Login → Dashboard                                            │
│ 2. Criar Nova Rota                                              │
│ 3. Adicionar Paradas (Endereços)                               │
│ 4. Otimizar Rota                                                │
│ 5. Atribuir Motorista                                           │
│ 6. Salvar e Notificar                                           │
│ 7. Monitorar Execução                                           │
│ 8. Ver Relatórios                                               │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                  FLUXO DO MOTORISTA                             │
├─────────────────────────────────────────────────────────────────┤
│ 1. Login → Ver Rotas do Dia                                     │
│ 2. Selecionar Rota Ativa                                        │
│ 3. Visualizar Paradas                                           │
│ 4. Navegar para Primeira Parada ← GAP CRÍTICO                  │
│ 5. Concluir Parada (Foto + Confirmação)                        │
│ 6. Navegar para Próxima Parada ← GAP CRÍTICO                   │
│ 7. Repetir até finalizar                                        │
│ 8. Ver Resumo do Dia                                            │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              VOLTA PARA O GESTOR                                │
├─────────────────────────────────────────────────────────────────┤
│ 1. Ver rota concluída em tempo real                             │
│ 2. Gerar relatórios                                             │
│ 3. Analisar performance                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 👨‍💼 FLUXO DO GESTOR - Gaps Identificados

### **Etapa 1: Login → Dashboard** ✅

**Status:** Funcional (90%)

**Gaps:**
- Nenhum gap crítico

**Melhorias desejáveis (não bloqueadoras):**
- Recuperação de senha (pode ser adicionado depois)

---

### **Etapa 2: Dashboard** ✅

**Status:** Funcional (70%)

**Implementado:**
- ✅ Cards de estatísticas (Total, Em Andamento, Concluídas, Km Total)
- ✅ Lista de rotas recentes
- ✅ Botão "Nova Rota"
- ✅ Pull to refresh

**Gaps:**
- 🟡 **GAP 2.1** - Métricas avançadas ausentes
  - Economia calculada (vs rotas não otimizadas)
  - Tempo médio por entrega
  - Taxa de conclusão

**Prioridade:** BAIXA (não bloqueia uso)

**Sugestão de implementação:**
```typescript
// Adicionar ao dashboard.tsx
interface MetricasAvancadas {
  economiaMensal: {
    kmEconomizados: number;
    tempoEconomizado: number; // minutos
    custoEvitado: number; // R$
  };
  performance: {
    tempoMedioPorParada: number; // minutos
    taxaConclusao: number; // %
  };
}

// Calcular a partir da view vw_rotas_resumo
async function calcularEconomia() {
  const { data: rotasOtimizadas } = await supabase
    .from('rotas')
    .select('distancia_total, tempo_total')
    .gte('created_at', primeiroDiaMes);

  // Estimar economia de 15-20% vs rotas não otimizadas
  const economiaPorcentagem = 0.175; // 17.5%
  const kmTotal = rotasOtimizadas.reduce((acc, r) => acc + r.distancia_total, 0);
  const kmEconomizados = kmTotal * economiaPorcentagem;

  return {
    kmEconomizados,
    custoEvitado: kmEconomizados * 2.5 // R$ 2,50 por km
  };
}
```

---

### **Etapa 3: Criar Nova Rota - Adicionar Paradas** 🟡

**Status:** Funcional mas com limitações (60%)

**Implementado:**
- ✅ Formulário completo (tipo, endereço, destinatário, telefone)
- ✅ Geocoding manual (função `getCoordinates()`)
- ✅ Validação de campos
- ✅ Lista visual de paradas

**Gaps:**

#### **🔴 GAP 3.1 - Google Places Autocomplete AUSENTE**

**Problema:** Gestor precisa digitar endereço completo manualmente, sem sugestões.

**Impacto:**
- Endereços incorretos ou incompletos
- Geocoding pode falhar silenciosamente
- Experiência lenta e propensa a erros

**Prioridade:** 🔥 ALTA

**Sugestão de implementação:**

**Passo 1: Instalar dependência**
```bash
npm install react-native-google-places-autocomplete
```

**Passo 2: Substituir TextInput em `app/gestor/nova-entrega.tsx`**

```typescript
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

// Substituir Controller do endereço (linhas 338-355)
<GooglePlacesAutocomplete
  placeholder="Digite o endereço..."
  minLength={3}
  fetchDetails={true}
  onPress={(data, details = null) => {
    if (details) {
      const coords = details.geometry.location;
      const endereco = details.formatted_address;

      // Atualizar campo
      setValue('endereco', endereco);

      // Salvar coordenadas para usar depois
      setTempCoords({ lat: coords.lat, lng: coords.lng });
    }
  }}
  query={{
    key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    language: 'pt-BR',
    components: 'country:br',
  }}
  styles={{
    container: styles.autocompleteContainer,
    textInput: styles.input,
    listView: styles.autocompleteList,
  }}
  enablePoweredByContainer={false}
  textInputProps={{
    placeholderTextColor: '#9ca3af',
    returnKeyType: 'search',
  }}
/>
```

**Passo 3: Atualizar lógica de adição de parada**

```typescript
async function onAddParada(data: ParadaFormData) {
  setIsLoading(true);
  try {
    // Usar coordenadas do Autocomplete (mais confiável)
    const coords = tempCoords || await getCoordinates(data.endereco);

    if (!coords) {
      Alert.alert(
        'Endereço Inválido',
        'Não foi possível localizar este endereço. Por favor, selecione um endereço da lista de sugestões.'
      );
      return;
    }

    const novaParada: Parada = {
      ...data,
      latitude: coords.lat,
      longitude: coords.lng,
      ordem: paradas.length + 1,
    };

    setParadas([...paradas, novaParada]);
    setTempCoords(null); // Limpar
    reset();

    // Feedback visual
    Toast.show({
      type: 'success',
      text1: '✅ Parada adicionada',
      text2: data.endereco
    });
  } catch (error) {
    console.error('Erro ao adicionar parada:', error);
    Alert.alert('Erro', 'Não foi possível adicionar a parada');
  } finally {
    setIsLoading(false);
  }
}
```

**Estimativa:** 2-3 dias
**Benefícios:**
- 95%+ de endereços corretos
- UX muito mais rápida (5-10 segundos vs 30-60 segundos)
- Validação automática de endereços

---

### **Etapa 4: Otimizar Rota** ✅

**Status:** 100% Funcional

**Implementado:**
- ✅ Google Directions API com `optimize:true`
- ✅ Reordenação automática de paradas
- ✅ Cálculo de distância e tempo
- ✅ Banner visual com economia
- ✅ Alert com estatísticas

**Gaps:** Nenhum

---

### **Etapa 5: Atribuir Motorista** ✅

**Status:** 100% Funcional

**Implementado:**
- ✅ Lista de motoristas da unidade
- ✅ Seleção visual (cards)
- ✅ Validação de motorista obrigatório
- ✅ Salvamento no banco

**Gaps:** Nenhum

---

### **Etapa 6: Salvar e Notificar** 🟡

**Status:** Parcial (50%)

**Implementado:**
- ✅ Salvamento de rota no banco
- ✅ Criação de paradas vinculadas
- ✅ Log de auditoria

**Gaps:**

#### **🟡 GAP 6.1 - Notificação Push AUSENTE**

**Problema:** Motorista não é notificado quando recebe nova rota.

**Impacto:**
- Motorista precisa abrir app manualmente para ver novas rotas
- Atrasos no início da execução

**Prioridade:** MÉDIA (pode esperar Fase 2)

**Sugestão de implementação:**

**Passo 1: Configurar Expo Notifications**
```bash
npx expo install expo-notifications
```

**Passo 2: Criar serviço de notificações**

```typescript
// src/lib/notifications.ts
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

// Configurar handler de notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // Salvar token no perfil do usuário
  await supabase
    .from('usuarios')
    .update({ push_token: token })
    .eq('id', userId);

  return token;
}

export async function enviarNotificacaoNovaRota(motoristaId: string, rota: any) {
  const { data: motorista } = await supabase
    .from('usuarios')
    .select('push_token, nome')
    .eq('id', motoristaId)
    .single();

  if (!motorista?.push_token) return;

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: motorista.push_token,
      title: '🚚 Nova Rota Atribuída',
      body: `Você tem ${rota.total_paradas} parada(s) para hoje`,
      data: { rotaId: rota.id, tipo: 'nova_rota' },
      sound: 'default',
      priority: 'high',
    }),
  });
}
```

**Passo 3: Enviar notificação ao criar rota**

```typescript
// Em app/gestor/nova-entrega.tsx - função gerarRota()
async function gerarRota() {
  // ... código existente ...

  // Após criar rota
  const { data: rotaData, error: rotaError } = await supabase
    .from('rotas')
    .insert({ ... })
    .select()
    .single();

  // NOVO: Enviar notificação
  await enviarNotificacaoNovaRota(motoristaSelecionado, {
    id: rotaData.id,
    total_paradas: paradas.length
  });

  Alert.alert('Sucesso!', `Rota criada e motorista notificado`);
}
```

**Estimativa:** 2-3 dias
**Pode esperar para:** Fase 2 ou 3

---

### **Etapa 7: Monitorar Execução** 🔴

**Status:** Não funcional (0%)

**Gaps:**

#### **🔴 GAP 7.1 - Real-Time Tracking AUSENTE**

**Problema:** Gestor não consegue ver onde motorista está em tempo real.

**Impacto:**
- Sem visibilidade da execução
- Impossível calcular ETA
- Não valida que motorista visitou local fisicamente

**Prioridade:** 🔥 ALTA (Fase 2)

**Sugestão de implementação:**

**Passo 1: Adicionar coluna no banco**

```sql
-- Migration: adicionar tracking de localização
ALTER TABLE usuarios
ADD COLUMN ultima_localizacao JSONB,
ADD COLUMN ultima_atualizacao_gps TIMESTAMP WITH TIME ZONE;

-- Ou criar tabela separada para histórico
CREATE TABLE localizacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  motorista_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  rota_id UUID REFERENCES rotas(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  velocidade DECIMAL(5, 2), -- km/h
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_localizacoes_motorista ON localizacoes(motorista_id);
CREATE INDEX idx_localizacoes_timestamp ON localizacoes(timestamp);
```

**Passo 2: Tracking no app do motorista**

```typescript
// src/hooks/useLocationTracking.ts
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useLocationTracking(rotaId: string | null) {
  const [tracking, setTracking] = useState(false);

  useEffect(() => {
    if (!rotaId) return;

    let subscription: Location.LocationSubscription | null = null;

    async function startTracking() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      // Atualizar localização a cada 30 segundos
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 30000, // 30 segundos
          distanceInterval: 50, // ou 50 metros
        },
        async (location) => {
          const { latitude, longitude, speed } = location.coords;

          // Salvar no banco
          await supabase.from('localizacoes').insert({
            motorista_id: userId,
            rota_id: rotaId,
            latitude,
            longitude,
            velocidade: speed ? speed * 3.6 : null, // m/s para km/h
          });

          // Atualizar última localização do usuário
          await supabase
            .from('usuarios')
            .update({
              ultima_localizacao: { latitude, longitude },
              ultima_atualizacao_gps: new Date().toISOString(),
            })
            .eq('id', userId);
        }
      );

      setTracking(true);
    }

    startTracking();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [rotaId]);

  return { tracking };
}
```

**Passo 3: Dashboard do gestor com mapa ao vivo**

```typescript
// app/gestor/mapa-ao-vivo.tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MapaRN } from '@/components/MapaRN';

export default function MapaAoVivo() {
  const [motoristas, setMotoristas] = useState([]);

  useEffect(() => {
    // Carregar posições iniciais
    loadPosicoes();

    // Realtime subscription
    const subscription = supabase
      .channel('localizacoes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'usuarios',
          filter: 'papel=eq.motorista',
        },
        (payload) => {
          // Atualizar posição do motorista em tempo real
          setMotoristas((prev) =>
            prev.map((m) =>
              m.id === payload.new.id
                ? { ...m, ...payload.new }
                : m
            )
          );
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadPosicoes() {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, ultima_localizacao, ultima_atualizacao_gps')
      .eq('papel', 'motorista')
      .eq('unidade_id', unidadeId)
      .not('ultima_localizacao', 'is', null);

    setMotoristas(data || []);
  }

  return (
    <MapView>
      {motoristas.map((motorista) => (
        <Marker
          key={motorista.id}
          coordinate={{
            latitude: motorista.ultima_localizacao.latitude,
            longitude: motorista.ultima_localizacao.longitude,
          }}
          title={motorista.nome}
        >
          {/* Ícone de carro animado */}
          <Image source={require('@/assets/car-icon.png')} />
        </Marker>
      ))}
    </MapView>
  );
}
```

**Estimativa:** 5-7 dias
**Prioridade:** ALTA (Fase 2)

---

### **Etapa 8: Ver Relatórios** 🟡

**Status:** Parcial (40%)

**Implementado:**
- ✅ Tela de histórico existe
- ✅ Lista de rotas passadas

**Gaps:**

#### **🟡 GAP 8.1 - Filtros e Exportação AUSENTES**

**Problema:** Gestor não consegue filtrar por data ou exportar relatórios.

**Impacto:**
- Análise de dados limitada
- Impossível gerar relatórios mensais
- Não há como comprovar performance para clientes

**Prioridade:** MÉDIA (Fase 2)

**Sugestão de implementação:**

```typescript
// app/gestor/historico.tsx - adicionar filtros
interface Filtros {
  dataInicio: Date;
  dataFim: Date;
  motorista?: string;
  status?: 'concluida' | 'cancelada' | 'todas';
}

function FiltrosAvancados({ onFiltrar }: { onFiltrar: (f: Filtros) => void }) {
  const [filtros, setFiltros] = useState<Filtros>({
    dataInicio: subDays(new Date(), 30),
    dataFim: new Date(),
    status: 'todas',
  });

  return (
    <View style={styles.filtrosContainer}>
      <DatePicker
        label="De"
        value={filtros.dataInicio}
        onChange={(date) => setFiltros({ ...filtros, dataInicio: date })}
      />
      <DatePicker
        label="Até"
        value={filtros.dataFim}
        onChange={(date) => setFiltros({ ...filtros, dataFim: date })}
      />
      <Picker
        label="Motorista"
        items={motoristas}
        selectedValue={filtros.motorista}
        onValueChange={(id) => setFiltros({ ...filtros, motorista: id })}
      />
      <TouchableOpacity onPress={() => onFiltrar(filtros)}>
        <Text>Aplicar Filtros</Text>
      </TouchableOpacity>
    </View>
  );
}

// Exportar para PDF
async function exportarParaPDF(rotas: Rota[]) {
  const html = gerarHTMLRelatorio(rotas);

  const { uri } = await Print.printToFileAsync({ html });

  // Compartilhar
  await Sharing.shareAsync(uri);
}
```

**Estimativa:** 3-4 dias
**Prioridade:** MÉDIA

---

## 🚗 FLUXO DO MOTORISTA - Gaps Identificados

### **Etapa 1: Login → Ver Rotas do Dia** ✅

**Status:** Funcional (90%)

**Implementado:**
- ✅ Tela existe
- ✅ Lista de rotas

**Gap menor:**
- Tela não existe ainda, mas é trivial criar

---

### **Etapa 2: Selecionar Rota Ativa** ✅

**Status:** Funcional (80%)

**Implementado:**
- ✅ Navegação para tela de rota
- ✅ Exibição de informações
- ✅ Progresso visual

---

### **Etapa 3: Visualizar Paradas** ✅

**Status:** Funcional (80%)

**Implementado:**
- ✅ Lista de paradas em ordem
- ✅ Endereços completos
- ✅ Status de cada parada
- ✅ Informações de destinatário

**Gap:**

#### **🟡 GAP 3M.1 - Mapa Visual AUSENTE na tela do motorista**

**Problema:** Motorista vê apenas lista, não vê paradas no mapa.

**Impacto:**
- Não tem contexto visual de onde está indo
- Não vê proximidade entre paradas

**Prioridade:** MÉDIA

**Sugestão de implementação:**

```typescript
// app/motorista/rota.tsx - adicionar mapa
import { MapaRN } from '@/components/MapaRN';

export default function RotaMotorista() {
  // ... código existente ...

  return (
    <ScrollView>
      {/* NOVO: Adicionar mapa visual */}
      {paradas.length > 0 && (
        <View style={styles.mapContainer}>
          <MapaRN paradas={paradas} rotaAtiva={true} />
        </View>
      )}

      {/* Lista existente de paradas */}
      <View style={styles.paradasContainer}>
        {/* ... código existente ... */}
      </View>
    </ScrollView>
  );
}
```

**Estimativa:** 1 dia
**Prioridade:** MÉDIA

---

### **Etapa 4: Navegar para Primeira Parada** 🔴

**Status:** NÃO FUNCIONAL (0%)

#### **🔴 GAP 4M.1 - NAVEGAÇÃO GPS AUSENTE (BLOQUEADOR CRÍTICO)**

**Problema:** Motorista não consegue abrir navegação para ir até a parada.

**Impacto:**
- **BLOQUEADOR TOTAL** - App é inutilizável sem isso
- Motorista precisa copiar endereço e colar no Waze/Google Maps manualmente
- Experiência péssima, lenta, propensa a erros

**Prioridade:** 🔥🔥🔥 **CRÍTICA - BLOQUEADOR**

**Sugestão de implementação:**

#### **Solução 1: Botão "Como Chegar" em cada parada**

```typescript
// app/motorista/rota.tsx
import { Linking, Platform, Alert, ActionSheetIOS } from 'react-native';

interface Parada {
  id: string;
  endereco: string;
  latitude: number;
  longitude: number;
  ordem: number;
}

function abrirNavegacao(parada: Parada) {
  const opcoes = [
    {
      nome: 'Waze',
      url: `waze://ul?ll=${parada.latitude},${parada.longitude}&navigate=yes`,
      fallback: `https://waze.com/ul?ll=${parada.latitude},${parada.longitude}`,
    },
    {
      nome: 'Google Maps',
      url: Platform.select({
        ios: `comgooglemaps://?daddr=${parada.latitude},${parada.longitude}&directionsmode=driving`,
        android: `google.navigation:q=${parada.latitude},${parada.longitude}&mode=d`,
      }),
      fallback: `https://www.google.com/maps/dir/?api=1&destination=${parada.latitude},${parada.longitude}`,
    },
    {
      nome: 'Apple Maps',
      url: `maps://app?daddr=${parada.latitude},${parada.longitude}`,
      fallback: null,
    },
  ];

  if (Platform.OS === 'ios') {
    // iOS: ActionSheet nativo
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Abrir navegação em:',
        options: [...opcoes.map((o) => o.nome), 'Cancelar'],
        cancelButtonIndex: opcoes.length,
      },
      async (buttonIndex) => {
        if (buttonIndex < opcoes.length) {
          const opcao = opcoes[buttonIndex];
          await tentarAbrirApp(opcao);
        }
      }
    );
  } else {
    // Android: Alert com botões
    Alert.alert(
      'Abrir navegação em:',
      'Escolha o app de navegação',
      [
        ...opcoes.map((opcao) => ({
          text: opcao.nome,
          onPress: () => tentarAbrirApp(opcao),
        })),
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  }
}

async function tentarAbrirApp(opcao: { nome: string; url: string; fallback: string | null }) {
  try {
    const supported = await Linking.canOpenURL(opcao.url);

    if (supported) {
      await Linking.openURL(opcao.url);
    } else if (opcao.fallback) {
      // App não instalado, abrir versão web
      await Linking.openURL(opcao.fallback);
    } else {
      Alert.alert('App não instalado', `${opcao.nome} não está instalado neste dispositivo.`);
    }
  } catch (error) {
    console.error('Erro ao abrir navegação:', error);
    Alert.alert('Erro', 'Não foi possível abrir o app de navegação.');
  }
}

// COMPONENTE DA PARADA
function ParadaCard({ parada, index }: { parada: Parada; index: number }) {
  return (
    <View style={styles.paradaCard}>
      <View style={styles.paradaHeader}>
        <Text style={styles.paradaOrdem}>{parada.ordem}</Text>
        <Text style={styles.paradaEndereco}>{parada.endereco}</Text>
      </View>

      {/* NOVO: Botão de Navegação */}
      <TouchableOpacity
        style={styles.botaoNavegar}
        onPress={() => abrirNavegacao(parada)}
        activeOpacity={0.7}
      >
        <Icon name="navigation" size={20} color="#fff" />
        <Text style={styles.botaoNavegarTexto}>Como Chegar</Text>
      </TouchableOpacity>

      {/* Botões existentes de Concluir/Pular */}
      <View style={styles.acoesContainer}>
        <TouchableOpacity onPress={() => pularParada(parada)}>
          <Text>Pular</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => concluirParada(parada)}>
          <Text>✓ Concluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  botaoNavegar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF8C00', // Laranja RotaMestre
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  botaoNavegarTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

#### **Solução 2: Botão flutuante "Navegar para Próxima Parada"**

```typescript
// app/motorista/rota.tsx
function BotaoFlutanteNavegacao({ proximaParada }: { proximaParada: Parada | null }) {
  if (!proximaParada) return null;

  return (
    <TouchableOpacity
      style={styles.botaoFlutuante}
      onPress={() => abrirNavegacao(proximaParada)}
      activeOpacity={0.9}
    >
      <View style={styles.botaoFlutuanteContent}>
        <Icon name="navigation" size={24} color="#fff" />
        <View style={styles.botaoFlutuanteTexto}>
          <Text style={styles.botaoFlutuanteTitulo}>Próxima Parada</Text>
          <Text style={styles.botaoFlutuanteSubtitulo} numberOfLines={1}>
            {proximaParada.endereco}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  botaoFlutuante: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#0D5A9C', // Azul RotaMestre
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  botaoFlutuanteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  botaoFlutuanteTexto: {
    flex: 1,
  },
  botaoFlutuanteTitulo: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  botaoFlutuanteSubtitulo: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
});
```

#### **Solução 3: Usar componente MapaRN existente**

```typescript
// app/motorista/rota.tsx
import { MapaRN } from '@/components/MapaRN';

export default function RotaMotorista() {
  const [paradas, setParadas] = useState<Parada[]>([]);

  return (
    <ScrollView style={styles.container}>
      {/* Adicionar mapa com botão de navegação integrado */}
      {paradas.length > 0 && (
        <View style={styles.mapSection}>
          <MapaRN
            paradas={paradas}
            rotaAtiva={true} // Isso habilita o botão "Iniciar Navegação"
          />
        </View>
      )}

      {/* Lista de paradas com botões individuais */}
      <View style={styles.paradasList}>
        {paradas.map((parada) => (
          <ParadaCard key={parada.id} parada={parada} />
        ))}
      </View>

      {/* Botão flutuante para próxima parada */}
      <BotaoFlutanteNavegacao proximaParada={proximaParadaPendente} />
    </ScrollView>
  );
}
```

**Estimativa:** 3-4 dias

**Arquivos a modificar:**
1. `app/motorista/rota.tsx` - Adicionar botões e lógica
2. `app/motorista/checkpoints.tsx` - Adicionar mesmo botão
3. `src/lib/navigation.ts` - Criar helper reutilizável

**Critério de sucesso:**
- ✅ Motorista abre navegação com 1 clique
- ✅ Funciona em iOS e Android
- ✅ Suporta Waze, Google Maps e Apple Maps
- ✅ Fallback para versão web se app não instalado

---

### **Etapa 5: Concluir Parada** 🟡

**Status:** Parcial (70%)

**Implementado:**
- ✅ Botão "Concluir Parada"
- ✅ Atualização de status no banco
- ✅ Feedback visual

**Gaps:**

#### **🟡 GAP 5M.1 - Upload de Foto AUSENTE**

**Problema:** Campo `foto_comprovante` existe no banco mas não há UI para tirar foto.

**Impacto:**
- Sem prova de entrega
- Impossível validar que entrega foi feita

**Prioridade:** MÉDIA-ALTA

**Sugestão de implementação:**

```typescript
// app/motorista/checkpoints.tsx
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

async function tirarFotoComprovante(parada: Parada) {
  // Pedir permissão de câmera
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera para tirar foto do comprovante.');
    return;
  }

  // Abrir câmera
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7, // Comprimir para economizar storage
  });

  if (result.canceled) return;

  const imageUri = result.assets[0].uri;

  // Upload para Supabase Storage
  setUploadingFoto(true);
  try {
    // Converter para blob
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // Nome único
    const fileName = `${parada.rota_id}/${parada.id}_${Date.now()}.jpg`;

    // Upload
    const { data, error } = await supabase.storage
      .from('comprovantes-entrega')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
      });

    if (error) throw error;

    // Pegar URL pública
    const { data: publicUrl } = supabase.storage
      .from('comprovantes-entrega')
      .getPublicUrl(fileName);

    // Salvar URL no banco
    await supabase
      .from('paradas')
      .update({ foto_comprovante: publicUrl.publicUrl })
      .eq('id', parada.id);

    setFotoComprovante(publicUrl.publicUrl);
    Alert.alert('✅ Foto salva', 'Comprovante de entrega registrado com sucesso');
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    Alert.alert('Erro', 'Não foi possível salvar a foto. Tente novamente.');
  } finally {
    setUploadingFoto(false);
  }
}

// UI do botão
function BotoesConcluirParada({ parada }: { parada: Parada }) {
  const [fotoComprovante, setFotoComprovante] = useState(parada.foto_comprovante);

  return (
    <View style={styles.acoesContainer}>
      {/* Botão de foto */}
      {!fotoComprovante ? (
        <TouchableOpacity
          style={styles.botaoFoto}
          onPress={() => tirarFotoComprovante(parada)}
        >
          <Icon name="camera" size={20} color="#0D5A9C" />
          <Text style={styles.botaoFotoTexto}>Tirar Foto</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.fotoThumb}>
          <Image source={{ uri: fotoComprovante }} style={styles.fotoImage} />
          <Icon name="check-circle" size={20} color="#10b981" />
        </View>
      )}

      {/* Botão concluir - só habilita se tem foto */}
      <TouchableOpacity
        style={[
          styles.botaoConcluir,
          !fotoComprovante && styles.botaoConcluirDisabled,
        ]}
        onPress={() => concluirParada(parada)}
        disabled={!fotoComprovante}
      >
        <Text style={styles.botaoConcluirTexto}>✓ Concluir Parada</Text>
      </TouchableOpacity>
    </View>
  );
}
```

**Configuração necessária no Supabase:**

1. Criar bucket `comprovantes-entrega`
2. Configurar política de RLS:
```sql
-- Motorista pode fazer upload de suas próprias fotos
CREATE POLICY "Motoristas podem fazer upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'comprovantes-entrega' AND
  auth.uid() IN (
    SELECT motorista_id FROM rotas WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Todos podem ver fotos (gestor precisa ver no histórico)
CREATE POLICY "Todos podem ver comprovantes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'comprovantes-entrega');
```

**Estimativa:** 3-4 dias
**Prioridade:** MÉDIA-ALTA

---

#### **🟡 GAP 5M.2 - Assinatura Digital AUSENTE**

**Problema:** Não há captura de assinatura do destinatário.

**Impacto:**
- Sem prova de que pessoa correta recebeu
- Importante para alguns tipos de entrega

**Prioridade:** BAIXA (pode esperar Fase 3)

**Sugestão de implementação:**

```bash
npm install react-native-signature-canvas
```

```typescript
import SignatureScreen from 'react-native-signature-canvas';

function ModalAssinatura({ visible, onConfirm, onCancel }) {
  const handleSignature = (signature) => {
    // signature é base64
    onConfirm(signature);
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.modalContainer}>
        <Text style={styles.modalTitle}>Assinatura do Destinatário</Text>
        <SignatureScreen
          onOK={handleSignature}
          onEmpty={() => Alert.alert('Por favor, assine antes de confirmar')}
          descriptionText="Assine acima"
          clearText="Limpar"
          confirmText="Confirmar"
        />
        <TouchableOpacity onPress={onCancel}>
          <Text>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
```

**Estimativa:** 2-3 dias
**Pode esperar para:** Fase 3

---

### **Etapa 6: Navegar para Próxima Parada** 🔴

**Mesmo gap 4M.1 - Navegação GPS**

Após implementar navegação, motorista usa mesmo botão para ir para próxima parada.

---

### **Etapa 7: Ver Resumo do Dia** 🟡

**Status:** Tela não existe (0%)

**Gap:**

#### **🟡 GAP 7M.1 - Tela de Resumo AUSENTE**

**Problema:** Ao final do dia, motorista não vê resumo do que fez.

**Impacto:**
- Sem feedback de conclusão
- Motorista não sabe performance dele

**Prioridade:** BAIXA

**Sugestão de implementação:**

```typescript
// app/motorista/resumo.tsx
export default function ResumoMotorista() {
  const [stats, setStats] = useState({
    totalRotas: 0,
    totalParadas: 0,
    paradasConcluidas: 0,
    kmPercorridos: 0,
    tempoTotal: 0,
  });

  useEffect(() => {
    loadResumo();
  }, []);

  async function loadResumo() {
    const hoje = new Date().toISOString().split('T')[0];

    const { data: rotas } = await supabase
      .from('rotas')
      .select(`
        id,
        distancia_total,
        tempo_total,
        paradas (id, status)
      `)
      .eq('motorista_id', userId)
      .gte('data', hoje);

    const totalRotas = rotas?.length || 0;
    const totalParadas = rotas?.reduce((acc, r) => acc + r.paradas.length, 0) || 0;
    const paradasConcluidas =
      rotas?.reduce(
        (acc, r) => acc + r.paradas.filter((p) => p.status === 'concluida').length,
        0
      ) || 0;
    const kmPercorridos =
      rotas?.reduce((acc, r) => acc + (r.distancia_total || 0), 0) || 0;
    const tempoTotal = rotas?.reduce((acc, r) => acc + (r.tempo_total || 0), 0) || 0;

    setStats({
      totalRotas,
      totalParadas,
      paradasConcluidas,
      kmPercorridos,
      tempoTotal,
    });
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Resumo do Dia</Text>
        <Text style={styles.subtitle}>{format(new Date(), 'dd/MM/yyyy')}</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          icon="check-circle"
          value={`${stats.paradasConcluidas}/${stats.totalParadas}`}
          label="Paradas Concluídas"
          color="#10b981"
        />
        <StatCard
          icon="route"
          value={stats.totalRotas}
          label="Rotas"
          color="#0D5A9C"
        />
        <StatCard
          icon="road"
          value={`${stats.kmPercorridos.toFixed(1)} km`}
          label="Percorridos"
          color="#FF8C00"
        />
        <StatCard
          icon="clock"
          value={`${Math.round(stats.tempoTotal / 60)}h`}
          label="Tempo Total"
          color="#8b5cf6"
        />
      </View>

      {/* Mensagem motivacional */}
      <View style={styles.motivacao}>
        <Text style={styles.motivacaoTexto}>
          {stats.paradasConcluidas === stats.totalParadas
            ? '🎉 Parabéns! Todas as entregas foram concluídas!'
            : `Ótimo trabalho! ${((stats.paradasConcluidas / stats.totalParadas) * 100).toFixed(0)}% de conclusão.`}
        </Text>
      </View>
    </ScrollView>
  );
}
```

**Estimativa:** 2 dias
**Prioridade:** BAIXA (Fase 3)

---

## 🎯 Matriz de Priorização

### **Por Impacto no Fluxo:**

| Gap | Etapa | Impacto | Prioridade | Estimativa | Fase |
|-----|-------|---------|------------|------------|------|
| **4M.1 - Navegação GPS** | Motorista #4 | 🔴 **BLOQUEADOR** | **CRÍTICA** | 3-4 dias | **1** |
| **3.1 - Autocomplete** | Gestor #3 | 🔴 Endereços inválidos | **ALTA** | 2-3 dias | **1** |
| **5M.1 - Upload Foto** | Motorista #5 | 🟡 Sem prova | MÉDIA-ALTA | 3-4 dias | **1-2** |
| **7.1 - Tracking Real-time** | Gestor #7 | 🟡 Sem visibilidade | ALTA | 5-7 dias | **2** |
| **3M.1 - Mapa Motorista** | Motorista #3 | 🟡 Contexto visual | MÉDIA | 1 dia | **2** |
| **8.1 - Filtros/Exportação** | Gestor #8 | 🟡 Análise limitada | MÉDIA | 3-4 dias | **2** |
| **2.1 - Métricas Avançadas** | Gestor #2 | 🟢 Nice-to-have | BAIXA | 2-3 dias | **3** |
| **6.1 - Notificações Push** | Gestor #6 | 🟢 Conveniência | MÉDIA | 2-3 dias | **2-3** |
| **5M.2 - Assinatura Digital** | Motorista #5 | 🟢 Extra | BAIXA | 2-3 dias | **3** |
| **7M.1 - Resumo do Dia** | Motorista #7 | 🟢 Motivação | BAIXA | 2 dias | **3** |

---

## 📋 Plano de Implementação Sequencial

### **🔥 FASE 1: DESBLOQUEIO CRÍTICO (Semanas 1-2)**

**Objetivo:** Tornar produto minimamente usável para testes reais.

#### **Sprint 1.1 (3-4 dias) - NAVEGAÇÃO GPS**

**Ordem de implementação:**

**Dia 1:**
1. Criar helper `src/lib/navigation.ts` com função `abrirNavegacao()`
2. Implementar lógica de detecção de apps (Waze, Google Maps, Apple Maps)
3. Adicionar fallbacks para web

**Dia 2:**
4. Adicionar botão "Como Chegar" em `app/motorista/rota.tsx`
5. Adicionar mesmos botões em `app/motorista/checkpoints.tsx`
6. Estilizar botões (seguir design tokens)

**Dia 3:**
7. Integrar `MapaRN` na tela do motorista com prop `rotaAtiva={true}`
8. Criar botão flutuante "Próxima Parada"
9. Testar em dispositivo real (Android)

**Dia 4:**
10. Testar em dispositivo iOS
11. Ajustes de UX baseados em testes
12. Commit e deploy

**Arquivos modificados:**
- `app/motorista/rota.tsx`
- `app/motorista/checkpoints.tsx`
- `src/lib/navigation.ts` (novo)

**Critério de sucesso:**
- ✅ Motorista navega para qualquer parada com 1-2 cliques
- ✅ Funciona em iOS e Android
- ✅ Suporta 3 apps (Waze, Google Maps, Apple Maps)

---

#### **Sprint 1.2 (2-3 dias) - AUTOCOMPLETE**

**Ordem de implementação:**

**Dia 1:**
1. `npm install react-native-google-places-autocomplete`
2. Testar componente isolado
3. Configurar API key e restrições

**Dia 2:**
4. Substituir TextInput em `app/gestor/nova-entrega.tsx`
5. Integrar com lógica existente de geocoding
6. Adicionar validação visual (checkmark)

**Dia 3:**
7. Testes com endereços reais
8. Ajustar UX (debounce, loading states)
9. Commit

**Arquivos modificados:**
- `app/gestor/nova-entrega.tsx`
- `package.json`

**Critério de sucesso:**
- ✅ Sugestões aparecem enquanto digita
- ✅ Seleção com 1 toque
- ✅ 95%+ de taxa de sucesso no geocoding

---

#### **Sprint 1.3 (3-4 dias) - UPLOAD DE FOTO**

**Ordem de implementação:**

**Dia 1:**
1. Criar bucket `comprovantes-entrega` no Supabase
2. Configurar políticas RLS
3. Testar upload manual via Supabase Dashboard

**Dia 2:**
4. Implementar função `tirarFotoComprovante()` em `app/motorista/checkpoints.tsx`
5. Integrar expo-image-picker
6. Testar captura de foto

**Dia 3:**
7. Implementar upload para Supabase Storage
8. Salvar URL no campo `foto_comprovante`
9. Adicionar preview de thumbnail

**Dia 4:**
10. Adicionar visualização da foto na tela do gestor (histórico)
11. Otimizar compressão de imagem
12. Commit

**Arquivos modificados:**
- `app/motorista/checkpoints.tsx`
- Supabase: bucket + RLS policies

**Critério de sucesso:**
- ✅ Motorista tira foto ao concluir parada
- ✅ Foto é salva no Supabase Storage
- ✅ Gestor vê foto no histórico

---

### **🚀 FASE 2: OTIMIZAÇÃO E ESCALA (Semanas 3-5)**

#### **Sprint 2.1 (5-7 dias) - REAL-TIME TRACKING**

**Ordem:**
1. Migration: adicionar tabela `localizacoes`
2. Hook `useLocationTracking()` no app motorista
3. Tela `app/gestor/mapa-ao-vivo.tsx`
4. Realtime subscription com Supabase
5. Ícones animados de carros
6. Cálculo de ETA
7. Testes de performance

---

#### **Sprint 2.2 (1 dia) - MAPA NA TELA DO MOTORISTA**

**Ordem:**
1. Importar `MapaRN` em `app/motorista/rota.tsx`
2. Adicionar container de mapa acima da lista
3. Passar prop `rotaAtiva={true}`
4. Ajustar layout (mapa + lista scrollable)

---

#### **Sprint 2.3 (3-4 dias) - FILTROS E RELATÓRIOS**

**Ordem:**
1. Adicionar filtros de data em `app/gestor/historico.tsx`
2. Picker de motorista
3. Filtro de status
4. Implementar exportação para PDF
5. Função de compartilhamento

---

#### **Sprint 2.4 (2-3 dias) - NOTIFICAÇÕES PUSH**

**Ordem:**
1. Configurar Expo Notifications
2. Migration: adicionar campo `push_token` em usuarios
3. Função `registerForPushNotifications()`
4. Função `enviarNotificacaoNovaRota()`
5. Integrar no fluxo de criação de rota

---

### **✨ FASE 3: POLIMENTO (Semanas 6-7)**

#### **Sprint 3.1 (2-3 dias) - MÉTRICAS AVANÇADAS**

**Ordem:**
1. Função `calcularEconomia()` no dashboard
2. Card "Economia do Mês"
3. Chart de performance (opcional)

---

#### **Sprint 3.2 (2 dias) - RESUMO DO MOTORISTA**

**Ordem:**
1. Criar tela `app/motorista/resumo.tsx`
2. Carregar estatísticas do dia
3. Cards visuais
4. Mensagem motivacional

---

#### **Sprint 3.3 (2-3 dias) - ASSINATURA DIGITAL**

**Ordem:**
1. `npm install react-native-signature-canvas`
2. Modal de assinatura
3. Salvar base64 no banco
4. Visualização no histórico

---

## ⏱️ Cronograma Estimado

| Fase | Sprints | Duração | Entregas |
|------|---------|---------|----------|
| **Fase 1** | 3 sprints | 8-11 dias | Navegação GPS, Autocomplete, Upload Foto |
| **Fase 2** | 4 sprints | 11-17 dias | Tracking, Mapa Motorista, Relatórios, Push |
| **Fase 3** | 3 sprints | 6-8 dias | Métricas, Resumo, Assinatura |
| **TOTAL** | **10 sprints** | **25-36 dias** | **Produto completo e funcional** |

---

## 🎯 Definição de "Pronto para Produção"

Após **Fase 1** completa (8-11 dias):

### **Checklist Mínimo Viável:**

#### **Gestor:**
- ✅ Login funcional
- ✅ Dashboard com estatísticas
- ✅ Criar rota com autocomplete (**Novo**)
- ✅ Otimizar rota
- ✅ Atribuir motorista
- ✅ Ver mapa da rota
- ⏸️ Tracking tempo real (Fase 2)

#### **Motorista:**
- ✅ Login funcional
- ✅ Ver rotas do dia
- ✅ Visualizar paradas
- ✅ **Navegar para paradas** (**NOVO - CRÍTICO**)
- ✅ Concluir paradas
- ✅ **Tirar foto comprovante** (**Novo**)
- ⏸️ Ver resumo do dia (Fase 3)

### **Critério de Lançamento Beta:**

**Após Fase 1:**
- ✅ App não crasha
- ✅ Fluxo completo funcional (gestor cria → motorista executa)
- ✅ Navegação GPS funcionando
- ✅ Endereços validados com autocomplete
- ✅ Fotos de comprovante salvando
- ✅ Testado em 2+ dispositivos reais (Android + iOS)

**Pode lançar em produção com clientes piloto!**

---

## 💡 Recomendação Final

### **Ordem de Prioridade Absoluta:**

1. **🔥 NAVEGAÇÃO GPS** (Sprint 1.1) - 3-4 dias
   - **BLOQUEADOR CRÍTICO**
   - Sem isso, motorista não consegue trabalhar
   - Implementar PRIMEIRO

2. **🔥 AUTOCOMPLETE** (Sprint 1.2) - 2-3 dias
   - Evita 80% dos erros de geocoding
   - Melhora UX drasticamente
   - Implementar SEGUNDO

3. **📷 UPLOAD FOTO** (Sprint 1.3) - 3-4 dias
   - Prova de entrega
   - Importante para confiança do sistema
   - Implementar TERCEIRO

**Total Fase 1: 8-11 dias de desenvolvimento**

Após isso, produto está **PRONTO PARA TESTES REAIS** com clientes piloto.

Fase 2 e 3 são otimizações e polimento, não bloqueadores.

---

**Última atualização:** 24 de outubro de 2025
**Próximo passo:** Iniciar Sprint 1.1 (Navegação GPS)
