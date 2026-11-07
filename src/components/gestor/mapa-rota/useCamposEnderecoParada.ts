/**
 * Handlers dos campos endereço/telefone que `useAddStopForm` e `useEditStopForm`
 * tinham idênticos (R-GES-5). O salvar continua separado em cada um (RPC x
 * UPDATE condicionado); o JSX dos campos não foi unificado aqui — mexer no
 * autocomplete exige validar o foco no navegador.
 */

import { useCallback } from 'react';

import { maskPhone } from '@/lib/phone';
import type { Coordenadas } from '@/types/endereco';

/** O trecho do `useForm` que os handlers usam (evita acoplar o tipo inteiro). */
interface FormularioDaParada {
  setValue: (
    campo: 'endereco' | 'latitude' | 'longitude' | 'telefone',
    valor: string | number | undefined,
    opcoes?: { shouldValidate?: boolean },
  ) => void;
  clearErrors: (campo: 'endereco') => void;
  isSubmitted: boolean;
}

export function useCamposEnderecoParada(
  { setValue, clearErrors, isSubmitted }: FormularioDaParada,
  limparErroGeral: () => void,
) {
  // Photon já retorna coordenadas diretamente - não precisa de getPlaceDetails!
  const handleAddressSelect = useCallback(
    (address: string, _placeId: string, coordinates?: Coordenadas) => {
      setValue('endereco', address);
      setValue('latitude', coordinates?.latitude);
      setValue('longitude', coordinates?.longitude);
      limparErroGeral();
      // Erro cruzado: a mensagem mora em `endereco` ("não achei as
      // coordenadas"), mas a causa era lat/long, que acabaram de chegar.
      // `setValue` não revalida e a revalidação assíncrona perde a corrida: o
      // erro ficaria preso ao lado do selo "Validado". Limpar explicitamente é
      // o caminho determinístico (ver FormularioParada).
      if (coordinates) {
        clearErrors('endereco');
      }
    },
    [setValue, clearErrors, limparErroGeral],
  );

  const handlePhoneChange = useCallback(
    (text: string) => {
      setValue('telefone', maskPhone(text), { shouldValidate: isSubmitted });
    },
    [setValue, isSubmitted],
  );

  return { handleAddressSelect, handlePhoneChange };
}
