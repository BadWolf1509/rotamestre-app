import { nomeEstadoParaUF } from '../estados';

describe('nomeEstadoParaUF', () => {
  // O caso que motivou o helper: a Edge Function google-place-details extrai
  // os componentes com `longText`, então o estado chega por extenso. Jogado
  // direto num campo com maxLength 2, "Paraíba" viraria "Pa".
  it('converte o nome por extenso devolvido pelo geocoding em sigla', () => {
    expect(nomeEstadoParaUF('Paraíba')).toBe('PB');
    expect(nomeEstadoParaUF('São Paulo')).toBe('SP');
    expect(nomeEstadoParaUF('Rio de Janeiro')).toBe('RJ');
    expect(nomeEstadoParaUF('Distrito Federal')).toBe('DF');
  });

  it('ignora acentuação e caixa', () => {
    expect(nomeEstadoParaUF('paraiba')).toBe('PB');
    expect(nomeEstadoParaUF('PARAÍBA')).toBe('PB');
    expect(nomeEstadoParaUF('  Rondônia  ')).toBe('RO');
    expect(nomeEstadoParaUF('rondonia')).toBe('RO');
  });

  it('aceita a sigla já pronta', () => {
    expect(nomeEstadoParaUF('PB')).toBe('PB');
    expect(nomeEstadoParaUF('sp')).toBe('SP');
  });

  it('cobre as 27 unidades federativas', () => {
    const nomes = [
      'Acre',
      'Alagoas',
      'Amapá',
      'Amazonas',
      'Bahia',
      'Ceará',
      'Distrito Federal',
      'Espírito Santo',
      'Goiás',
      'Maranhão',
      'Mato Grosso',
      'Mato Grosso do Sul',
      'Minas Gerais',
      'Pará',
      'Paraíba',
      'Paraná',
      'Pernambuco',
      'Piauí',
      'Rio de Janeiro',
      'Rio Grande do Norte',
      'Rio Grande do Sul',
      'Rondônia',
      'Roraima',
      'Santa Catarina',
      'São Paulo',
      'Sergipe',
      'Tocantins',
    ];

    const siglas = nomes.map(nomeEstadoParaUF);
    expect(siglas).toHaveLength(27);
    expect(siglas.every((sigla) => /^[A-Z]{2}$/.test(sigla))).toBe(true);
    expect(new Set(siglas).size).toBe(27);
  });

  it('devolve vazio quando não reconhece, em vez de preencher lixo', () => {
    expect(nomeEstadoParaUF('Buenos Aires')).toBe('');
    expect(nomeEstadoParaUF('XX')).toBe('');
    expect(nomeEstadoParaUF('')).toBe('');
    expect(nomeEstadoParaUF(null)).toBe('');
    expect(nomeEstadoParaUF(undefined)).toBe('');
  });
});
