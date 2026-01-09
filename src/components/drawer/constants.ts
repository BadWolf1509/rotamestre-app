/**
 * Constants for DrawerMenu component
 */

// Motivos de contato com o gestor
export const CONTACT_REASONS = [
  { id: 'route_problem', label: '🚗 Problema na rota', message: 'problema na rota atual' },
  { id: 'wrong_address', label: '📍 Endereço incorreto', message: 'endereço incorreto/não encontrado' },
  { id: 'delivery_issue', label: '📦 Problema com entrega', message: 'problema com a entrega' },
  { id: 'question', label: '❓ Dúvida geral', message: 'uma dúvida' },
  { id: 'emergency', label: '🆘 Emergência', message: 'uma emergência' },
] as const;

export type ContactReason = (typeof CONTACT_REASONS)[number];
