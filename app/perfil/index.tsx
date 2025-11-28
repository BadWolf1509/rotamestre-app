import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AvatarEditable } from '@/components/AvatarEditable';
import { DesktopPageLayout } from '@/components/desktop/DesktopPageLayout';
import { PerfilDesktopLayout } from '@/components/perfil/PerfilDesktopLayout';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useProfile } from '@/hooks/useProfile';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Usuario } from '@/types/usuario';
import { StyleSheet, useUnistyles } from '@/utils/styles';

interface SectionItem {
  label: string;
  value?: string;
  action?: boolean;
}

interface Section {
  title: string;
  icon: string;
  items: SectionItem[];
  onPress?: () => void;
}

type UsuarioComUnidade = Usuario & {
  unidades?: {
    nome?: string;
  };
  ultimo_login?: string | null;
};

export default function PerfilGestor() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const [user, setUser] = useState<any>(null);
  const [usuario, setUsuario] = useState<UsuarioComUnidade | null>(null);
  const [loading, setLoading] = useState(true);
  const [atividadeRecente, setAtividadeRecente] = useState<{
    ultimoAcesso: string | null;
    dispositivosAtivos: number | null;
  }>({
    ultimoAcesso: null,
    dispositivosAtivos: null,
  });

  // Hook centralizado para perfil
  const {
    profile,
    uploadingPhoto,
    showPhotoOptions,
  } = useProfile(user);

  const pageMeta = getGestorPageMeta('perfil');
  const { userMenuTrigger, userMenuItems, logoutModal, openLogoutModal } = useDesktopHeaderMenu({
    userName: usuario?.nome || profile?.nome,
  });

  useEffect(() => {
    loadUsuario();
  }, []);

  // Sincronizar profile com usuario local (para dados extras como unidades)
  useEffect(() => {
    if (profile?.foto_url && usuario) {
      setUsuario(prev => prev ? { ...prev, foto_url: profile.foto_url } : prev);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.foto_url]);

  async function loadUsuario() {
    try {
      const session = await authService.getSession();
      if (session?.user?.id) {
        setUser(session.user);

        const { data, error } = await supabase
          .from('usuarios')
          .select('*, unidades(nome)')
          .eq('id', session.user.id)
          .single();

        if (error) throw error;
        setUsuario(data as UsuarioComUnidade);

        const lastAccess = (data as UsuarioComUnidade)?.ultimo_login || session.user.last_sign_in_at;
        const userMetadata = session.user.user_metadata as {
          dispositivos?: string[];
          devices?: string[];
        } | undefined;
        const appMetadata = session.user.app_metadata as { active_devices?: number } | undefined;
        const dispositivosAtivos =
          appMetadata?.active_devices ??
          (Array.isArray(userMetadata?.dispositivos)
            ? userMetadata?.dispositivos.length
            : Array.isArray(userMetadata?.devices)
              ? userMetadata?.devices.length
              : 1);

        setAtividadeRecente({
          ultimoAcesso: lastAccess ?? null,
          dispositivosAtivos: dispositivosAtivos ?? 1,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
    } finally {
      setLoading(false);
    }
  }

  // Renderizar layout desktop para telas grandes
  if (isDesktop) {
    return (
      <>
        <DesktopPageLayout
          title={pageMeta.title}
          subtitle="Gerencie suas informacoes pessoais e configuracoes"
          breadcrumbs={pageMeta.breadcrumbs}
          userMenuTrigger={userMenuTrigger}
          userMenuItems={userMenuItems}
          loading={loading}
        >
          <PerfilDesktopLayout
            usuario={usuario}
            uploadingPhoto={uploadingPhoto}
            onSelectPhoto={showPhotoOptions}
            atividade={atividadeRecente}
            onLogout={openLogoutModal}
          />
        </DesktopPageLayout>
        {logoutModal}
      </>
    );
  }

  // Layout mobile/tablet existente
  const sections: Section[] = [
    {
      title: 'Informações Pessoais',
      icon: '👤',
      items: [
        { label: 'Nome', value: usuario?.nome || 'Não informado' },
        { label: 'Email', value: usuario?.email || 'Não informado' },
        { label: 'Telefone', value: usuario?.telefone || 'Não informado' },
      ],
      onPress: () => router.push('/perfil/editar'),
    },
    {
      title: 'Segurança',
      icon: '🔐',
      items: [{ label: 'Alterar Senha', action: true }],
      onPress: () => router.push('/perfil/trocar-senha'),
    },
  ];

  if (loading) {
    return (
      <>
        <View style={styles(theme).loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles(theme).loadingText}>Carregando perfil...</Text>
        </View>
        {logoutModal}
      </>
    );
  }

  return (
    <>
      <ScrollView style={styles(theme).container}>
      <View style={styles(theme).header}>
        <AvatarEditable
          name={usuario?.nome || 'Gestor'}
          imageUrl={usuario?.foto_url}
          size="xl"
          onPress={showPhotoOptions}
          uploading={uploadingPhoto}
        />

        <Text style={styles(theme).nome}>{usuario?.nome || 'Gestor'}</Text>
        <Text style={styles(theme).email}>{usuario?.email || ''}</Text>
        <View style={styles(theme).roleBadge}>
          <Text style={styles(theme).roleBadgeText}>
            {usuario?.papel === 'gestor' ? 'Gestor' : 'Usuário'}
          </Text>
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
                {item.value ? (
                  <Text style={styles(theme).itemValue} numberOfLines={1}>
                    {item.value}
                  </Text>
                ) : (
                  item.action && (
                    <Text style={styles(theme).itemAction}>›</Text>
                  )
                )}
              </View>
            ))}
          </View>
        </TouchableOpacity>
      ))}
      </ScrollView>
      {logoutModal}
    </>
  );
}

const styles = (theme: any) =>
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
      marginTop: theme.spacing.sm,
      fontSize: theme.typography.sm,
      color: theme.colors.gray500,
    },
    header: {
      padding: theme.spacing.xl,
      alignItems: 'center',
      backgroundColor: theme.colors.white,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray200,
    },
    nome: {
      marginTop: theme.spacing.lg,
      fontSize: theme.typography['2xl'],
      fontFamily: theme.typography.fontSansBold,
      color: theme.colors.gray900,
    },
    email: {
      marginTop: 4,
      fontSize: theme.typography.sm,
      color: theme.colors.gray500,
    },
    roleBadge: {
      marginTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primaryBg,
    },
    roleBadgeText: {
      color: theme.colors.primary,
      fontWeight: '600',
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
      fontWeight: '600',
      color: theme.colors.gray800,
    },
    section: {
      margin: theme.spacing.lg,
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.gray100,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        },
        android: {
          elevation: 2,
        },
      }),
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray100,
    },
    sectionIcon: {
      fontSize: 20,
      marginRight: theme.spacing.md,
    },
    sectionTitle: {
      flex: 1,
      fontSize: theme.typography.base,
      fontWeight: '600',
      color: theme.colors.gray900,
    },
    sectionArrow: {
      fontSize: 20,
      color: theme.colors.gray400,
    },
    sectionContent: {
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    sectionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    itemLabel: {
      fontSize: theme.typography.sm,
      color: theme.colors.gray500,
    },
    itemValue: {
      fontSize: theme.typography.sm,
      color: theme.colors.gray900,
      maxWidth: '60%',
      textAlign: 'right',
    },
    itemAction: {
      fontSize: 20,
      color: theme.colors.gray400,
    },
  });



