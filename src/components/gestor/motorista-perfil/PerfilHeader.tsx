/**
 * PerfilHeader - Avatar, nome, email, telefone, status e ações
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';

import { useUnistyles } from '@/utils/styles';

import { styles } from './styles';

import type { Motorista } from './types';

interface PerfilHeaderProps {
  motorista: Motorista;
  onEdit?: () => void;
  onToggleStatus?: () => void;
}

export function PerfilHeader({ motorista, onEdit, onToggleStatus }: PerfilHeaderProps) {
  const { theme } = useUnistyles();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <View style={styles.perfilHeaderCard}>
      <View style={styles.perfilHeaderContent}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {motorista.foto_url ? (
            <Image source={{ uri: motorista.foto_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {motorista.nome.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.perfilInfo}>
          <Text style={styles.perfilNome}>{motorista.nome}</Text>
          <Text style={styles.perfilEmail}>{motorista.email}</Text>
          {motorista.telefone && (
            <Text style={styles.perfilTelefone}>{motorista.telefone}</Text>
          )}

          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              motorista.ativo ? styles.statusBadgeAtivo : styles.statusBadgeInativo,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                motorista.ativo ? styles.statusBadgeTextAtivo : styles.statusBadgeTextInativo,
              ]}
            >
              {motorista.ativo ? 'Ativo' : 'Inativo'}
            </Text>
          </View>

          {/* Desde */}
          <Text style={styles.perfilDesde}>
            Motorista desde {formatDate(motorista.created_at)}
          </Text>
        </View>

        {/* Actions */}
        {(onEdit || onToggleStatus) && (
          <View style={styles.perfilActions}>
            {onEdit && (
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={onEdit}
              >
                <Ionicons name="create-outline" size={18} color={theme.colors.white} />
                <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                  Editar
                </Text>
              </TouchableOpacity>
            )}
            {onToggleStatus && (
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonSecondary]}
                onPress={onToggleStatus}
              >
                <Ionicons
                  name={motorista.ativo ? 'close-circle-outline' : 'checkmark-circle-outline'}
                  size={18}
                  color={theme.colors.gray700}
                />
                <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                  {motorista.ativo ? 'Desativar' : 'Ativar'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
