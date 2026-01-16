/**
 * DialogWeb - Web-specific implementation using HTML5 <dialog>
 * Uses createPortal to render outside the React tree
 */
import { Ionicons } from '@expo/vector-icons';
import React, { RefObject, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TextInput } from 'react-native';

import { boxShadow } from '@/utils/color';
import { useUnistyles } from '@/utils/styles';

import { getIconName } from './DialogIcon';

import type { DialogVariant, DialogType } from './Dialog.types';

interface DialogWebProps {
  visible: boolean;
  title: string;
  message: string;
  variant: DialogVariant;
  type: DialogType;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel?: () => void;
  loading: boolean;
  destructiveConfirmText?: string;
  confirmInput: string;
  setConfirmInput: (value: string) => void;
  isDestructiveConfirmValid: boolean;
  isConfirmDisabled: boolean;
  iconColor: string;
  iconBgColor: string;
  dialogRef: RefObject<HTMLDialogElement | null>;
  isDesktop: boolean;
}

export function DialogWeb({
  visible,
  title,
  message,
  variant,
  type,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  loading,
  destructiveConfirmText,
  confirmInput,
  setConfirmInput,
  isDestructiveConfirmValid,
  isConfirmDisabled,
  iconColor,
  iconBgColor,
  dialogRef,
  isDesktop,
}: DialogWebProps) {
  const { theme } = useUnistyles();
  const inputRef = React.useRef<TextInput>(null);
  const iconName = getIconName(variant, type);

  // Auto-focus input for destructive variant
  useEffect(() => {
    if (visible && destructiveConfirmText && inputRef.current) {
      const timer = setTimeout(() => {
        (inputRef.current as unknown as HTMLInputElement)?.focus?.();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [visible, destructiveConfirmText]);

  const dialogContent = (
    <dialog
      ref={dialogRef}
      className="unified-dialog"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-message"
      aria-modal="true"
      style={{
        position: 'fixed',
        border: 'none',
        padding: 0,
        margin: 'auto',
        maxWidth: isDesktop ? theme.desktop.dialog.maxWidth : 360,
        width: 'calc(100% - 48px)',
        backgroundColor: 'transparent',
        overflow: 'visible',
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.white,
          borderRadius: theme.borderRadius.xl,
          padding: isDesktop ? theme.desktop.dialog.containerPadding : theme.spacing.xl,
          boxShadow: [
            boxShadow(0, 20, 25, -5, theme.colors.black, 0.1),
            boxShadow(0, 10, 10, -5, theme.colors.black, 0.04),
          ].join(', '),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div
          style={{
            width: isDesktop ? theme.desktop.dialog.iconCircleSize : 56,
            height: isDesktop ? theme.desktop.dialog.iconCircleSize : 56,
            borderRadius: theme.borderRadius.full,
            backgroundColor: iconBgColor,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            margin: `0 auto ${isDesktop ? theme.spacing.sm + theme.spacing['0.5'] : theme.spacing.md}px`,
          }}
        >
          <Ionicons
            name={iconName}
            size={isDesktop ? theme.desktop.dialog.iconSize : 28}
            color={iconColor}
          />
        </div>

        {/* Title */}
        <h2
          id="dialog-title"
          style={{
            margin: 0,
            fontFamily: theme.typography.fontSansBold,
            fontSize: isDesktop ? theme.desktop.dialog.titleFontSize : theme.typography.fontSize.xl,
            lineHeight: `${(isDesktop ? theme.desktop.dialog.titleFontSize : theme.typography.fontSize.xl) * 1.4}px`,
            color: theme.colors.gray900,
            textAlign: 'center',
            marginBottom: isDesktop ? theme.spacing['1.5'] : theme.spacing.sm,
          }}
        >
          {title}
        </h2>

        {/* Message */}
        <p
          id="dialog-message"
          style={{
            margin: 0,
            fontFamily: theme.typography.fontSans,
            fontSize: isDesktop ? theme.desktop.dialog.messageFontSize : theme.typography.fontSize.sm,
            lineHeight: `${(isDesktop ? theme.desktop.dialog.messageFontSize : theme.typography.fontSize.sm) * 1.5}px`,
            color: theme.colors.gray500,
            textAlign: 'center',
            marginBottom: destructiveConfirmText ? theme.spacing.md : (isDesktop ? theme.spacing['3.5'] : theme.spacing.lg),
            whiteSpace: 'pre-line',
          }}
        >
          {message}
        </p>

        {/* Destructive confirmation input */}
        {variant === 'destructive' && destructiveConfirmText && (
          <div
            style={{
              marginBottom: isDesktop ? theme.spacing['3.5'] : theme.spacing.lg,
              padding: theme.spacing.md,
              backgroundColor: `${theme.colors.error}08`,
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.error}20`,
            }}
          >
            <p
              style={{
                margin: 0,
                marginBottom: theme.spacing.sm,
                fontFamily: theme.typography.fontSans,
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.gray700,
              }}
            >
              Digite <strong style={{ color: theme.colors.error }}>{destructiveConfirmText}</strong> para confirmar:
            </p>
            <input
              ref={inputRef as any}
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={destructiveConfirmText}
              disabled={loading}
              style={{
                width: '100%',
                padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
                fontFamily: theme.typography.fontSansSemiBold,
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.gray900,
                backgroundColor: theme.colors.white,
                border: `1px solid ${
                  confirmInput.length > 0
                    ? isDestructiveConfirmValid
                      ? theme.colors.success
                      : theme.colors.error
                    : theme.colors.gray300
                }`,
                borderRadius: theme.borderRadius.sm,
                outline: 'none',
                letterSpacing: 1,
                textTransform: 'uppercase',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: isDesktop ? theme.desktop.dialog.buttonGap : theme.components.dialog.buttonGap,
          }}
        >
          {/* Cancel button (only for confirm/destructive variants) */}
          {variant !== 'alert' && (
            <button
              onClick={onCancel}
              aria-label={cancelText}
              disabled={loading}
              style={{
                flex: 1,
                padding: isDesktop
                  ? `${theme.desktop.dialog.buttonPaddingV}px ${theme.desktop.dialog.buttonPaddingH}px`
                  : `${theme.components.dialog.buttonPaddingV}px ${theme.components.dialog.buttonPaddingH}px`,
                borderRadius: theme.borderRadius.md,
                minHeight: isDesktop ? theme.desktop.dialog.buttonHeight : 44,
                backgroundColor: theme.colors.gray100,
                border: `1px solid ${theme.colors.gray200}`,
                fontSize: isDesktop ? theme.desktop.button.fontSize : theme.typography.fontSize.base,
                fontFamily: theme.typography.fontSansSemiBold,
                color: theme.colors.gray900,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = theme.colors.gray200;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.gray100;
              }}
            >
              {cancelText}
            </button>
          )}

          {/* Confirm button */}
          <button
            onClick={onConfirm}
            aria-label={confirmText}
            disabled={isConfirmDisabled}
            style={{
              flex: 1,
              padding: isDesktop
                ? `${theme.desktop.dialog.buttonPaddingV}px ${theme.desktop.dialog.buttonPaddingH}px`
                : `${theme.components.dialog.buttonPaddingV}px ${theme.components.dialog.buttonPaddingH}px`,
              borderRadius: theme.borderRadius.md,
              minHeight: isDesktop ? theme.desktop.dialog.buttonHeight : 44,
              backgroundColor: isConfirmDisabled ? theme.colors.gray300 : iconColor,
              border: 'none',
              fontSize: isDesktop ? theme.desktop.button.fontSize : theme.typography.fontSize.base,
              fontFamily: theme.typography.fontSansSemiBold,
              color: theme.colors.white,
              cursor: isConfirmDisabled ? 'not-allowed' : 'pointer',
              opacity: isConfirmDisabled ? 0.6 : 1,
              transition: 'opacity 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.sm,
            }}
            onMouseEnter={(e) => {
              if (!isConfirmDisabled) e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = isConfirmDisabled ? '0.6' : '1';
            }}
          >
            {loading && (
              <span
                style={{
                  width: 16,
                  height: 16,
                  border: '2px solid transparent',
                  borderTopColor: theme.colors.white,
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </dialog>
  );

  return visible ? createPortal(dialogContent, document.body) : null;
}

export default DialogWeb;
