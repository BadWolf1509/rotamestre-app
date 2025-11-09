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

import { googleMapsService, PlaceSuggestion } from '@/lib/google';
import { StyleSheet } from '@/utils/styles';

interface AddressAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectAddress: (address: string, placeId: string) => void;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
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
  placeholder = 'Digite o endereço completo',
  error,
  multiline = false,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sessionToken] = useState(() => generateSessionToken());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpar suggestions quando value é limpo externamente
  useEffect(() => {
    if (value === '') {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [value]);

  // Buscar sugestões com debounce
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
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
    onSelectAddress(suggestion.description, suggestion.place_id);
    setSuggestions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();
  }, [onSelectAddress]);

  const handleClearInput = useCallback(() => {
    onChangeText('');
    setSuggestions([]);
    setShowSuggestions(false);
  }, [onChangeText]);

  const handleFocus = useCallback(() => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [suggestions.length]);

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            error && styles.inputError,
            multiline && styles.inputMultiline,
          ]}
          placeholder={placeholder}
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
        />
        {value && value.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearInput}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Indicador de carregamento - Só mostra se demorar mais de 300ms */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#0D5A9C" />
          <Text style={styles.loadingText}>Buscando endereços...</Text>
        </View>
      )}

      {/* Lista de sugestões */}
      {showSuggestions && suggestions.length > 0 && !isLoading && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.place_id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => handleSelectSuggestion(item)}
                activeOpacity={0.7}
              >
                <View style={styles.suggestionIcon}>
                  <Text style={styles.suggestionIconText}>📍</Text>
                </View>
                <View style={styles.suggestionTextContainer}>
                  <Text style={styles.suggestionMainText}>
                    {item.structured_formatting.main_text}
                  </Text>
                  <Text style={styles.suggestionSecondaryText}>
                    {item.structured_formatting.secondary_text}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          />
        </View>
      )}

      {/* Mensagem quando não há resultados */}
      {showSuggestions && suggestions.length === 0 && !isLoading && value && value.length >= 3 && (
        <View style={styles.noResultsContainer}>
          <Text style={styles.noResultsText}>
            Nenhum endereço encontrado. Tente ser mais específico.
          </Text>
        </View>
      )}

      {/* Hint de uso */}
      {!showSuggestions && value && value.length > 0 && value.length < 3 && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>Digite pelo menos 3 caracteres para buscar</Text>
        </View>
      )}
    </View>
  );
};

// Exportar com React.memo customizado que ignora mudanças nas funções
// Isso evita re-renders desnecessários que causam perda de foco
export const AddressAutocomplete = React.memo(
  AddressAutocompleteComponent,
  (prevProps, nextProps) => {
    // Comparar apenas value, placeholder, error e multiline
    // Ignorar funções (onChangeText, onSelectAddress) para evitar re-renders
    return (
      prevProps.value === nextProps.value &&
      prevProps.placeholder === nextProps.placeholder &&
      prevProps.error === nextProps.error &&
      prevProps.multiline === nextProps.multiline
    );
  }
);

// Gerar session token único para agrupar chamadas
function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: 12,
    zIndex: 1000,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: theme.colors.surface,
    paddingRight: 40,
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
    right: 12,
    top: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: theme.colors.surface,
    fontSize: 14,
    fontWeight: 'bold',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 12,
    marginTop: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: theme.colors.disabled,
    borderRadius: 8,
    marginTop: 8,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  suggestionsContainer: {
    marginTop: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: 300,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  suggestionsList: {
    maxHeight: 300,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: theme.colors.surface,
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  suggestionIconText: {
    fontSize: 20,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionMainText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  suggestionSecondaryText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  noResultsContainer: {
    padding: 16,
    backgroundColor: theme.colors.errorLight,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  noResultsText: {
    fontSize: 14,
    color: theme.colors.error,
    textAlign: 'center',
  },
  hintContainer: {
    marginTop: 4,
  },
  hintText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
}));
