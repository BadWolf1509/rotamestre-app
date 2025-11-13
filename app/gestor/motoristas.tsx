import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';

import { ConfirmModal } from '@/components/ConfirmModal';
import { DataTable, DataTableAction, DataTableColumn } from '@/components/DataTable';
import { DesktopCard, DesktopModal, DesktopPageLayout } from '@/components/desktop';
import { Toast } from '@/components/Toast';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { maskPhone, validatePhone, getPhoneErrorMessage } from '@/utils/phoneValidation';
import { StyleSheet, useUnistyles } from '@/utils/styles';
import { toast } from '@/utils/toast';

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
  const { isDesktop } = useResponsive();
  const { toast: toastState, showToast, hideToast, withToast } = useToast();
  const [motoristas, setMotoristas] = useState<MotoristaDetalhado[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [motoristaEditando, setMotoristaEditando] = useState<MotoristaDetalhado | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [motoristaParaToggle, setMotoristaParaToggle] = useState<MotoristaDetalhado | null>(null);

  // Form state
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formSenha, setFormSenha] = useState('');

  // Validation errors
  const [emailError, setEmailError] = useState('');
  const [telefoneError, setTelefoneError] = useState('');

  const loadMotoristas = useCallback(async () => {
    if (!userData?.unidade_id) return;

    try {
      setLoading(true);

      const { data: motoristasData, error: motoristasError } = await supabase
        .from('usuarios')
        .select('id, nome, email, telefone, ativo, created_at')
        .eq('unidade_id', userData.unidade_id)
        .eq('papel', 'motorista')
        .order('nome');

      if (motoristasError) throw motoristasError;

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
      showToast('Não foi possível carregar os motoristas', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, userData?.unidade_id]);

  useEffect(() => {
    loadMotoristas();
  }, [loadMotoristas]);

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

  function handleTelefoneChange(text: string) {
    const formatted = maskPhone(text);
    setFormTelefone(formatted);

    if (text.length > 0) {
      const error = getPhoneErrorMessage(formatted);
      setTelefoneError(error || '');
    } else {
      setTelefoneError('');
    }
  }

  async function adicionarMotorista() {
    // Validar campos obrigatórios
    if (!formNome.trim() || !formEmail.trim() || !formSenha.trim()) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formEmail.trim())) {
      showToast('Digite um email válido', 'error');
      return;
    }

    // Validar telefone se preenchido
    if (formTelefone && !validatePhone(formTelefone)) {
      showToast('Telefone inválido', 'error');
      return;
    }

    setSalvando(true);
    try {
      console.log('🔄 Iniciando criação de motorista...');

      // Obter token de autenticação do gestor atual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('❌ Erro ao obter sessão:', sessionError);
        showToast(`Erro ao obter sessão: ${sessionError.message}. Faça logout e login novamente.`, 'error');
        return;
      }

      if (!session) {
        console.error('❌ Sessão não encontrada');
        showToast('Sua sessão expirou. Por favor, faça login novamente.', 'error');
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
        showToast(`Erro de conexão: ${fetchError.message}. Verifique se a função foi deployada.`, 'error');
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
        showToast('A Edge Function retornou uma resposta inválida. Função não deployada corretamente.', 'error');
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
      showToast('Motorista adicionado com sucesso!', 'success');
      setShowAddModal(false);
      loadMotoristas();
    } catch (error: any) {
      console.error('❌ Erro inesperado ao adicionar motorista:', error);
      showToast(error.message || 'Não foi possível adicionar o motorista', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function editarMotorista() {
    // Validar campos obrigatórios
    if (!formNome.trim() || !formEmail.trim()) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formEmail.trim())) {
      showToast('Digite um email válido', 'error');
      return;
    }

    // Validar telefone se preenchido
    if (formTelefone && !validatePhone(formTelefone)) {
      showToast('Telefone inválido', 'error');
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

      showToast('Motorista atualizado com sucesso!', 'success');
      setShowEditModal(false);
      setMotoristaEditando(null);
      loadMotoristas();
    } catch (error: any) {
      console.error('Erro ao editar motorista:', error);
      showToast(error.message || 'Não foi possível editar o motorista', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo(motorista: MotoristaDetalhado) {
    setMotoristaParaToggle(motorista);

    if (Platform.OS === 'web') {
      setShowConfirmModal(true);
    } else {
      const Alert = require('react-native').Alert;
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
            onPress: () => confirmarToggleAtivo(),
          },
        ]
      );
    }
  }

  async function confirmarToggleAtivo() {
    if (!motoristaParaToggle) return;

    const motorista = motoristaParaToggle;
    const novoStatus = !motorista.ativo;

    setShowConfirmModal(false);
    setMotoristaParaToggle(null);

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
  }

  function resetFormulario() {
    setFormNome('');
    setFormEmail('');
    setFormTelefone('');
    setFormSenha('');
    setEmailError('');
    setTelefoneError('');
  }

  const handleAdicionarMotorista = () => adicionarMotorista();
  const handleEditarMotorista = () => editarMotorista();

  const renderAddModalContent = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.modalContent}>
        {/* Nome */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Nome Completo</Text>
          <TextInput
            style={styles.input}
            value={formNome}
            onChangeText={setFormNome}
            placeholder="Digite o nome completo"
            autoCapitalize="words"
          />
        </View>

        {/* Email */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={[styles.input, emailError && styles.inputError]}
            value={formEmail}
            onChangeText={(text) => {
              setFormEmail(text.toLowerCase());
              setEmailError('');
            }}
            placeholder="email@exemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
        </View>

        {/* Telefone */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Telefone (opcional)</Text>
          <TextInput
            style={[styles.input, telefoneError && styles.inputError]}
            value={formTelefone}
            onChangeText={(text) => {
              const maskedPhone = maskPhone(text);
              setFormTelefone(maskedPhone);
              if (maskedPhone) {
                const validation = validatePhone(maskedPhone);
                setTelefoneError(validation.isValid ? '' : getPhoneErrorMessage(validation.error));
              } else {
                setTelefoneError('');
              }
            }}
            placeholder="(00) 00000-0000"
            keyboardType="phone-pad"
          />
          {telefoneError ? <Text style={styles.errorText}>{telefoneError}</Text> : null}
        </View>

        {/* Senha */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Senha Inicial</Text>
          <TextInput
            style={styles.input}
            value={formSenha}
            onChangeText={setFormSenha}
            placeholder="Mínimo 6 caracteres"
            secureTextEntry
            autoCapitalize="none"
          />
          <Text style={styles.helperText}>
            O motorista poderá alterar a senha no primeiro acesso
          </Text>
        </View>

        {/* Botões */}
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setShowAddModal(false);
              resetFormulario();
            }}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmButton, salvando && styles.disabledButton]}
            onPress={handleAdicionarMotorista}
            disabled={salvando}
          >
            {salvando ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={styles.confirmButtonText}>Adicionar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderEditModalContent = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.modalContent}>
        {/* Nome */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Nome Completo</Text>
          <TextInput
            style={styles.input}
            value={formNome}
            onChangeText={setFormNome}
            placeholder="Digite o nome completo"
            autoCapitalize="words"
          />
        </View>

        {/* Email - Não editável */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={motoristaEditando?.email}
            editable={false}
          />
          <Text style={styles.helperText}>
            Email não pode ser alterado
          </Text>
        </View>

        {/* Telefone */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Telefone (opcional)</Text>
          <TextInput
            style={[styles.input, telefoneError && styles.inputError]}
            value={formTelefone}
            onChangeText={(text) => {
              const maskedPhone = maskPhone(text);
              setFormTelefone(maskedPhone);
              if (maskedPhone) {
                const validation = validatePhone(maskedPhone);
                setTelefoneError(validation.isValid ? '' : getPhoneErrorMessage(validation.error));
              } else {
                setTelefoneError('');
              }
            }}
            placeholder="(00) 00000-0000"
            keyboardType="phone-pad"
          />
          {telefoneError ? <Text style={styles.errorText}>{telefoneError}</Text> : null}
        </View>

        {/* Botões */}
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setShowEditModal(false);
              setMotoristaEditando(null);
              resetFormulario();
            }}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmButton, salvando && styles.disabledButton]}
            onPress={handleEditarMotorista}
            disabled={salvando}
          >
            {salvando ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={styles.confirmButtonText}>Salvar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

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
        placeholderTextColor={theme.colors.gray400}
        accessibilityLabel="Campo de nome do motorista"
        accessibilityHint="Digite o nome completo do motorista"
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
        placeholderTextColor={theme.colors.gray400}
        accessibilityLabel="Campo de email do motorista"
        accessibilityHint="Digite o email do motorista"
      />
      {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

      <Text style={styles.inputLabel}>Telefone</Text>
      <TextInput
        style={[styles.input, telefoneError && styles.inputError]}
        placeholder="(00) 00000-0000"
        value={formTelefone}
        onChangeText={handleTelefoneChange}
        keyboardType="phone-pad"
        placeholderTextColor={theme.colors.gray400}
        maxLength={15}
        accessibilityLabel="Campo de telefone do motorista"
        accessibilityHint="Digite o telefone do motorista com DDD"
      />
      {telefoneError ? <Text style={styles.errorText}>{telefoneError}</Text> : null}

      <Text style={styles.inputLabel}>Senha *</Text>
      <TextInput
        style={styles.input}
        placeholder="Digite a senha inicial"
        value={formSenha}
        onChangeText={setFormSenha}
        secureTextEntry
        placeholderTextColor={theme.colors.gray400}
        accessibilityLabel="Campo de senha do motorista"
        accessibilityHint="Digite a senha inicial do motorista"
      />

      <View style={styles.modalActions}>
        <TouchableOpacity
          style={styles.modalButtonSecondary}
          onPress={() => setShowAddModal(false)}
          disabled={salvando}
          accessibilityLabel="Cancelar adição de motorista"
          accessibilityRole="button"
        >
          <Text style={styles.modalButtonSecondaryText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalButtonPrimary, salvando && styles.buttonDisabled]}
          onPress={adicionarMotorista}
          disabled={salvando}
          accessibilityLabel="Adicionar motorista"
          accessibilityRole="button"
          accessibilityState={{ disabled: salvando }}
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
        placeholderTextColor={theme.colors.gray400}
        accessibilityLabel="Campo de nome do motorista"
        accessibilityHint="Digite o nome completo do motorista"
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
        placeholderTextColor={theme.colors.gray400}
        accessibilityLabel="Campo de email do motorista"
        accessibilityHint="Digite o email do motorista"
      />
      {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

      <Text style={styles.inputLabel}>Telefone</Text>
      <TextInput
        style={[styles.input, telefoneError && styles.inputError]}
        placeholder="(00) 00000-0000"
        value={formTelefone}
        onChangeText={handleTelefoneChange}
        keyboardType="phone-pad"
        placeholderTextColor={theme.colors.gray400}
        maxLength={15}
        accessibilityLabel="Campo de telefone do motorista"
        accessibilityHint="Digite o telefone do motorista com DDD"
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
          accessibilityLabel="Cancelar edição de motorista"
          accessibilityRole="button"
        >
          <Text style={styles.modalButtonSecondaryText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalButtonPrimary, salvando && styles.buttonDisabled]}
          onPress={editarMotorista}
          disabled={salvando}
          accessibilityLabel="Salvar alterações do motorista"
          accessibilityRole="button"
          accessibilityState={{ disabled: salvando }}
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

  // Desktop Layout
  if (isDesktop) {
    return (
      <>
        <DesktopPageLayout
          title="Motoristas"
          subtitle={`${motoristas.length} ${motoristas.length === 1 ? 'motorista' : 'motoristas'} cadastrados`}
          actions={[
            {
              label: 'Adicionar Motorista',
              icon: 'add-circle-outline',
              onPress: abrirModalAdicionar,
              variant: 'primary'
            }
          ]}
          loading={loading}
          loadingText="Carregando motoristas..."
        >
          {motoristas.length === 0 ? (
            <DesktopCard variant="elevated">
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={64} color={theme.colors.gray400} />
                <Text style={styles.emptyText}>Nenhum motorista cadastrado</Text>
                <Text style={styles.emptySubtext}>
                  Adicione o primeiro motorista usando o botão acima
                </Text>
              </View>
            </DesktopCard>
          ) : (
            <DesktopCard
              title="Lista de Motoristas"
              icon="people"
              variant="elevated"
              noPadding
            >
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
            </DesktopCard>
          )}
        </DesktopPageLayout>

        {/* Modals usando DesktopModal */}
        <DesktopModal
          visible={showAddModal}
          title="Adicionar Motorista"
          onClose={() => {
            setShowAddModal(false);
            resetFormulario();
          }}
        >
          {renderAddModalContent()}
        </DesktopModal>

        <DesktopModal
          visible={showEditModal}
          title="Editar Motorista"
          onClose={() => {
            setShowEditModal(false);
            setMotoristaEditando(null);
            resetFormulario();
          }}
        >
          {renderEditModalContent()}
        </DesktopModal>

        {/* Modal de Confirmação */}
        <ConfirmModal
          visible={showConfirmModal}
          title={motoristaParaToggle?.ativo ? "Desativar Motorista" : "Ativar Motorista"}
          message={`Deseja realmente ${motoristaParaToggle?.ativo ? 'desativar' : 'ativar'} ${motoristaParaToggle?.nome}?`}
          confirmText="Confirmar"
          cancelText="Cancelar"
          type={motoristaParaToggle?.ativo ? "danger" : "success"}
          onConfirm={confirmarToggleAtivo}
          onCancel={() => {
            setShowConfirmModal(false);
            setMotoristaParaToggle(null);
          }}
        />

        <Toast {...toastState} onDismiss={hideToast} />
      </>
    );
  }

  // Mobile Layout (existing)
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
      {/* Content */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
        {/* Header com Info e Botão */}
        <View style={styles.topSection}>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              {motoristas.length} {motoristas.length === 1 ? 'motorista' : 'motoristas'} cadastrados
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addButtonMobile}
            onPress={abrirModalAdicionar}
            accessibilityLabel="Adicionar novo motorista"
            accessibilityRole="button"
            accessibilityHint="Abre o formulário para adicionar um novo motorista"
          >
            <Text style={styles.addButtonText}>+ Novo Motorista</Text>
          </TouchableOpacity>
        </View>

        {/* Lista/Tabela de Motoristas */}
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

      {/* Modal de Confirmação de Toggle Ativo/Inativo */}
      <ConfirmModal
        visible={showConfirmModal}
        title={motoristaParaToggle?.ativo ? "Desativar Motorista" : "Ativar Motorista"}
        message={`Deseja realmente ${motoristaParaToggle?.ativo ? 'desativar' : 'ativar'} ${motoristaParaToggle?.nome}?`}
        confirmText="Confirmar"
        cancelText="Cancelar"
        type={motoristaParaToggle?.ativo ? "danger" : "success"}
        onConfirm={confirmarToggleAtivo}
        onCancel={() => {
          setShowConfirmModal(false);
          setMotoristaParaToggle(null);
        }}
      />

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
  topSection: {
    marginBottom: theme.spacing.lg,
  },
  infoBox: {
    backgroundColor: theme.colors.info + '10',
    borderWidth: 1,
    borderColor: theme.colors.info + '30',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  infoText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.info,
    textAlign: 'center',
  },
  addButtonMobile: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
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
    borderColor: theme.colors.error,
    borderWidth: 2,
    backgroundColor: theme.colors.red50,
  },
  errorText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.error,
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
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  helperText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
  },
  inputDisabled: {
    backgroundColor: theme.colors.gray100,
    color: theme.colors.gray500,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing['2xl'],
  },
  cancelButton: {
    flex: 1,
    backgroundColor: theme.colors.gray100,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.gray700,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.white,
  },
  disabledButton: {
    opacity: 0.6,
  },
}));



