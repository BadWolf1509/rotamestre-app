import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { googleMapsService } from '@/lib/google';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { useResponsive } from '@/hooks/useResponsive';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';

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

export default function NovaEntrega() {
  const { userData, unidade } = useUser();
  const { isDesktop, isMobile, isTablet } = useResponsive();
  const { toast: toastState, showToast, hideToast, withToast } = useToast();
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
      Alert.alert('Erro', 'Não foi possível carregar os motoristas');
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
          Alert.alert(
            'Erro',
            'Não foi possível localizar o endereço. Use o autocomplete para selecionar um endereço válido.'
          );
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
    if (paradas.length < 2) {
      Alert.alert('Atenção', 'Adicione pelo menos 2 paradas para otimizar a rota');
      return;
    }

    setIsOptimizing(true);
    try {
      // Pegar primeira e última parada como origem e destino
      const origem = {
        latitude: paradas[0].latitude!,
        longitude: paradas[0].longitude!,
      };
      const destino = {
        latitude: paradas[paradas.length - 1].latitude!,
        longitude: paradas[paradas.length - 1].longitude!,
      };

      // Paradas intermediárias (waypoints)
      const waypoints = paradas.slice(1, -1).map((p) => ({
        latitude: p.latitude!,
        longitude: p.longitude!,
      }));

      // Chamar API Google Directions com optimize:true
      const resultado = await googleMapsService.getDirections(
        origem,
        destino,
        waypoints.length > 0 ? waypoints : undefined
      );

      if (!resultado) {
        Alert.alert('Erro', 'Não foi possível otimizar a rota');
        return;
      }

      // Reordenar paradas conforme ordem otimizada
      const ordemOtimizada = resultado.ordem_otimizada || [];
      const paradasReordenadas: Parada[] = [paradas[0]]; // Primeira parada fixa

      // Adicionar waypoints na ordem otimizada
      ordemOtimizada.forEach((indice: number) => {
        paradasReordenadas.push(paradas[indice + 1]);
      });

      // Adicionar última parada
      paradasReordenadas.push(paradas[paradas.length - 1]);

      // Atualizar ordem
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

      // 2. Inserir paradas vinculadas à rota
      const paradasParaInserir = paradas.map((p) => ({
        rota_id: rotaData.id,
        tipo: p.tipo,
        endereco: p.endereco,
        latitude: p.latitude!,
        longitude: p.longitude!,
        ordem: p.ordem,
        destinatario: p.destinatario,
        telefone: p.telefone,
        observacoes: p.observacoes,
        status: 'pendente',
      }));

      const { error: paradasError } = await supabase
        .from('paradas')
        .insert(paradasParaInserir);

      if (paradasError) throw paradasError;

      console.log('✅ Paradas inseridas com sucesso');

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

      showToast(
        `Rota criada com sucesso! ${paradas.length} parada(s) adicionadas.`,
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
        <ActivityIndicator size="large" color="#0D5A9C" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <ResponsiveContainer>
        <Text style={styles.title}>Nova Rota de Entrega</Text>

        {/* Layout Responsivo: 2 colunas em desktop, stack em mobile */}
        <View style={[styles.content, isDesktop && styles.contentDesktop]}>
          {/* Coluna Esquerda: Formulário de Parada */}
          <View style={[styles.form, isDesktop && styles.formDesktop]}>
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
                  // Atualizar campo de endereço
                  onChange(address);

                  // Obter detalhes do place (coordenadas)
                  const details = await googleMapsService.getPlaceDetails(placeId);
                  if (details) {
                    // Armazenar coordenadas temporariamente no form data
                    // Usando setValue para atualizar campos não visíveis
                    // @ts-ignore - adicionando campos extras ao form
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
                  onChangeText={onChange}
                  keyboardType="phone-pad"
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
              />
            )}
          />

          <TouchableOpacity
            style={styles.addButton}
            onPress={handleSubmit(onAddParada)}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.addButtonText}>+ Adicionar Parada</Text>
            )}
          </TouchableOpacity>
          </View>
          {/* Fim Coluna Esquerda: Formulário */}

          {/* Coluna Direita: Lista de Paradas + Motorista */}
          <View style={[styles.paradasColumn, isDesktop && styles.paradasColumnDesktop]}>
        {/* Lista de Paradas */}
        {paradas.length > 0 && (
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
            {paradas.length >= 2 && (
              <TouchableOpacity
                style={styles.otimizarButton}
                onPress={otimizarRota}
                disabled={isOptimizing}
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
                  As paradas foram reordenadas para o percurso mais eficiente
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.gerarButtonText}>Criando rota...</Text>
              </View>
            ) : (
              <Text style={styles.gerarButtonText}>✅ Gerar Rota</Text>
            )}
          </TouchableOpacity>
        )}
          </View>
          {/* Fim Coluna Direita */}
        </View>
        {/* Fim Layout 2 Colunas */}
      </ResponsiveContainer>

      {/* Toast de Feedback */}
      <Toast {...toastState} onDismiss={hideToast} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20,
  },
  form: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 15,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  radioButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  radioButtonActive: {
    backgroundColor: '#0D5A9C',
    borderColor: '#0D5A9C',
  },
  radioText: {
    color: '#6b7280',
    fontWeight: '500',
  },
  radioTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: '#FF8C00',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  paradasList: {
    marginBottom: 20,
  },
  paradaCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#0D5A9C',
  },
  paradaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paradaTipo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D5A9C',
  },
  removeButton: {
    color: '#ef4444',
    fontSize: 14,
  },
  paradaEndereco: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 4,
  },
  paradaDetail: {
    fontSize: 12,
    color: '#6b7280',
  },
  motoristaSection: {
    marginBottom: 20,
  },
  noMotoristas: {
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  motoristaCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  motoristaCardActive: {
    borderColor: '#0D5A9C',
    backgroundColor: '#eff6ff',
  },
  motoristaNome: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  motoristaEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  gerarButton: {
    backgroundColor: '#0D5A9C',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  gerarButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  gerarButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  otimizarButton: {
    backgroundColor: '#8b5cf6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
  },
  otimizarButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  otimizacaoBanner: {
    backgroundColor: '#d1fae5',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    padding: 16,
    borderRadius: 8,
    marginTop: 15,
  },
  otimizacaoBannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#065f46',
    marginBottom: 12,
  },
  otimizacaoStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  otimizacaoStat: {
    alignItems: 'center',
  },
  otimizacaoStatLabel: {
    fontSize: 12,
    color: '#047857',
    marginBottom: 4,
  },
  otimizacaoStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#065f46',
  },
  otimizacaoBannerHint: {
    fontSize: 12,
    color: '#047857',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // ============================================
  // Estilos Responsivos Desktop
  // ============================================
  contentDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 0,
  },
  formDesktop: {
    flex: 1,
    minWidth: 400,
    maxWidth: 500,
    marginRight: 24,
  },
  paradasColumn: {
    // Mobile: fullwidth
  },
  paradasColumnDesktop: {
    flex: 1,
    minWidth: 400,
  },
});
