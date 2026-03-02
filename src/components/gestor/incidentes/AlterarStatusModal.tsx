/**
 * Modal for changing incident status.
 * Extracted from app/gestor/incidentes.tsx for maintainability.
 */

import { View, TouchableOpacity, TextInput } from "react-native";

import { Text } from "@/components/Text";
import { DesktopModal } from "@/design-system";
import type { Incidente, StatusLabel } from "@/hooks/incidentes-gestor/types";
import { styles } from "@/styles/gestor/incidentes.styles";

interface AlterarStatusModalProps {
  incidente: Incidente | null;
  visible: boolean;
  onClose: () => void;
  statusLabels: Record<string, StatusLabel>;
  novoStatus: string;
  observacoes: string;
  atualizando: boolean;
  onConfirmar: () => void;
  setNovoStatus: (status: string) => void;
  setObservacoes: (text: string) => void;
}

export function AlterarStatusModal({
  incidente,
  visible,
  onClose,
  statusLabels,
  novoStatus,
  observacoes,
  atualizando,
  onConfirmar,
  setNovoStatus,
  setObservacoes,
}: AlterarStatusModalProps) {
  if (!incidente) return null;

  return (
    <DesktopModal
      visible={visible}
      onClose={onClose}
      title="Alterar Status do Incidente"
      maxWidth={500}
      primaryButton={{
        text: "Salvar",
        onPress: onConfirmar,
        loading: atualizando,
      }}
      secondaryButton={{
        text: "Cancelar",
        onPress: onClose,
        disabled: atualizando,
      }}
    >
      <View>
        <Text style={styles.modalLabel}>Novo Status:</Text>
        <View style={styles.statusOptions}>
          {Object.entries(statusLabels).map(([key, { label, color }]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.statusOption,
                novoStatus === key && styles.statusOptionActive,
                { borderColor: color },
              ]}
              onPress={() => setNovoStatus(key)}
            >
              <Text
                style={[
                  styles.statusOptionText,
                  novoStatus === key && { color },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.modalLabel, { marginTop: 20 }]}>
          Observações (opcional):
        </Text>
        <TextInput
          style={styles.observacoesInput}
          placeholder="Adicione observações sobre a resolução..."
          value={observacoes}
          onChangeText={setObservacoes}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
    </DesktopModal>
  );
}
