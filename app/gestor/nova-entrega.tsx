import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { useForm, Controller, Control, FieldErrors, UseFormWatch } from 'react-hook-form';
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
import { DesktopCard } from '@/components/desktop/DesktopCard';
import { DesktopPageLayout } from '@/components/desktop/DesktopPageLayout';
import { Toast } from '@/components/Toast';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { googleMapsService } from '@/lib/google';
import {
  otimizarRotaComDependencias,
  ParadaParaOtimizar,
} from '@/lib/routeOptimization';
import { supabase } from '@/lib/supabase';
import { GoogleDirectionsLeg } from '@/types/google-directions';
import { maskPhone } from '@/utils/phoneValidation';
import { StyleSheet, useUnistyles } from '@/utils/styles';

// Função para gerar ID único
function generateUniqueId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Schema de validação
const paradaSchema = z.object({
  endereco: z
    .string()
    .min(5, 'Endereço deve ter no mínimo 5 caracteres'),
  tipo: z.enum(['entrega', 'retirada']),
  destinatario: z
    .string()
    .min(3, 'Nome do destinatário deve ter no mínimo 3 caracteres'),
  telefone: z
    .string()
    .min(1, 'Telefone de contato é obrigatório')
    .refine((val) => val.replace(/\D/g, '').length >= 10, {
      message: 'Telefone deve ter no mínimo 10 dígitos',
    }),
  observacoes: z.string().optional(),
});

type ParadaFormData = z.infer<typeof paradaSchema>;

interface Parada extends ParadaFormData {
  id: string; // ID temporário para vincular antes de salvar
  latitude?: number;
  longitude?: number;
  ordem: number;
  /** ID da retirada que deve ser feita antes (apenas para entregas) */
  vinculo_parada_id?: string;
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
  watch: UseFormWatch<ParadaFormData>;
  onAddParada: (data: ParadaFormData, vinculoId?: string) => void;
  isLoading: boolean;
  retiradasDisponiveis: Parada[];
  vinculoSelecionado: string;
  setVinculoSelecionado: (id: string) => void;
}

const FormularioParadaMemoized = memo(function FormularioParada({
  control,
  errors,
  setValue,
  handleSubmit,
  watch,
  onAddParada,
  isLoading,
  retiradasDisponiveis,
  vinculoSelecionado,
  setVinculoSelecionado,
}: FormularioParadaProps) {
  const { theme } = useUnistyles();
  const styles = createStyles(theme);
  // Usar watch para observar o valor real do campo tipo
  const tipoAtual = watch('tipo');

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
              onPress={() => {
                onChange('retirada');
                setVinculoSelecionado(''); // Limpa vínculo se mudar para retirada
              }}
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

      {/* Seletor de Vínculo - aparece apenas para entregas quando há retiradas disponíveis */}
      {tipoAtual === 'entrega' && retiradasDisponiveis.length > 0 && (
        <View style={styles.vinculoSection}>
          <Text style={styles.vinculoLabel}>
            Vincular a uma retirada? (equipamento locado)
          </Text>
          <Text style={styles.vinculoHint}>
            Se esta entrega usa equipamento que será retirado de outro cliente, selecione a retirada correspondente
          </Text>
          <View style={styles.vinculoOptions}>
            <TouchableOpacity
              style={[
                styles.vinculoOption,
                !vinculoSelecionado && styles.vinculoOptionActive,
              ]}
              onPress={() => setVinculoSelecionado('')}
            >
              <Text
                style={[
                  styles.vinculoOptionText,
                  !vinculoSelecionado && styles.vinculoOptionTextActive,
                ]}
              >
                Sem vínculo
              </Text>
            </TouchableOpacity>
            {retiradasDisponiveis.map((retirada) => (
              <TouchableOpacity
                key={retirada.id}
                style={[
                  styles.vinculoOption,
                  vinculoSelecionado === retirada.id && styles.vinculoOptionActive,
                ]}
                onPress={() => setVinculoSelecionado(retirada.id)}
              >
                <Text
                  style={[
                    styles.vinculoOptionText,
                    vinculoSelecionado === retirada.id && styles.vinculoOptionTextActive,
                  ]}
                  numberOfLines={2}
                >
                  {retirada.destinatario || retirada.endereco.substring(0, 30)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

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
            placeholder="Digite o endereço completo"
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
              placeholder="Nome do destinatário"
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
              placeholder="Telefone de contato"
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
        onPress={handleSubmit((data: ParadaFormData) => {
          onAddParada(data, vinculoSelecionado || undefined);
          setVinculoSelecionado(''); // Limpa seleção após adicionar
        })}
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
  const { unidadeAtiva, unidadeAtivaData } = useUnidadeAtiva();
  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
  });
  const { toast: toastState, showToast, hideToast } = useToast();
  const { isDesktop } = useResponsive();
  const pageMeta = getGestorPageMeta('novaRota');
  const unidadeDisplayName = unidade?.nome || userData?.unidades?.nome || '';
  const pageSubtitle = unidadeDisplayName || pageMeta.subtitle || 'Carregando...';
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [motoristaSelecionado, setMotoristaSelecionado] = useState<string>('');
  const [vinculoSelecionado, setVinculoSelecionado] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMotoristas, setIsLoadingMotoristas] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [rotaOtimizada, setRotaOtimizada] = useState<RotaOtimizadaState | null>(null);
  const [ordemManual, setOrdemManual] = useState(false); // Rastreia se ordem foi alterada manualmente
  const [distanciaManualReal, setDistanciaManualReal] = useState<{
    metros: number;
    segundos: number;
  } | null>(null); // Distância real calculada via API após alteração manual
  const [isCalculandoReal, setIsCalculandoReal] = useState(false); // Loading do cálculo real
  const [enderecoUnidade, setEnderecoUnidade] = useState<{
    latitude: number;
    longitude: number;
    endereco: string;
  } | null>(null);

  // Lista de retiradas disponíveis para vincular
  const retiradasDisponiveis = useMemo(
    () => paradas.filter((p) => p.tipo === 'retirada'),
    [paradas]
  );

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
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
    if (!unidadeAtiva) {
      setIsLoadingMotoristas(false);
      return;
    }

    try {
      setIsLoadingMotoristas(true);
      // Buscar motoristas vinculados à unidade ativa via usuario_unidades
      const { data: vinculacoesData, error: vinculacoesError } = await supabase
        .from('usuario_unidades')
        .select(`
          usuario_id,
          usuarios (id, nome, email, ativo)
        `)
        .eq('unidade_id', unidadeAtiva)
        .eq('papel', 'motorista')
        .eq('ativo', true);

      if (vinculacoesError) throw vinculacoesError;

      // Extrair usuários ativos
      const motoristasData = vinculacoesData
        ?.map((v) => v.usuarios)
        .filter((u): u is NonNullable<typeof u> => u !== null && u.ativo)
        .sort((a, b) => a.nome.localeCompare(b.nome));

      setMotoristas(motoristasData || []);
    } catch (error) {
      console.error('Erro ao carregar motoristas:', error);
      showToast('Não foi possível carregar os motoristas', 'error');
    } finally {
      setIsLoadingMotoristas(false);
    }
  }, [showToast, unidadeAtiva]);

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
  async function onAddParada(paradaData: ParadaFormData, vinculoId?: string) {
    setIsLoading(true);
    try {
      // Coordenadas podem ter sido adicionadas pelo autocomplete via setValue
      const extendedData = paradaData as ParadaFormData & { latitude?: number; longitude?: number };

      // Se não tem coordenadas, tentar geocodificar manualmente
      if (!extendedData.latitude || !extendedData.longitude) {
        const result = await googleMapsService.geocodeAddress(paradaData.endereco);

        if (!result) {
          showToast('Não foi possível localizar o endereço. Use o autocomplete para selecionar um endereço válido.', 'error');
          return;
        }

        extendedData.latitude = result.coordenadas.latitude;
        extendedData.longitude = result.coordenadas.longitude;
      }

      const novaParada: Parada = {
        ...extendedData,
        id: generateUniqueId(), // ID temporário para vinculação
        latitude: extendedData.latitude,
        longitude: extendedData.longitude,
        ordem: paradas.length + 1,
        vinculo_parada_id: vinculoId, // Vínculo com retirada (se houver)
      };

      setParadas([...paradas, novaParada]);
      reset();

      // Mensagem de sucesso diferente se houver vínculo
      if (vinculoId) {
        const retiradaVinculada = paradas.find((p) => p.id === vinculoId);
        showToast(
          `Entrega vinculada! A retirada em "${retiradaVinculada?.destinatario || 'cliente'}" será feita primeiro.`,
          'success',
          4000
        );
      } else {
        showToast('Parada adicionada à lista!', 'success');
      }
    } catch (error) {
      console.error('Erro ao adicionar parada:', error);
      showToast('Não foi possível adicionar a parada', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  // Remover parada da lista
  function removeParada(index: number) {
    const paradaRemovida = paradas[index];
    let novasParadas = paradas.filter((_, i) => i !== index);

    // Se removeu uma retirada, limpar vínculos das entregas que dependiam dela
    if (paradaRemovida.tipo === 'retirada') {
      novasParadas = novasParadas.map((p) => {
        if (p.vinculo_parada_id === paradaRemovida.id) {
          return { ...p, vinculo_parada_id: undefined };
        }
        return p;
      });
    }

    // Reordenar
    const reordenadas = novasParadas.map((p, i) => ({ ...p, ordem: i + 1 }));
    setParadas(reordenadas);
    setRotaOtimizada(null); // Limpar otimização ao remover parada
  }

  // Mover parada para cima (trocar com a anterior)
  function moveParadaUp(index: number) {
    if (index <= 0) return; // Já está no topo

    const novasParadas = [...paradas];
    // Trocar posições
    [novasParadas[index - 1], novasParadas[index]] = [novasParadas[index], novasParadas[index - 1]];

    // Atualizar ordem
    const reordenadas = novasParadas.map((p, i) => ({ ...p, ordem: i + 1 }));
    setParadas(reordenadas);

    // Marcar como ordem manual (diferente da otimizada)
    if (rotaOtimizada) {
      setOrdemManual(true);
      setDistanciaManualReal(null); // Resetar distância real ao alterar ordem
    }
  }

  // Mover parada para baixo (trocar com a próxima)
  function moveParadaDown(index: number) {
    if (index >= paradas.length - 1) return; // Já está no final

    const novasParadas = [...paradas];
    // Trocar posições
    [novasParadas[index], novasParadas[index + 1]] = [novasParadas[index + 1], novasParadas[index]];

    // Atualizar ordem
    const reordenadas = novasParadas.map((p, i) => ({ ...p, ordem: i + 1 }));
    setParadas(reordenadas);

    // Marcar como ordem manual (diferente da otimizada)
    if (rotaOtimizada) {
      setOrdemManual(true);
      setDistanciaManualReal(null); // Resetar distância real ao alterar ordem
    }
  }

  // Calcular distância total da rota atual usando Haversine (linha reta - aproximado)
  // Rota circular: Unidade → Parada 1 → Parada 2 → ... → Unidade
  const calcularDistanciaAproximada = useCallback(() => {
    if (!enderecoUnidade || paradas.length === 0) return 0;

    let distanciaTotal = 0;
    let pontoAnterior = { latitude: enderecoUnidade.latitude, longitude: enderecoUnidade.longitude };

    // Percorrer todas as paradas na ordem atual
    for (const parada of paradas) {
      if (parada.latitude && parada.longitude) {
        // Calcular distância do ponto anterior até esta parada
        const distancia = distanceInMeters(
          { ...parada, latitude: parada.latitude, longitude: parada.longitude } as Parada,
          pontoAnterior
        );
        if (distancia !== Number.POSITIVE_INFINITY) {
          distanciaTotal += distancia;
        }
        pontoAnterior = { latitude: parada.latitude, longitude: parada.longitude };
      }
    }

    // Adicionar retorno à unidade (última parada → unidade)
    const distanciaRetorno = distanceInMeters(
      { latitude: enderecoUnidade.latitude, longitude: enderecoUnidade.longitude } as unknown as Parada,
      pontoAnterior
    );
    if (distanciaRetorno !== Number.POSITIVE_INFINITY) {
      distanciaTotal += distanciaRetorno;
    }

    return distanciaTotal;
  }, [enderecoUnidade, paradas]);

  // Calcular distância real via Google Directions API (considera ruas)
  // Usa chamadas segmentadas para garantir que a ordem manual seja respeitada
  // (Google API ignora optimize:false em rotas circulares)
  async function calcularDistanciaReal() {
    console.log('🚨 calcularDistanciaReal() INICIADA');

    if (!enderecoUnidade || paradas.length === 0) return;

    setIsCalculandoReal(true);
    try {
      const pontoUnidade = {
        latitude: enderecoUnidade.latitude,
        longitude: enderecoUnidade.longitude,
      };

      // Criar waypoints na ordem atual das paradas
      const waypoints = paradas
        .filter((p) => p.latitude && p.longitude)
        .map((p) => ({
          latitude: p.latitude!,
          longitude: p.longitude!,
        }));

      // Log ordem das paradas sendo enviadas
      console.log('📍 calcularDistanciaReal - Ordem das paradas:');
      paradas.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.destinatario || p.endereco.substring(0, 30)} (ordem: ${p.ordem})`);
      });

      // Usar método sequencial para garantir que a ordem seja respeitada
      // (Cada segmento é calculado separadamente: unidade→p1, p1→p2, ..., pN→unidade)
      console.log('🚨 CHAMANDO API SEQUENCIAL (garante ordem manual)');
      const resultado = await googleMapsService.getDirectionsSequential(
        pontoUnidade,
        pontoUnidade, // Rota circular: destino = origem
        waypoints
      );
      console.log('🚨 RESULTADO RECEBIDO:', resultado ? 'OK' : 'NULL');

      if (resultado) {
        console.log('📍 Resultado da API SEQUENCIAL:', {
          distancia: (resultado.distancia_total_metros / 1000).toFixed(1) + ' km',
          duracao: Math.round(resultado.duracao_total_segundos / 60) + ' min',
          segmentos: resultado.legs.length,
        });
        setDistanciaManualReal({
          metros: resultado.distancia_total_metros,
          segundos: resultado.duracao_total_segundos,
        });
        showToast('Distância real calculada!', 'success');
      } else {
        showToast('Não foi possível calcular a distância real', 'error');
      }
    } catch (error) {
      console.error('Erro ao calcular distância real:', error);
      showToast('Erro ao calcular distância', 'error');
    } finally {
      setIsCalculandoReal(false);
    }
  }

  // Calcular distância aproximada quando ordem manual é detectada
  const distanciaManualAproximada = useMemo(() => {
    if (!ordemManual || !rotaOtimizada) return null;
    const distanciaMetros = calcularDistanciaAproximada();
    // Fator de correção: Haversine subestima ~20-30% em áreas urbanas
    const distanciaCorrigida = distanciaMetros * 1.3; // Fator de 1.3 para aproximar da realidade
    return {
      metros: distanciaCorrigida,
      diferenca: distanciaCorrigida - rotaOtimizada.distancia_total_metros,
      percentual: ((distanciaCorrigida - rotaOtimizada.distancia_total_metros) / rotaOtimizada.distancia_total_metros) * 100,
    };
  }, [ordemManual, rotaOtimizada, calcularDistanciaAproximada]);

  // Otimizar rota usando Google Directions API (com suporte a dependências)
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

      // Verificar se há vínculos (dependências entre paradas)
      const temVinculos = paradas.some((p) => p.vinculo_parada_id);

      console.log('🗺️ Otimizando rota circular da unidade:', {
        unidade: enderecoUnidade.endereco,
        paradas: paradas.length,
        temVinculos,
      });

      if (temVinculos) {
        // Usar otimização com dependências
        const paradasParaOtimizar: ParadaParaOtimizar[] = paradas.map((p) => ({
          id: p.id,
          tipo: p.tipo,
          endereco: p.endereco,
          latitude: p.latitude!,
          longitude: p.longitude!,
          ordem: p.ordem,
          destinatario: p.destinatario,
          telefone: p.telefone,
          observacoes: p.observacoes,
          vinculo_parada_id: p.vinculo_parada_id,
        }));

        const resultado = await otimizarRotaComDependencias(
          pontoUnidade,
          paradasParaOtimizar,
          pontoUnidade // Rota circular
        );

        if (!resultado) {
          showToast('Não foi possível otimizar a rota', 'error');
          return;
        }

        // Atualizar paradas com a ordem otimizada
        const paradasAtualizadas = resultado.paradasOrdenadas.map((pOtimizada, i) => {
          const paradaOriginal = paradas.find((p) => p.id === pOtimizada.id)!;
          return {
            ...paradaOriginal,
            ordem: i + 1,
          };
        });

        setParadas(paradasAtualizadas);
        setRotaOtimizada({
          distancia_total_metros: resultado.distanciaTotalMetros,
          duracao_total_segundos: resultado.duracaoTotalSegundos,
          legs: [], // Não temos legs detalhados neste modo
          polyline: resultado.polyline,
        });
        setOrdemManual(false); // Resetar flag de ordem manual

        showToast(
          `Rota otimizada com dependências! ${(resultado.distanciaTotalMetros / 1000).toFixed(1)} km - ${Math.round(resultado.duracaoTotalSegundos / 60)} min`,
          'success',
          4000
        );
      } else {
        // Otimização simples (sem dependências)
        const waypoints = paradas.map((p) => ({
          latitude: p.latitude!,
          longitude: p.longitude!,
        }));

        const resultado = await googleMapsService.getDirections(
          pontoUnidade,
          pontoUnidade,
          waypoints
        );

        if (!resultado) {
          showToast('Não foi possível otimizar a rota', 'error');
          return;
        }

        const ordemOtimizada = resultado.ordem_otimizada || [];
        const paradasReordenadas = ordenarParadasPorRota(paradas, ordemOtimizada, resultado.legs);

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
        setOrdemManual(false); // Resetar flag de ordem manual

        showToast(
          `Rota otimizada! ${(resultado.distancia_total_metros / 1000).toFixed(1)} km - ${Math.round(resultado.duracao_total_segundos / 60)} min`,
          'success',
          4000
        );
      }
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
      // Data de hoje no formato ISO (YYYY-MM-DD) usando horário local
      const hoje = new Date();
      const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

      const distanciaKm =
        rotaOtimizada?.distancia_total_metros != null
          ? Number((rotaOtimizada.distancia_total_metros / 1000).toFixed(2))
          : null;
      const tempoMin =
        rotaOtimizada?.duracao_total_segundos != null
          ? Math.round(rotaOtimizada.duracao_total_segundos / 60)
          : null;

      const rotaPayload: Record<string, any> = {
        unidade_id: unidadeAtiva,
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
          is_checkpoint: false,
        });
      }

      // Paradas 1 a N: Entregas/coletas do usuário
      // Manter referência do temp_id para mapear vínculos depois
      const tempIdToIndex: Record<string, number> = {};

      paradas.forEach((p, index) => {
        // index = 0 corresponde ao leg 1 (base -> primeira entrega já foi usada acima)
        // Precisamos do leg para ir desta parada até a próxima
        const legIndex = index + 1; // leg 1 = da primeira entrega para a segunda
        const leg = rotaOtimizada?.legs?.[legIndex];

        // Guardar índice (considerando a parada 0 da unidade)
        tempIdToIndex[p.id] = paradasParaInserir.length;

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
          // Guardar temp_id para mapear vínculos (será removido antes de salvar)
          _temp_id: p.id,
          _temp_vinculo_id: p.vinculo_parada_id,
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
          is_checkpoint: false,
        });
      }

      // Verificar se há vínculos a serem mapeados
      const temVinculos = paradasParaInserir.some((p: any) => p._temp_vinculo_id);

      // Preparar paradas para inserção (sem campos temporários)
      const paradasLimpas = paradasParaInserir.map((p: any) => {
        const { _temp_id, _temp_vinculo_id, ...paradaLimpa } = p;
        return paradaLimpa;
      });

      // Inserir todas as paradas e obter IDs
      const { data: paradasInseridas, error: paradasError } = await supabase
        .from('paradas')
        .insert(paradasLimpas)
        .select('id, ordem');

      if (paradasError) {
        console.error('❌ Erro ao inserir paradas:', paradasError);
        throw paradasError;
      }

      // Se há vínculos, atualizar as paradas com os IDs corretos
      if (temVinculos && paradasInseridas) {
        // Criar mapa de temp_id para real_id
        const tempIdToRealId: Record<string, string> = {};
        paradasParaInserir.forEach((p: any, index: number) => {
          if (p._temp_id && paradasInseridas[index]) {
            tempIdToRealId[p._temp_id] = paradasInseridas[index].id;
          }
        });

        // Atualizar paradas que têm vínculos
        const updatePromises = paradasParaInserir
          .map((p: any, index: number) => {
            if (p._temp_vinculo_id && tempIdToRealId[p._temp_vinculo_id]) {
              const realVinculoId = tempIdToRealId[p._temp_vinculo_id];
              const realParadaId = paradasInseridas[index]?.id;

              if (realParadaId) {
                return supabase
                  .from('paradas')
                  .update({ vinculo_parada_id: realVinculoId })
                  .eq('id', realParadaId);
              }
            }
            return null;
          })
          .filter(Boolean);

        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
          console.log(`✅ ${updatePromises.length} vínculo(s) de paradas atualizado(s)`);
        }
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
    setRotaOtimizada(null);
    setOrdemManual(false);
    setDistanciaManualReal(null);
    reset();
  }

  if (isLoadingMotoristas) {
    return (
      <>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primaryDark} />
        </View>
        {logoutModal}
      </>
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
          {paradas.map((parada, index) => {
            // Encontrar a retirada vinculada (se houver)
            const retiradaVinculada = parada.vinculo_parada_id
              ? paradas.find((p) => p.id === parada.vinculo_parada_id)
              : null;

            return (
              <View
                key={parada.id || index}
                style={[
                  styles.paradaCard,
                  parada.vinculo_parada_id && styles.paradaCardVinculada,
                ]}
              >
                <View style={styles.paradaCardContent}>
                  {/* Botões de reordenação (setas) */}
                  {paradas.length > 1 && (
                    <View style={styles.reorderButtons}>
                      <TouchableOpacity
                        style={[
                          styles.reorderButton,
                          index === 0 && styles.reorderButtonDisabled,
                        ]}
                        onPress={() => moveParadaUp(index)}
                        disabled={index === 0}
                      >
                        <Ionicons
                          name="chevron-up"
                          size={18}
                          color={index === 0 ? theme.colors.gray300 : theme.colors.gray600}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.reorderButton,
                          index === paradas.length - 1 && styles.reorderButtonDisabled,
                        ]}
                        onPress={() => moveParadaDown(index)}
                        disabled={index === paradas.length - 1}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color={index === paradas.length - 1 ? theme.colors.gray300 : theme.colors.gray600}
                        />
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Conteúdo do card */}
                  <View style={styles.paradaInfo}>
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
                        Destinatario: {parada.destinatario}
                      </Text>
                    )}
                    {/* Mostrar vínculo com retirada */}
                    {retiradaVinculada && (
                      <View style={styles.vinculoBadge}>
                        <Text style={styles.vinculoBadgeText}>
                          Depende de: Retirada em {retiradaVinculada.destinatario || retiradaVinculada.endereco.substring(0, 25)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}

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

          {/* Banner de Ordem Manual com Comparativo */}
          {ordemManual && rotaOtimizada && (
            <View style={styles.ordemManualBanner}>
              {/* Cabeçalho do Banner */}
              <View style={styles.ordemManualHeader}>
                <View style={styles.ordemManualTitleRow}>
                  <Ionicons name="swap-vertical" size={20} color={theme.colors.warning} />
                  <Text style={styles.ordemManualTitle}>Ordem alterada manualmente</Text>
                </View>
                <TouchableOpacity
                  style={styles.reotimizarButton}
                  onPress={otimizarRota}
                  disabled={isOptimizing}
                >
                  {isOptimizing ? (
                    <ActivityIndicator size="small" color={theme.colors.white} />
                  ) : (
                    <>
                      <Ionicons name="refresh" size={14} color={theme.colors.white} />
                      <Text style={styles.reotimizarButtonText}>Re-otimizar</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Comparativo de Distâncias */}
              <View style={styles.comparativoContainer}>
                {/* Rota Otimizada (Original) */}
                <View style={styles.comparativoItem}>
                  <View style={styles.comparativoLabelRow}>
                    <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                    <Text style={styles.comparativoLabel}>Rota Otimizada:</Text>
                  </View>
                  <Text style={styles.comparativoValueSuccess}>
                    {(rotaOtimizada.distancia_total_metros / 1000).toFixed(1)} km
                  </Text>
                  <Text style={styles.comparativoTime}>
                    ~{Math.round(rotaOtimizada.duracao_total_segundos / 60)} min
                  </Text>
                </View>

                {/* Separador */}
                <View style={styles.comparativoSeparator}>
                  <Ionicons name="arrow-forward" size={16} color={theme.colors.gray400} />
                </View>

                {/* Ordem Atual */}
                <View style={styles.comparativoItem}>
                  <View style={styles.comparativoLabelRow}>
                    <Ionicons name="navigate" size={16} color={theme.colors.warning} />
                    <Text style={styles.comparativoLabel}>Ordem Atual:</Text>
                  </View>
                  {distanciaManualReal ? (
                    <>
                      <Text style={[
                        styles.comparativoValue,
                        distanciaManualReal.metros > rotaOtimizada.distancia_total_metros && styles.comparativoValueWarning,
                      ]}>
                        {(distanciaManualReal.metros / 1000).toFixed(1)} km
                      </Text>
                      <Text style={styles.comparativoTime}>
                        ~{Math.round(distanciaManualReal.segundos / 60)} min
                      </Text>
                    </>
                  ) : distanciaManualAproximada ? (
                    <>
                      <Text style={[
                        styles.comparativoValue,
                        distanciaManualAproximada.diferenca > 0 && styles.comparativoValueWarning,
                      ]}>
                        ~{(distanciaManualAproximada.metros / 1000).toFixed(1)} km*
                      </Text>
                      <Text style={styles.comparativoAproximado}>*aproximado</Text>
                    </>
                  ) : (
                    <Text style={styles.comparativoValue}>--</Text>
                  )}
                </View>

                {/* Diferença */}
                <View style={styles.comparativoItem}>
                  <Text style={styles.comparativoLabel}>Diferença:</Text>
                  {distanciaManualReal ? (
                    <Text style={[
                      styles.comparativoDiferenca,
                      distanciaManualReal.metros > rotaOtimizada.distancia_total_metros
                        ? styles.comparativoDiferencaNegativa
                        : styles.comparativoDiferencaPositiva,
                    ]}>
                      {distanciaManualReal.metros > rotaOtimizada.distancia_total_metros ? '+' : ''}
                      {((distanciaManualReal.metros - rotaOtimizada.distancia_total_metros) / 1000).toFixed(1)} km
                      {' '}
                      ({distanciaManualReal.metros > rotaOtimizada.distancia_total_metros ? '+' : ''}
                      {(((distanciaManualReal.metros - rotaOtimizada.distancia_total_metros) / rotaOtimizada.distancia_total_metros) * 100).toFixed(0)}%)
                    </Text>
                  ) : distanciaManualAproximada ? (
                    <Text style={[
                      styles.comparativoDiferenca,
                      distanciaManualAproximada.diferenca > 0
                        ? styles.comparativoDiferencaNegativa
                        : styles.comparativoDiferencaPositiva,
                    ]}>
                      {distanciaManualAproximada.diferenca > 0 ? '+' : ''}
                      {(distanciaManualAproximada.diferenca / 1000).toFixed(1)} km*
                      {' '}
                      ({distanciaManualAproximada.percentual > 0 ? '+' : ''}
                      {distanciaManualAproximada.percentual.toFixed(0)}%)
                    </Text>
                  ) : (
                    <Text style={styles.comparativoDiferenca}>--</Text>
                  )}
                </View>
              </View>

              {/* Botão Calcular Distância Real */}
              {!distanciaManualReal && (
                <TouchableOpacity
                  style={styles.calcularRealButton}
                  onPress={calcularDistanciaReal}
                  disabled={isCalculandoReal}
                >
                  {isCalculandoReal ? (
                    <ActivityIndicator size="small" color={theme.colors.info} />
                  ) : (
                    <>
                      <Ionicons name="navigate-circle-outline" size={18} color={theme.colors.info} />
                      <Text style={styles.calcularRealButtonText}>Calcular distância real</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.emptyParadasState}>
          <View style={styles.emptyParadasIconContainer}>
            <Ionicons name="cube-outline" size={48} color={theme.colors.gray400} />
          </View>
          <Text style={styles.emptyParadasTitle}>Nenhuma parada adicionada</Text>
          <Text style={styles.emptyParadasText}>
            {isDesktop
              ? 'Adicione paradas ao formulário ao lado para começar a criar sua rota de entrega'
              : 'Adicione paradas usando o formulário acima para criar sua rota de entrega'}
          </Text>
          {isDesktop && (
            <View style={styles.emptyParadasCta}>
              <Ionicons name="arrow-back" size={16} color={theme.colors.secondary} />
              <Text style={styles.emptyParadasCtaText}>
                Preencha o formulário à esquerda
              </Text>
            </View>
          )}
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
              motoristas.map((motorista) => {
                const isSelecionado = motoristaSelecionado === motorista.id;

                return (
                  <TouchableOpacity
                    key={motorista.id}
                    style={[
                      styles.motoristaCard,
                      isSelecionado && styles.motoristaCardActive,
                    ]}
                    onPress={() => setMotoristaSelecionado(motorista.id)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.motoristaNome,
                        isSelecionado && styles.motoristaNomeActive,
                      ]}
                    >
                      {motorista.nome}
                    </Text>
                    <Text
                      style={[
                        styles.motoristaEmail,
                        isSelecionado && styles.motoristaEmailActive,
                      ]}
                    >
                      {motorista.email}
                    </Text>
                  </TouchableOpacity>
                );
              })
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
          title={pageMeta.title}
          subtitle={pageSubtitle}
          breadcrumbs={pageMeta.breadcrumbs}
          userMenuTrigger={userMenuTrigger}
          userMenuItems={userMenuItems}
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
                  watch={watch}
                  onAddParada={onAddParada}
                  isLoading={isLoading}
                  retiradasDisponiveis={retiradasDisponiveis}
                  vinculoSelecionado={vinculoSelecionado}
                  setVinculoSelecionado={setVinculoSelecionado}
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
                actions={
                  <TouchableOpacity
                    style={[
                      styles.clearCardButton,
                      paradas.length === 0 && styles.clearCardButtonDisabled,
                    ]}
                    onPress={limparFormulario}
                    disabled={paradas.length === 0}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={18}
                      color={theme.colors.primary}
                    />
                    <Text style={styles.clearCardButtonText}>Limpar formulário</Text>
                  </TouchableOpacity>
                }
              >
                <ParadasListAndActions />
              </DesktopCard>
            </View>
          </View>
        </DesktopPageLayout>

        {/* Toast de Feedback */}
        <Toast {...toastState} onDismiss={hideToast} />
        {logoutModal}
        {logoutModal}
      </>
    );
  }

  // Mobile Layout (original)

  const renderMainContent = () => (
    <View style={styles.content}>
      <FormularioParadaMemoized
        control={control}
        errors={errors}
        setValue={setValue}
        handleSubmit={handleSubmit}
        watch={watch}
        onAddParada={onAddParada}
        isLoading={isLoading}
        retiradasDisponiveis={retiradasDisponiveis}
        vinculoSelecionado={vinculoSelecionado}
        setVinculoSelecionado={setVinculoSelecionado}
      />
      <ParadasListAndActions />
    </View>
  );

  return (
    <>
      <ScrollView style={styles.scrollView}>
        {renderMainContent()}
      </ScrollView>
      <Toast {...toastState} onDismiss={hideToast} />
      {logoutModal}
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
  clearCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.white,
  },
  clearCardButtonDisabled: {
    opacity: 0.5,
  },
  clearCardButtonText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
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
  paradaCardVinculada: {
    borderLeftColor: theme.colors.info,
    backgroundColor: theme.colors.info + '08',
  },
  vinculoBadge: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.info + '15',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.info,
  },
  vinculoBadgeText: {
    fontSize: theme.typography.xs,
    color: theme.colors.info,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  vinculoSection: {
    marginBottom: theme.spacing['2xl'],
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.info + '08',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.info + '30',
  },
  vinculoLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  vinculoHint: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.lg,
    lineHeight: 16,
  },
  vinculoOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  vinculoOption: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    backgroundColor: theme.colors.white,
    minWidth: 100,
  },
  vinculoOptionActive: {
    borderColor: theme.colors.info,
    backgroundColor: theme.colors.info + '15',
  },
  vinculoOptionText: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray700,
    textAlign: 'center',
  },
  vinculoOptionTextActive: {
    color: theme.colors.info,
    fontFamily: theme.typography.fontSansSemiBold,
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
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  motoristaCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryBg,
    shadowColor: theme.colors.primaryDark,
    shadowOpacity: 0.15,
    elevation: 4,
  },
  motoristaNome: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  motoristaNomeActive: {
    color: theme.colors.primaryDark,
  },
  motoristaEmail: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginTop: theme.spacing.sm,
  },
  motoristaEmailActive: {
    color: theme.colors.primary,
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
  emptyParadasIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: theme.spacing.xl,
  },
  emptyParadasCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    backgroundColor: theme.colors.secondary + '15',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.secondary + '30',
  },
  emptyParadasCtaText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.secondary,
  },
  // Estilos para reordenação de paradas
  paradaCardContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: theme.spacing.md,
  },
  reorderButtons: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingRight: theme.spacing.sm,
    borderRightWidth: 1,
    borderRightColor: theme.colors.gray200,
  },
  reorderButton: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderButtonDisabled: {
    backgroundColor: theme.colors.gray50,
    opacity: 0.5,
  },
  paradaInfo: {
    flex: 1,
  },
  // Banner de ordem manual com comparativo
  ordemManualBanner: {
    backgroundColor: theme.colors.warning + '10',
    borderWidth: 1,
    borderColor: theme.colors.warning + '40',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  ordemManualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  ordemManualTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  ordemManualTitle: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.warning,
  },
  reotimizarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.warning,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  reotimizarButtonText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
  // Comparativo de distâncias
  comparativoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  comparativoItem: {
    flex: 1,
    alignItems: 'center',
  },
  comparativoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  comparativoLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray600,
    fontFamily: theme.typography.fontSansMedium,
  },
  comparativoValue: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  comparativoValueSuccess: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.success,
  },
  comparativoValueWarning: {
    color: theme.colors.warning,
  },
  comparativoTime: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
  },
  comparativoAproximado: {
    fontSize: 10,
    color: theme.colors.gray400,
    fontStyle: 'italic',
  },
  comparativoSeparator: {
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.xl,
  },
  comparativoDiferenca: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray700,
    textAlign: 'center',
  },
  comparativoDiferencaNegativa: {
    color: theme.colors.error,
  },
  comparativoDiferencaPositiva: {
    color: theme.colors.success,
  },
  // Botão calcular distância real
  calcularRealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.info + '15',
    borderWidth: 1,
    borderColor: theme.colors.info + '40',
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  calcularRealButtonText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.info,
  },
});
