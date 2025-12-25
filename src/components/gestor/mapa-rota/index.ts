/**
 * Mapa da Rota - Componentes
 * Componentes extraídos da página de visualização de rota do gestor
 */

// Componentes originais
export { ParadaCard } from './ParadaCard';
export { ResumoStats } from './ResumoStats';
export { BaseInfoContent, useHasBaseInfo } from './BaseInfoContent';
export { RouteInfoHeader, getStatusBadgeVariant, formatStatusLabel } from './RouteInfoHeader';
export { PhotoModal } from './PhotoModal';
export { MapaRotaSkeleton } from './MapaRotaSkeleton';

// Componentes otimizados (novo layout)
export { ParadaCardCompact } from './ParadaCardCompact';
export { ResumoInline } from './ResumoInline';
export { TimelineCollapsible } from './TimelineCollapsible';
export { RouteInfoHeaderCompact } from './RouteInfoHeaderCompact';
export { ChangeDriverModal } from './ChangeDriverModal';
export { EditStopModal } from './EditStopModal';
export { AddStopModal } from './AddStopModal';
export { DraggableStopList } from './DraggableStopList';

// Estilos
export { styles, MAP_HEIGHT } from './styles';

// Types
export type { Parada, Rota, ResumoParadas } from './types';
