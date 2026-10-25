import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/Text';
import type { EstatisticaMotorista } from '@/hooks/incidentes-gestor/types';
import { styles } from '@/styles/gestor/incidentes.styles';
import { useUnistyles } from '@/utils/styles';


interface EstatisticaMotoristaCardProps {
  stat: EstatisticaMotorista;
  index: number;
  onVerHistorico: (motoristaId: string, nome: string) => void;
}

/**
 * Linha do top 5 "Incidentes por Motorista". O grupo "Motorista removido"
 * (`id` nulo: contas excluídas, Migration 56) junta pessoas diferentes e não
 * tem histórico próprio — o card só informa, sem ação. Os incidentes dele
 * seguem na lista de incidentes.
 */
export function EstatisticaMotoristaCard({
  stat,
  index,
  onVerHistorico,
}: EstatisticaMotoristaCardProps) {
  const { theme } = useUnistyles();
  const motoristaId = stat.id;

  const conteudo = (
    <>
      <View style={styles.motoristaRank}>
        <Text style={styles.motoristaRankText}>{index + 1}</Text>
      </View>
      <View style={styles.motoristaInfo}>
        <Text style={styles.motoristaNome}>{stat.nome}</Text>
        <Text style={styles.motoristaStats}>
          {stat.total} incidentes ({stat.abertos} abertos, {stat.resolvidos}{' '}
          resolvidos)
        </Text>
      </View>
      {motoristaId !== null && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={theme.colors.gray400}
        />
      )}
    </>
  );

  if (motoristaId === null) {
    return <View style={styles.motoristaStat}>{conteudo}</View>;
  }

  return (
    <TouchableOpacity
      style={styles.motoristaStat}
      onPress={() => onVerHistorico(motoristaId, stat.nome)}
      accessibilityRole="button"
      accessibilityLabel={`Ver histórico de incidentes de ${stat.nome}`}
    >
      {conteudo}
    </TouchableOpacity>
  );
}
