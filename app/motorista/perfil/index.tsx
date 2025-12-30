import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';

import { AvatarEditable } from '@/components/AvatarEditable';
import { useProfile } from '@/hooks/useProfile';
import { authService } from '@/lib/auth';
import { Usuario } from '@/types/usuario';
import { StyleSheet, useUnistyles } from '@/utils/styles';

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

type UsuarioComUnidade = Usuario & {
  unidades?: {
    nome?: string;
  };
};

export default function PerfilMotorista() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [usuario, setUsuario] = useState<UsuarioComUnidade | null>(null);
  const [loading, setLoading] = useState(true);

  // Hook centralizado para perfil
  const {
    profile,
    uploadingPhoto,
    showPhotoOptions,
  } = useProfile(user);

  useEffect(() => {
    loadUsuario();
  }, []);

  // Sincronizar profile com usuario local
  useEffect(() => {
    if (profile?.foto_url && usuario) {
      setUsuario(prev => prev ? { ...prev, foto_url: profile.foto_url } : prev);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.foto_url]);

  async function loadUsuario() {
    try {
      const session = await authService.getSession();
      if (session?.user) {
        setUser(session.user);
        const userData = await authService.getUsuario(session.user.id);
        setUsuario(userData);
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
    } finally {
      setLoading(false);
    }
  }

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
      items: [
        { label: 'Alterar Senha', action: true },
      ],
      onPress: () => router.push('/motorista/perfil/senha'),
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
    <ScrollView style={styles(theme).container}>
      {/* Header com Avatar */}
      <View style={styles(theme).header}>
        <AvatarEditable
          name={usuario?.nome || 'Motorista'}
          imageUrl={usuario?.foto_url}
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
    </ScrollView>
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
      fontSize: 16,
      color: theme.colors.gray500,
    },
    header: {
      backgroundColor: theme.colors.white,
      paddingVertical: 32,
      paddingHorizontal: 20,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray200,
      marginBottom: 16,
    },
    nome: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.colors.gray900,
      marginBottom: 4,
    },
    email: {
      fontSize: 14,
      color: theme.colors.gray500,
      marginBottom: 12,
    },
    roleBadge: {
      backgroundColor: theme.colors.primary + '20',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    roleBadgeText: {
      fontSize: 12,
      fontWeight: '600',
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
      fontWeight: '600',
      color: theme.colors.gray800,
    },
    section: {
      backgroundColor: theme.colors.white,
      marginBottom: 16,
      borderRadius: 12,
      marginHorizontal: 16,
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
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray100,
    },
    sectionIcon: {
      fontSize: 20,
      marginRight: 12,
    },
    sectionTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.gray900,
    },
    sectionArrow: {
      fontSize: 24,
      color: theme.colors.gray400,
    },
    sectionContent: {
      padding: 16,
    },
    sectionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    itemLabel: {
      fontSize: 14,
      color: theme.colors.gray600,
      flex: 1,
    },
    itemValue: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.gray900,
      flex: 2,
      textAlign: 'right',
    },
    itemAction: {
      fontSize: 20,
      color: theme.colors.gray400,
      marginLeft: 8,
    },
    footer: {
      height: 40,
    },
  });
