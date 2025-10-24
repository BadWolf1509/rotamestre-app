import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Platform,
  Keyboard,
} from 'react-native';
import { googleMapsService, PlaceSuggestion } from '@/lib/google';

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
 * - Debounce de 500ms para reduzir chamadas à API
 * - Session tokens para agrupar chamadas e reduzir custos
 * - Lista de sugestões com separação de texto principal e secundário
 * - Coordenadas obtidas automaticamente ao selecionar
 */
export function AddressAutocomplete({
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
  const debounceTimer = useRef<NodeJS.Timeout>();

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
      return;
    }

    setIsLoading(true);
    setShowSuggestions(true);

    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await googleMapsService.autocompleteAddress(value, sessionToken);
        setSuggestions(results);
      } catch (error) {
        console.error('Erro no autocomplete:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 500); // 500ms de debounce

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [value, sessionToken]);

  const handleSelectSuggestion = (suggestion: PlaceSuggestion) => {
    onSelectAddress(suggestion.description, suggestion.place_id);
    setSuggestions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const handleClearInput = () => {
    onChangeText('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

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
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          multiline={multiline}
          numberOfLines={multiline ? 2 : 1}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {value && value.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={handleClearInput}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Indicador de carregamento */}
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
        <Text style={styles.hintText}>Digite pelo menos 3 caracteres para buscar</Text>
      )}
    </View>
  );
}

// Gerar session token único para agrupar chamadas
function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    zIndex: 1000,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    paddingRight: 40, // Espaço para o botão clear
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#9ca3af',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginTop: 8,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6b7280',
  },
  suggestionsContainer: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
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
    backgroundColor: '#fff',
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
    color: '#111827',
    marginBottom: 2,
  },
  suggestionSecondaryText: {
    fontSize: 13,
    color: '#6b7280',
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  noResultsContainer: {
    padding: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  noResultsText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
  },
  hintText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
