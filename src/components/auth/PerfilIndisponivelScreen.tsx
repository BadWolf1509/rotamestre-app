import { View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { StyleSheet, type Theme } from '@/utils/styles';

const TEXTOS = {
  conexao: {
    icone: 'cloud-offline-outline',
    titulo: 'Sem conexão',
    descricao:
      'Não conseguimos carregar o seu perfil. Verifique a internet e tente de novo — você continua conectado.',
  },
  erro: {
    icone: 'alert-circle-outline',
    titulo: 'Não foi possível carregar seu perfil',
    descricao:
      'Algo deu errado do nosso lado ao buscar o seu perfil. Tente de novo em instantes — você continua conectado.',
  },
} as const;

/**
 * Portão sem perfil para decidir: a busca falhou e o aparelho não tem perfil
 * desta conta que possa responder (ou a falha é de verdade, não de rede).
 * Login e onboarding não resolvem — a sessão segue guardada e os dois também
 * precisam de rede —, então a pessoa fica aqui, conectada, até dar certo.
 *
 * Usada por `app/index.tsx` e pelos layouts protegidos (`useRequireAuth`).
 */
export function PerfilIndisponivelScreen({
  motivo = 'conexao',
  tentando = false,
  onTentarNovamente,
}: {
  motivo?: 'conexao' | 'erro';
  tentando?: boolean;
  onTentarNovamente: () => void;
}) {
  const texto = TEXTOS[motivo];
  return (
    <View style={styles.container} testID="portao-perfil-indisponivel">
      <EmptyState
        icon={texto.icone}
        title={texto.titulo}
        description={texto.descricao}
        actionLabel="Tentar novamente"
        onActionPress={onTentarNovamente}
        actionLoading={tentando}
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
