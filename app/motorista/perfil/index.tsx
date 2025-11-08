import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { StyleSheet, useUnistyles } from '@/utils/styles';
import { useRouter } from 'expo-router';
import { authService } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Usuario } from '@/types/usuario';
import * as ImagePicker from 'expo-image-picker';
import { storageService } from '@/lib/storage';

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
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    loadUsuario();
  }, []);

  async function loadUsuario() {
    try {
      const session = await authService.getSession();
      if (session?.user) {
        const userData = await authService.getUsuario(session.user.id);
        setUsuario(userData);
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados do perfil');
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPhoto() {
    try {
      // Solicitar permissão
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permissão necessária',
          'Precisamos de permissão para acessar suas fotos'
        );
        return;
      }

      // Abrir galeria
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingPhoto(true);
        const photoUri = result.assets[0].uri;

        // Upload da foto
        if (usuario?.id) {
          const fotoUrl = await storageService.uploadFotoUsuario(
            usuario.id,
            photoUri
          );

          // Atualizar estado local
          setUsuario({ ...usuario, foto_url: fotoUrl });

          Alert.alert('Sucesso', 'Foto de perfil atualizada!');
        }
      }
    } catch (error) {
      console.error('Erro ao selecionar foto:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a foto');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleLogout() {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.signOut();
              router.replace('/auth/login');
            } catch (error) {
              console.error('Erro ao fazer logout:', error);
              Alert.alert('Erro', 'Não foi possível sair');
            }
          },
        },
      ]
    );
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
        <TouchableOpacity
          onPress={handleSelectPhoto}
          disabled={uploadingPhoto}
          style={styles(theme).avatarContainer}
        >
          {usuario?.foto_url ? (
            <Image
              source={{ uri: usuario.foto_url }}
              style={styles(theme).avatar}
            />
          ) : (
            <View style={styles(theme).avatarPlaceholder}>
              <Text style={styles(theme).avatarPlaceholderText}>
                {usuario?.nome?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={styles(theme).avatarBadge}>
            <Text style={styles(theme).avatarBadgeText}>✏️</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles(theme).nome}>{usuario?.nome || 'Usuário'}</Text>
        <Text style={styles(theme).email}>{usuario?.email || ''}</Text>
        <View style={styles(theme).roleBadge}>
          <Text style={styles(theme).roleBadgeText}>Motorista</Text>
        </View>
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
      <TouchableOpacity
        style={styles(theme).logoutButton}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Text style={styles(theme).logoutIcon}>🚪</Text>
        <Text style={styles(theme).logoutText}>Sair</Text>
      </TouchableOpacity>

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
    avatarContainer: {
      position: 'relative',
      marginBottom: 16,
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.colors.gray200,
    },
    avatarPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarPlaceholderText: {
      fontSize: 40,
      fontWeight: 'bold',
      color: theme.colors.white,
    },
    avatarBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: theme.colors.secondary,
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: theme.colors.white,
    },
    avatarBadgeText: {
      fontSize: 16,
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
    section: {
      backgroundColor: theme.colors.white,
      marginBottom: 16,
      borderRadius: 12,
      marginHorizontal: 16,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
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
    logoutButton: {
      flexDirection: 'row',
      backgroundColor: theme.colors.white,
      marginHorizontal: 16,
      marginTop: 8,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.error + '30',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    logoutIcon: {
      fontSize: 20,
      marginRight: 8,
    },
    logoutText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.error,
    },
    footer: {
      height: 40,
    },
  });
