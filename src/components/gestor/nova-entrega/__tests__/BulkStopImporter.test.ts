import { parseBulkStops } from '../BulkStopImporter';

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
      },
      {
        tipo: 'retirada',
        endereco: 'Av. Central, 200',
        destinatario: 'Fornecedor',
        telefone: '85988887777',
        observacoes: '',
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
