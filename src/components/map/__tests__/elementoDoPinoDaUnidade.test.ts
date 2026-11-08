/**
 * @jest-environment ./jest.ambiente-jsdom.js
 */
import {
  CORES_DE_STATUS_SOBRE_O_MAPA,
  CORES_SOBRE_O_MAPA,
} from '../coresSobreOMapa';
import { criarElementoDoPinoDaUnidade } from '../elementoDoPinoDaUnidade';
import { ESPEC_DO_PONTO, pontosDaUnidade } from '../pontosDaUnidade';

const base = { latitude: -7.1, longitude: -34.8, endereco: 'Av. X, 1' };
const [sede] = pontosDaUnidade([
  { ...base, id: 'p0', ordem: 0 },
  { ...base, id: 'c9', ordem: 9 },
]);

describe('criarElementoDoPinoDaUnidade', () => {
  it('sede: casa branca no quadrado azul-marinho, rotulada', () => {
    const el = criarElementoDoPinoDaUnidade(sede, 28);

    expect(el.dataset.tipo).toBe('sede');
    expect(el.getAttribute('aria-label')).toBe('Sede da unidade, Av. X, 1');
    expect(el.innerHTML).toContain(ESPEC_DO_PONTO.sede.svgPath);
    expect(el.style.borderRadius).toBe('6px');
    // jsdom normaliza cor para rgb(); compara pela cor aplicada.
    const probe = document.createElement('div');
    probe.style.background = CORES_SOBRE_O_MAPA.sede;
    expect(el.style.background).toBe(probe.style.background);
  });

  it('nenhuma cor de status (verde, vermelho) no pino', () => {
    const html = criarElementoDoPinoDaUnidade(sede, 28).outerHTML;
    expect(html).not.toContain(CORES_DE_STATUS_SOBRE_O_MAPA.errorDark);
    expect(html).not.toContain(CORES_DE_STATUS_SOBRE_O_MAPA.successDark);
  });

  it('com clique: botão que chama uma vez e não deixa o clique chegar ao mapa', () => {
    const aoClicar = jest.fn();
    const el = criarElementoDoPinoDaUnidade(sede, 28, aoClicar);
    const doMapa = jest.fn();
    const pai = document.createElement('div');
    pai.addEventListener('click', doMapa);
    pai.appendChild(el);

    el.click();

    expect(el.getAttribute('role')).toBe('button');
    expect(aoClicar).toHaveBeenCalledTimes(1);
    expect(doMapa).not.toHaveBeenCalled();
  });

  it('sem clique: imagem rotulada, fora da ordem de foco', () => {
    const el = criarElementoDoPinoDaUnidade(sede, 22);
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('tabindex')).toBeNull();
  });

  it('com clique: alcançável pelo teclado (Enter e Espaço)', () => {
    const aoClicar = jest.fn();
    const el = criarElementoDoPinoDaUnidade(sede, 28, aoClicar);

    expect(el.getAttribute('tabindex')).toBe('0');
    el.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(aoClicar).toHaveBeenCalledTimes(2);
  });
});
