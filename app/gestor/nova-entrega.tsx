import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect, memo, useCallback } from 'react';
import { useForm, Controller, Control, FieldErrors } from 'react-hook-form';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { z } from 'zod';

import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/hooks/useUser';
import { googleMapsService } from '@/lib/google';
import { supabase } from '@/lib/supabase';
import { GoogleDirectionsLeg } from '@/types/google-directions';
import { maskPhone } from '@/utils/phoneValidation';
import { StyleSheet, useUnistyles } from '@/utils/styles';
import { useResponsive } from '@/hooks/useResponsive';
import { DesktopPageLayout } from '@/components/desktop/DesktopPageLayout';
import { DesktopCard } from '@/components/desktop/DesktopCard';

// Schema de validação
const paradaSchema = z.object({
  endereco: z
    .string({ required_error: 'Endereço é obrigatório' })
    .min(5, 'Endereço deve ter no mínimo 5 caracteres'),
  tipo: z.enum(['entrega', 'retirada']),
  destinatario: z
    .string({ required_error: 'Nome do destinatário é obrigatório' })
    .min(1, 'Nome do destinatário é obrigatório')
    .refine((val) => val.trim().length >= 3, {
      message: 'Nome do destinatário deve ter no mínimo 3 caracteres',
    }),
  telefone: z
    .string({ required_error: 'Telefone é obrigatório' })
    .min(1, 'Telefone de contato é obrigatório')
    .refine((val) => val.replace(/\D/g, '').length >= 10, {
      message: 'Telefone deve ter no mínimo 10 dígitos',
    }),
  observacoes: z.string().optional(),
});

type ParadaFormData = z.infer<typeof paradaSchema>;

interface Parada extends ParadaFormData {
  latitude?: number;
  longitude?: number;
  ordem: number;
}

interface RotaOtimizadaState {
  distancia_total_metros: number;
  duracao_total_segundos: number;
  legs: GoogleDirectionsLeg[];
  polyline?: string;
}

function distanceInMeters(
  parada: Parada,
  coords?: { latitude: number; longitude: number }
) {
  if (
    parada.latitude == null ||
    parada.longitude == null ||
    !coords
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(coords.latitude - parada.latitude);
  const dLon = toRad(coords.longitude - parada.longitude);

  const lat1 = toRad(parada.latitude);
  const lat2 = toRad(coords.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function ordenarParadasPorRota(
  paradas: Parada[],
  ordemOtimizada: number[],
  legs?: GoogleDirectionsLeg[]
) {
  if (ordemOtimizada?.length === paradas.length) {
    return ordemOtimizada.map((index) => paradas[index]);
  }

  if (legs?.length) {
    const utilizados = new Set<number>();
    const ordenadas: Parada[] = [];

    legs.forEach((leg, idx) => {
      // último leg = retorno à base
      if (idx === legs.length - 1) return;

      let melhorIndex = -1;
      let menorDistancia = Number.POSITIVE_INFINITY;

      paradas.forEach((parada, paradaIndex) => {
        if (utilizados.has(paradaIndex)) return;
        const distancia = distanceInMeters(parada, leg.coordenadas_fim);
        if (distancia < menorDistancia) {
          menorDistancia = distancia;
          melhorIndex = paradaIndex;
        }
      });

      if (melhorIndex !== -1) {
        ordenadas.push(paradas[melhorIndex]);
        utilizados.add(melhorIndex);
      }
    });

    // Caso alguma parada não tenha sido encontrada (variação de coordenadas), mantém a ordem original remanescente
    paradas.forEach((parada, index) => {
      if (!utilizados.has(index)) {
        ordenadas.push(parada);
        utilizados.add(index);
      }
    });

    if (ordenadas.length === paradas.length) {
      return ordenadas;
    }
  }

  // Fallback: mantém a ordem original
  return [...paradas];
}

// ============================================
// Componente FormularioParada Memoizado
// ============================================
interface FormularioParadaProps {
  control: Control<ParadaFormData>;
  errors: FieldErrors<ParadaFormData>;
  setValue: any;
  handleSubmit: any;
  onAddParada: (data: ParadaFormData) => void;
  isLoading: boolean;
}

const FormularioParadaMemoized = memo(function FormularioParada({
  control,
  errors,
  setValue,
  handleSubmit,
  onAddParada,
  isLoading,
}: FormularioParadaProps) {
  const { theme } = useUnistyles();
  const styles = createStyles(theme);

  return (
    <View style={styles.form}>
      <Text style={styles.sectionTitle}>Adicionar Parada</Text>

      <Controller
        control={control}
        name="tipo"
        render={({ field: { onChange, value } }) => (
          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={[
                styles.radioButton,
                value === 'entrega' && styles.radioButtonActive,
              ]}
              onPress={() => onChange('entrega')}
              accessibilityLabel="Selecionar tipo entrega"
              accessibilityRole="radio"
              accessibilityState={{ checked: value === 'entrega' }}
            >
              <Text
                style={[
                  styles.radioText,
                  value === 'entrega' && styles.radioTextActive,
                ]}
              >
                Entrega
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.radioButton,
                value === 'retirada' && styles.radioButtonActive,
              ]}
              onPress={() => onChange('retirada')}
              accessibilityLabel="Selecionar tipo retirada"
              accessibilityRole="radio"
              accessibilityState={{ checked: value === 'retirada' }}
            >
              <Text
                style={[
                  styles.radioText,
                  value === 'retirada' && styles.radioTextActive,
                ]}
              >
                Retirada
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <Controller
        control={control}
        name="endereco"
        render={({ field: { onChange, value } }) => (
          <AddressAutocomplete
            value={value || ''}
            onChangeText={onChange}
            onSelectAddress={async (address, placeId) => {
              onChange(address);
              const details = await googleMapsService.getPlaceDetails(placeId);
              if (details) {
                // @ts-ignore
                setValue('latitude', details.coordenadas.latitude);
                // @ts-ignore
                setValue('longitude', details.coordenadas.longitude);
              }
            }}
            placeholder="Digite o endereço completo *"
            error={errors.endereco?.message}
            multiline
          />
        )}
      />

      <Controller
        control={control}
        name="destinatario"
        render={({ field: { onChange, value } }) => (
          <>
            <TextInput
              style={[
                styles.input,
                errors.destinatario && styles.inputError,
              ]}
              placeholder="Nome do destinatário *"
              value={value}
              onChangeText={onChange}
              accessibilityLabel="Campo de nome do destinatário"
              accessibilityHint="Digite o nome completo do destinatário"
            />
            {errors.destinatario && (
              <Text style={styles.errorText}>{errors.destinatario.message}</Text>
            )}
          </>
        )}
      />

      <Controller
        control={control}
        name="telefone"
        render={({ field: { onChange, value } }) => (
          <>
            <TextInput
              style={[
                styles.input,
                errors.telefone && styles.inputError,
              ]}
              placeholder="Telefone de contato *"
              value={value}
              onChangeText={(text) => onChange(maskPhone(text))}
              keyboardType="phone-pad"
              maxLength={15}
              accessibilityLabel="Campo de telefone do destinatário"
              accessibilityHint="Digite o telefone do destinatário com DDD"
            />
            {errors.telefone && (
              <Text style={styles.errorText}>{errors.telefone.message}</Text>
            )}
          </>
        )}
      />

      <Controller
        control={control}
        name="observacoes"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Observações"
            value={value}
            onChangeText={onChange}
            multiline
            numberOfLines={3}
            accessibilityLabel="Campo de observações"
            accessibilityHint="Digite observações adicionais sobre a entrega"
          />
        )}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={handleSubmit(onAddParada)}
        disabled={isLoading}
        accessibilityLabel="Adicionar parada à lista"
        accessibilityRole="button"
        accessibilityState={{ disabled: isLoading }}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.addButtonText}>+ Adicionar Parada</Text>
        )}
      </TouchableOpacity>
    </View>
  );
});

export default function NovaEntrega() {
  const { theme } = useUnistyles();
  const styles = createStyles(theme);
  const { userData, unidade } = useUser();
  const { toast: toastState, showToast, hideToast } = useToast();
  const { isDesktop } = useResponsive();
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [motoristaSelecionado, setMotoristaSelecionado] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMotoristas, setIsLoadingMotoristas] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [rotaOtimizada, setRotaOtimizada] = useState<RotaOtimizadaState | null>(null);
  const [enderecoUnidade, setEnderecoUnidade] = useState<{
    latitude: number;
    longitude: number;
    endereco: string;
  } | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ParadaFormData>({
    resolver: zodResolver(paradaSchema),
    defaultValues: {
      tipo: 'entrega',
      endereco: '',
      destinatario: '',
      telefone: '',
      observacoes: '',
    },
  });

  const loadEnderecoUnidade = useCallback(async () => {
    if (!unidade) {
      console.warn('Usuário sem unidade vinculada');
      return;
    }

    const parseCoordinate = (value: unknown): number | null => {
      if (value === null || value === undefined) return null;
      const numeric = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };

    const latitudeFromDb = parseCoordinate((unidade as any).sede_latitude);
    const longitudeFromDb = parseCoordinate((unidade as any).sede_longitude);
    const enderecoBase = (unidade as any).sede_endereco || unidade.endereco;

    const enderecoCompleto = [
      enderecoBase,
      unidade.cidade,
      (unidade as any).uf,
      (unidade as any).cep,
    ]
      .filter((parte) => typeof parte === 'string' && parte.trim().length > 0)
      .join(', ');

    if (latitudeFromDb != null && longitudeFromDb != null) {
      setEnderecoUnidade({
        latitude: latitudeFromDb,
        longitude: longitudeFromDb,
        endereco: enderecoCompleto || enderecoBase || 'Sede da unidade',
      });
      return;
    }

    if (!enderecoCompleto) {
      console.warn('Unidade sem endereço completo cadastrado');
      showToast('Endereço da unidade não encontrado. Complete o cadastro antes de gerar rotas.', 'error');
      return;
    }

    try {
      const result = await googleMapsService.geocodeAddress(enderecoCompleto);
      if (result?.coordenadas) {
        setEnderecoUnidade({
          latitude: result.coordenadas.latitude,
          longitude: result.coordenadas.longitude,
          endereco: result.formatted_address || enderecoCompleto,
        });
      } else {
        console.error('⚠️ Não foi possível geocodificar o endereço da unidade');
        showToast('Endereço da unidade não encontrado. Verifique o cadastro da unidade.', 'error');
      }
    } catch (error) {
      console.error('Erro ao geocodificar endereço da unidade:', error);
    }
  }, [showToast, unidade]);

  const loadMotoristas = useCallback(async () => {
    const unidadeId = userData?.unidade_id;
    if (!unidadeId) {
      setIsLoadingMotoristas(false);
      return;
    }

    try {
      setIsLoadingMotoristas(true);
      const { data: motoristasData, error } = await supabase
        .from('usuarios')
        .select('id, nome, email')
        .eq('papel', 'motorista')
        .eq('unidade_id', unidadeId)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setMotoristas(motoristasData || []);
    } catch (error) {
      console.error('Erro ao carregar motoristas:', error);
      showToast('Não foi possível carregar os motoristas', 'error');
    } finally {
      setIsLoadingMotoristas(false);
    }
  }, [showToast, userData?.unidade_id]);

  // Carregar motoristas da unidade
  useEffect(() => {
    loadMotoristas();
  }, [loadMotoristas]);

  // Carregar endereço da unidade ao montar
  useEffect(() => {
    if (unidade) {
      loadEnderecoUnidade();
    }
  }, [loadEnderecoUnidade, unidade]);

  // Adicionar parada à lista (coordenadas já obtidas pelo autocomplete)
  async function onAddParada(paradaData: ParadaFormData) {
    setIsLoading(true);
    try {
      // Se não tem coordenadas, tentar geocodificar manualmente
      if (!paradaData.latitude || !paradaData.longitude) {
        const result = await googleMapsService.geocodeAddress(paradaData.endereco);

        if (!result) {
          showToast('Não foi possível localizar o endereço. Use o autocomplete para selecionar um endereço válido.', 'error');
          return;
        }

        paradaData.latitude = result.coordenadas.latitude;
        paradaData.longitude = result.coordenadas.longitude;
      }

      const novaParada: Parada = {
        ...paradaData,
        ordem: paradas.length + 1,
      };

      setParadas([...paradas, novaParada]);
      reset();
      showToast('Parada adicionada à lista!', 'success');
    } catch (error) {
      console.error('Erro ao adicionar parada:', error);
      showToast('Não foi possível adicionar a parada', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  // Remover parada da lista
  function removeParada(index: number) {
    const novasParadas = paradas.filter((_, i) => i !== index);
    // Reordenar
    const reordenadas = novasParadas.map((p, i) => ({ ...p, ordem: i + 1 }));
    setParadas(reordenadas);
    setRotaOtimizada(null); // Limpar otimização ao remover parada
  }

  // Otimizar rota usando Google Directions API
  async function otimizarRota() {
    if (paradas.length < 1) {
      showToast('Adicione pelo menos 1 parada para otimizar a rota', 'info');
      return;
    }

    if (!enderecoUnidade) {
      showToast('Endereço da unidade não encontrado. Verifique o cadastro da unidade.', 'error');
      return;
    }

    setIsOptimizing(true);
    try {
      // Origem e destino: endereço da unidade (rota circular)
      const pontoUnidade = {
        latitude: enderecoUnidade.latitude,
        longitude: enderecoUnidade.longitude,
      };

      // Todas as paradas são waypoints a serem otimizados
      const waypoints = paradas.map((p) => ({
        latitude: p.latitude!,
        longitude: p.longitude!,
      }));

      console.log('🗺️ Otimizando rota circular da unidade:', {
        unidade: enderecoUnidade.endereco,
        paradas: paradas.length,
      });

      // Chamar API Google Directions com optimize:true
      const resultado = await googleMapsService.getDirections(
        pontoUnidade, // Origem: Unidade
        pontoUnidade, // Destino: Unidade (rota circular)
        waypoints
      );

      if (!resultado) {
        showToast('Não foi possível otimizar a rota', 'error');
        return;
      }

      // Reordenar paradas conforme ordem otimizada retornada pela API
      const ordemOtimizada = resultado.ordem_otimizada || [];
      const paradasReordenadas = ordenarParadasPorRota(paradas, ordemOtimizada, resultado.legs);

      // Atualizar ordem das paradas
      const paradasComNovaOrdem = paradasReordenadas.map((p, i) => ({
        ...p,
        ordem: i + 1,
      }));

      setParadas(paradasComNovaOrdem);
      setRotaOtimizada({
        distancia_total_metros: resultado.distancia_total_metros,
        duracao_total_segundos: resultado.duracao_total_segundos,
        legs: resultado.legs,
        polyline: resultado.polyline,
      });

      showToast(
        `Rota otimizada! ${(resultado.distancia_total_metros / 1000).toFixed(1)} km - ${Math.round(resultado.duracao_total_segundos / 60)} min`,
        'success',
        4000
      );
    } catch (error) {
      console.error('Erro ao otimizar rota:', error);
      showToast('Não foi possível otimizar a rota', 'error');
    } finally {
      setIsOptimizing(false);
    }
  }

  // Gerar rota completa
  async function gerarRota() {
    console.log('🚀 gerarRota() chamada!');
    console.log('📍 Paradas:', paradas.length);
    console.log('🚗 Motorista:', motoristaSelecionado);

    if (paradas.length === 0) {
      showToast('Adicione pelo menos uma parada antes de gerar a rota', 'info');
      return;
    }

    if (!motoristaSelecionado) {
      showToast('Selecione um motorista para a rota', 'info');
      return;
    }

    // ⚠️ PROTEÇÃO: Prevenir múltiplos cliques
    if (isLoading) {
      console.log('⚠️ Já está processando, ignorando clique duplicado');
      return;
    }

    setIsLoading(true);
    try {
      // Data de hoje no formato ISO (YYYY-MM-DD)
      const dataHoje = new Date().toISOString().split('T')[0];

      const distanciaKm =
        rotaOtimizada?.distancia_total_metros != null
          ? Number((rotaOtimizada.distancia_total_metros / 1000).toFixed(2))
          : null;
      const tempoMin =
        rotaOtimizada?.duracao_total_segundos != null
          ? Math.round(rotaOtimizada.duracao_total_segundos / 60)
          : null;

      const rotaPayload: Record<string, any> = {
        unidade_id: userData!.unidade_id,
        motorista_id: motoristaSelecionado,
        status: 'pendente',
        data: dataHoje,
      };

      if (distanciaKm !== null) {
        rotaPayload.distancia_total = distanciaKm;
      }

      if (tempoMin !== null) {
        rotaPayload.tempo_total = tempoMin;
      }

      if (rotaOtimizada?.polyline) {
        rotaPayload.polyline = rotaOtimizada.polyline;
      }

      const { data: rotaData, error: rotaError } = await supabase
        .from('rotas')
        .insert(rotaPayload)
        .select()
        .single();

      if (rotaError) throw rotaError;

      // 2. Inserir paradas vinculadas à rota (incluindo unidade como início e fim)
      const paradasParaInserir = [];

      // Parada 0: Unidade (início da rota)
      if (enderecoUnidade) {
        // Para a primeira parada, usar o leg 0 para distância/tempo até a próxima
        const leg0 = rotaOtimizada?.legs?.[0];

        paradasParaInserir.push({
          rota_id: rotaData.id,
          tipo: 'retirada', // ponto de retirada inicial
          endereco: leg0?.endereco_inicio || enderecoUnidade.endereco,
          latitude: enderecoUnidade.latitude,
          longitude: enderecoUnidade.longitude,
          ordem: 0,
          destinatario: unidade?.nome || 'Base',
          telefone: null,
          observacoes: 'Ponto de partida',
          status: 'pendente',
        });
      }

      // Paradas 1 a N: Entregas/coletas do usuário
      paradas.forEach((p, index) => {
        // index = 0 corresponde ao leg 1 (base -> primeira entrega já foi usada acima)
        // Precisamos do leg para ir desta parada até a próxima
        const legIndex = index + 1; // leg 1 = da primeira entrega para a segunda
        const leg = rotaOtimizada?.legs?.[legIndex];

        paradasParaInserir.push({
          rota_id: rotaData.id,
          tipo: p.tipo,
          endereco: leg?.endereco_inicio || p.endereco,
          latitude: p.latitude!,
          longitude: p.longitude!,
          ordem: index + 1, // Começa do 1
          destinatario: p.destinatario,
          telefone: p.telefone,
          observacoes: p.observacoes,
          status: 'pendente',
        });
      });

      // Parada N+1: Unidade (fim da rota)
      if (enderecoUnidade) {
        // Última parada não tem "próxima parada", então distância/tempo são null
        const ultimoLegIndex = paradas.length; // leg que chega na última parada (volta para base)
        const ultimoLeg = rotaOtimizada?.legs?.[ultimoLegIndex];

        paradasParaInserir.push({
          rota_id: rotaData.id,
          tipo: 'entrega', // retorno à base
          endereco: ultimoLeg?.endereco_fim || enderecoUnidade.endereco,
          latitude: enderecoUnidade.latitude,
          longitude: enderecoUnidade.longitude,
          ordem: paradas.length + 1, // Última parada
          destinatario: unidade?.nome || 'Base',
          telefone: null,
          observacoes: 'Ponto de chegada',
          status: 'pendente',
        });
      }

      const { error: paradasError } = await supabase
        .from('paradas')
        .insert(paradasParaInserir);

      if (paradasError) {
        console.error('❌ Erro ao inserir paradas:', paradasError);
        throw paradasError;
      }

      // 3. Log da ação
      await supabase.from('logs').insert({
        usuario_id: userData!.id,
        rota_id: rotaData.id,
        evento: 'rota_criada',
        detalhes: {
          total_paradas: paradas.length,
          motorista_id: motoristaSelecionado,
        },
      });

      // Conta apenas entregas reais (não inclui base)
      const totalEntregas = paradas.length;
      showToast(
        `Rota circular criada com sucesso! ${totalEntregas} entrega(s) cadastrada(s).`,
        'success',
        4000
      );

      // Limpar formulário após sucesso
      setTimeout(() => limparFormulario(), 1000);
    } catch (error) {
      console.error('❌ Erro ao criar rota:', error);
      showToast('Não foi possível criar a rota. Tente novamente.', 'error', 5000);
    } finally {
      setIsLoading(false);
    }
  }

  function limparFormulario() {
    setParadas([]);
    setMotoristaSelecionado('');
    reset();
  }

  if (isLoadingMotoristas) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primaryDark} />
      </View>
    );
  }

  // ============================================
  // Componentes Reutilizáveis
  // ============================================

  // Lista de Paradas + Motorista + Gerar Rota (Right Panel no Desktop)
  const ParadasListAndActions = () => (
    <View style={styles.paradasColumn}>
      {/* Lista de Paradas */}
      {paradas.length > 0 ? (
        <View style={styles.paradasList}>
          <Text style={styles.sectionTitle}>
            Paradas Adicionadas ({paradas.length})
          </Text>
          {paradas.map((parada, index) => (
            <View key={index} style={styles.paradaCard}>
              <View style={styles.paradaHeader}>
                <Text style={styles.paradaTipo}>
                  {`${parada.ordem}. ${parada.tipo.toUpperCase()}`}
                </Text>
                <TouchableOpacity onPress={() => removeParada(index)}>
                  <Text style={styles.removeButton}>Remover</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.paradaEndereco}>{parada.endereco}</Text>
              {parada.destinatario && (
                <Text style={styles.paradaDetail}>
                  Destinatário: {parada.destinatario}
                </Text>
              )}
            </View>
          ))}

          {/* Botão Otimizar Rota */}
          {paradas.length >= 1 && (
            <TouchableOpacity
              style={styles.otimizarButton}
              onPress={otimizarRota}
              disabled={isOptimizing || !enderecoUnidade}
            >
              {isOptimizing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.otimizarButtonText}>
                  🗺️ Otimizar Rota (Melhor Percurso)
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* Banner de Rota Otimizada */}
          {rotaOtimizada && (
            <View style={styles.otimizacaoBanner}>
              <Text style={styles.otimizacaoBannerTitle}>✅ Rota Otimizada!</Text>
              <View style={styles.otimizacaoStats}>
                <View style={styles.otimizacaoStat}>
                  <Text style={styles.otimizacaoStatLabel}>Distância:</Text>
                  <Text style={styles.otimizacaoStatValue}>
                    {(rotaOtimizada.distancia_total_metros / 1000).toFixed(1)} km
                  </Text>
                </View>
                <View style={styles.otimizacaoStat}>
                  <Text style={styles.otimizacaoStatLabel}>Tempo Estimado:</Text>
                  <Text style={styles.otimizacaoStatValue}>
                    {Math.round(rotaOtimizada.duracao_total_segundos / 60)} min
                  </Text>
                </View>
              </View>
              <Text style={styles.otimizacaoBannerHint}>
                Rota circular otimizada: {enderecoUnidade?.endereco || 'Unidade'} → Paradas → {enderecoUnidade?.endereco || 'Unidade'}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.emptyParadasState}>
          <Text style={styles.emptyParadasIcon}>📦</Text>
          <Text style={styles.emptyParadasTitle}>Nenhuma parada adicionada</Text>
          <Text style={styles.emptyParadasText}>
            Adicione paradas ao formulário ao lado para começar a criar sua rota de entrega
          </Text>
        </View>
      )}

      {/* Seleção de Motorista */}
      {paradas.length > 0 && (
          <View style={styles.motoristaSection}>
            <Text style={styles.sectionTitle}>Selecionar Motorista</Text>
            {motoristas.length === 0 ? (
              <Text style={styles.noMotoristas}>
                Nenhum motorista disponível nesta unidade
              </Text>
            ) : (
              motoristas.map((motorista) => (
                <TouchableOpacity
                  key={motorista.id}
                  style={[
                    styles.motoristaCard,
                    motoristaSelecionado === motorista.id &&
                      styles.motoristaCardActive,
                  ]}
                  onPress={() => setMotoristaSelecionado(motorista.id)}
                >
                  <Text style={styles.motoristaNome}>{motorista.nome}</Text>
                  <Text style={styles.motoristaEmail}>{motorista.email}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

      {/* Botão Gerar Rota */}
      {paradas.length > 0 && (
        <TouchableOpacity
          style={[
            styles.gerarButton,
            (!motoristaSelecionado || isLoading) && styles.gerarButtonDisabled,
          ]}
          onPress={gerarRota}
          disabled={!motoristaSelecionado || isLoading}
        >
          {isLoading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color="#fff" />
              <Text style={[styles.gerarButtonText, { marginLeft: 10 }]}>Criando rota...</Text>
            </View>
          ) : (
            <Text style={styles.gerarButtonText}>✅ Gerar Rota</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  // ============================================
  // Render Principal
  // ============================================

  // Desktop Layout
  if (isDesktop) {
    return (
      <>
        <DesktopPageLayout
          title="Nova Rota de Entrega"
          subtitle={userData?.unidades?.nome || 'Carregando...'}
          breadcrumbs={[
            { label: 'Dashboard', route: '/gestor' },
            { label: 'Nova Entrega' }
          ]}
          actions={[
            {
              label: 'Limpar Formulário',
              icon: 'refresh-outline',
              onPress: limparFormulario,
              variant: 'secondary',
              disabled: paradas.length === 0
            }
          ]}
          loading={isLoadingMotoristas}
          loadingText="Carregando dados..."
        >
          <View style={styles.twoColumnLayout}>
            {/* Formulário */}
            <View style={styles.formColumn}>
              <DesktopCard
                title="Adicionar Parada"
                icon="add-circle-outline"
                iconColor={theme.colors.primary}
                variant="outlined"
              >
                <FormularioParadaMemoized
                  control={control}
                  errors={errors}
                  setValue={setValue}
                  handleSubmit={handleSubmit}
                  onAddParada={onAddParada}
                  isLoading={isLoading}
                />
              </DesktopCard>
            </View>

            {/* Lista de Paradas e Ações */}
            <View style={styles.previewColumn}>
              <DesktopCard
                title="Paradas Adicionadas"
                subtitle={`${paradas.length} parada(s) na lista`}
                icon="list-outline"
                iconColor={theme.colors.secondary}
                variant="elevated"
              >
                <ParadasListAndActions />
              </DesktopCard>
            </View>
          </View>
        </DesktopPageLayout>

        {/* Toast de Feedback */}
        <Toast {...toastState} onDismiss={hideToast} />
      </>
    );
  }

  // Mobile Layout (original)
  return (
    <>
      {/* Content */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <FormularioParadaMemoized
            control={control}
            errors={errors}
            setValue={setValue}
            handleSubmit={handleSubmit}
            onAddParada={onAddParada}
            isLoading={isLoading}
          />
          <ParadasListAndActions />
        </View>
      </ScrollView>

      {/* Toast de Feedback */}
      <Toast {...toastState} onDismiss={hideToast} />
    </>
  );
}

// Helper para criar styles (usado tanto no componente principal quanto no memoizado)
const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  header: {
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['2xl'],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: theme.typography['3xl'],
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.gray900,
  },
  headerSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  content: {
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['2xl'],
    maxWidth: theme.layout.containerMaxWidth,
    marginHorizontal: 'auto',
    width: '100%',
  },
  // Two-column layout (Desktop)
  twoColumnLayout: {
    flexDirection: 'row',
    gap: theme.spacing['2xl'],
    alignItems: 'flex-start',
  },
  formColumn: {
    flex: 1,
    minWidth: 0, // Permite flex shrink funcionar corretamente
  },
  previewColumn: {
    flex: 1,
    minWidth: 0,
  },
  form: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing['2xl'],
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing['2xl'],
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  sectionTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing['2xl'],
  },
  radioGroup: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing['2xl'],
  },
  radioButton: {
    flex: 1,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    alignItems: 'center',
  },
  radioButtonActive: {
    backgroundColor: theme.colors.primaryDark,
    borderColor: theme.colors.primaryDark,
  },
  radioText: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  radioTextActive: {
    color: theme.colors.white,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    fontSize: theme.typography.base,
    marginBottom: theme.spacing['2xl'],
    backgroundColor: theme.colors.white,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.xs,
    marginTop: -theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  addButton: {
    backgroundColor: theme.colors.secondary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  addButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  paradasList: {
    marginBottom: theme.spacing['2xl'],
  },
  paradaCard: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primaryDark,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  paradaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  paradaTipo: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primaryDark,
  },
  removeButton: {
    color: theme.colors.error,
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  paradaEndereco: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  paradaDetail: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
  },
  motoristaSection: {
    marginBottom: theme.spacing['2xl'],
  },
  noMotoristas: {
    color: theme.colors.gray500,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: theme.spacing['2xl'],
    fontSize: theme.typography.sm,
  },
  motoristaCard: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.gray200,
  },
  motoristaCardActive: {
    borderColor: theme.colors.primaryDark,
    backgroundColor: theme.colors.primaryLight,
  },
  motoristaNome: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  motoristaEmail: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginTop: theme.spacing.sm,
  },
  gerarButton: {
    backgroundColor: theme.colors.success,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  gerarButtonDisabled: {
    backgroundColor: theme.colors.gray400,
    opacity: 0.5,
  },
  gerarButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  otimizarButton: {
    backgroundColor: theme.colors.info,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  otimizarButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  otimizacaoBanner: {
    backgroundColor: theme.colors.success + '10',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.success,
    borderWidth: 1,
    borderColor: theme.colors.success + '30',
    padding: theme.spacing['2xl'],
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.lg,
  },
  otimizacaoBannerTitle: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.success,
    marginBottom: theme.spacing.lg,
  },
  otimizacaoStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.lg,
  },
  otimizacaoStat: {
    alignItems: 'center',
  },
  otimizacaoStatLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.success,
    marginBottom: theme.spacing.sm,
  },
  otimizacaoStatValue: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.success,
  },
  otimizacaoBannerHint: {
    fontSize: theme.typography.xs,
    color: theme.colors.success,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  paradasColumn: {
    flex: 1,
  },
  emptyParadasState: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing['3xl'],
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
  },
  emptyParadasIcon: {
    fontSize: 64,
    marginBottom: theme.spacing['2xl'],
  },
  emptyParadasTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  emptyParadasText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 20,
  },
});
