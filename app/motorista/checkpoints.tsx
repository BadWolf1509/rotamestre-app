import { View, Text, StyleSheet } from 'react-native';

export default function Checkpoints() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lista de Paradas</Text>
      <Text style={styles.subtitle}>Em desenvolvimento...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
});
