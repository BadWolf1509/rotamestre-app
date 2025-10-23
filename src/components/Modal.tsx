/**
 * ============================================
 * Modal - Componente de Modal Reutilizável
 * ============================================
 *
 * Modal customizável com overlay, animações e variantes.
 * Usa design tokens para cores, sombras e espaçamento.
 */

import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  Animated,
  Dimensions,
} from 'react-native';
import { useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows, zIndex } from '@/lib/design-tokens';

type ModalSize = 'small' | 'medium' | 'large' | 'full';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: ModalSize;
  showCloseButton?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
  transparent?: boolean;
  style?: ViewStyle;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function Modal({
  visible,
  onClose,
  title,
  children,
  size = 'medium',
  showCloseButton = true,
  animationType = 'fade',
  transparent = true,
  style,
}: ModalProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 90,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getModalWidth = (): string | number => {
    switch (size) {
      case 'small':
        return '70%';
      case 'medium':
        return '85%';
      case 'large':
        return '95%';
      case 'full':
        return '100%';
      default:
        return '85%';
    }
  };

  return (
    <RNModal
      visible={visible}
      transparent={transparent}
      animationType={animationType === 'none' ? 'none' : undefined}
      onRequestClose={onClose}
    >
      {/* Overlay */}
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      {/* Modal Content */}
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.modal,
            {
              width: getModalWidth(),
              transform: [{ translateY: animationType === 'slide' ? slideAnim : 0 }],
              opacity: animationType === 'fade' ? fadeAnim : 1,
            },
            size === 'full' && styles.fullModal,
            style,
          ]}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <View style={styles.header}>
              {title && <Text style={styles.title}>{title}</Text>}
              {showCloseButton && (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={24} color={colors.text.secondary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Content */}
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.dark,
    zIndex: zIndex.modal,
  },
  overlayTouchable: {
    flex: 1,
  },

  // Container
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: zIndex.modal + 1,
  },

  // Modal
  modal: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.xl,
    maxHeight: '80%',
    ...shadows.modal,
  },
  fullModal: {
    width: '100%',
    height: '100%',
    maxHeight: '100%',
    borderRadius: 0,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  title: {
    ...typography.styles.h3,
    flex: 1,
  },

  closeButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },

  // Content
  content: {
    padding: spacing.md,
  },
});

// Export default para facilitar import
export default Modal;

/**
 * ============================================
 * EXEMPLOS DE USO
 * ============================================
 *
 * import Modal from '@/components/Modal';
 * import { Button } from '@/components/Button';
 *
 * // Modal básico
 * const [visible, setVisible] = useState(false);
 *
 * <Modal
 *   visible={visible}
 *   onClose={() => setVisible(false)}
 *   title="Confirmar Ação"
 * >
 *   <Text>Tem certeza que deseja continuar?</Text>
 *   <Button title="Confirmar" onPress={() => setVisible(false)} />
 * </Modal>
 *
 * // Modal pequeno
 * <Modal
 *   visible={visible}
 *   onClose={() => setVisible(false)}
 *   size="small"
 *   title="Aviso"
 * >
 *   <Text>Operação concluída com sucesso!</Text>
 * </Modal>
 *
 * // Modal grande
 * <Modal
 *   visible={visible}
 *   onClose={() => setVisible(false)}
 *   size="large"
 *   title="Detalhes da Rota"
 * >
 *   <ScrollView>
 *     {/* Conteúdo grande */}
 * </Modal>
 *
 * // Modal full screen
 * <Modal
 *   visible={visible}
 *   onClose={() => setVisible(false)}
 *   size="full"
 *   title="Editor"
 * >
 *   {/* Conteúdo que precisa de tela cheia */}
 * </Modal>
 *
 * // Modal sem botão de fechar
 * <Modal
 *   visible={visible}
 *   onClose={() => {}}
 *   showCloseButton={false}
 * >
 *   <Text>Carregando...</Text>
 * </Modal>
 *
 * // Modal com animação de slide
 * <Modal
 *   visible={visible}
 *   onClose={() => setVisible(false)}
 *   animationType="slide"
 *   title="Nova Rota"
 * >
 *   {/* Formulário */}
 * </Modal>
 *
 * // Modal com conteúdo customizado
 * <Modal
 *   visible={visible}
 *   onClose={() => setVisible(false)}
 *   title="Filtros"
 * >
 *   <Input label="Data" />
 *   <Input label="Status" />
 *   <Button title="Aplicar Filtros" onPress={applyFilters} />
 * </Modal>
 */
