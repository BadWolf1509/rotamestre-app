import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MotoristaAvatar } from '@/components/gestor/motoristas/MotoristaAvatar';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import {
  DataTable,
  type DataTableAction,
  type DataTableColumn,
  DesktopCard,
  DesktopModal,
  DesktopPageLayout,
  Dialog,
  MobileEmptyState,
  StatusBadge,
  Toast,
} from '@/design-system';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import {
  useMotoristasGestor,
  type MotoristaDetalhado,
} from '@/hooks/useMotoristasGestor';
import { useResponsive } from '@/hooks/useResponsive';
import { useUser } from '@/hooks/useUser';
import { styles } from '@/styles/gestor/motoristas.styles';
import { useUnistyles } from '@/utils/styles';

export default function MotoristasGestor() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { userData } = useUser();
  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
    userImageUrl: userData?.foto_url,
  });
  const { isDesktop } = useResponsive();
  const pageMeta = getGestorPageMeta('motoristas');

  const {
    // State
    motoristas,
    loading,
    salvando,
    totalMotoristas,
    ativosMotoristas,
    // Modal state
    showAddModal,
    showEditModal,
    showConfirmModal,
    motoristaEditando,
    motoristaParaToggle,
    // Form state
    formNome,
    formEmail,
    formTelefone,
    formSenha,
    emailError,
    telefoneError,
    // Form setters
    setFormNome,
    setFormEmail,
    setFormSenha,
    // Modal controls
    setShowAddModal,
    setShowEditModal,
    setShowConfirmModal,
    setMotoristaEditando,
    setMotoristaParaToggle,
    // Actions
    abrirModalAdicionar,
    abrirModalEditar,
    adicionarMotorista,
    editarMotorista,
    toggleAtivo,
    confirmarToggleAtivo,
    resetFormulario,
    // Validation
    validateEmail,
    handleTelefoneChange,
    // Toast
    toastState,
    hideToast,
  } = useMotoristasGestor();

  // ============================================
  // Modal Content Renderers (Desktop)
  // ============================================

  const renderAddModalContent = () => (
    <ScrollView showsVerticalScrollIndicator={Platform.OS === 'web'}>
      <View style={[styles.field, isDesktop && styles.fieldCompact]}>
        <Text style={[styles.label, isDesktop && styles.labelCompact]}>
          Nome Completo *
        </Text>
        <TextInput
          style={[styles.input, isDesktop && styles.inputCompact]}
          value={formNome}
          onChangeText={setFormNome}
          placeholder="Digite o nome completo"
          placeholderTextColor={theme.colors.gray400}
          autoCapitalize="words"
          accessibilityLabel="Campo de nome do motorista"
        />
      </View>

      <View style={[styles.field, isDesktop && styles.fieldCompact]}>
        <Text style={[styles.label, isDesktop && styles.labelCompact]}>
          Email *
        </Text>
        <TextInput
          style={[
            styles.input,
            isDesktop && styles.inputCompact,
            emailError && styles.inputError,
          ]}
          value={formEmail}
          onChangeText={(text) => {
            setFormEmail(text.toLowerCase());
            validateEmail(text.toLowerCase());
          }}
          onBlur={() => validateEmail(formEmail)}
          placeholder="email@exemplo.com"
          placeholderTextColor={theme.colors.gray400}
          keyboardType="email-address"
          autoCapitalize="none"
          accessibilityLabel="Campo de email do motorista"
        />
        {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
      </View>

      <View style={[styles.field, isDesktop && styles.fieldCompact]}>
        <Text style={[styles.label, isDesktop && styles.labelCompact]}>
          Telefone (opcional)
        </Text>
        <TextInput
          style={[
            styles.input,
            isDesktop && styles.inputCompact,
            telefoneError && styles.inputError,
          ]}
          value={formTelefone}
          onChangeText={handleTelefoneChange}
          placeholder="(00) 00000-0000"
          placeholderTextColor={theme.colors.gray400}
          keyboardType="phone-pad"
          maxLength={15}
          accessibilityLabel="Campo de telefone do motorista"
        />
        {telefoneError ? (
          <Text style={styles.errorText}>{telefoneError}</Text>
        ) : null}
      </View>

      <View style={[styles.field, isDesktop && styles.fieldCompact]}>
        <Text style={[styles.label, isDesktop && styles.labelCompact]}>
          Senha Inicial *
        </Text>
        <TextInput
          style={[styles.input, isDesktop && styles.inputCompact]}
          value={formSenha}
          onChangeText={setFormSenha}
          placeholder="Mínimo 6 caracteres"
          placeholderTextColor={theme.colors.gray400}
          secureTextEntry
          autoCapitalize="none"
          accessibilityLabel="Campo de senha do motorista"
        />
        <Text
          style={[styles.helperText, isDesktop && styles.helperTextCompact]}
        >
          O motorista poderá alterar a senha no primeiro acesso
        </Text>
      </View>
    </ScrollView>
  );

  const renderEditModalContent = () => (
    <ScrollView showsVerticalScrollIndicator={Platform.OS === 'web'}>
      <View style={[styles.field, isDesktop && styles.fieldCompact]}>
        <Text style={[styles.label, isDesktop && styles.labelCompact]}>
          Nome Completo *
        </Text>
        <TextInput
          style={[styles.input, isDesktop && styles.inputCompact]}
          value={formNome}
          onChangeText={setFormNome}
          placeholder="Digite o nome completo"
          placeholderTextColor={theme.colors.gray400}
          autoCapitalize="words"
          accessibilityLabel="Campo de nome do motorista"
        />
      </View>

      <View style={[styles.field, isDesktop && styles.fieldCompact]}>
        <Text style={[styles.label, isDesktop && styles.labelCompact]}>
          Email
        </Text>
        <TextInput
          style={[
            styles.input,
            isDesktop && styles.inputCompact,
            styles.inputDisabledStyle,
          ]}
          value={motoristaEditando?.email}
          editable={false}
          accessibilityLabel="Email do motorista (não editável)"
        />
        <Text
          style={[styles.helperText, isDesktop && styles.helperTextCompact]}
        >
          Email não pode ser alterado
        </Text>
      </View>

      <View style={[styles.field, isDesktop && styles.fieldCompact]}>
        <Text style={[styles.label, isDesktop && styles.labelCompact]}>
          Telefone (opcional)
        </Text>
        <TextInput
          style={[
            styles.input,
            isDesktop && styles.inputCompact,
            telefoneError && styles.inputError,
          ]}
          value={formTelefone}
          onChangeText={handleTelefoneChange}
          placeholder="(00) 00000-0000"
          placeholderTextColor={theme.colors.gray400}
          keyboardType="phone-pad"
          maxLength={15}
          accessibilityLabel="Campo de telefone do motorista"
        />
        {telefoneError ? (
          <Text style={styles.errorText}>{telefoneError}</Text>
        ) : null}
      </View>
    </ScrollView>
  );

  // ============================================
  // DataTable Configuration
  // ============================================

  const columns: DataTableColumn<MotoristaDetalhado>[] = [
    {
      key: 'avatar',
      label: '',
      width: 60,
      render: (motorista) => (
        <MotoristaAvatar fotoUrl={motorista.foto_url} nome={motorista.nome} />
      ),
    },
    {
      key: 'nome',
      label: 'Nome',
      width: 200,
      sortable: true,
      noWrap: true,
      render: (motorista) => (
        <Text style={styles.tableCellText}>{motorista.nome}</Text>
      ),
    },
    {
      key: 'email',
      label: 'E-mail',
      width: 260,
      noWrap: true,
      render: (motorista) => (
        <Text style={styles.tableCellText}>{motorista.email}</Text>
      ),
    },
    {
      key: 'telefone',
      label: 'Telefone',
      width: 130,
      render: (motorista) => (
        <Text style={styles.tableCellText}>{motorista.telefone || '-'}</Text>
      ),
    },
    {
      key: 'created_at',
      label: 'Cadastrado em',
      width: 130,
      desktopOnly: true,
      render: (motorista) => (
        <Text style={styles.tableCellText}>
          {new Date(motorista.created_at).toLocaleDateString('pt-BR')}
        </Text>
      ),
    },
    {
      key: 'ativo',
      label: 'Status',
      width: 100,
      render: (motorista) => (
        <StatusBadge
          color={motorista.ativo ? theme.colors.success : theme.colors.error}
          label={motorista.ativo ? 'Ativo' : 'Inativo'}
          variant="soft"
        />
      ),
    },
  ];

  const actions: DataTableAction<MotoristaDetalhado>[] = [
    {
      label: 'Ver Perfil',
      icon: 'person-outline',
      type: 'secondary',
      onPress: (motorista) =>
        router.push(`/gestor/motorista-perfil?id=${motorista.id}`),
    },
    {
      label: 'Editar',
      icon: 'create-outline',
      type: 'primary',
      onPress: abrirModalEditar,
    },
    {
      label: (motorista) => (motorista.ativo ? 'Desativar' : 'Ativar'),
      icon: (motorista) =>
        motorista.ativo ? 'close-circle-outline' : 'checkmark-circle-outline',
      type: 'secondary',
      onPress: toggleAtivo,
    },
  ];

  // ============================================
  // Header Actions
  // ============================================

  const desktopStats = (
    <View style={styles.headerStats}>
      <View style={styles.headerStat}>
        <Text style={styles.headerStatValue}>{totalMotoristas}</Text>
        <Text style={styles.headerStatLabel}>Cadastrados</Text>
      </View>
      <View style={styles.headerStat}>
        <Text style={[styles.headerStatValue, styles.headerStatValueSuccess]}>
          {ativosMotoristas}
        </Text>
        <Text style={styles.headerStatLabel}>Ativos</Text>
      </View>
    </View>
  );

  const tableHeaderActions = isDesktop ? (
    <View style={styles.cardHeaderActions}>
      {desktopStats}
      <TouchableOpacity
        style={styles.cardAddButton}
        onPress={abrirModalAdicionar}
        accessibilityLabel="Adicionar motorista"
        accessibilityRole="button"
      >
        <Ionicons
          name="add-circle-outline"
          size={18}
          color={theme.colors.white}
        />
        <Text style={styles.cardAddButtonText}>Adicionar Motorista</Text>
      </TouchableOpacity>
    </View>
  ) : undefined;

  // ============================================
  // Confirm Modal (shared)
  // ============================================

  const confirmModal = (
    <Dialog
      visible={showConfirmModal}
      variant="confirm"
      title={
        motoristaParaToggle?.ativo ? 'Desativar Motorista' : 'Ativar Motorista'
      }
      message={`Deseja realmente ${motoristaParaToggle?.ativo ? 'desativar' : 'ativar'} ${motoristaParaToggle?.nome}?`}
      confirmText="Confirmar"
      cancelText="Cancelar"
      type={motoristaParaToggle?.ativo ? 'danger' : 'success'}
      onConfirm={confirmarToggleAtivo}
      onCancel={() => {
        setShowConfirmModal(false);
        setMotoristaParaToggle(null);
      }}
    />
  );

  // ============================================
  // Desktop Layout
  // ============================================

  if (isDesktop) {
    return (
      <>
        <DesktopPageLayout
          title={pageMeta.title}
          subtitle={pageMeta.subtitle}
          breadcrumbs={pageMeta.breadcrumbs}
          userMenuTrigger={userMenuTrigger}
          userMenuItems={userMenuItems}
          loading={loading}
          loadingText="Carregando motoristas..."
        >
          <DesktopCard
            title="Lista de Motoristas"
            icon="people"
            variant="elevated"
            actions={tableHeaderActions}
            noPadding={motoristas.length > 0}
          >
            {motoristas.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="people-outline"
                  size={64}
                  color={theme.colors.gray400}
                />
                <Text style={styles.emptyText}>
                  Nenhum motorista cadastrado
                </Text>
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
          </DesktopCard>
        </DesktopPageLayout>

        <DesktopModal
          visible={showAddModal}
          title="Adicionar Motorista"
          onClose={() => {
            setShowAddModal(false);
            resetFormulario();
          }}
          closeOnOverlayPress={false}
          maxWidth={500}
          primaryButton={{
            text: 'Adicionar',
            onPress: adicionarMotorista,
            loading: salvando,
          }}
          secondaryButton={{
            text: 'Cancelar',
            onPress: () => {
              setShowAddModal(false);
              resetFormulario();
            },
            disabled: salvando,
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
          closeOnOverlayPress={false}
          maxWidth={500}
          primaryButton={{
            text: 'Salvar',
            onPress: editarMotorista,
            loading: salvando,
          }}
          secondaryButton={{
            text: 'Cancelar',
            onPress: () => {
              setShowEditModal(false);
              setMotoristaEditando(null);
              resetFormulario();
            },
            disabled: salvando,
          }}
        >
          {renderEditModalContent()}
        </DesktopModal>

        {confirmModal}
        <Toast {...toastState} onDismiss={hideToast} />
        {logoutModal}
      </>
    );
  }

  // ============================================
  // Mobile Layout
  // ============================================

  if (loading) {
    return (
      <>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primaryDark} />
          <Text style={styles.loadingText}>Carregando motoristas...</Text>
        </View>
        {logoutModal}
      </>
    );
  }

  return (
    <ErrorBoundary>
      <>
        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            <View style={styles.topSection}>
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  {motoristas.length}{' '}
                  {motoristas.length === 1 ? 'motorista' : 'motoristas'}{' '}
                  cadastrados
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addButtonMobile}
                onPress={abrirModalAdicionar}
                accessibilityLabel="Adicionar novo motorista"
                accessibilityRole="button"
              >
                <Text style={styles.addButtonText}>+ Novo Motorista</Text>
              </TouchableOpacity>
            </View>

            {motoristas.length === 0 ? (
              <MobileEmptyState
                icon="👤"
                title="Nenhum motorista cadastrado"
                subtitle="Adicione o primeiro motorista usando o botão acima"
              />
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

        <DesktopModal
          visible={showAddModal}
          title="Adicionar Motorista"
          onClose={() => {
            setShowAddModal(false);
            resetFormulario();
          }}
          closeOnOverlayPress={false}
          maxWidth={500}
          primaryButton={{
            text: 'Adicionar',
            onPress: adicionarMotorista,
            loading: salvando,
          }}
          secondaryButton={{
            text: 'Cancelar',
            onPress: () => {
              setShowAddModal(false);
              resetFormulario();
            },
            disabled: salvando,
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
          closeOnOverlayPress={false}
          maxWidth={500}
          primaryButton={{
            text: 'Salvar',
            onPress: editarMotorista,
            loading: salvando,
          }}
          secondaryButton={{
            text: 'Cancelar',
            onPress: () => {
              setShowEditModal(false);
              setMotoristaEditando(null);
              resetFormulario();
            },
            disabled: salvando,
          }}
        >
          {renderEditModalContent()}
        </DesktopModal>

        {confirmModal}
        <Toast {...toastState} onDismiss={hideToast} />
        {logoutModal}
      </>
    </ErrorBoundary>
  );
}
