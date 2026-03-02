/**
 * Modal for viewing incident details.
 * Extracted from app/gestor/incidentes.tsx for maintainability.
 */

import { Ionicons } from "@expo/vector-icons";
import {
  View,
  TouchableOpacity,
  ScrollView,
  Image,
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

interface IncidenteDetalhesModalProps {
  incidente: Incidente | null;
  visible: boolean;
  onClose: () => void;
  isDesktop: boolean;
  categoriaLabels: Record<string, CategoriaLabel>;
  statusLabels: Record<string, StatusLabel>;
  fotoLoading: boolean;
  fotoError: boolean;
  fotoRetryCount: number;
  onFotoLoad: () => void;
  onFotoError: () => void;
  onFotoRetry: () => void;
  onAlterarStatus: (incidente: Incidente) => void;
  onRemarcarEntrega: (incidente: Incidente) => void;
  onVerHistoricoMotorista: (motoristaId: string, nome: string) => void;
  formatDate: (date: string) => string;
}

export function IncidenteDetalhesModal({
  incidente,
  visible,
  onClose,
  isDesktop,
  categoriaLabels,
  statusLabels,
  fotoLoading,
  fotoError,
  fotoRetryCount,
  onFotoLoad,
  onFotoError,
  onFotoRetry,
  onAlterarStatus,
  onRemarcarEntrega,
  onVerHistoricoMotorista,
  formatDate,
}: IncidenteDetalhesModalProps) {
  const { theme } = useUnistyles();

  if (!incidente) return null;

  const cat = categoriaLabels[incidente.categoria];
  const st = statusLabels[incidente.status];

  const fotoUri = incidente.foto_url
    ? fotoRetryCount > 0
      ? `${incidente.foto_url}?retry=${fotoRetryCount}`
      : incidente.foto_url
    : null;

  return (
    <DesktopModal
      visible={visible}
      onClose={onClose}
      title="Detalhes do Incidente"
      maxWidth={600}
      primaryButton={{
        text: "Alterar Status",
        onPress: () => {
          onClose();
          setTimeout(() => onAlterarStatus(incidente), 300);
        },
      }}
      secondaryButton={{
        text: "Remarcar Entrega",
        onPress: () => onRemarcarEntrega(incidente),
      }}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.detalhesHeader,
            isDesktop && styles.detalhesHeaderCompact,
          ]}
        >
          <View style={styles.detalhesCategoria}>
            <Ionicons
              name={cat.icon}
              size={isDesktop ? 20 : 24}
              color={cat.color}
            />
            <Text
              style={[
                styles.detalhesCategoriaText,
                isDesktop && styles.detalhesCategoriaTextCompact,
              ]}
            >
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

        <View
          style={[
            styles.detalhesSection,
            isDesktop && styles.detalhesSectionCompact,
          ]}
        >
          <Text
            style={[
              styles.detalhesLabel,
              isDesktop && styles.detalhesLabelCompact,
            ]}
          >
            Data/Hora:
          </Text>
          <Text
            style={[
              styles.detalhesValue,
              isDesktop && styles.detalhesValueCompact,
            ]}
          >
            {formatDate(incidente.created_at)}
          </Text>
        </View>

        <View
          style={[
            styles.detalhesSection,
            isDesktop && styles.detalhesSectionCompact,
          ]}
        >
          <Text
            style={[
              styles.detalhesLabel,
              isDesktop && styles.detalhesLabelCompact,
            ]}
          >
            Motorista:
          </Text>
          <Text
            style={[
              styles.detalhesValue,
              isDesktop && styles.detalhesValueCompact,
            ]}
          >
            {incidente.motorista_nome}
          </Text>
        </View>

        <View
          style={[
            styles.detalhesSection,
            isDesktop && styles.detalhesSectionCompact,
          ]}
        >
          <Text
            style={[
              styles.detalhesLabel,
              isDesktop && styles.detalhesLabelCompact,
            ]}
          >
            Local:
          </Text>
          <Text
            style={[
              styles.detalhesValue,
              isDesktop && styles.detalhesValueCompact,
            ]}
          >
            {incidente.endereco}
          </Text>
        </View>

        {incidente.rota_id && (
          <View
            style={[
              styles.detalhesSection,
              isDesktop && styles.detalhesSectionCompact,
            ]}
          >
            <Text
              style={[
                styles.detalhesLabel,
                isDesktop && styles.detalhesLabelCompact,
              ]}
            >
              Rota:
            </Text>
            <Text
              style={[
                styles.detalhesValue,
                isDesktop && styles.detalhesValueCompact,
              ]}
            >
              {incidente.rota_data
                ? `Rota de ${new Date(incidente.rota_data).toLocaleDateString("pt-BR")}`
                : "N/A"}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.detalhesSection,
            isDesktop && styles.detalhesSectionCompact,
          ]}
        >
          <Text
            style={[
              styles.detalhesLabel,
              isDesktop && styles.detalhesLabelCompact,
            ]}
          >
            Descrição:
          </Text>
          <Text
            style={[
              styles.detalhesDescricao,
              isDesktop && styles.detalhesDescricaoCompact,
            ]}
          >
            {incidente.descricao}
          </Text>
        </View>

        {/* Foto */}
        {fotoUri && (
          <View
            style={[
              styles.detalhesSection,
              isDesktop && styles.detalhesSectionCompact,
            ]}
          >
            <Text
              style={[
                styles.detalhesLabel,
                isDesktop && styles.detalhesLabelCompact,
              ]}
            >
              Foto:
            </Text>
            <View
              style={[
                styles.fotoContainer,
                isDesktop && styles.fotoContainerCompact,
              ]}
            >
              {fotoLoading && !fotoError && (
                <View style={styles.fotoLoadingContainer}>
                  <ActivityIndicator
                    size="large"
                    color={theme.colors.primary}
                  />
                  <Text style={styles.fotoLoadingText}>Carregando foto...</Text>
                </View>
              )}

              {fotoError && (
                <View style={styles.fotoErrorContainer}>
                  <Ionicons
                    name="image-outline"
                    size={48}
                    color={theme.colors.gray400}
                  />
                  <Text style={styles.fotoErrorText}>
                    Não foi possível carregar a foto
                  </Text>
                  <TouchableOpacity
                    style={styles.fotoRetryButton}
                    onPress={onFotoRetry}
                  >
                    <Ionicons
                      name="refresh"
                      size={16}
                      color={theme.colors.primary}
                    />
                    <Text style={styles.fotoRetryText}>Tentar novamente</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!fotoError && (
                <Image
                  source={{ uri: fotoUri }}
                  style={[
                    styles.incidenteFoto,
                    isDesktop && styles.incidenteFotoCompact,
                    { opacity: fotoLoading ? 0 : 1 },
                  ]}
                  resizeMode="cover"
                  onLoad={onFotoLoad}
                  onError={onFotoError}
                  accessibilityLabel={`Foto do incidente: ${cat.label}`}
                />
              )}
            </View>
          </View>
        )}

        {incidente.observacoes_gestao && (
          <View
            style={[
              styles.detalhesSection,
              isDesktop && styles.detalhesSectionCompact,
            ]}
          >
            <Text
              style={[
                styles.detalhesLabel,
                isDesktop && styles.detalhesLabelCompact,
              ]}
            >
              Observações da Gestão:
            </Text>
            <Text
              style={[
                styles.detalhesDescricao,
                isDesktop && styles.detalhesDescricaoCompact,
              ]}
            >
              {incidente.observacoes_gestao}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.verHistoricoLink,
            isDesktop && styles.verHistoricoLinkCompact,
          ]}
          onPress={() => {
            onClose();
            setTimeout(
              () =>
                onVerHistoricoMotorista(
                  incidente.motorista_id,
                  incidente.motorista_nome,
                ),
              300,
            );
          }}
          accessibilityRole="link"
        >
          <Ionicons
            name="time-outline"
            size={isDesktop ? 14 : 16}
            color={theme.colors.primary}
          />
          <Text
            style={[
              styles.verHistoricoLinkText,
              isDesktop && styles.verHistoricoLinkTextCompact,
            ]}
          >
            Ver histórico de incidentes deste motorista
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </DesktopModal>
  );
}
