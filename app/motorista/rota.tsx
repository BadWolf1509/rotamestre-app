import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { authService } from '../../lib/auth';

export default function Rota() {
  const router = useRouter();
  const [userName, setUserName] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  async function loadUserData() {
    try {
      const session = await authService.getSession();
      if (session?.user) {
        const usuario = await authService.getUsuario(session.user.id);
        setUserName(usuario?.nome || 'Motorista');
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  }

  async function handleLogout() {
    try {
      await authService.signOut();
      router.replace('/');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Olá, {userName}!</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutButton}>Sair</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Rota Atual</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Nenhuma rota atribuída</Text>
          <Text style={styles.emptyStateSubtext}>
            Aguarde o gestor atribuir uma rota para você
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  logoutButton: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 15,
  },
  emptyState: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyStateText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
  },
});
