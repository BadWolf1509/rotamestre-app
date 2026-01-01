import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { googleMapsService, PlaceSuggestion } from '@/lib/google';
import { boxShadow } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface AddressAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectAddress: (address: string, placeId: string) => void;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
  /** Force compact mode (auto-detects desktop if not provided) */
  compact?: boolean;
}

/**
 * Componente de autocomplete de endereços usando Google Places API
 *
 * Features:
 * - Busca a partir de 3 caracteres
 * - Debounce de 1000ms (1 segundo) para não interromper digitação rápida
 * - Session tokens para agrupar chamadas e reduzir custos
 * - Lista de sugestões com separação de texto principal e secundário
 * - Coordenadas obtidas automaticamente ao selecionar
 * - TextInput otimizado com useCallback e React.memo para evitar perda de foco
 */
const AddressAutocompleteComponent = function AddressAutocomplete({
  value,
  onChangeText,
  onSelectAddress,
  placeholder = 'Digite o endereco completo',
  error,
  multiline = false,
  compact,
}: AddressAutocompleteProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  // Use explicit compact prop if provided, otherwise auto-detect from viewport
  const useCompact = compact ?? isDesktop;
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sessionToken] = useState(() => generateSessionToken());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track if last value change was from selection (not typing)
  const wasSelectedRef = useRef(false);
  // Track if user has interacted with the input (to skip initial search)
  const hasUserInteracted = useRef(false);

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
        const results = await googleMapsService.autocompleteAddress(value, sessionToken);
        setSuggestions(results);
      } catch (error) {
        console.error('Erro no autocomplete:', error);
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
  }, [value, sessionToken]);

  // Memoizar handlers para evitar re-renders
  const handleSelectSuggestion = useCallback((suggestion: PlaceSuggestion) => {
    // Mark that next value change is from selection, not typing
    wasSelectedRef.current = true;
    onSelectAddress(suggestion.description, suggestion.place_id);
    setSuggestions([]);
    setShowSuggestions(false);
    Keyboard?.dismiss?.();
  }, [onSelectAddress]);

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

  // Memoizar renderItem para estabilizar callbacks em testes
  const renderSuggestionItem = useCallback(
    ({ item }: { item: PlaceSuggestion }) => (
      <TouchableOpacity
        testID="suggestion-item"
        style={[styles.suggestionItem, useCompact && styles.suggestionItemCompact]}
        onPress={() => handleSelectSuggestion(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.suggestionIcon, useCompact && styles.suggestionIconCompact]}>
          <Text style={[styles.suggestionIconText, useCompact && styles.suggestionIconTextCompact]}>📍</Text>
        </View>
        <View style={styles.suggestionTextContainer}>
          <Text style={[styles.suggestionMainText, useCompact && styles.suggestionMainTextCompact]}>
            {item.structured_formatting.main_text}
          </Text>
          <Text style={[styles.suggestionSecondaryText, useCompact && styles.suggestionSecondaryTextCompact]}>
            {item.structured_formatting.secondary_text}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [handleSelectSuggestion, useCompact]
  );

  // Conteúdo do dropdown (loading, sugestões, no results, hint)
  const renderDropdownContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Buscando endereços...</Text>
        </View>
      );
    }

    if (showSuggestions && suggestions.length > 0) {
      return (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.place_id}
            renderItem={renderSuggestionItem}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          />
        </View>
      );
    }

    if (showSuggestions && suggestions.length === 0 && value && value.length >= 3) {
      return (
        <View style={styles.noResultsContainer}>
          <Text style={styles.noResultsText}>
            Nenhum endereço encontrado. Tente ser mais específico.
          </Text>
        </View>
      );
    }

    if (!showSuggestions && value && value.length > 0 && value.length < 3) {
      return (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>Digite pelo menos 3 caracteres para buscar</Text>
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
          ]}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.gray400}
          value={value || ''}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          multiline={multiline}
          numberOfLines={multiline ? 2 : 1}
          textAlignVertical={multiline ? 'top' : 'center'}
          autoCorrect={false}
          autoCapitalize="words"
          blurOnSubmit={false}
          returnKeyType="done"
          editable={true}
          selectTextOnFocus={false}
          pointerEvents="auto"
        />
        {value && value.length > 0 && (
          <TouchableOpacity
            style={[styles.clearButton, useCompact && styles.clearButtonCompact]}
            onPress={handleClearInput}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.clearButtonText, useCompact && styles.clearButtonTextCompact]}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

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
    // Comparar apenas value, placeholder, error, multiline e compact
    // Ignorar funções (onChangeText, onSelectAddress) para evitar re-renders
    return (
      prevProps.value === nextProps.value &&
      prevProps.placeholder === nextProps.placeholder &&
      prevProps.error === nextProps.error &&
      prevProps.multiline === nextProps.multiline &&
      prevProps.compact === nextProps.compact
    );
  }
);

// Gerar session token único para agrupar chamadas
function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

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
    marginBottom: 2,
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


