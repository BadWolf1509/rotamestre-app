import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  FlatList,
  Platform,
  Keyboard,
} from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { geocodingService, UnifiedPlaceSuggestion } from '@/lib/geocoding';
import { logger } from '@/lib/logger';
import type { Coordenadas } from '@/types/endereco';
import { boxShadow } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface AddressAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  /**
   * Callback ao selecionar endereço.
   * Com Photon, coordenadas são retornadas diretamente (não precisa de getPlaceDetails).
   * @param address - Endereço formatado
   * @param placeId - ID único (formato: osm_N12345 ou osm_W12345)
   * @param coordinates - Coordenadas do local (Photon retorna automaticamente)
   */
  onSelectAddress: (
    address: string,
    placeId: string,
    coordinates?: Coordenadas,
  ) => void;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
  /** Force compact mode (auto-detects desktop if not provided) */
  compact?: boolean;
  /**
   * Coordenadas para priorizar resultados próximos (location bias).
   * Útil para priorizar endereços na região da unidade do usuário.
   */
  locationBias?: Coordenadas;
  /** Whether the field is required (adds aria-required for screen readers) */
  required?: boolean;
  /** Ref do formulário para foco automático no primeiro erro. */
  inputRef?: React.Ref<TextInput>;
}

/**
 * Componente de autocomplete de endereços com abordagem híbrida
 *
 * Features:
 * - Busca híbrida: Photon (gratuito) → Google (fallback) → ViaCEP (para CEPs)
 * - Busca a partir de 3 caracteres
 * - Debounce de 1000ms (1 segundo) para não interromper digitação rápida
 * - Detecção automática de CEP (busca via ViaCEP - gratuito)
 * - Fallback para Google Places quando Photon não encontra (melhor cobertura)
 * - Lista de sugestões com separação de texto principal e secundário
 * - Indicador visual da fonte (Photon, Google, CEP)
 * - TextInput otimizado com useCallback e React.memo para evitar perda de foco
 */
const AddressAutocompleteComponent = function AddressAutocomplete({
  value,
  onChangeText,
  onSelectAddress,
  placeholder = 'Endereço ou CEP',
  error,
  multiline = false,
  compact,
  locationBias,
  required = false,
  inputRef: externalInputRef,
}: AddressAutocompleteProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  // Use explicit compact prop if provided, otherwise auto-detect from viewport
  const useCompact = compact ?? isDesktop;

  // Stable IDs for ARIA combobox pattern
  const comboboxId = useId();
  const listboxId = `${comboboxId}-listbox`;
  const getOptionId = useCallback(
    (index: number) => `${comboboxId}-option-${index}`,
    [comboboxId],
  );
  const inputRef = useRef<TextInput>(null);
  const setInputRef = useCallback(
    (node: TextInput | null) => {
      inputRef.current = node;
      if (typeof externalInputRef === 'function') {
        externalInputRef(node);
      } else if (externalInputRef) {
        (externalInputRef as React.MutableRefObject<TextInput | null>).current =
          node;
      }
    },
    [externalInputRef],
  );
  const [suggestions, setSuggestions] = useState<UnifiedPlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track if last value change was from selection (not typing)
  const wasSelectedRef = useRef(false);
  // Track if user has interacted with the input (to skip initial search)
  const hasUserInteracted = useRef(false);
  // Track if we're fetching coordinates for a selected suggestion
  const [isFetchingCoords, setIsFetchingCoords] = useState(false);

  // Limpar suggestions quando value é limpo externamente
  useEffect(() => {
    if (value === '') {
      setSuggestions([]);
      setShowSuggestions(false);
      // Reset interaction tracking for next use (e.g., modal reopen)
      hasUserInteracted.current = false;
    }
  }, [value]);

  // Buscar sugestões com debounce
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Skip search if value was set by selection (not typing)
    if (wasSelectedRef.current) {
      wasSelectedRef.current = false;
      return;
    }

    // Skip search if user hasn't interacted yet (initial value from props)
    if (!hasUserInteracted.current) {
      return;
    }

    if (!value || value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoading(false);
      return;
    }

    // Não mostrar loading imediatamente - só após o debounce
    debounceTimer.current = setTimeout(async () => {
      setIsLoading(true);
      setShowSuggestions(true);

      try {
        // Busca híbrida: Photon (gratuito) → Google (fallback) → ViaCEP (para CEPs)
        // Passa locationBias para priorizar resultados próximos da região do usuário
        const results = await geocodingService.autocomplete(
          value,
          locationBias,
        );
        setSuggestions(results);
      } catch (error) {
        logger.error('[AddressAutocomplete] Erro no autocomplete:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 1000); // 1000ms de debounce (1 segundo = sem interrupções)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [value, locationBias]);

  // Extrair número do texto digitado pelo usuário
  const extractNumberFromInput = useCallback((input: string): string | null => {
    // Procura por padrões de número em várias posições do endereço brasileiro
    // Formatos comuns:
    // - "Rua X, 123" (número no final)
    // - "Rua X, 123, Bairro, Cidade" (número após primeira vírgula, seguido de mais vírgulas)
    // - "Rua X 123" (número após espaço no final)
    // - "Rua X nº 123" ou "número 123"
    const patterns = [
      // Número após primeira vírgula, seguido de outra vírgula (endereço completo)
      // Ex: "Rua X, 29, Bairro, Cidade" → captura "29"
      /,\s*(\d+[a-zA-Z]?(?:-[a-zA-Z0-9]+)?)\s*,/,

      // Número após vírgula no final do texto
      // Ex: "Rua X, 430" ou "Rua X, 430-A"
      /,\s*(\d+[a-zA-Z]?(?:-[a-zA-Z0-9]+)?)\s*$/,

      // Número após espaço no final do texto
      // Ex: "Rua X 430" ou "Rua X 430-A"
      /\s+(\d+[a-zA-Z]?(?:-[a-zA-Z0-9]+)?)\s*$/,

      // Número com prefixo "nº", "n.", "n°"
      // Ex: "Rua X nº 430" ou "Rua X n. 430-A"
      /\s+n[º°.]?\s*(\d+[a-zA-Z]?(?:-[a-zA-Z0-9]+)?)/i,

      // Número com prefixo "número"
      // Ex: "Rua X número 430"
      /\s+n[úu]mero\s*(\d+[a-zA-Z]?(?:-[a-zA-Z0-9]+)?)/i,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }, []);

  // Ref para guardar o valor digitado (evita problemas de closure stale)
  const lastTypedValueRef = useRef(value);
  useEffect(() => {
    // Atualiza ref apenas quando usuário digita (não quando seleciona)
    if (!wasSelectedRef.current) {
      lastTypedValueRef.current = value;
    }
  }, [value]);

  // Memoizar handlers para evitar re-renders
  const handleSelectSuggestion = useCallback(
    async (suggestion: UnifiedPlaceSuggestion) => {
      // Mark that next value change is from selection, not typing
      wasSelectedRef.current = true;

      // Usar o valor do ref para garantir que temos o valor correto
      const currentTypedValue = lastTypedValueRef.current;

      // Extrair número do valor digitado AGORA (não do closure)
      const numberFromInput = extractNumberFromInput(currentTypedValue);

      // Verificar se a sugestão já tem número
      const suggestionHasNumber =
        /,\s*\d+[a-zA-Z]?(?:-[a-zA-Z0-9]+)?(\s|,|$)/.test(
          suggestion.description,
        );

      // Se o usuário digitou um número e a sugestão não tem, adicionar
      let finalAddress = suggestion.description;
      if (numberFromInput && !suggestionHasNumber) {
        // Inserir número após o nome da rua (antes da primeira vírgula)
        const firstCommaIndex = suggestion.description.indexOf(',');
        if (firstCommaIndex > 0) {
          finalAddress =
            suggestion.description.slice(0, firstCommaIndex) +
            ', ' +
            numberFromInput +
            suggestion.description.slice(firstCommaIndex);
        } else {
          // Sem vírgula, adiciona no final
          finalAddress = suggestion.description + ', ' + numberFromInput;
        }
      }

      // Se já tem coordenadas, usar diretamente
      if (suggestion.coordinates) {
        onSelectAddress(
          finalAddress,
          suggestion.place_id,
          suggestion.coordinates,
        );
        setSuggestions([]);
        setShowSuggestions(false);
        Keyboard?.dismiss?.();
        return;
      }

      // Se precisa buscar coordenadas (Google ou ViaCEP)
      if (suggestion.needsCoordinates) {
        setIsFetchingCoords(true);
        setSuggestions([]);
        setShowSuggestions(false);

        try {
          const coords = await geocodingService.getCoordinates(suggestion);
          onSelectAddress(
            finalAddress,
            suggestion.place_id,
            coords || undefined,
          );
        } catch (error) {
          logger.error(
            '[AddressAutocomplete] Erro ao obter coordenadas:',
            error,
          );
          // Mesmo sem coordenadas, retorna o endereço
          onSelectAddress(finalAddress, suggestion.place_id, undefined);
        } finally {
          setIsFetchingCoords(false);
          Keyboard?.dismiss?.();
        }
        return;
      }

      // Fallback: retorna sem coordenadas
      onSelectAddress(finalAddress, suggestion.place_id, undefined);
      setSuggestions([]);
      setShowSuggestions(false);
      Keyboard?.dismiss?.();
    },
    [onSelectAddress, extractNumberFromInput],
  );

  const handleClearInput = useCallback(() => {
    onChangeText('');
    setSuggestions([]);
    setShowSuggestions(false);
  }, [onChangeText]);

  const handleFocus = useCallback(() => {
    // Mark that user has interacted - enables search from now on
    hasUserInteracted.current = true;
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [suggestions.length]);

  // Fechar dropdown ao perder foco (com delay para permitir clique nas sugestões)
  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setShowSuggestions(false);
    }, 150);
  }, []);

  // Estado para navegação por teclado (web)
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Reset selectedIndex quando sugestões mudam
  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  // Refs for keyboard handler to avoid stale closures
  const showSuggestionsRef = useRef(showSuggestions);
  const suggestionsRef = useRef(suggestions);
  const selectedIndexRef = useRef(selectedIndex);
  showSuggestionsRef.current = showSuggestions;
  suggestionsRef.current = suggestions;
  selectedIndexRef.current = selectedIndex;
  const handleSelectSuggestionRef = useRef(handleSelectSuggestion);
  handleSelectSuggestionRef.current = handleSelectSuggestion;

  // Keyboard navigation via DOM addEventListener (RNW overrides onKeyDown on TextInput)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node =
      (inputRef.current as unknown as { _node?: HTMLElement })?._node ??
      (inputRef.current as unknown as HTMLElement);
    if (!node?.addEventListener) return;

    const handler = (e: Event) => {
      const ke = e as KeyboardEvent;
      if (!showSuggestionsRef.current || suggestionsRef.current.length === 0)
        return;

      switch (ke.key) {
        case 'ArrowDown':
          ke.preventDefault();
          setSelectedIndex((prev) =>
            prev < suggestionsRef.current.length - 1 ? prev + 1 : prev,
          );
          break;
        case 'ArrowUp':
          ke.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case 'Enter':
          if (selectedIndexRef.current >= 0) {
            ke.preventDefault();
            handleSelectSuggestionRef.current(
              suggestionsRef.current[selectedIndexRef.current],
            );
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          setSelectedIndex(-1);
          break;
        case 'Tab':
          setShowSuggestions(false);
          setSelectedIndex(-1);
          break;
      }
    };

    node.addEventListener('keydown', handler);
    return () => node.removeEventListener('keydown', handler);
  }, []);

  // Ícone baseado na fonte
  const getSourceIcon = useCallback(
    (source: UnifiedPlaceSuggestion['source']) => {
      switch (source) {
        case 'viacep':
          return '📮'; // CEP/Correios
        case 'google':
        default:
          return '🔍'; // Google
      }
    },
    [],
  );

  // Memoizar renderItem para estabilizar callbacks em testes
  const renderSuggestionItem = useCallback(
    ({ item, index }: { item: UnifiedPlaceSuggestion; index: number }) => {
      const suggestionHasNumber =
        /,\s*\d+[a-zA-Z]?(?:-[a-zA-Z0-9]+)?(\s|,|$)/.test(
          item.structured_formatting.main_text,
        );

      // Extrair número do valor atual (usar ref para valor mais recente)
      const currentNumber = extractNumberFromInput(lastTypedValueRef.current);

      // Adicionar número ao texto principal se não tiver
      let displayMainText = item.structured_formatting.main_text;
      if (currentNumber && !suggestionHasNumber) {
        displayMainText = `${item.structured_formatting.main_text}, ${currentNumber}`;
      }

      const isSelected = index === selectedIndex;

      const sourceLabel =
        item.source === 'viacep' ? 'Resultado via CEP' : 'Resultado de busca';
      const fullLabel = `${sourceLabel}: ${displayMainText}, ${item.structured_formatting.secondary_text}${item.cep ? ', CEP: ' + item.cep : ''}`;

      return (
        <TouchableOpacity
          testID="suggestion-item"
          nativeID={getOptionId(index)}
          style={[
            styles.suggestionItem,
            useCompact && styles.suggestionItemCompact,
            isSelected && styles.suggestionItemSelected,
          ]}
          onPress={() => handleSelectSuggestion(item)}
          activeOpacity={0.7}
          accessibilityLabel={fullLabel}
          accessibilityHint="Toque para selecionar este endereço"
          accessibilityRole={Platform.OS !== 'web' ? 'button' : undefined}
          {...(Platform.OS === 'web'
            ? ({
                role: 'option' as any,
                'aria-selected': isSelected,
              } as any)
            : {})}
        >
          <View
            style={[
              styles.suggestionIcon,
              useCompact && styles.suggestionIconCompact,
            ]}
            accessibilityElementsHidden={true}
            importantForAccessibility="no-hide-descendants"
            {...(Platform.OS === 'web' ? { 'aria-hidden': true } : {})}
          >
            <Text
              style={[
                styles.suggestionIconText,
                useCompact && styles.suggestionIconTextCompact,
              ]}
            >
              {getSourceIcon(item.source)}
            </Text>
          </View>
          <View style={styles.suggestionTextContainer}>
            <Text
              style={[
                styles.suggestionMainText,
                useCompact && styles.suggestionMainTextCompact,
              ]}
            >
              {displayMainText}
            </Text>
            <Text
              style={[
                styles.suggestionSecondaryText,
                useCompact && styles.suggestionSecondaryTextCompact,
              ]}
            >
              {item.structured_formatting.secondary_text}
              {item.cep ? ` • CEP: ${item.cep}` : ''}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [
      handleSelectSuggestion,
      useCompact,
      extractNumberFromInput,
      selectedIndex,
      getSourceIcon,
      getOptionId,
    ],
  );

  // ItemSeparator extraído para evitar recriação a cada render
  const ItemSeparator = useCallback(
    () => <View style={styles.separator} />,
    [],
  );

  // Conteúdo do dropdown (loading, sugestões, no results, hint)
  const renderDropdownContent = () => {
    // Loading para busca de coordenadas
    if (isFetchingCoords) {
      return (
        <View style={styles.loadingContainer} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Obtendo localização...</Text>
        </View>
      );
    }

    if (isLoading) {
      return (
        <View style={styles.loadingContainer} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Buscando endereços...</Text>
        </View>
      );
    }

    if (showSuggestions && suggestions.length > 0) {
      return (
        <View
          style={styles.suggestionsContainer}
          nativeID={listboxId}
          accessibilityRole="list"
          accessibilityLabel={`Sugestões de endereço, ${suggestions.length} resultado${suggestions.length > 1 ? 's' : ''}`}
          accessibilityLiveRegion="polite"
          {...(Platform.OS === 'web' ? { role: 'listbox' as any } : {})}
        >
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.place_id}
            renderItem={renderSuggestionItem}
            ItemSeparatorComponent={ItemSeparator}
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          />
        </View>
      );
    }

    if (
      showSuggestions &&
      suggestions.length === 0 &&
      value &&
      value.length >= 3
    ) {
      return (
        <View
          style={styles.noResultsContainer}
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
        >
          <Text style={styles.noResultsText}>
            Nenhum endereço encontrado. Tente ser mais específico.
          </Text>
        </View>
      );
    }

    if (!showSuggestions && value && value.length > 0 && value.length < 3) {
      return (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>
            Digite pelo menos 3 caracteres para buscar
          </Text>
        </View>
      );
    }

    // Mostrar dica quando campo vazio ou com pouco texto
    if (!value || value.length === 0) {
      return (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>
            Dica: Use CEP + número para resultado rápido (ex: 58068-504, 100)
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            useCompact && styles.inputCompact,
            error && styles.inputError,
            multiline && styles.inputMultiline,
            { pointerEvents: 'auto' },
          ]}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.gray400}
          value={value || ''}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          multiline={multiline}
          numberOfLines={multiline ? 2 : 1}
          textAlignVertical={multiline ? 'top' : 'center'}
          autoCorrect={false}
          autoCapitalize="words"
          blurOnSubmit={false}
          returnKeyType="done"
          editable={true}
          selectTextOnFocus={false}
          nativeID={comboboxId}
          accessibilityLabel="Campo de endereço"
          accessibilityHint="Digite o endereço para buscar sugestões"
          aria-invalid={!!error}
          aria-required={required}
          ref={setInputRef}
          {...(Platform.OS === 'web'
            ? {
                role: 'combobox',
                'aria-expanded': showSuggestions && suggestions.length > 0,
                'aria-autocomplete': 'list',
                'aria-controls': listboxId,
                'aria-activedescendant':
                  selectedIndex >= 0 ? getOptionId(selectedIndex) : undefined,
              }
            : {})}
        />
        {value && value.length > 0 && (
          <TouchableOpacity
            style={[
              styles.clearButton,
              useCompact && styles.clearButtonCompact,
            ]}
            onPress={handleClearInput}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Limpar endereço"
          >
            <Text
              style={[
                styles.clearButtonText,
                useCompact && styles.clearButtonTextCompact,
              ]}
              {...(Platform.OS === 'web' ? { 'aria-hidden': true } : {})}
            >
              ×
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <Text style={styles.errorText} accessibilityLiveRegion="assertive">
          {error}
        </Text>
      )}

      {/* Dropdown com position absolute */}
      {renderDropdownContent()}
    </View>
  );
};

// Exportar com React.memo customizado que ignora mudanças nas funções
// Isso evita re-renders desnecessários que causam perda de foco
export const AddressAutocomplete = React.memo(
  AddressAutocompleteComponent,
  (prevProps, nextProps) => {
    // Comparar apenas value, placeholder, error, multiline, compact e locationBias
    // Ignorar funções (onChangeText, onSelectAddress) para evitar re-renders
    return (
      prevProps.value === nextProps.value &&
      prevProps.onChangeText === nextProps.onChangeText &&
      prevProps.onSelectAddress === nextProps.onSelectAddress &&
      prevProps.inputRef === nextProps.inputRef &&
      prevProps.placeholder === nextProps.placeholder &&
      prevProps.error === nextProps.error &&
      prevProps.multiline === nextProps.multiline &&
      prevProps.compact === nextProps.compact &&
      prevProps.required === nextProps.required &&
      prevProps.locationBias?.latitude === nextProps.locationBias?.latitude &&
      prevProps.locationBias?.longitude === nextProps.locationBias?.longitude
    );
  },
);

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    marginBottom: theme.spacing.sm,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSans,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    paddingRight: theme.spacing.xl + theme.spacing.xs,
  },
  inputCompact: {
    padding: theme.spacing.xs,
    paddingRight: theme.spacing.lg,
    fontSize: theme.components.input.size.medium.fontSize,
    height: theme.components.input.size.medium.height,
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  clearButton: {
    position: 'absolute',
    right: theme.spacing.sm,
    top: theme.spacing.sm,
    width: theme.spacing.lg,
    height: theme.spacing.lg,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonCompact: {
    right: theme.spacing.xs,
    top: theme.spacing.xs,
    width: theme.spacing.md + theme.spacing.xs,
    height: theme.spacing.md + theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  clearButtonText: {
    color: theme.colors.surface,
    fontSize: theme.typography.sm,
    fontWeight: 'bold',
  },
  clearButtonTextCompact: {
    fontSize: theme.typography.xs,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSans,
    marginTop: theme.spacing.xs,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.disabled,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.xs,
  },
  loadingText: {
    marginLeft: theme.spacing.xs,
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.textSecondary,
  },
  suggestionsContainer: {
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: 200,
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: boxShadow(0, 2, 8, 0, theme.colors.black, 0.1),
      },
    }),
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  suggestionItemCompact: {
    padding: theme.spacing.xs,
  },
  suggestionItemSelected: {
    backgroundColor: theme.colors.disabled,
  },
  suggestionIcon: {
    width: theme.spacing.lg,
    height: theme.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  suggestionIconCompact: {
    width: theme.spacing.lg,
    height: theme.spacing.lg,
    marginRight: theme.spacing.xs,
  },
  suggestionIconText: {
    fontSize: theme.typography.xl,
  },
  suggestionIconTextCompact: {
    fontSize: theme.typography.base,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionMainText: {
    fontSize: theme.typography.base - 1,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.text,
    marginBottom: theme.spacing['0.5'],
  },
  suggestionMainTextCompact: {
    fontSize: theme.components.input.size.medium.fontSize,
    marginBottom: 1,
  },
  suggestionSecondaryText: {
    fontSize: theme.typography.sm - 1,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.textSecondary,
  },
  suggestionSecondaryTextCompact: {
    fontSize: theme.typography.xs,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  noResultsContainer: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  noResultsText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.error,
    textAlign: 'center',
  },
  hintContainer: {
    marginTop: theme.spacing.xs,
  },
  hintText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
}));
