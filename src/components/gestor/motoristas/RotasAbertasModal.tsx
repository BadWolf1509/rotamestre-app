/**
 * Aviso de desativação recusada: o motorista tem rota pendente ou em
 * andamento nesta loja (Migration 54). Lista as rotas; cada uma abre a tela da
 * rota, onde o gestor troca o motorista ou cancela. Depois, desativa de novo.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';

import { DesktopModal } from '@/components/desktop/DesktopModal';
import { Text } from '@/components/Text';
import type { BloqueioDesativacao } from '@/hooks/motoristas-gestor/useBloqueioDesativacao';
// `rotas.data` é coluna date: formatDateBR monta o dia com componentes locais.
import { formatDateBR } from '@/lib/dateUtils';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

/** O texto conta as rotas (singular com uma); sem lista legível, não conta. */
function textoDoBloqueio(nome: string, total: number): string {
  if (total === 1) {
    return `${nome} tem 1 rota aberta nesta loja. Antes de desativar, reatribua a rota a outro motorista ou cancele-a.`;
  }
  const quantas = total > 1 ? `${total} rotas abertas` : 'rotas abertas';
  return `${nome} tem ${quantas} nesta loja. Antes de desativar, reatribua cada rota a outro motorista ou cancele-a.`;
}

const ROTULO_STATUS: Record<string, string> = {
  em_andamento: 'Em andamento',
  pendente: 'Pendente',
};

interface RotasAbertasModalProps {
  bloqueio: BloqueioDesativacao | null;
  onClose: () => void;
}

export function RotasAbertasModal({
  bloqueio,
  onClose,
}: RotasAbertasModalProps) {
  const router = useRouter();
  const { theme } = useUnistyles();

  const abrirRota = (id: string) => {
    onClose();
    router.push(`/gestor/mapa-rota?id=${id}`);
  };

  const nome = bloqueio?.nomeMotorista ?? '';
  const rotas = bloqueio?.rotas ?? [];

  return (
    <DesktopModal
      visible={bloqueio !== null}
      onClose={onClose}
      title="Não dá para desativar"
      maxWidth={480}
      primaryButton={{ text: 'Entendi', onPress: onClose }}
    >
      {bloqueio && (
        <View style={styles.corpo}>
          <Text style={styles.texto}>
            {textoDoBloqueio(nome, rotas.length)}
          </Text>
          {rotas.length > 0 && (
            <Text style={styles.dica}>
              Toque numa rota para abrir e trocar o motorista ou cancelar.
            </Text>
          )}
          {/* No aparelho o DesktopModal (bottom sheet) não rola o corpo:
              a lista rola sozinha, com altura limitada. */}
          <ScrollView
            testID="rotas-abertas-lista"
            style={styles.lista}
            contentContainerStyle={styles.listaConteudo}
            nestedScrollEnabled
          >
            {rotas.map((rota) => (
              <TouchableOpacity
                key={rota.id}
                testID={`rota-aberta-${rota.id}`}
                style={styles.linha}
                onPress={() => abrirRota(rota.id)}
                accessibilityRole="button"
                accessibilityLabel={`Abrir rota de ${formatDateBR(rota.data)}`}
              >
                <Ionicons
                  name={rota.status === 'em_andamento' ? 'time' : 'hourglass'}
                  size={18}
                  color={
                    rota.status === 'em_andamento'
                      ? theme.colors.info
                      : theme.colors.warning
                  }
                />
                <Text style={styles.data}>{formatDateBR(rota.data)}</Text>
                <Text style={styles.status}>
                  {ROTULO_STATUS[rota.status] ?? rota.status}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.colors.gray500}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </DesktopModal>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  corpo: {
    gap: theme.spacing.md,
  },
  texto: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text,
  },
  dica: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  lista: {
    maxHeight: 320,
  },
  listaConteudo: {
    gap: theme.spacing.md,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  data: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.text,
  },
  status: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
}));
