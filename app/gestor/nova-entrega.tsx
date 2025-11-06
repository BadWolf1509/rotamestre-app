import { useState, useEffect, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { maskPhone, validatePhone, getPhoneErrorMessage } from '@/utils/phoneValidation';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useForm, Controller, Control, FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { googleMapsService } from '@/lib/google';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { useBreakpoint } from '@/hooks/useBreakpoint';

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
  const { toast: toastState, showToast, hideToast, withToast } = useToast();
  const { isDesktop, isLargeDesktop } = useBreakpoint();
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [motoristaSelecionado, setMotoristaSelecionado] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMotoristas, setIsLoadingMotoristas] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [rotaOtimizada, setRotaOtimizada] = useState<{
    distancia: number;
    tempo: number;
  } | null>(null);
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

  // Carregar motoristas da unidade
  useEffect(() => {
    loadMotoristas();
  }, [userData]);

  // Carregar endereço da unidade ao montar
  useEffect(() => {
    if (unidade?.endereco) {
      loadEnderecoUnidade();
    }
  }, [unidade]);

  async function loadEnderecoUnidade() {
    if (!unidade?.endereco) {
      console.warn('Unidade sem endereço cadastrado');
      return;
    }

    try {
      const result = await googleMapsService.geocodeAddress(unidade.endereco);
      if (result?.coordenadas) {
        setEnderecoUnidade({
          latitude: result.coordenadas.latitude,
          longitude: result.coordenadas.longitude,
          endereco: unidade.endereco,
        });
        console.log('✅ Endereço da unidade geocodificado:', unidade.endereco);
      } else {
        console.error('❌ Não foi possível geocodificar o endereço da unidade');
        showToast('Endereço da unidade não encontrado. Verifique o cadastro da unidade.', 'error');
      }
    } catch (error) {
      console.error('Erro ao geocodificar endereço da unidade:', error);
    }
  }

  async function loadMotoristas() {
    if (!userData?.unidade_id) return;

    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, email')
        .eq('papel', 'motorista')
        .eq('unidade_id', userData.unidade_id)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setMotoristas(data || []);
    } catch (error) {
      console.error('Erro ao carregar motoristas:', error);
      showToast('Não foi possível carregar os motoristas', 'error');
    } finally {
      setIsLoadingMotoristas(false);
    }
  }

  // Adicionar parada à lista (coordenadas já obtidas pelo autocomplete)
  async function onAddParada(data: ParadaFormData) {
    setIsLoading(true);
    try {
      // Se não tem coordenadas, tentar geocodificar manualmente
      if (!data.latitude || !data.longitude) {
        const result = await googleMapsService.geocodeAddress(data.endereco);

        if (!result) {
          showToast('Não foi possível localizar o endereço. Use o autocomplete para selecionar um endereço válido.', 'error');
          return;
        }

        data.latitude = result.coordenadas.latitude;
        data.longitude = result.coordenadas.longitude;
      }

      const novaParada: Parada = {
        ...data,
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
      const paradasReordenadas: Parada[] = [];

      // Adicionar paradas na ordem otimizada
      ordemOtimizada.forEach((indice: number) => {
        paradasReordenadas.push(paradas[indice]);
      });

      // Se não houver ordem otimizada (1 parada apenas), manter ordem original
      if (paradasReordenadas.length === 0) {
        paradasReordenadas.push(...paradas);
      }

      // Atualizar ordem das paradas
      const paradasComNovaOrdem = paradasReordenadas.map((p, i) => ({
        ...p,
        ordem: i + 1,
      }));

      setParadas(paradasComNovaOrdem);
      setRotaOtimizada({
        distancia: resultado.distancia / 1000, // Converter metros para km
        tempo: resultado.tempo / 60, // Converter segundos para minutos
      });

      showToast(
        `Rota otimizada! ${(resultado.distancia / 1000).toFixed(1)} km - ${Math.round(resultado.tempo / 60)} min`,
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

    console.log('✅ Validações OK, iniciando criação de rota...');
    setIsLoading(true);
    try {
      // 1. Criar rota
      const { data: rotaData, error: rotaError } = await supabase
        .from('rotas')
        .insert({
          unidade_id: userData!.unidade_id,
          motorista_id: motoristaSelecionado,
          status: 'pendente',
          distancia_total: rotaOtimizada?.distancia || null,
        })
        .select()
        .single();

      if (rotaError) throw rotaError;

      console.log('✅ Rota criada:', rotaData);

      // 2. Inserir paradas vinculadas à rota (incluindo unidade como início e fim)
      const paradasParaInserir = [];

      // Parada 0: Unidade (início da rota)
      if (enderecoUnidade) {
        paradasParaInserir.push({
          rota_id: rotaData.id,
          tipo: 'retirada', // Usando 'retirada' pois é onde o motorista retira os pacotes
          endereco: enderecoUnidade.endereco,
          latitude: enderecoUnidade.latitude,
          longitude: enderecoUnidade.longitude,
          ordem: 0,
          destinatario: unidade?.nome || 'Base',
          telefone: null,
          observacoes: 'Ponto de partida',
          status: 'pendente',
          is_checkpoint: false, // Base não conta como entrega
        });
      }

      // Paradas 1 a N: Entregas/coletas do usuário
      paradas.forEach((p, index) => {
        paradasParaInserir.push({
          rota_id: rotaData.id,
          tipo: p.tipo,
          endereco: p.endereco,
          latitude: p.latitude!,
          longitude: p.longitude!,
          ordem: index + 1, // Começa do 1
          destinatario: p.destinatario,
          telefone: p.telefone,
          observacoes: p.observacoes,
          status: 'pendente',
          is_checkpoint: true, // Entregas reais contam como checkpoint
        });
      });

      // Parada N+1: Unidade (fim da rota)
      if (enderecoUnidade) {
        paradasParaInserir.push({
          rota_id: rotaData.id,
          tipo: 'entrega', // Usando 'entrega' pois é o retorno à base
          endereco: enderecoUnidade.endereco,
          latitude: enderecoUnidade.latitude,
          longitude: enderecoUnidade.longitude,
          ordem: paradas.length + 1, // Última parada
          destinatario: unidade?.nome || 'Base',
          telefone: null,
          observacoes: 'Ponto de chegada',
          status: 'pendente',
          is_checkpoint: false, // Base não conta como entrega
        });
      }

      // Debug: Log das paradas que serão inseridas
      console.log('🔍 Paradas a serem inseridas:', JSON.stringify(paradasParaInserir, null, 2));

      const { error: paradasError } = await supabase
        .from('paradas')
        .insert(paradasParaInserir);

      if (paradasError) {
        console.error('❌ Erro ao inserir paradas:', paradasError);
        throw paradasError;
      }

      console.log('✅ Paradas inseridas com sucesso (incluindo unidade como início e fim)');

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

      console.log('🎉 Rota completa criada com sucesso!');

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
                    {rotaOtimizada.distancia.toFixed(1)} km
                  </Text>
                </View>
                <View style={styles.otimizacaoStat}>
                  <Text style={styles.otimizacaoStatLabel}>Tempo Estimado:</Text>
                  <Text style={styles.otimizacaoStatValue}>
                    {Math.round(rotaOtimizada.tempo)} min
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
  return (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Nova Rota de Entrega</Text>
            <Text style={styles.headerSubtitle}>
              {userData?.unidades?.nome}
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Desktop: Two-column layout (Form | Preview) */}
          {isDesktop || isLargeDesktop ? (
            <View style={styles.twoColumnLayout}>
              <View style={styles.formColumn}>
                <FormularioParadaMemoized
                  control={control}
                  errors={errors}
                  setValue={setValue}
                  handleSubmit={handleSubmit}
                  onAddParada={onAddParada}
                  isLoading={isLoading}
                />
              </View>
              <View style={styles.previewColumn}>
                <ParadasListAndActions />
              </View>
            </View>
          ) : (
            /* Mobile/Tablet: Stacked layout */
            <>
              <FormularioParadaMemoized
                control={control}
                errors={errors}
                setValue={setValue}
                handleSubmit={handleSubmit}
                onAddParada={onAddParada}
                isLoading={isLoading}
              />
              <ParadasListAndActions />
            </>
          )}
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
