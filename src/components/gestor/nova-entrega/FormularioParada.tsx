/**
 * FormularioParada - Memoized form component for adding stops
 *
 * Extracted from nova-entrega.tsx to reduce file size.
 * Handles: tipo selection, vinculo, address autocomplete, destinatario, telefone, observacoes
 */

import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import {
  Controller,
  Control,
  FieldErrors,
  UseFormWatch,
  UseFormHandleSubmit,
} from "react-hook-form";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";

import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { useResponsive } from "@/hooks/useResponsive";
import { maskPhone } from "@/lib/phone";
import type { Coordenadas } from "@/types/endereco";
import { useUnistyles } from "@/utils/styles";

import { novaEntregaStyles as styles } from "./styles";

import type { Parada, ParadaFormData, ParadaFormDataWithCoords } from "./types";

export interface FormularioParadaProps {
  control: Control<ParadaFormDataWithCoords>;
  errors: FieldErrors<ParadaFormDataWithCoords>;
  setValue: (name: "latitude" | "longitude", value: number) => void;
  handleSubmit: UseFormHandleSubmit<ParadaFormDataWithCoords>;
  watch: UseFormWatch<ParadaFormDataWithCoords>;
  onAddParada: (data: ParadaFormData, vinculoId?: string) => void;
  isLoading: boolean;
  retiradasDisponiveis: Parada[];
  vinculoSelecionado: string;
  setVinculoSelecionado: (id: string) => void;
  /** Coordenadas da unidade para priorizar resultados próximos */
  locationBias?: Coordenadas;
  /** Whether the current address has valid coordinates */
  hasValidCoordinates?: boolean;
}

export const FormularioParada = memo(function FormularioParada({
  control,
  errors,
  setValue,
  handleSubmit,
  watch,
  onAddParada,
  isLoading,
  retiradasDisponiveis,
  vinculoSelecionado,
  setVinculoSelecionado,
  locationBias,
  hasValidCoordinates = false,
}: FormularioParadaProps) {
  const { theme } = useUnistyles();
  const { isDesktop, isTablet, isMobile } = useResponsive();
  const tipoAtual = watch("tipo");

  return (
    <View
      style={[
        styles.form,
        isDesktop && styles.formDesktop,
        isTablet && styles.formTablet,
        isMobile && styles.formMobileInner,
      ]}
    >
      {/* Título só aparece em tablet - desktop usa header do DesktopCard, mobile usa MobileCard */}
      {isTablet && <Text style={styles.sectionTitle}>Adicionar Parada</Text>}

      <Controller
        control={control}
        name="tipo"
        render={({ field: { onChange, value } }) => (
          <View
            style={[styles.radioGroup, isDesktop && styles.radioGroupDesktop]}
          >
            <TouchableOpacity
              style={[
                styles.radioButton,
                isDesktop && styles.radioButtonDesktop,
                value === "entrega" && styles.radioButtonActive,
              ]}
              onPress={() => onChange("entrega")}
              accessibilityLabel="Selecionar tipo entrega"
              accessibilityRole="radio"
              accessibilityState={{ checked: value === "entrega" }}
            >
              <Ionicons
                name="arrow-down-circle"
                size={isDesktop ? 16 : 18}
                color={
                  value === "entrega"
                    ? theme.colors.white
                    : theme.colors.primary
                }
                style={styles.radioIcon}
              />
              <Text
                style={[
                  styles.radioText,
                  isDesktop && styles.radioTextDesktop,
                  value === "entrega" && styles.radioTextActive,
                ]}
              >
                Entrega
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.radioButton,
                styles.radioButtonRetirada,
                isDesktop && styles.radioButtonDesktop,
                value === "retirada" && styles.radioButtonRetiradaActive,
              ]}
              onPress={() => {
                onChange("retirada");
                setVinculoSelecionado("");
              }}
              accessibilityLabel="Selecionar tipo retirada"
              accessibilityRole="radio"
              accessibilityState={{ checked: value === "retirada" }}
            >
              <Ionicons
                name="arrow-up-circle"
                size={isDesktop ? 16 : 18}
                color={
                  value === "retirada"
                    ? theme.colors.white
                    : theme.colors.warning
                }
                style={styles.radioIcon}
              />
              <Text
                style={[
                  styles.radioText,
                  styles.radioTextRetirada,
                  isDesktop && styles.radioTextDesktop,
                  value === "retirada" && styles.radioTextActive,
                ]}
              >
                Retirada
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Seletor de Vínculo */}
      {tipoAtual === "entrega" && retiradasDisponiveis.length > 0 && (
        <View
          style={[
            styles.vinculoSection,
            isDesktop && styles.vinculoSectionDesktop,
          ]}
        >
          <Text
            style={[
              styles.vinculoLabel,
              isDesktop && styles.vinculoLabelDesktop,
            ]}
          >
            Vincular a uma retirada? (equipamento locado)
          </Text>
          <Text
            style={[styles.vinculoHint, isDesktop && styles.vinculoHintDesktop]}
          >
            Se esta entrega usa equipamento que será retirado de outro cliente,
            selecione a retirada correspondente
          </Text>
          <View
            style={[
              styles.vinculoOptions,
              isDesktop && styles.vinculoOptionsDesktop,
            ]}
          >
            <TouchableOpacity
              style={[
                styles.vinculoOption,
                isDesktop && styles.vinculoOptionDesktop,
                !vinculoSelecionado && styles.vinculoOptionActive,
              ]}
              onPress={() => setVinculoSelecionado("")}
              accessibilityLabel="Sem vínculo a retirada"
              accessibilityRole="radio"
              accessibilityState={{ checked: !vinculoSelecionado }}
            >
              <Text
                style={[
                  styles.vinculoOptionText,
                  isDesktop && styles.vinculoOptionTextDesktop,
                  !vinculoSelecionado && styles.vinculoOptionTextActive,
                ]}
              >
                Sem vínculo
              </Text>
            </TouchableOpacity>
            {retiradasDisponiveis.map((retirada) => {
              const isSelected = vinculoSelecionado === retirada.id;
              const retiradaNome =
                retirada.destinatario || retirada.endereco.substring(0, 30);
              return (
                <TouchableOpacity
                  key={retirada.id}
                  style={[
                    styles.vinculoOption,
                    isDesktop && styles.vinculoOptionDesktop,
                    isSelected && styles.vinculoOptionActive,
                  ]}
                  onPress={() => setVinculoSelecionado(retirada.id)}
                  accessibilityLabel={`Vincular a retirada: ${retiradaNome}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                >
                  <Text
                    style={[
                      styles.vinculoOptionText,
                      isDesktop && styles.vinculoOptionTextDesktop,
                      isSelected && styles.vinculoOptionTextActive,
                    ]}
                    numberOfLines={2}
                  >
                    {retiradaNome}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Endereço com badge de validação */}
      <View style={styles.fieldWithLabel}>
        <View style={styles.labelRow}>
          <Text
            style={[styles.fieldLabel, isDesktop && styles.fieldLabelDesktop]}
          >
            Endereço *
          </Text>
          {hasValidCoordinates && (
            <View
              style={[
                styles.validatedBadge,
                isDesktop && styles.validatedBadgeDesktop,
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={isDesktop ? 14 : 16}
                color={theme.colors.success}
              />
              <Text
                style={[
                  styles.validatedText,
                  isDesktop && styles.validatedTextDesktop,
                ]}
              >
                Validado
              </Text>
            </View>
          )}
        </View>
        <Controller
          control={control}
          name="endereco"
          render={({ field: { onChange, value } }) => (
            <AddressAutocomplete
              value={value || ""}
              onChangeText={onChange}
              onSelectAddress={(
                address,
                _placeId,
                coordinates?: Coordenadas,
              ) => {
                onChange(address);
                if (coordinates) {
                  setValue("latitude", coordinates.latitude);
                  setValue("longitude", coordinates.longitude);
                }
              }}
              error={errors.endereco?.message}
              multiline
              locationBias={locationBias}
              required
            />
          )}
        />
      </View>

      <Controller
        control={control}
        name="destinatario"
        render={({ field: { onChange, value } }) => (
          <>
            <TextInput
              style={[
                styles.input,
                isDesktop && styles.inputDesktop,
                errors.destinatario && styles.inputError,
              ]}
              placeholder="Nome do destinatário"
              value={value}
              onChangeText={onChange}
              accessibilityLabel="Campo de nome do destinatário"
              accessibilityHint="Digite o nome completo do destinatário"
            />
            {errors.destinatario && (
              <Text
                style={[styles.errorText, isDesktop && styles.errorTextDesktop]}
              >
                {errors.destinatario.message}
              </Text>
            )}
          </>
        )}
      />

      <Controller
        control={control}
        name="telefone"
        render={({ field: { onChange, value } }) => (
          <>
            <TextInput
              style={[
                styles.input,
                isDesktop && styles.inputDesktop,
                errors.telefone && styles.inputError,
              ]}
              placeholder="(00) 00000-0000"
              placeholderTextColor={theme.colors.gray400}
              value={value}
              onChangeText={(text) => onChange(maskPhone(text))}
              keyboardType="phone-pad"
              maxLength={15}
              accessibilityLabel="Campo de telefone do destinatário"
              accessibilityHint="Digite o telefone do destinatário com DDD"
            />
            {errors.telefone && (
              <Text
                style={[styles.errorText, isDesktop && styles.errorTextDesktop]}
              >
                {errors.telefone.message}
              </Text>
            )}
          </>
        )}
      />

      <Controller
        control={control}
        name="observacoes"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={[
              styles.input,
              isDesktop && styles.inputDesktop,
              styles.textArea,
              isDesktop && styles.textAreaDesktop,
            ]}
            placeholder="Observações (opcional)"
            placeholderTextColor={theme.colors.gray400}
            value={value}
            onChangeText={onChange}
            multiline
            numberOfLines={3}
            maxLength={300}
            accessibilityLabel="Campo de observações"
            accessibilityHint="Digite observações adicionais sobre a entrega (máximo 300 caracteres)"
          />
        )}
      />

      <TouchableOpacity
        style={[styles.addButton, isDesktop && styles.addButtonDesktop]}
        onPress={handleSubmit((data: ParadaFormData) => {
          onAddParada(data, vinculoSelecionado || undefined);
          setVinculoSelecionado("");
        })}
        disabled={isLoading}
        accessibilityLabel="Adicionar parada à lista"
        accessibilityRole="button"
        accessibilityState={{ disabled: isLoading }}
      >
        {isLoading ? (
          <ActivityIndicator color={theme.colors.white} />
        ) : (
          <Text
            style={[
              styles.addButtonText,
              isDesktop && styles.addButtonTextDesktop,
            ]}
          >
            + Adicionar Parada
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
});
