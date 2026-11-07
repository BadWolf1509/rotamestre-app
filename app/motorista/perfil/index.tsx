import { type Href, useRouter } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';

import { AvatarEditable } from '@/components/AvatarEditable';
import { Dialog } from '@/components/Dialog';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useUser } from '@/hooks/useUser';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface SectionItem {
  label: string;
  value?: string;
  icon?: string;
  action?: boolean;
  onPress?: () => void;
}

interface Section {
  title: string;
  icon: string;
  items: SectionItem[];
  onPress?: () => void;
}

export default function PerfilMotorista() {
  const { theme } = useUnistyles();
  const router = useRouter();
  // Nome, telefone e unidade vêm do `useUser`, que recarrega quando alguém grava
  // o perfil (`emitProfileUpdate`). Antes a tela lia uma vez em estado local e
  // só sincronizava a foto: editar e voltar mostrava o nome velho.
  const { user } = useAuth();
  const { userData: usuario, loading } = useUser();

  // Hook centralizado para perfil (foto otimista)
  const {
    profile,
    uploadingPhoto,
    showPhotoOptions,
    confirmDialog,
    closeConfirmDialog,
    alertDialog,
    closeAlertDialog,
  } = useProfile(user);

  // A foto nova (upload em curso) aparece pelo `profile`; fora disso, a do banco.
  const fotoUrl = profile ? profile.foto_url : usuario?.foto_url;

  const sections: Section[] = [
    {
      title: 'Informações Pessoais',
      icon: '👤',
      items: [
        { label: 'Nome', value: usuario?.nome || 'Não informado' },
        { label: 'Email', value: usuario?.email || 'Não informado' },
        { label: 'Telefone', value: usuario?.telefone || 'Não informado' },
      ],
      onPress: () => router.push('/motorista/perfil/editar'),
    },
    {
      title: 'Segurança',
      icon: '🔐',
      items: [{ label: 'Alterar Senha', action: true }],
      onPress: () => router.push('/motorista/perfil/senha'),
    },
    {
      title: 'Privacidade',
      icon: '🛡️',
      items: [{ label: 'Excluir conta e dados', action: true }],
      onPress: () => router.push('/exclusao-de-conta' as Href),
    },
  ];

  if (loading) {
    return (
      <View style={styles(theme).loadingContainer}>
        <Text style={styles(theme).loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ScrollView style={styles(theme).container}>
        {/* Header com Avatar */}
        <View style={styles(theme).header}>
          <AvatarEditable
            name={usuario?.nome || 'Motorista'}
            imageUrl={fotoUrl}
            size="xl"
            onPress={showPhotoOptions}
            uploading={uploadingPhoto}
          />

          <Text style={styles(theme).nome}>{usuario?.nome || 'Usuário'}</Text>
          <Text style={styles(theme).email}>{usuario?.email || ''}</Text>
          <View style={styles(theme).roleBadge}>
            <Text style={styles(theme).roleBadgeText}>Motorista</Text>
          </View>
          {usuario?.unidades?.nome && (
            <View style={styles(theme).unitBadge}>
              <Text style={styles(theme).unitBadgeLabel}>Unidade</Text>
              <Text style={styles(theme).unitBadgeValue}>
                {usuario.unidades.nome}
              </Text>
            </View>
          )}
        </View>

        {/* Seções */}
        {sections.map((section, index) => (
          <TouchableOpacity
            key={index}
            style={styles(theme).section}
            onPress={section.onPress}
            activeOpacity={0.7}
          >
            <View style={styles(theme).sectionHeader}>
              <Text style={styles(theme).sectionIcon}>{section.icon}</Text>
              <Text style={styles(theme).sectionTitle}>{section.title}</Text>
              <Text style={styles(theme).sectionArrow}>›</Text>
            </View>

            <View style={styles(theme).sectionContent}>
              {section.items.map((item, itemIndex) => (
                <View key={itemIndex} style={styles(theme).sectionItem}>
                  <Text style={styles(theme).itemLabel}>{item.label}</Text>
                  {item.value && (
                    <Text style={styles(theme).itemValue} numberOfLines={1}>
                      {item.value}
                    </Text>
                  )}
                  {item.action && (
                    <Text style={styles(theme).itemAction}>›</Text>
                  )}
                </View>
              ))}
            </View>
          </TouchableOpacity>
        ))}

        {/* Botão Sair */}
        {/* Espaçamento inferior */}
        <View style={styles(theme).footer} />

        <Dialog
          visible={confirmDialog.visible}
          variant="confirm"
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={closeConfirmDialog}
        />
        <Dialog
          visible={alertDialog.visible}
          variant="alert"
          title={alertDialog.title}
          message={alertDialog.message}
          type={alertDialog.type}
          onConfirm={closeAlertDialog}
        />
      </ScrollView>
    </ErrorBoundary>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
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
      fontSize: theme.typography.base,
      color: theme.colors.gray500,
    },
    header: {
      backgroundColor: theme.colors.white,
      paddingVertical: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray200,
      marginBottom: theme.spacing.md,
    },
    nome: {
      fontSize: theme.typography['2xl'],
      fontFamily: theme.typography.fontSansBold,
      color: theme.colors.gray900,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.xs,
    },
    email: {
      fontSize: theme.typography.sm,
      color: theme.colors.gray500,
      marginBottom: theme.spacing.md,
    },
    roleBadge: {
      backgroundColor: theme.colors.primary + '20',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.lg,
    },
    roleBadgeText: {
      fontSize: theme.typography.xs,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.primary,
    },
    unitBadge: {
      marginTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.gray100,
    },
    unitBadgeLabel: {
      fontSize: theme.typography.xs,
      color: theme.colors.gray500,
    },
    unitBadgeValue: {
      fontSize: theme.typography.sm,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.gray800,
    },
    section: {
      backgroundColor: theme.colors.white,
      marginBottom: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      marginHorizontal: theme.spacing.md,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.black,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray100,
    },
    sectionIcon: {
      fontSize: theme.typography.fontSize.xl,
      marginRight: theme.spacing.md,
    },
    sectionTitle: {
      flex: 1,
      fontSize: theme.typography.base,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.gray900,
    },
    sectionArrow: {
      fontSize: theme.typography.fontSize['2xl'],
      color: theme.colors.gray400,
    },
    sectionContent: {
      padding: theme.spacing.md,
    },
    sectionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    itemLabel: {
      fontSize: theme.typography.sm,
      color: theme.colors.gray600,
      flex: 1,
    },
    itemValue: {
      fontSize: theme.typography.sm,
      fontFamily: theme.typography.fontSansMedium,
      color: theme.colors.gray900,
      flex: 2,
      textAlign: 'right',
    },
    itemAction: {
      fontSize: theme.typography.fontSize.xl,
      color: theme.colors.gray400,
      marginLeft: theme.spacing.sm,
    },
    footer: {
      height: 40,
    },
  });
