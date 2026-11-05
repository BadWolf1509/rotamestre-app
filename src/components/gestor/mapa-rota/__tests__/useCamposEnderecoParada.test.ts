import { renderHook } from '@testing-library/react-native';

import { useCamposEnderecoParada } from '../useCamposEnderecoParada';

function montar(isSubmitted = false) {
  const setValue = jest.fn();
  const clearErrors = jest.fn();
  const limparErroGeral = jest.fn();
  const hook = renderHook(() =>
    useCamposEnderecoParada(
      { setValue, clearErrors, isSubmitted },
      limparErroGeral,
    ),
  );
  return { ...hook, setValue, clearErrors, limparErroGeral };
}

describe('useCamposEnderecoParada (R-GES-5)', () => {
  it('escolher a sugestão grava endereço e coordenadas e limpa o erro cruzado', () => {
    const { result, setValue, clearErrors, limparErroGeral } = montar();

    result.current.handleAddressSelect('Rua A, 1', 'place', {
      latitude: -7.1,
      longitude: -34.8,
    });

    expect(setValue).toHaveBeenCalledWith('endereco', 'Rua A, 1');
    expect(setValue).toHaveBeenCalledWith('latitude', -7.1);
    expect(setValue).toHaveBeenCalledWith('longitude', -34.8);
    expect(limparErroGeral).toHaveBeenCalled();
    expect(clearErrors).toHaveBeenCalledWith('endereco');
  });

  it('sugestão sem coordenadas não limpa o erro do endereço', () => {
    const { result, clearErrors } = montar();

    result.current.handleAddressSelect('Rua B', 'place');

    expect(clearErrors).not.toHaveBeenCalled();
  });

  it('telefone sai mascarado e só valida depois do primeiro envio', () => {
    const antes = montar(false);
    antes.result.current.handlePhoneChange('11999998888');
    expect(antes.setValue).toHaveBeenCalledWith('telefone', '(11) 99999-8888', {
      shouldValidate: false,
    });

    const depois = montar(true);
    depois.result.current.handlePhoneChange('11999998888');
    expect(depois.setValue).toHaveBeenCalledWith(
      'telefone',
      '(11) 99999-8888',
      { shouldValidate: true },
    );
  });
});
