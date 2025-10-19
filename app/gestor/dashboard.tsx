import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { authService } from '../../lib/auth';

export default function Dashboard() {
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
        setUserName(usuario?.nome || 'Gestor');
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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Olá, {userName}!</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutButton}>Sair</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Rotas Hoje</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Em Andamento</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Concluídas</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ações Rápidas</Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(gestor)/nova-entrega')}
        >
          <Text style={styles.actionButtonText}>+ Nova Rota de Entrega</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => router.push('/(gestor)/motoristas')}
        >
          <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
            Gerenciar Motoristas
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rotas Recentes</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Nenhuma rota cadastrada ainda</Text>
        </View>
      </View>
    </ScrollView>
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
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  section: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 15,
  },
  actionButton: {
    backgroundColor: '#2563eb',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    color: '#2563eb',
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
    color: '#6b7280',
    fontSize: 14,
  },
});
