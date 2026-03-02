/**
 * Modal for viewing a driver's incident history.
 * Extracted from app/gestor/incidentes.tsx for maintainability.
 */

import { Ionicons } from "@expo/vector-icons";
import {
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";

import { Text } from "@/components/Text";
import { DesktopModal, StatusBadge } from "@/design-system";
import type {
  CategoriaLabel,
  Incidente,
  StatusLabel,
} from "@/hooks/incidentes-gestor/types";
import { styles } from "@/styles/gestor/incidentes.styles";
import { useUnistyles } from "@/utils/styles";

interface HistoricoMotoristaModalProps {
  visible: boolean;
  onClose: () => void;
  motoristaSelecionado: { id: string; nome: string } | null;
  incidentesMotorista: Incidente[];
  historicoLoading: boolean;
  categoriaLabels: Record<string, CategoriaLabel>;
  statusLabels: Record<string, StatusLabel>;
  formatDate: (date: string) => string;
  onVerDetalhes: (incidente: Incidente) => void;
}

export function HistoricoMotoristaModal({
  visible,
  onClose,
  motoristaSelecionado,
  incidentesMotorista,
  historicoLoading,
  categoriaLabels,
  statusLabels,
  formatDate,
  onVerDetalhes,
}: HistoricoMotoristaModalProps) {
  const { theme } = useUnistyles();

  if (!motoristaSelecionado) return null;

  const resumoAbertos = incidentesMotorista.filter(
    (i) => i.status === "aberto" || i.status === "em_analise",
  ).length;
  const resumoResolvidos = incidentesMotorista.filter(
    (i) => i.status === "resolvido" || i.status === "fechado",
  ).length;

  return (
    <DesktopModal
      visible={visible}
      onClose={onClose}
      title={`Histórico de Incidentes - ${motoristaSelecionado.nome}`}
      maxWidth={700}
    >
      {historicoLoading ? (
        <View style={styles.historicoLoadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.historicoLoadingText}>
            Carregando histórico...
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {incidentesMotorista.length === 0 ? (
            <View style={styles.emptyHistorico}>
              <Text style={styles.emptyHistoricoText}>
                Nenhum incidente encontrado para este motorista
              </Text>
            </View>
          ) : (
            <>
              {/* Resumo de contagens */}
              <View style={styles.historicoResumo}>
                <View style={styles.historicoResumoItem}>
                  <Text
                    style={[
                      styles.historicoResumoCount,
                      { color: theme.colors.error },
                    ]}
                  >
                    {resumoAbertos}
                  </Text>
                  <Text style={styles.historicoResumoLabel}>
                    {resumoAbertos === 1 ? "aberto" : "abertos"}
                  </Text>
                </View>
                <Text style={styles.historicoResumoDivider}>·</Text>
                <View style={styles.historicoResumoItem}>
                  <Text
                    style={[
                      styles.historicoResumoCount,
                      { color: theme.colors.success },
                    ]}
                  >
                    {resumoResolvidos}
                  </Text>
                  <Text style={styles.historicoResumoLabel}>
                    {resumoResolvidos === 1 ? "resolvido" : "resolvidos"}
                  </Text>
                </View>
                <Text style={styles.historicoResumoDivider}>·</Text>
                <View style={styles.historicoResumoItem}>
                  <Text
                    style={[
                      styles.historicoResumoCount,
                      { color: theme.colors.gray600 },
                    ]}
                  >
                    {incidentesMotorista.length}
                  </Text>
                  <Text style={styles.historicoResumoLabel}>total</Text>
                </View>
              </View>

              {/* Lista de incidentes */}
              {incidentesMotorista.map((inc) => {
                const cat = categoriaLabels[inc.categoria];
                const st = statusLabels[inc.status];

                return (
                  <TouchableOpacity
                    key={inc.id}
                    style={styles.historicoItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      onClose();
                      setTimeout(() => onVerDetalhes(inc), 300);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${cat.label} - ${st.label} - ${formatDate(inc.created_at)}`}
                    accessibilityHint="Toque para ver detalhes do incidente"
                  >
                    <View style={styles.historicoItemRow}>
                      <View style={styles.historicoItemContent}>
                        <View style={styles.historicoHeader}>
                          <View style={styles.historicoCategoria}>
                            <Ionicons
                              name={cat.icon}
                              size={16}
                              color={cat.color}
                            />
                            <Text style={styles.historicoCategoriaText}>
                              {cat.label}
                            </Text>
                          </View>
                          <StatusBadge
                            color={st.color}
                            label={st.label}
                            variant="soft"
                            size="sm"
                          />
                        </View>
                        <Text style={styles.historicoEndereco}>
                          {inc.endereco}
                        </Text>
                        <View style={styles.historicoMetaRow}>
                          <Text style={styles.historicoData}>
                            {formatDate(inc.created_at)}
                          </Text>
                          {inc.foto_url && (
                            <View style={styles.historicoFotoIndicator}>
                              <Ionicons
                                name="camera-outline"
                                size={12}
                                color={theme.colors.gray400}
                              />
                            </View>
                          )}
                        </View>
                        {inc.descricao && (
                          <Text
                            style={styles.historicoDescricao}
                            numberOfLines={2}
                          >
                            {inc.descricao}
                          </Text>
                        )}
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={theme.colors.gray400}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </DesktopModal>
  );
}
