// Vigia dos console.error/console.warn dos testes (B-TOOL-1 / R-TOOL-3).
//
// O jest.setup.js troca o console por jest.fn() para a saída ficar limpa, e com
// isso qualquer aviso do React/RN/libs ("not wrapped in act", "unique key",
// prop inválida) sumia e o teste ficava verde. Aqui os avisos não somem mais:
// o teste falha quando recebe um aviso que não está em AVISOS_CONHECIDOS.
//
// O teste que faz jest.spyOn(console, ...) troca a função e fica fora da regra
// (ele já decidiu o que esperar). MEDIR_CONSOLE=1 só grava os avisos em
// coverage/console-avisos.jsonl, sem falhar nada (usado para montar a lista).
const fs = require('fs');
const path = require('path');

// Raiz do repositório pelo lugar do arquivo, não pelo cwd de quem roda o Jest.
const RAIZ = path.resolve(__dirname, '..');

/**
 * Avisos aceitos por enquanto (medidos em 05/11/2026: 352 avisos em 39 arquivos
 * de 652). Cada entrada vale só para os arquivos listados, então um arquivo
 * novo com o mesmo aviso continua falhando. A lista só deve encolher.
 */
const AVISOS_CONHECIDOS = [
  {
    // Atualização de estado fora de act() — dívida: envolver em act/waitFor nos testes listados
    padrao: /not wrapped in act/,
    arquivos: [
      'app/motorista/_screens/__tests__/inicio-carregamento.test.tsx',
      'src/components/__tests__/CameraUpload.test.tsx',
      'src/components/__tests__/IncidentReportWizard.test.tsx',
      'src/components/__tests__/MapaMobile.smoke.test.tsx',
      'src/components/__tests__/RouteTimeline.test.tsx',
      'src/components/__tests__/SeletorUnidade.test.tsx',
      'src/components/gestor/mapa-rota/__tests__/ChangeDriverModal.test.tsx',
      'src/components/motorista/__tests__/NavigationMode.test.tsx',
      'src/components/motorista/__tests__/NavigationSettings.test.tsx',
      'src/components/motorista/home/__tests__/MainCard.test.tsx',
      'src/components/motorista/home/__tests__/MiniMap.temaEscuro.test.tsx',
      'src/components/motorista/home/__tests__/MiniMap.test.tsx',
      'src/components/motorista/home/__tests__/PreRouteChecklist.test.tsx',
      'src/components/perfil/__tests__/PerfilDesktopLayout.test.tsx',
      'src/context/__tests__/RouteStatusContext.test.tsx',
      'src/hooks/__tests__/useAuth.test.ts',
      'src/hooks/__tests__/useIncidentesGestor.test.ts',
      'src/hooks/__tests__/useMilestones.test.ts',
      'src/hooks/__tests__/useMotoristas.test.ts',
      'src/hooks/__tests__/useMotoristasGestor.test.ts',
      'src/hooks/__tests__/useNetworkStatus.test.ts',
      'src/hooks/__tests__/useNotificationRealtime.test.ts',
      'src/hooks/__tests__/useResumoRota.test.ts',
      'src/hooks/__tests__/useSwipeHint.test.ts',
      'src/hooks/__tests__/useUser.test.ts',
      'src/hooks/auth/__tests__/useSessionRecovery.test.ts',
      'src/hooks/motorista/historico/__tests__/useHistoricoData.test.ts',
      'src/hooks/motoristas-gestor/__tests__/useMotoristasOperations.test.ts',
      'src/hooks/navigation/__tests__/useNavigationModeLogic.test.ts',
      'src/hooks/nova-entrega/__tests__/useMotoristaSelection.test.ts',
    ],
  },
  {
    // Mock devolve função como filho de React nos testes de navegação — dívida do mock
    padrao: /Functions are not valid as a React child/,
    arquivos: [
      'app/motorista/_screens/__tests__/inicio-carregamento.test.tsx',
      'app/motorista/_screens/__tests__/inicio-modo-navegacao.test.tsx',
      'src/components/motorista/__tests__/NavigationMode.temaEscuro.test.tsx',
      'src/components/motorista/__tests__/NavigationMode.web.test.tsx',
    ],
  },
  {
    // Aviso do expo-notifications no Expo Go/Jest ao montar o ErrorBoundary
    padrao: /expo-notifications: Android Push/,
    arquivos: [
      'app/__tests__/error-boundary-rotas-publicas.test.tsx',
      'app/auth/__tests__/error-boundary.test.tsx',
    ],
  },
  {
    // Teste exercita a recusa e a função registra o motivo, de propósito
    padrao:
      /Chamada recusada: x-(push|cron)-secret|PUSH_WEBHOOK_SECRET não configurado/,
    arquivos: ['supabase/functions/_shared/__tests__/cronAuth.test.ts'],
  },
  {
    // Teste exercita a falha do validador, de propósito
    padrao: /\[autenticacao\] Falha ao validar/,
    arquivos: ['supabase/functions/_shared/__tests__/autenticacao.test.ts'],
  },
  {
    // Aviso do React Native 0.88 em AuthBrandPanel — trocar por View + Image
    padrao: /ImageBackground is deprecated/,
    arquivos: ['src/components/auth/__tests__/AuthBrandPanel.test.tsx'],
  },
  {
    // O teste exercita a ponte de logs do LogBox, que chama console de verdade
    padrao: /./,
    arquivos: ['src/utils/__tests__/configureLogBox.test.ts'],
  },
];

function textoDe(args) {
  return args
    .map((a) =>
      a instanceof Error
        ? a.message
        : typeof a === 'string'
          ? a
          : safeStringify(a),
    )
    .join(' ');
}

function safeStringify(valor) {
  try {
    return JSON.stringify(valor) ?? String(valor);
  } catch {
    return String(valor);
  }
}

function conhecido(texto, arquivoRel) {
  return AVISOS_CONHECIDOS.some(
    (c) => c.padrao.test(texto) && c.arquivos.includes(arquivoRel),
  );
}

function instalarVigiaDoConsole(consoleDosTestes) {
  const medir = process.env.MEDIR_CONSOLE === '1';
  const funcoesDoSetup = {
    error: consoleDosTestes.error,
    warn: consoleDosTestes.warn,
  };

  afterEach(() => {
    const { testPath, currentTestName } = expect.getState();
    const arquivoRel = path
      .relative(RAIZ, testPath || '')
      .split(path.sep)
      .join('/');
    const novos = [];
    for (const nivel of ['error', 'warn']) {
      // Se o teste trocou a função ou deu a ela uma implementação própria
      // (spyOn(...).mockImplementation), ele já decidiu o que esperar. Atenção:
      // jest.spyOn sobre um jest.fn devolve o MESMO mock, então só a
      // implementação denuncia o spy.
      if (
        global.console[nivel] !== funcoesDoSetup[nivel] ||
        funcoesDoSetup[nivel].getMockImplementation() !== undefined
      ) {
        continue;
      }
      for (const args of funcoesDoSetup[nivel].mock.calls) {
        // O logger do app imprime com prefixo próprio; quem o vigia são os
        // testes que espiam logger.*. Aqui só interessa o que vem de fora.
        if (args[0] === '[WARN]' || args[0] === '[ERROR]') continue;
        const texto = textoDe(args);
        if (conhecido(texto, arquivoRel)) continue;
        novos.push({ nivel, texto });
      }
    }
    if (novos.length === 0) return;

    if (medir) {
      const alvo = path.join(RAIZ, 'coverage', 'console-avisos.jsonl');
      fs.mkdirSync(path.dirname(alvo), { recursive: true });
      for (const n of novos) {
        fs.appendFileSync(
          alvo,
          JSON.stringify({
            arquivo: path
              .relative(RAIZ, testPath || '')
              .replace(/\\/g, '/'),
            teste: currentTestName,
            nivel: n.nivel,
            texto: n.texto.slice(0, 300),
          }) + '\n',
        );
      }
      return;
    }

    throw new Error(
      `console.${novos[0].nivel} inesperado no teste (veja jest.mocks/consoleAvisos.js):\n` +
        novos.map((n) => `  [${n.nivel}] ${n.texto.slice(0, 300)}`).join('\n'),
    );
  });
}

module.exports = { AVISOS_CONHECIDOS, instalarVigiaDoConsole };
