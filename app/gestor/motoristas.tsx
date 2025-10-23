import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { toast } from '@/utils/toast';
import { validation, formatTelefone } from '@/utils/validation';

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
  const { userData } = useUser();
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
    setShowAddModal(true);
  }

  function abrirModalEditar(motorista: MotoristaDetalhado) {
    setMotoristaEditando(motorista);
    setFormNome(motorista.nome);
    setFormEmail(motorista.email);
    setFormTelefone(motorista.telefone || '');
    setShowEditModal(true);
  }

  async function adicionarMotorista() {
    if (!formNome.trim() || !formEmail.trim() || !formSenha.trim()) {
      Alert.alert('Erro', 'Preencha todos os campos obrigatórios');
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
    if (!formNome.trim() || !formEmail.trim()) {
      Alert.alert('Erro', 'Preencha todos os campos obrigatórios');
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

              Alert.alert(
                'Sucesso',
                `Motorista ${novoStatus ? 'ativado' : 'desativado'} com sucesso`
              );
              loadMotoristas();
            } catch (error: any) {
              console.error('Erro ao alterar status:', error);
              Alert.alert('Erro', 'Não foi possível alterar o status do motorista');
            }
          },
        },
      ]
    );
  }

  const renderAddModal = () => (
    <Modal
      visible={showAddModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowAddModal(false)}
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
            style={styles.input}
            placeholder="Digite o email"
            value={formEmail}
            onChangeText={setFormEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.inputLabel}>Telefone</Text>
          <TextInput
            style={styles.input}
            placeholder="(00) 00000-0000"
            value={formTelefone}
            onChangeText={setFormTelefone}
            keyboardType="phone-pad"
            placeholderTextColor="#9ca3af"
          />

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
      transparent
      animationType="slide"
      onRequestClose={() => setShowEditModal(false)}
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
            style={styles.input}
            placeholder="Digite o email"
            value={formEmail}
            onChangeText={setFormEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.inputLabel}>Telefone</Text>
          <TextInput
            style={styles.input}
            placeholder="(00) 00000-0000"
            value={formTelefone}
            onChangeText={setFormTelefone}
            keyboardType="phone-pad"
            placeholderTextColor="#9ca3af"
          />

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0D5A9C" />
        <Text style={styles.loadingText}>Carregando motoristas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Motoristas</Text>
            <Text style={styles.headerSubtitle}>
              {motoristas.length} {motoristas.length === 1 ? 'motorista' : 'motoristas'}{' '}
              cadastrados
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

      {/* Lista de Motoristas */}
      <FlatList
        data={motoristas}
        keyExtractor={(item) => item.id}
        renderItem={renderMotorista}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0D5A9C']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>👤</Text>
            <Text style={styles.emptyText}>Nenhum motorista cadastrado</Text>
            <Text style={styles.emptySubtext}>
              Adicione o primeiro motorista usando o botão acima
            </Text>
          </View>
        }
      />

      {/* Modals */}
      {renderAddModal()}
      {renderEditModal()}
    </View>
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
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  addButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  motoristaCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  motoristaEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  motoristaTelefone: {
    fontSize: 13,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeAtivo: {
    backgroundColor: '#d1fae5',
  },
  statusBadgeInativo: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0D5A9C',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
  },
  acoesContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  botaoEditar: {
    flex: 1,
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  botaoEditarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  botaoStatus: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  botaoDesativar: {
    backgroundColor: '#ef4444',
  },
  botaoAtivar: {
    backgroundColor: '#10b981',
  },
  botaoStatusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dataCadastro: {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: '#0D5A9C',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
