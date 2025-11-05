import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  ScrollView,
  Modal,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { toast } from '@/utils/toast';
import { validation, formatTelefone } from '@/utils/validation';
import { DataTable, DataTableColumn, DataTableAction } from '@/components/DataTable';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';

interface MotoristaDetalhado {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  ativo: boolean;
  created_at: string;
  rotas_stats?: {
    total: number;
    concluidas: number;
    em_andamento: number;
  };
}

export default function MotoristasGestor() {
  const { theme } = useUnistyles();
  const { userData } = useUser();
  const { toast: toastState, showToast, hideToast, withToast } = useToast();
  const [motoristas, setMotoristas] = useState<MotoristaDetalhado[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [motoristaEditando, setMotoristaEditando] = useState<MotoristaDetalhado | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Form state
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formSenha, setFormSenha] = useState('');

  // Validation errors
  const [emailError, setEmailError] = useState('');
  const [telefoneError, setTelefoneError] = useState('');

  useEffect(() => {
    if (userData?.unidade_id) {
      loadMotoristas();
    }
  }, [userData]);

  async function loadMotoristas() {
    try {
      setLoading(true);

      // Buscar motoristas da unidade
      const { data: motoristasData, error: motoristasError } = await supabase
        .from('usuarios')
        .select('id, nome, email, telefone, ativo, created_at')
        .eq('unidade_id', userData!.unidade_id)
        .eq('papel', 'motorista')
        .order('nome');

      if (motoristasError) throw motoristasError;

      // Para cada motorista, buscar estatísticas de rotas
      const motoristasComStats = await Promise.all(
        (motoristasData || []).map(async (motorista) => {
          const { data: rotasData, error: rotasError } = await supabase
            .from('rotas')
            .select('id, status')
            .eq('motorista_id', motorista.id);

          if (rotasError) {
            console.error('Erro ao buscar rotas do motorista:', rotasError);
            return {
              ...motorista,
              rotas_stats: { total: 0, concluidas: 0, em_andamento: 0 },
            };
          }

          return {
            ...motorista,
            rotas_stats: {
              total: rotasData?.length || 0,
              concluidas: rotasData?.filter((r) => r.status === 'concluida').length || 0,
              em_andamento:
                rotasData?.filter((r) => r.status === 'em_andamento').length || 0,
            },
          };
        })
      );

      setMotoristas(motoristasComStats as MotoristaDetalhado[]);
    } catch (error) {
      console.error('Erro ao carregar motoristas:', error);
      Alert.alert('Erro', 'Não foi possível carregar os motoristas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    loadMotoristas();
  }

  function abrirModalAdicionar() {
    setFormNome('');
    setFormEmail('');
    setFormTelefone('');
    setFormSenha('');
    setEmailError('');
    setTelefoneError('');
    setShowAddModal(true);
  }

  function abrirModalEditar(motorista: MotoristaDetalhado) {
    setMotoristaEditando(motorista);
    setFormNome(motorista.nome);
    setFormEmail(motorista.email);
    setFormTelefone(motorista.telefone || '');
    setEmailError('');
    setTelefoneError('');
    setShowEditModal(true);
  }

  // Validação em tempo real
  function validateEmail(email: string): boolean {
    setEmailError('');
    if (!email.trim()) return true; // Campo vazio é OK (validação obrigatória acontece no submit)

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setEmailError('Digite um email válido');
      return false;
    }
    return true;
  }

  function validateTelefone(telefone: string): boolean {
    setTelefoneError('');
    return true; // Apenas limpa erro, a formatação já limita os dígitos
  }

  function formatTelefoneInput(text: string): string {
    // Remove tudo que não é número
    const numeros = text.replace(/\D/g, '');

    // Limita a 11 dígitos
    const numerosLimitados = numeros.slice(0, 11);

    // Formata conforme o tamanho
    if (numerosLimitados.length <= 2) {
      return numerosLimitados;
    } else if (numerosLimitados.length <= 6) {
      // (00) 0000
      return `(${numerosLimitados.slice(0, 2)}) ${numerosLimitados.slice(2)}`;
    } else if (numerosLimitados.length <= 10) {
      // (00) 0000-0000
      return `(${numerosLimitados.slice(0, 2)}) ${numerosLimitados.slice(2, 6)}-${numerosLimitados.slice(6)}`;
    } else {
      // (00) 00000-0000
      return `(${numerosLimitados.slice(0, 2)}) ${numerosLimitados.slice(2, 7)}-${numerosLimitados.slice(7)}`;
    }
  }

  async function adicionarMotorista() {
    // Validar campos obrigatórios
    if (!formNome.trim() || !formEmail.trim() || !formSenha.trim()) {
      Alert.alert('Erro', 'Preencha todos os campos obrigatórios');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formEmail.trim())) {
      Alert.alert('Erro', 'Digite um email válido');
      return;
    }

    setSalvando(true);
    try {
      console.log('🔄 Iniciando criação de motorista...');

      // Obter token de autenticação do gestor atual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('❌ Erro ao obter sessão:', sessionError);
        Alert.alert(
          'Erro de Autenticação',
          `Erro ao obter sessão: ${sessionError.message}\n\nFaça logout e login novamente.`
        );
        return;
      }

      if (!session) {
        console.error('❌ Sessão não encontrada');
        Alert.alert(
          'Sessão Expirada',
          'Sua sessão expirou. Por favor, faça login novamente.'
        );
        return;
      }

      console.log('✅ Sessão obtida:', session.user.email);

      // Chamar Edge Function para criar motorista usando Admin API
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/criar-motorista`;

      console.log('🌐 Chamando Edge Function:', functionUrl);
      console.log('📋 Dados:', {
        nome: formNome.trim(),
        email: formEmail.trim(),
        telefone: formTelefone.trim() || null,
      });

      let response;
      try {
        response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            nome: formNome.trim(),
            email: formEmail.trim(),
            senha: formSenha.trim(),
            telefone: formTelefone.trim() || null,
          }),
        });
      } catch (fetchError: any) {
        console.error('❌ Erro de rede:', fetchError);
        Alert.alert(
          'Erro de Conexão',
          `Não foi possível conectar à Edge Function.\n\n` +
          `Erro: ${fetchError.message}\n\n` +
          `URL: ${functionUrl}\n\n` +
          `Verifique se a função foi deployada:\n` +
          `supabase functions deploy criar-motorista`
        );
        return;
      }

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', JSON.stringify(Object.fromEntries(response.headers)));

      let result;
      try {
        const responseText = await response.text();
        console.log('📄 Response text:', responseText);
        result = responseText ? JSON.parse(responseText) : {};
      } catch (parseError: any) {
        console.error('❌ Erro ao parsear resposta:', parseError);
        Alert.alert(
          'Erro na Resposta',
          `A Edge Function retornou uma resposta inválida.\n\n` +
          `Status: ${response.status}\n\n` +
          `Isso pode indicar que a função não foi deployada corretamente.`
        );
        return;
      }

      if (!response.ok) {
        console.error('❌ Resposta com erro:', result);
        toast.error(result.error || 'Erro desconhecido', 'Erro ao Criar Motorista');
        return;
      }

      console.log('✅ Motorista criado:', result);

      // Criar log
      console.log('📝 Criando log...');
      const { error: logError } = await supabase.from('logs').insert({
        usuario_id: userData!.id,
        evento: 'motorista_criado',
        detalhes: {
          motorista_nome: formNome.trim(),
          motorista_email: formEmail.trim(),
        },
      });

      if (logError) {
        console.error('⚠️ Erro ao criar log (não crítico):', logError);
      }

      console.log('✅ Processo concluído com sucesso!');
      Alert.alert('Sucesso', 'Motorista adicionado com sucesso!');
      setShowAddModal(false);
      loadMotoristas();
    } catch (error: any) {
      console.error('❌ Erro inesperado ao adicionar motorista:', error);
      Alert.alert(
        'Erro Inesperado',
        `${error.message || 'Não foi possível adicionar o motorista'}\n\n` +
        `Detalhes técnicos:\n${JSON.stringify(error, null, 2)}`
      );
    } finally {
      setSalvando(false);
    }
  }

  async function editarMotorista() {
    // Validar campos obrigatórios
    if (!formNome.trim() || !formEmail.trim()) {
      Alert.alert('Erro', 'Preencha todos os campos obrigatórios');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formEmail.trim())) {
      Alert.alert('Erro', 'Digite um email válido');
      return;
    }

    setSalvando(true);
    try {
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({
          nome: formNome.trim(),
          email: formEmail.trim(),
          telefone: formTelefone.trim() || null,
        })
        .eq('id', motoristaEditando!.id);

      if (updateError) throw updateError;

      // Criar log
      await supabase.from('logs').insert({
        usuario_id: userData!.id,
        evento: 'motorista_editado',
        detalhes: {
          motorista_id: motoristaEditando!.id,
          motorista_nome: formNome.trim(),
        },
      });

      Alert.alert('Sucesso', 'Motorista atualizado com sucesso!');
      setShowEditModal(false);
      setMotoristaEditando(null);
      loadMotoristas();
    } catch (error: any) {
      console.error('Erro ao editar motorista:', error);
      Alert.alert('Erro', error.message || 'Não foi possível editar o motorista');
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo(motorista: MotoristaDetalhado) {
    const novoStatus = !motorista.ativo;
    const acao = novoStatus ? 'ativar' : 'desativar';

    Alert.alert(
      `${novoStatus ? 'Ativar' : 'Desativar'} Motorista`,
      `Deseja realmente ${acao} ${motorista.nome}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: novoStatus ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await withToast(
                async () => {
                  const { error } = await supabase
                    .from('usuarios')
                    .update({ ativo: novoStatus })
                    .eq('id', motorista.id);

                  if (error) throw error;

                  // Criar log
                  await supabase.from('logs').insert({
                    usuario_id: userData!.id,
                    evento: novoStatus ? 'motorista_ativado' : 'motorista_desativado',
                    detalhes: {
                      motorista_id: motorista.id,
                      motorista_nome: motorista.nome,
                    },
                  });
                },
                {
                  loading: `${novoStatus ? 'Ativando' : 'Desativando'} motorista...`,
                  success: `Motorista ${novoStatus ? 'ativado' : 'desativado'} com sucesso!`,
                  error: 'Não foi possível alterar o status do motorista',
                }
              );
              loadMotoristas();
            } catch (error: any) {
              console.error('Erro ao alterar status:', error);
            }
          },
        },
      ]
    );
  }

  const renderAddModal = () => (
    <Modal
      visible={showAddModal}
      onRequestClose={() => setShowAddModal(false)}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Adicionar Motorista</Text>
      <Text style={styles.inputLabel}>Nome *</Text>
      <TextInput
        style={styles.input}
        placeholder="Digite o nome completo"
        value={formNome}
        onChangeText={setFormNome}
        placeholderTextColor="#9ca3af"
      />

      <Text style={styles.inputLabel}>Email *</Text>
      <TextInput
        style={[styles.input, emailError && styles.inputError]}
        placeholder="Digite o email"
        value={formEmail}
        onChangeText={(text) => {
          setFormEmail(text);
          validateEmail(text);
        }}
        onBlur={() => validateEmail(formEmail)}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor="#9ca3af"
      />
      {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

      <Text style={styles.inputLabel}>Telefone</Text>
      <TextInput
        style={[styles.input, telefoneError && styles.inputError]}
        placeholder="(00) 00000-0000"
        value={formTelefone}
        onChangeText={(text) => {
          const formatted = formatTelefoneInput(text);
          setFormTelefone(formatted);
          validateTelefone(formatted);
        }}
        keyboardType="phone-pad"
        placeholderTextColor="#9ca3af"
        maxLength={15}
      />
      {telefoneError ? <Text style={styles.errorText}>{telefoneError}</Text> : null}

      <Text style={styles.inputLabel}>Senha *</Text>
      <TextInput
        style={styles.input}
        placeholder="Digite a senha inicial"
        value={formSenha}
        onChangeText={setFormSenha}
        secureTextEntry
        placeholderTextColor="#9ca3af"
      />

      <View style={styles.modalActions}>
        <TouchableOpacity
          style={styles.modalButtonSecondary}
          onPress={() => setShowAddModal(false)}
          disabled={salvando}
        >
          <Text style={styles.modalButtonSecondaryText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalButtonPrimary, salvando && styles.buttonDisabled]}
          onPress={adicionarMotorista}
          disabled={salvando}
        >
          {salvando ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.modalButtonPrimaryText}>Adicionar</Text>
          )}
        </TouchableOpacity>
      </View>
        </View>
      </View>
    </Modal>
  );

  const renderEditModal = () => (
    <Modal
      visible={showEditModal}
      onRequestClose={() => {
        setShowEditModal(false);
        setMotoristaEditando(null);
      }}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Editar Motorista</Text>
      <Text style={styles.inputLabel}>Nome *</Text>
      <TextInput
        style={styles.input}
        placeholder="Digite o nome completo"
        value={formNome}
        onChangeText={setFormNome}
        placeholderTextColor="#9ca3af"
      />

      <Text style={styles.inputLabel}>Email *</Text>
      <TextInput
        style={[styles.input, emailError && styles.inputError]}
        placeholder="Digite o email"
        value={formEmail}
        onChangeText={(text) => {
          setFormEmail(text);
          validateEmail(text);
        }}
        onBlur={() => validateEmail(formEmail)}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor="#9ca3af"
      />
      {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

      <Text style={styles.inputLabel}>Telefone</Text>
      <TextInput
        style={[styles.input, telefoneError && styles.inputError]}
        placeholder="(00) 00000-0000"
        value={formTelefone}
        onChangeText={(text) => {
          const formatted = formatTelefoneInput(text);
          setFormTelefone(formatted);
          validateTelefone(formatted);
        }}
        keyboardType="phone-pad"
        placeholderTextColor="#9ca3af"
        maxLength={15}
      />
      {telefoneError ? <Text style={styles.errorText}>{telefoneError}</Text> : null}

      <View style={styles.modalActions}>
        <TouchableOpacity
          style={styles.modalButtonSecondary}
          onPress={() => {
            setShowEditModal(false);
            setMotoristaEditando(null);
          }}
          disabled={salvando}
        >
          <Text style={styles.modalButtonSecondaryText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalButtonPrimary, salvando && styles.buttonDisabled]}
          onPress={editarMotorista}
          disabled={salvando}
        >
          {salvando ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.modalButtonPrimaryText}>Salvar</Text>
          )}
        </TouchableOpacity>
      </View>
        </View>
      </View>
    </Modal>
  );

  const renderMotorista = ({ item }: { item: MotoristaDetalhado }) => (
    <View style={[styles.motoristaCard, !item.ativo && styles.motoristaCardInativo]}>
      {/* Header */}
      <View style={styles.motoristaHeader}>
        <View style={styles.motoristaHeaderLeft}>
          <Text style={styles.motoristaNome}>{item.nome}</Text>
          <Text style={styles.motoristaEmail}>{item.email}</Text>
          {item.telefone && (
            <Text style={styles.motoristaTelefone}>📞 {item.telefone}</Text>
          )}
        </View>
        <View
          style={[
            styles.statusBadge,
            item.ativo ? styles.statusBadgeAtivo : styles.statusBadgeInativo,
          ]}
        >
          <Text style={styles.statusBadgeText}>
            {item.ativo ? 'Ativo' : 'Inativo'}
          </Text>
        </View>
      </View>

      {/* Estatísticas */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.rotas_stats?.total || 0}</Text>
          <Text style={styles.statLabel}>Total de Rotas</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: '#10b981' }]}>
            {item.rotas_stats?.concluidas || 0}
          </Text>
          <Text style={styles.statLabel}>Concluídas</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: '#3b82f6' }]}>
            {item.rotas_stats?.em_andamento || 0}
          </Text>
          <Text style={styles.statLabel}>Em Andamento</Text>
        </View>
      </View>

      {/* Ações */}
      <View style={styles.acoesContainer}>
        <TouchableOpacity
          style={styles.botaoEditar}
          onPress={() => abrirModalEditar(item)}
        >
          <Text style={styles.botaoEditarText}>✏️ Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.botaoStatus,
            item.ativo ? styles.botaoDesativar : styles.botaoAtivar,
          ]}
          onPress={() => toggleAtivo(item)}
        >
          <Text style={styles.botaoStatusText}>
            {item.ativo ? '🚫 Desativar' : '✓ Ativar'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Data de Cadastro */}
      <Text style={styles.dataCadastro}>
        Cadastrado em{' '}
        {new Date(item.created_at).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}
      </Text>
    </View>
  );

  // ============================================
  // DATATABLE: Definir Colunas e Ações
  // ============================================

  const columns: DataTableColumn<MotoristaDetalhado>[] = [
    {
      key: 'nome',
      label: 'Nome',
      width: 180,
      sortable: true,
      render: (motorista) => motorista.nome,
    },
    {
      key: 'email',
      label: 'E-mail',
      width: 200,
      render: (motorista) => motorista.email,
    },
    {
      key: 'telefone',
      label: 'Telefone',
      width: 130,
      render: (motorista) => motorista.telefone || '-',
    },
    {
      key: 'rotas_total',
      label: 'Rotas',
      width: 80,
      align: 'center',
      sortable: true,
      render: (motorista) => motorista.rotas_stats?.total?.toString() || '0',
    },
    {
      key: 'rotas_concluidas',
      label: 'Concluídas',
      width: 100,
      align: 'center',
      render: (motorista) => motorista.rotas_stats?.concluidas?.toString() || '0',
    },
    {
      key: 'rotas_em_andamento',
      label: 'Em Andamento',
      width: 130,
      align: 'center',
      desktopOnly: true,
      render: (motorista) => motorista.rotas_stats?.em_andamento?.toString() || '0',
    },
    {
      key: 'created_at',
      label: 'Cadastrado em',
      width: 130,
      desktopOnly: true,
      render: (motorista) => new Date(motorista.created_at).toLocaleDateString('pt-BR'),
    },
    {
      key: 'ativo',
      label: 'Status',
      width: 90,
      render: (motorista) => (motorista.ativo ? '✅ Ativo' : '❌ Inativo'),
    },
  ];

  const actions: DataTableAction<MotoristaDetalhado>[] = [
    {
      label: 'Editar',
      icon: '✏️',
      type: 'primary',
      onPress: abrirModalEditar,
    },
    {
      label: (motorista) => (motorista.ativo ? 'Desativar' : 'Ativar'),
      icon: (motorista) => (motorista.ativo ? '🚫' : '✅'),
      type: 'secondary',
      onPress: toggleAtivo,
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primaryDark} />
        <Text style={styles.loadingText}>Carregando motoristas...</Text>
      </View>
    );
  }

  return (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Motoristas</Text>
            <Text style={styles.headerSubtitle}>
              {userData?.unidades?.nome}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={abrirModalAdicionar}
          >
            <Text style={styles.addButtonText}>+ Novo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {motoristas.length} {motoristas.length === 1 ? 'motorista' : 'motoristas'} cadastrados
          </Text>
        </View>
        {motoristas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>👤</Text>
            <Text style={styles.emptyText}>Nenhum motorista cadastrado</Text>
            <Text style={styles.emptySubtext}>
              Adicione o primeiro motorista usando o botão acima
            </Text>
          </View>
        ) : (
          <DataTable
            data={motoristas}
            columns={columns}
            actions={actions}
            keyExtractor={(item) => item.id}
            itemsPerPage={20}
            pagination
            isLoading={loading}
            skeletonRows={10}
          />
        )}
        </View>
      </ScrollView>

      {/* Modals */}
      {renderAddModal()}
      {renderEditModal()}

      {/* Toast de Feedback */}
      <Toast {...toastState} onDismiss={hideToast} />
    </>
  );
}

const styles = StyleSheet.create(theme => ({
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
  loadingText: {
    marginTop: theme.spacing.sm + 2,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
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
  infoBox: {
    backgroundColor: theme.colors.info + '10',
    borderWidth: 1,
    borderColor: theme.colors.info + '30',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing['2xl'],
  },
  infoText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.info,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  addButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  emptyContainer: {
    padding: theme.spacing['6xl'] - 4,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 64,
    marginBottom: theme.spacing.lg,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  motoristaCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  motoristaCardInativo: {
    opacity: 0.6,
  },
  motoristaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  motoristaHeaderLeft: {
    flex: 1,
  },
  motoristaNome: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  motoristaEmail: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.xs,
  },
  motoristaTelefone: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.gray500,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm - 2,
    borderRadius: theme.borderRadius.lg,
  },
  statusBadgeAtivo: {
    backgroundColor: theme.colors.successBg,
  },
  statusBadgeInativo: {
    backgroundColor: theme.colors.errorBg,
  },
  statusBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.sm,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.primaryDark,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  acoesContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  botaoEditar: {
    flex: 1,
    backgroundColor: theme.colors.info,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  botaoEditarText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
  },
  botaoStatus: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  botaoDesativar: {
    backgroundColor: theme.colors.error,
  },
  botaoAtivar: {
    backgroundColor: theme.colors.success,
  },
  botaoStatusText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
  },
  dataCadastro: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray400,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.gray700,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.colors.gray50,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray900,
  },
  inputError: {
    borderColor: '#ef4444',
    borderWidth: 2,
    backgroundColor: '#fef2f2',
  },
  errorText: {
    fontSize: theme.typography.fontSize.xs,
    color: '#ef4444',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing['2xl'],
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: theme.colors.gray100,
    padding: theme.spacing.sm + 6,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.gray700,
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: theme.colors.primaryDark,
    padding: theme.spacing.sm + 6,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing['2xl'],
    width: '100%',
    maxWidth: 600,
    minWidth: 400,
    maxHeight: '85vh',
    ...theme.shadows.lg,
  },
  modalTitle: {
    fontSize: theme.typography.xl,
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
}));
