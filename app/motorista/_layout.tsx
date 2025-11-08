import { Drawer } from 'expo-router/drawer';
import { Text } from 'react-native';
import { StyleSheet, useUnistyles } from '@/utils/styles';
import { CustomDrawerContent } from '@/components/CustomDrawerContent';
import 'react-native-gesture-handler';

export default function MotoristaLayout() {
  const { theme } = useUnistyles();

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerPosition: 'left',
        drawerType: 'slide',
        drawerStyle: {
          width: '80%',
          maxWidth: 320,
        },
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        drawerActiveTintColor: theme.colors.primary,
        drawerInactiveTintColor: theme.colors.gray600,
        drawerLabelStyle: styles(theme).drawerLabel,
        drawerItemStyle: styles(theme).drawerItem,
      }}
    >
      <Drawer.Screen
        name="rota"
        options={{
          title: 'Rota Atual',
          drawerLabel: 'Rota Atual',
          drawerIcon: () => <Text style={styles(theme).menuIcon}>🚗</Text>,
        }}
      />
      <Drawer.Screen
        name="checkpoints"
        options={{
          title: 'Paradas',
          drawerLabel: 'Paradas',
          drawerIcon: () => <Text style={styles(theme).menuIcon}>📍</Text>,
        }}
      />
      <Drawer.Screen
        name="mapa"
        options={{
          title: 'Mapa',
          drawerLabel: 'Mapa',
          drawerIcon: () => <Text style={styles(theme).menuIcon}>🗺️</Text>,
        }}
      />
      <Drawer.Screen
        name="historico"
        options={{
          title: 'Histórico',
          drawerLabel: 'Histórico',
          drawerIcon: () => <Text style={styles(theme).menuIcon}>📋</Text>,
        }}
      />
      <Drawer.Screen
        name="resumo"
        options={{
          title: 'Resumo',
          drawerLabel: 'Resumo',
          drawerIcon: () => <Text style={styles(theme).menuIcon}>📊</Text>,
        }}
      />
      <Drawer.Screen
        name="perfil"
        options={{
          headerShown: false,
          drawerItemStyle: { display: 'none' }, // Esconder do menu (acessa via seção de perfil)
        }}
      />
    </Drawer>
  );
}

const styles = (theme: any) =>
  StyleSheet.create({
    menuIcon: {
      fontSize: 20,
      marginRight: theme.spacing.lg,
      width: 24,
    },
    drawerLabel: {
      fontSize: 15,
      marginLeft: -16,
    },
    drawerItem: {
      borderRadius: 8,
      marginHorizontal: 8,
    },
  });
