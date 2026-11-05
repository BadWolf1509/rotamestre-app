/**
 * DrawerContactModal component
 * Modal for selecting contact reason (Web only)
 */

import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';

import { StyleSheet, type Theme } from '@/utils/styles';

import { CONTACT_REASONS, type ContactReason } from './constants';

import type { GestorData } from './types';

interface DrawerContactModalProps {
  visible: boolean;
  gestorData: GestorData | null;
  onSelectReason: (reason: ContactReason) => void;
  onClose: () => void;
}

export function DrawerContactModal({
  visible,
  gestorData,
  onSelectReason,
  onClose,
}: DrawerContactModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.contactModalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.contactModalContainer}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.contactModalContent}>
              <Text style={styles.contactModalTitle}>📞 Contatar {gestorData?.nome}</Text>
              <Text style={styles.contactModalSubtitle}>Qual o motivo do contato?</Text>

              <View style={styles.contactModalOptions}>
                {CONTACT_REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason.id}
                    style={styles.contactModalOption}
                    onPress={() => onSelectReason(reason)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.contactModalOptionText}>{reason.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.contactModalCancel}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.contactModalCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  contactModalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactModalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  contactModalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  contactModalTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  contactModalSubtitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray500,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  contactModalOptions: {
    gap: theme.spacing.sm,
  },
  contactModalOption: {
    backgroundColor: theme.colors.gray50,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  contactModalOptionText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray700,
    textAlign: 'center',
  },
  contactModalCancel: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  contactModalCancelText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
}));
