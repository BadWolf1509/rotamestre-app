import { View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { StyleSheet, type Theme } from '@/utils/styles';

/**
 * Portão sem perfil para decidir: a busca falhou e o aparelho não conhece
 * nenhum perfil desta conta. Login e onboarding não resolvem — a sessão é
 * válida e os dois também precisam de rede —, então a pessoa fica aqui, com
 * a sessão intacta, até a busca voltar.
 *
 * Usada por `app/index.tsx` e pelos layouts protegidos (`useRequireAuth`).
 */
export function SemConexaoScreen({
  onTentarNovamente,
}: {
  onTentarNovamente: () => void;
}) {
  return (
    <View style={styles.container} testID="portao-sem-conexao">
      <EmptyState
        icon="cloud-offline-outline"
        title="Sem conexão"
        description="Não conseguimos carregar o seu perfil. Verifique a internet e tente de novo — você continua conectado."
        actionLabel="Tentar novamente"
        onActionPress={onTentarNovamente}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
}));
