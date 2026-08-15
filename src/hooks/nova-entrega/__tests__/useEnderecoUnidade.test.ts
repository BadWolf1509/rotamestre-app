import { renderHook, waitFor } from '@testing-library/react-native';

import { useEnderecoUnidade } from '../useEnderecoUnidade';

jest.mock('@/hooks/useUnidadeAtiva');
jest.mock('@/lib/photon');

const mockUseUnidadeAtiva = require('@/hooks/useUnidadeAtiva')
  .useUnidadeAtiva as jest.Mock;

/** Unidade com coordenadas no banco: o hook usa o endereço sem geocodificar. */
function comUnidade(dados: Record<string, unknown>) {
  mockUseUnidadeAtiva.mockReturnValue({
    unidadeAtivaData: {
      sede_latitude: -7.12008,
      sede_longitude: -34.86142,
      ...dados,
    },
  });
}

describe('useEnderecoUnidade', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('não repete cidade e UF que o endereço da sede já traz', async () => {
    // O endereço da sede vem do Google Places, que já devolve cidade e UF no
    // texto. Concatenar os campos do cadastro por cima produzia
    // "... João Pessoa - PB, João Pessoa, PB" na tela de Nova Rota, no banner
    // da rota otimizada e no texto que vai para o geocoding.
    comUnidade({
      sede_endereco: 'Avenida Epitacio Pessoa, 1000 - Torre, João Pessoa - PB',
      cidade: 'João Pessoa',
      uf: 'PB',
      cep: null,
    });

    const { result } = renderHook(() => useEnderecoUnidade());

    await waitFor(() => expect(result.current.enderecoUnidade).not.toBeNull());

    const endereco = result.current.enderecoUnidade!.endereco;
    expect(endereco).toBe(
      'Avenida Epitacio Pessoa, 1000 - Torre, João Pessoa - PB',
    );
    // Contagem explícita: a falha antiga era exatamente a segunda ocorrência.
    expect(endereco.match(/João Pessoa/g)).toHaveLength(1);
    expect(endereco.match(/PB/g)).toHaveLength(1);
  });

  it('ignora acento e caixa ao decidir se a parte já está no endereço', async () => {
    // O cadastro é digitado à mão e o Places devolve texto formatado — os dois
    // divergem em acento e caixa com frequência.
    comUnidade({
      sede_endereco: 'Rua das Flores, 50 - SAO PAULO - sp',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: null,
    });

    const { result } = renderHook(() => useEnderecoUnidade());

    await waitFor(() => expect(result.current.enderecoUnidade).not.toBeNull());

    expect(result.current.enderecoUnidade!.endereco).toBe(
      'Rua das Flores, 50 - SAO PAULO - sp',
    );
  });

  it('completa o endereço cru com cidade, UF e CEP', async () => {
    // Sem isso o geocoding recebe "Rua das Flores, 50" e erra de cidade — é
    // por isso que a concatenação existe, e ela precisa continuar valendo.
    comUnidade({
      sede_endereco: null,
      endereco: 'Rua das Flores, 50',
      cidade: 'João Pessoa',
      uf: 'PB',
      cep: '58030-000',
    });

    const { result } = renderHook(() => useEnderecoUnidade());

    await waitFor(() => expect(result.current.enderecoUnidade).not.toBeNull());

    expect(result.current.enderecoUnidade!.endereco).toBe(
      'Rua das Flores, 50, João Pessoa, PB, 58030-000',
    );
  });

  it('não confunde UF com as letras dentro de uma palavra', async () => {
    // "PA" aparece dentro de "Parnamirim"; um `includes` cru daria match e a
    // UF sumiria do endereço.
    comUnidade({
      sede_endereco: 'Avenida Parnamirim, 200',
      cidade: 'Belém',
      uf: 'PA',
      cep: null,
    });

    const { result } = renderHook(() => useEnderecoUnidade());

    await waitFor(() => expect(result.current.enderecoUnidade).not.toBeNull());

    expect(result.current.enderecoUnidade!.endereco).toBe(
      'Avenida Parnamirim, 200, Belém, PA',
    );
  });
});
