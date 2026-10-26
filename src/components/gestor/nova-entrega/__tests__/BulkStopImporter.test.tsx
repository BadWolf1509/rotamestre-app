import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import type {
  BulkImportResult,
  BulkParadaInput,
  EnderecoLocalizado,
  LocalizarLoteOpcoes,
  LocalizarLoteResult,
} from '@/hooks/nova-entrega/useParadasManagement';
import { logger } from '@/lib/logger';

import { BulkStopImporter, parseBulkStops } from '../BulkStopImporter';

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

describe('parseBulkStops', () => {
  it('parses a header and quoted semicolons', () => {
    const result = parseBulkStops(
      [
        'tipo;endereco;destinatario;telefone;observacoes',
        'entrega;"Rua A; bloco 2";Maria;(85) 99999-0000;"Deixar na portaria; ligar antes"',
        'retirada;Av. Central, 200;Fornecedor;85988887777;',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    expect(result.items).toEqual([
      {
        tipo: 'entrega',
        endereco: 'Rua A; bloco 2',
        destinatario: 'Maria',
        telefone: '(85) 99999-0000',
        observacoes: 'Deixar na portaria; ligar antes',
        linha: 2,
      },
      {
        tipo: 'retirada',
        endereco: 'Av. Central, 200',
        destinatario: 'Fornecedor',
        telefone: '85988887777',
        observacoes: '',
        linha: 3,
      },
    ]);
  });

  it('keeps the original line number when a header is present', () => {
    const result = parseBulkStops(
      'tipo;endereco;destinatario;telefone\nentrega;Rua A;Maria;123',
    );

    expect(result.items).toEqual([]);
    expect(result.errors[0]).toContain('Linha 2');
  });

  it('leva a linha real do texto colado, contando linhas em branco', () => {
    const result = parseBulkStops(
      [
        'tipo;endereco;destinatario;telefone',
        '',
        'entrega;Rua A, 10;Maria;85999990000',
        '',
        'retirada;Rua B, 20;João;85988887777',
      ].join('\n'),
    );

    expect(result.items.map((item) => item.linha)).toEqual([3, 5]);
  });

  it('rejects unclosed quotes and extra columns', () => {
    const result = parseBulkStops(
      [
        'entrega;"Rua sem fechamento;Maria;85999990000',
        'entrega;Rua A, 10;Maria;85999990000;obs;coluna extra',
      ].join('\n'),
    );

    expect(result.items).toEqual([]);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('4 ou 5 colunas');
  });
});

describe('BulkStopImporter — conferência do lote', () => {
  const linhas = [
    'entrega;Rua A, 10;Maria;85999990001',
    'retirada;Rua B, 20;João;85999990002',
    'entrega;Rua C, 30;Ana;85999990003',
  ];

  function localizado(
    item: BulkParadaInput,
    overrides: Partial<EnderecoLocalizado> = {},
  ): EnderecoLocalizado {
    return {
      linha: item.linha,
      item,
      enderecoEncontrado: `${item.endereco} - Centro, João Pessoa - PB`,
      latitude: -7.12,
      longitude: -34.88,
      fonte: 'google',
      distanciaSedeKm: 2.5,
      ...overrides,
    };
  }

  /** As linhas localizam, menos a 3ª, que falha. */
  const localizarPadrao = async (
    items: BulkParadaInput[],
  ): Promise<LocalizarLoteResult> => ({
    localizados: items
      .filter((item) => item.linha !== 3)
      .map((item) => localizado(item)),
    erros: items
      .filter((item) => item.linha === 3)
      .map((item) => `Linha ${item.linha}: endereço não localizado.`),
  });

  const importarTudo = (
    confirmados: EnderecoLocalizado[],
  ): BulkImportResult => ({
    adicionadas: confirmados.length,
    ignoradas: 0,
    erros: [],
    linhasAdicionadas: confirmados.map((item) => item.linha),
  });

  function montar({
    texto = linhas.slice(0, 2).join('\n'),
    onLocalizar = jest.fn(localizarPadrao),
    onImport = jest.fn(importarTudo),
  }: {
    texto?: string;
    onLocalizar?: jest.Mock;
    onImport?: jest.Mock;
  } = {}) {
    const tela = render(
      <BulkStopImporter onLocalizar={onLocalizar} onImport={onImport} />,
    );
    fireEvent.press(tela.getByText('Importar em lote'));
    fireEvent.changeText(
      tela.getByLabelText('Linhas de paradas para importação'),
      texto,
    );
    return { ...tela, onLocalizar, onImport };
  }

  async function localizar(tela: ReturnType<typeof montar>) {
    await act(async () => {
      fireEvent.press(tela.getByText('Localizar endereços'));
    });
  }

  it('"Localizar endereços" mostra a conferência sem criar parada nenhuma', async () => {
    const tela = montar();
    await localizar(tela);

    expect(tela.onLocalizar).toHaveBeenCalledTimes(1);
    expect(tela.onImport).not.toHaveBeenCalled();
    // Texto colado E endereço encontrado, lado a lado, pela linha real.
    expect(tela.getByText('Linha 1')).toBeTruthy();
    expect(tela.getByText('Rua A, 10')).toBeTruthy();
    expect(tela.getByText('Rua A, 10 - Centro, João Pessoa - PB')).toBeTruthy();
    expect(tela.getByText('Adicionar 2 paradas')).toBeTruthy();
  });

  it('"Adicionar 2 paradas" entrega as duas conferidas', async () => {
    const tela = montar();
    await localizar(tela);

    act(() => {
      fireEvent.press(tela.getByText('Adicionar 2 paradas'));
    });

    expect(tela.onImport).toHaveBeenCalledTimes(1);
    const [confirmados, opcoes] = tela.onImport.mock.calls[0];
    expect(confirmados.map((item: EnderecoLocalizado) => item.linha)).toEqual([
      1, 2,
    ]);
    expect(opcoes).toEqual({ foraDoLote: 0 });
  });

  it('"Remover" tira a linha e o botão passa a contar 1 parada', async () => {
    const tela = montar();
    await localizar(tela);

    fireEvent.press(tela.getByLabelText('Remover linha 2'));

    expect(tela.queryByText('Rua B, 20')).toBeNull();
    expect(tela.getByText('Adicionar 1 parada')).toBeTruthy();
  });

  it('avisa a linha que caiu a mais de 30 km da sede, e só ela', async () => {
    const tela = montar({
      onLocalizar: jest.fn(async (items: BulkParadaInput[]) => ({
        localizados: [
          localizado(items[0]!, { distanciaSedeKm: 45 }),
          localizado(items[1]!, { distanciaSedeKm: 2.5 }),
        ],
        erros: [],
      })),
    });
    await localizar(tela);

    expect(tela.getByText('45,0 km da sede')).toBeTruthy();
    expect(tela.getByText('2,5 km da sede')).toBeTruthy();
    expect(tela.getAllByText('Mais de 30 km da sede — confira')).toHaveLength(
      1,
    );
  });

  it('rotula a fonte com honestidade: CEP é posição aproximada', async () => {
    const tela = montar({
      onLocalizar: jest.fn(async (items: BulkParadaInput[]) => ({
        localizados: [
          localizado(items[0]!, { fonte: 'viacep' }),
          localizado(items[1]!, { fonte: 'photon' }),
        ],
        erros: [],
      })),
    });
    await localizar(tela);

    expect(tela.getByText('CEP (posição aproximada)')).toBeTruthy();
    expect(tela.getByText('Photon')).toBeTruthy();
  });

  it('lista o erro de localização pela linha real', async () => {
    const tela = montar({ texto: linhas.join('\n') });
    await localizar(tela);

    expect(tela.getByText('• Linha 3: endereço não localizado.')).toBeTruthy();
    expect(tela.getByText('Adicionar 2 paradas')).toBeTruthy();
  });

  it('depois de adicionar com 1 falha, o campo fica exatamente com a linha que falhou', async () => {
    const tela = montar({ texto: linhas.join('\n') });
    await localizar(tela);

    act(() => {
      fireEvent.press(tela.getByText('Adicionar 2 paradas'));
    });

    expect(tela.onImport.mock.calls[0][1]).toEqual({ foraDoLote: 1 });
    expect(
      tela.getByLabelText('Linhas de paradas para importação').props.value,
    ).toBe(linhas[2]);
    // No campo novo ela é a linha 1: a mensagem acompanha o que está na tela.
    expect(tela.getByText('• Linha 1: endereço não localizado.')).toBeTruthy();
  });

  it('a linha removida e a recusada na fase 2 também voltam ao campo', async () => {
    const tela = montar({
      texto: linhas.join('\n'),
      onLocalizar: jest.fn(async (items: BulkParadaInput[]) => ({
        localizados: items.map((item) => localizado(item)),
        erros: [],
      })),
      onImport: jest.fn(
        (confirmados: EnderecoLocalizado[]): BulkImportResult => ({
          adicionadas: 1,
          ignoradas: 1,
          erros: ['Linha 3: entrega duplicada (mesmo endereço ou telefone).'],
          linhasAdicionadas: [confirmados[0]!.linha],
        }),
      ),
    });
    await localizar(tela);
    fireEvent.press(tela.getByLabelText('Remover linha 2'));

    act(() => {
      fireEvent.press(tela.getByText('Adicionar 2 paradas'));
    });

    expect(tela.onImport.mock.calls[0][1]).toEqual({ foraDoLote: 1 });
    expect(
      tela.getByLabelText('Linhas de paradas para importação').props.value,
    ).toBe([linhas[1], linhas[2]].join('\n'));
    expect(tela.getByText('• Linha 1: removida na conferência.')).toBeTruthy();
    expect(
      tela.getByText(
        '• Linha 2: entrega duplicada (mesmo endereço ou telefone).',
      ),
    ).toBeTruthy();
  });

  it('fecha e esvazia o campo quando todas as linhas entram', async () => {
    const tela = montar();
    await localizar(tela);

    act(() => {
      fireEvent.press(tela.getByText('Adicionar 2 paradas'));
    });

    expect(tela.queryByText('Importar paradas em lote')).toBeNull();
    fireEvent.press(tela.getByText('Importar em lote'));
    expect(
      tela.getByLabelText('Linhas de paradas para importação').props.value,
    ).toBe('');
  });

  it('mostra o andamento enquanto localiza', async () => {
    let concluir: (resultado: LocalizarLoteResult) => void = () => {};
    const onLocalizar = jest.fn(
      (_items: BulkParadaInput[], opcoes?: LocalizarLoteOpcoes) => {
        opcoes?.onProgresso?.(2, 3);
        return new Promise<LocalizarLoteResult>((resolve) => {
          concluir = resolve;
        });
      },
    );
    const tela = montar({ texto: linhas.join('\n'), onLocalizar });

    await act(async () => {
      fireEvent.press(tela.getByText('Localizar endereços'));
    });

    expect(tela.getByText('Localizando 2 de 3…')).toBeTruthy();
    await act(async () => {
      concluir({ localizados: [], erros: [] });
    });
  });

  it('"Corrigir" localiza de novo só aquela linha, com o texto editado', async () => {
    const onLocalizar = jest.fn(localizarPadrao);
    const tela = montar({ onLocalizar });
    await localizar(tela);

    fireEvent.press(tela.getByLabelText('Corrigir linha 1'));
    fireEvent.changeText(
      tela.getByLabelText('Endereço da linha 1'),
      'Rua A, 10, Cabedelo - PB',
    );
    await act(async () => {
      fireEvent.press(tela.getByText('Localizar de novo'));
    });

    expect(onLocalizar).toHaveBeenCalledTimes(2);
    const [itens] = onLocalizar.mock.calls[1];
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({
      linha: 1,
      endereco: 'Rua A, 10, Cabedelo - PB',
    });
    expect(
      tela.getByText('Rua A, 10, Cabedelo - PB - Centro, João Pessoa - PB'),
    ).toBeTruthy();
    expect(tela.getByText('Adicionar 2 paradas')).toBeTruthy();
  });

  it('"Corrigir" que não acha o endereço mantém a linha antiga e diz por quê', async () => {
    const onLocalizar = jest.fn(localizarPadrao);
    const tela = montar({ onLocalizar });
    await localizar(tela);
    onLocalizar.mockResolvedValueOnce({
      localizados: [],
      erros: ['Linha 1: endereço não localizado.'],
    });

    fireEvent.press(tela.getByLabelText('Corrigir linha 1'));
    fireEvent.changeText(
      tela.getByLabelText('Endereço da linha 1'),
      'Rua Inexistente, 0',
    );
    await act(async () => {
      fireEvent.press(tela.getByText('Localizar de novo'));
    });

    expect(tela.getByText('Linha 1: endereço não localizado.')).toBeTruthy();
    expect(tela.getByText('Rua A, 10 - Centro, João Pessoa - PB')).toBeTruthy();
  });

  it('"Voltar" devolve à etapa de colar com o texto intacto', async () => {
    const texto = linhas.slice(0, 2).join('\n');
    const tela = montar({ texto });
    await localizar(tela);

    fireEvent.press(tela.getByText('Voltar'));

    expect(
      tela.getByLabelText('Linhas de paradas para importação').props.value,
    ).toBe(texto);
    expect(tela.onImport).not.toHaveBeenCalled();
  });

  describe('falhas e corridas da correção', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('"Localizar de novo" rejeitando devolve os botões e diz o que houve', async () => {
      const onLocalizar = jest.fn(localizarPadrao);
      const tela = montar({ onLocalizar });
      await localizar(tela);
      onLocalizar.mockRejectedValueOnce(new Error('Network request failed'));

      fireEvent.press(tela.getByLabelText('Corrigir linha 1'));
      fireEvent.changeText(
        tela.getByLabelText('Endereço da linha 1'),
        'Rua A, 10, Cabedelo - PB',
      );
      await act(async () => {
        fireEvent.press(tela.getByText('Localizar de novo'));
      });

      expect(
        tela.getByText('Linha 1: não foi possível localizar. Tente de novo.'),
      ).toBeTruthy();
      expect(tela.getByText('Localizar de novo')).toBeEnabled();
      expect(tela.getByText('Cancelar')).toBeEnabled();
      expect(tela.getByText('Voltar')).toBeEnabled();
      expect(tela.getByLabelText('Endereço da linha 1')).toHaveProp(
        'editable',
        true,
      );
      expect(logger.warn).toHaveBeenCalled();
      // A linha antiga continua na conferência.
      expect(
        tela.getByText('Rua A, 10 - Centro, João Pessoa - PB'),
      ).toBeTruthy();
    });

    it('fechar com correção em voo: a resposta velha não sobrescreve a conferência nova', async () => {
      const onLocalizar = jest.fn(localizarPadrao);
      const tela = montar({ onLocalizar });
      await localizar(tela);

      let responderVelha: (r: LocalizarLoteResult) => void = () => {};
      onLocalizar.mockImplementationOnce(
        () =>
          new Promise<LocalizarLoteResult>((resolve) => {
            responderVelha = resolve;
          }),
      );
      fireEvent.press(tela.getByLabelText('Corrigir linha 1'));
      fireEvent.changeText(
        tela.getByLabelText('Endereço da linha 1'),
        'Rua Velha, 99',
      );
      await act(async () => {
        fireEvent.press(tela.getByText('Localizar de novo'));
      });

      fireEvent.press(tela.getByLabelText('Fechar importação em lote'));
      fireEvent.press(tela.getByText('Importar em lote'));
      await localizar(tela);
      // Correção nova aberta na conferência nova.
      fireEvent.press(tela.getByLabelText('Corrigir linha 2'));

      const item = onLocalizar.mock.calls[1][0][0] as BulkParadaInput;
      await act(async () => {
        responderVelha({
          localizados: [
            localizado(item, { enderecoEncontrado: 'Rua Velha, 99 - Velho' }),
          ],
          erros: [],
        });
      });

      expect(tela.queryByText('Rua Velha, 99 - Velho')).toBeNull();
      expect(
        tela.getByText('Rua A, 10 - Centro, João Pessoa - PB'),
      ).toBeTruthy();
      // A correção aberta depois não é fechada pela resposta velha.
      expect(tela.getByLabelText('Endereço da linha 2')).toBeTruthy();
    });

    it('"Localizar endereços" rejeitando mostra o erro no modal e loga', async () => {
      const onLocalizar = jest.fn().mockRejectedValue(new Error('boom'));
      const tela = montar({ onLocalizar });

      await localizar(tela);

      expect(
        tela.getByText(
          '• Não foi possível localizar os endereços. Tente de novo.',
        ),
      ).toBeTruthy();
      expect(tela.getByText('Localizar endereços')).toBeEnabled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('"Adicionar" fica desabilitado com a correção aberta (o texto editado não se perde)', async () => {
      const tela = montar();
      await localizar(tela);

      fireEvent.press(tela.getByLabelText('Corrigir linha 1'));
      fireEvent.changeText(
        tela.getByLabelText('Endereço da linha 1'),
        'Rua A, 10, Cabedelo - PB',
      );

      expect(tela.getByText('Adicionar 2 paradas')).toBeDisabled();
      // Botão desabilitado: o toque sobe ao Pressable do modal, que pede o
      // evento (stopPropagation) — daí o evento falso.
      fireEvent.press(tela.getByText('Adicionar 2 paradas'), {
        stopPropagation: () => {},
      });
      expect(tela.onImport).not.toHaveBeenCalled();

      fireEvent.press(tela.getByText('Cancelar'));
      expect(tela.getByText('Adicionar 2 paradas')).toBeEnabled();
    });
  });
});
