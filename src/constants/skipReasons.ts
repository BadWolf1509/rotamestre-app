/**
 * Skip reason constants for parada (stop) skip flow.
 * Used when a driver cannot complete a delivery/pickup.
 */

export type MotivoSkip =
  | 'cliente_ausente'
  | 'recusa'
  | 'endereco_incorreto'
  | 'acesso_bloqueado'
  | 'renovacao_contrato'
  | 'outro';

export interface SkipReason {
  value: MotivoSkip;
  label: string;
  icon: string; // Ionicons name
}

export const SKIP_REASONS: SkipReason[] = [
  { value: 'cliente_ausente', label: 'Cliente ausente', icon: 'home-outline' },
  { value: 'recusa', label: 'Recusou receber/entregar', icon: 'close-circle-outline' },
  { value: 'endereco_incorreto', label: 'Endereço incorreto', icon: 'location-outline' },
  { value: 'acesso_bloqueado', label: 'Acesso bloqueado', icon: 'lock-closed-outline' },
  { value: 'renovacao_contrato', label: 'Renovação de contrato', icon: 'document-text-outline' },
  { value: 'outro', label: 'Outro motivo', icon: 'help-circle-outline' },
];

export const SKIP_REASON_LABELS: Record<MotivoSkip, string> = Object.fromEntries(
  SKIP_REASONS.map(r => [r.value, r.label])
) as Record<MotivoSkip, string>;
