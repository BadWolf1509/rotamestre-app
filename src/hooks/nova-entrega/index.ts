/**
 * Hooks para a funcionalidade de Nova Entrega
 * Cada hook tem uma responsabilidade específica, facilitando manutenção e testes
 */

export { useEnderecoUnidade, type UseEnderecoUnidadeReturn } from './useEnderecoUnidade';
export { useMotoristaSelection, type UseMotoristaSelectionReturn } from './useMotoristaSelection';
export { useParadasManagement, type UseParadasManagementReturn, type UseParadasManagementOptions } from './useParadasManagement';
export { useRouteOptimization, type UseRouteOptimizationReturn, type UseRouteOptimizationOptions } from './useRouteOptimization';
export { useDistanceCalculation, type UseDistanceCalculationReturn, type UseDistanceCalculationOptions } from './useDistanceCalculation';
export { useRouteCreation, type UseRouteCreationReturn, type UseRouteCreationOptions } from './useRouteCreation';
