import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TesterRecruitmentScreen } from '@/components/testar/TesterRecruitmentScreen';

/**
 * Rota pública /testar — hub de recrutamento de testadores do teste fechado
 * Android. Acessível sem login (mesmo padrão das páginas legais).
 */
export default function Testar() {
  return (
    <ErrorBoundary>
      <TesterRecruitmentScreen />
    </ErrorBoundary>
  );
}
