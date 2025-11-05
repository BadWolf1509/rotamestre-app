import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';

interface UnidadeData {
  id: string;
  nome: string;
  cnpj: string;
  telefone: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
}

export default function UnidadeScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { userData, loading: userLoading } = useUser();
  const { toast: toastState, showToast, hideToast } = useToast();
  const [unidade, setUnidade] = useState<UnidadeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [membrosCount, setMembrosCount] = useState(0);

  // Form state
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [cep, setCep] = useState('');

  useEffect(() => {
    if (userData?.unidade_id) {
      loadUnidade();
      loadMembrosCount();
    }
  }, [userData]);

  async function loadUnidade() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('unidades')
        .select('*')
        .eq('id', userData!.unidade_id)
        .single();

      if (error) throw error;

      setUnidade(data);
      setNome(data.nome || '');
      setTelefone(data.telefone || '');
      setEndereco(data.endereco || '');
      setCidade(data.cidade || '');
      setEstado(data.estado || '');
      setCep(data.cep || '');
    } catch (error) {
      console.error('Erro ao carregar unidade:', error);
      showToast('Erro ao carregar dados da unidade', 'error', 4000);
    } finally {
      setLoading(false);
    }
  }

  async function loadMembrosCount() {
    try {
      const { count, error } = await supabase
        .from('usuarios')
        .select('*', { count: 'exact', head: true })
        .eq('unidade_id', userData!.unidade_id);

      if (error) throw error;
      setMembrosCount(count || 0);
    } catch (error) {
      console.error('Erro ao contar membros:', error);
    }
  }

  async function handleSave() {
    if (!nome.trim()) {
      Alert.alert('Erro', 'O nome da unidade é obrigatório');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('unidades')
        .update({
          nome: nome.trim(),
          telefone: telefone.trim(),
          endereco: endereco.trim(),
          cidade: cidade.trim(),
          estado: estado.trim(),
          cep: cep.trim(),
        })
        .eq('id', unidade!.id);

      if (error) throw error;

      showToast('Dados atualizados com sucesso!', 'success', 3000);
      setEditMode(false);
      await loadUnidade();
    } catch (error) {
      console.error('Erro ao atualizar unidade:', error);
      showToast('Erro ao atualizar dados', 'error', 4000);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setNome(unidade?.nome || '');
    setTelefone(unidade?.telefone || '');
    setEndereco(unidade?.endereco || '');
    setCidade(unidade?.cidade || '');
    setEstado(unidade?.estado || '');
    setCep(unidade?.cep || '');
    setEditMode(false);
  }

  if (userLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0D5A9C" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  const isGestorPrincipal = userData?.is_gestor_principal === true;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Minha Unidade</Text>
          {isGestorPrincipal && !editMode && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditMode(true)}
            >
              <Text style={styles.editButtonText}>✏️ Editar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.content}>
        {/* Badge Gestor Principal */}
        {isGestorPrincipal && (
          <View style={styles.principalBadge}>
            <Text style={styles.principalBadgeText}>⭐ Gestor Principal</Text>
          </View>
        )}

        {/* Info Cards */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Membros da Equipe</Text>
          <Text style={styles.infoValue}>{membrosCount}</Text>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push('/unidade/equipe')}
          >
            <Text style={styles.linkButtonText}>Ver equipe →</Text>
          </TouchableOpacity>
        </View>

        {/* Dados da Unidade */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações da Unidade</Text>

          {/* Nome */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nome da Unidade</Text>
            <TextInput
              style={[styles.input, !editMode && styles.inputDisabled]}
              value={nome}
              onChangeText={setNome}
              editable={editMode}
              placeholder="Nome da unidade"
            />
          </View>

          {/* CNPJ (sempre bloqueado) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>CNPJ</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={unidade?.cnpj || ''}
              editable={false}
              placeholder="Não informado"
            />
            <Text style={styles.helperText}>
              O CNPJ não pode ser alterado. Entre em contato com o suporte.
            </Text>
          </View>

          {/* Telefone */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Telefone</Text>
            <TextInput
              style={[styles.input, !editMode && styles.inputDisabled]}
              value={telefone}
              onChangeText={setTelefone}
              editable={editMode}
              placeholder="(00) 00000-0000"
              keyboardType="phone-pad"
            />
          </View>

          {/* Endereço */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Endereço</Text>
            <TextInput
              style={[styles.input, !editMode && styles.inputDisabled]}
              value={endereco}
              onChangeText={setEndereco}
              editable={editMode}
              placeholder="Rua, número, complemento"
            />
          </View>

          {/* Cidade e Estado */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.flex2]}>
              <Text style={styles.inputLabel}>Cidade</Text>
              <TextInput
                style={[styles.input, !editMode && styles.inputDisabled]}
                value={cidade}
                onChangeText={setCidade}
                editable={editMode}
                placeholder="Cidade"
              />
            </View>

            <View style={[styles.inputGroup, styles.flex1]}>
              <Text style={styles.inputLabel}>UF</Text>
              <TextInput
                style={[styles.input, !editMode && styles.inputDisabled]}
                value={estado}
                onChangeText={setEstado}
                editable={editMode}
                placeholder="UF"
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* CEP */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>CEP</Text>
            <TextInput
              style={[styles.input, !editMode && styles.inputDisabled]}
              value={cep}
              onChangeText={setCep}
              editable={editMode}
              placeholder="00000-000"
              keyboardType="numeric"
            />
          </View>

          {/* Botões de Ação (apenas em modo edição) */}
          {editMode && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={handleCancel}
                disabled={saving}
              >
                <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Aviso para gestores não principais */}
        {!isGestorPrincipal && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ℹ️ Apenas o gestor principal pode editar as informações da unidade.
            </Text>
          </View>
        )}
      </View>

      {/* Toast de Feedback */}
      <Toast {...toastState} onDismiss={hideToast} />
    </ScrollView>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  backIcon: {
    fontSize: 24,
    color: theme.colors.primary,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  content: {
    padding: 20,
  },
  principalBadge: {
    backgroundColor: theme.colors.warningLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  principalBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.warningDark,
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 12,
  },
  linkButton: {
    paddingVertical: 8,
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  section: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
  inputDisabled: {
    backgroundColor: theme.colors.disabled,
    color: theme.colors.textSecondary,
  },
  helperText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: theme.colors.secondary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  buttonTextSecondary: {
    color: theme.colors.text,
  },
  warningBox: {
    backgroundColor: theme.colors.primaryLight,
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  warningText: {
    fontSize: 14,
    color: theme.colors.primary,
    textAlign: 'center',
  },
}));
