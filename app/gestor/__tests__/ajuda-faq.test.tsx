/**
 * A FAQ do gestor só afirma o que o app faz. Em 08/11/2026 ela citava
 * recursos que não existem (assinatura do destinatário, escalar para suporte,
 * estimativa de conclusão) e rótulos antigos ("Nova Entrega", "Dashboard"),
 * e a seção de links levava a duas páginas 404.
 */
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import AjudaGestorScreen from '../ajuda';

const PERGUNTAS = [
  'Como criar rotas otimizadas?',
  'Como atribuir uma rota a um motorista?',
  'Como gerenciar motoristas?',
  'Como analisar relatórios e métricas?',
  'Como resolver incidentes?',
  'Como acompanhar uma rota em tempo real?',
  'Como editar uma rota em andamento?',
  'Como ver fotos de comprovante de entrega?',
  'O que fazer se um motorista não conseguir entregar?',
  'Como exportar dados para Excel?',
];

/** Recursos e rótulos que não existem no app. */
const INEXISTENTES = [
  /Nova Entrega/,
  /Dashboard/,
  /Motorista Responsável/,
  /assinatura/i,
  /escalar/i,
  /coment[aá]rio/i,
  /estimativa de conclus/i,
  /ícone de edição/i,
  /notificação com o motivo/i,
  /botão "\+"/,
];

type No = { children?: (No | string)[] | null } | string | null;

function textos(no: No | No[]): string[] {
  if (no === null) return [];
  if (typeof no === 'string') return [no];
  if (Array.isArray(no)) return no.flatMap(textos);
  return (no.children ?? []).flatMap(textos);
}

/** Abre cada pergunta (uma por vez, como na tela) e junta o texto visível. */
function respostas(): string {
  const api = render(<AjudaGestorScreen />);
  return PERGUNTAS.map((pergunta) => {
    fireEvent.press(api.getByText(pergunta));
    return textos(api.toJSON() as No).join('\n');
  }).join('\n');
}

describe('FAQ do gestor', () => {
  it('não cita recurso nem rótulo que o app não tem', () => {
    const texto = respostas();
    for (const padrao of INEXISTENTES) {
      expect(texto).not.toMatch(padrao);
    }
  });

  it('usa os rótulos reais das telas', () => {
    const texto = respostas();
    for (const rotulo of [
      'Nova Rota',
      'Selecionar Motorista',
      'Adicionar motorista',
      'Excel (XLSX)',
      '+ Parada',
      'Ver foto',
    ]) {
      expect(texto).toContain(rotulo);
    }
  });

  it('não oferece links que dão 404', () => {
    const api = render(<AjudaGestorScreen />);
    expect(api.queryByText('Central de Ajuda')).toBeNull();
    expect(api.queryByText('Tutoriais em Vídeo')).toBeNull();
    expect(api.getByText('Termos de Uso')).toBeTruthy();
  });
});
