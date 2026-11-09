/**
 * A FAQ do motorista só afirma o que o app faz. Em 08/11/2026 ela dizia que o
 * gesto de deslizar já concluía (só revela o botão), que a foto era enviada
 * sozinha (há "Enviar Foto") e obrigatória (há "Continuar sem foto"), citava
 * um "ícone da câmera" e prometia que o gestor "reprograma" a entrega.
 */
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import AjudaMotoristaScreen from '../ajuda';

const PERGUNTAS = [
  'Como iniciar uma rota?',
  'Como marcar uma parada como concluída?',
  'Como tirar foto de comprovante?',
  'O que fazer se não conseguir entregar?',
  'O que fazer em caso de emergência?',
  'Como alterar minha senha?',
  'Como ver meu histórico de rotas?',
  'O app funciona offline?',
  'Quais são os modos de navegação?',
  'Por que o "Navegar" abriu o mapa do app e não o Waze?',
  'O que são os badges na lista de paradas?',
];

const INEXISTENTES = [
  /ícone da câmera/i,
  /enviada automaticamente/i,
  /reprogramar/i,
  /toque no card para expandir/i,
  /para concluí-la/i,
  /e envia a foto/i,
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
  const api = render(<AjudaMotoristaScreen />);
  return PERGUNTAS.map((pergunta) => {
    fireEvent.press(api.getByText(pergunta));
    return textos(api.toJSON() as No).join('\n');
  }).join('\n');
}

describe('FAQ do motorista', () => {
  it('não promete o que o app não faz', () => {
    const texto = respostas();
    for (const padrao of INEXISTENTES) {
      expect(texto).not.toMatch(padrao);
    }
  });

  it('usa os rótulos reais dos botões', () => {
    const texto = respostas();
    for (const rotulo of [
      'Adicionar Foto do Comprovante',
      'Enviar Foto',
      'Continuar sem foto',
      'Retomar Parada',
      'ACIONAR SOS',
      'Em rota',
    ]) {
      expect(texto).toContain(rotulo);
    }
  });
});
