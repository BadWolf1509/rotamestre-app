import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';

import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import {
  AddressAutocomplete,
  Button,
  Card,
  ErrorBoundary,
  Input,
  Text,
} from '@/design-system';
import { useCriarUnidade } from '@/hooks/onboarding/useCriarUnidade';
import { useAlert } from '@/hooks/useAlert';
import { useResponsive } from '@/hooks/useResponsive';
import { nomeEstadoParaUF } from '@/lib/estados';
import { googlePlacesService } from '@/lib/googlePlaces';
import { logger } from '@/lib/logger';
import {
  criarUnidadeSchema,
  type CriarUnidadeInput,
} from '@/lib/schemas/onboarding';
import { supabase } from '@/lib/supabase';
import type { Coordenadas } from '@/types/endereco';

function CriarUnidadeScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { criarUnidade, loading } = useCriarUnidade();
  const { showSuccess, showError, AlertDialog } = useAlert();

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    clearErrors,
    formState: { errors },
  } = useForm<CriarUnidadeInput>({
    resolver: zodResolver(criarUnidadeSchema),
    defaultValues: {
      gestorNome: '',
      unidadeNome: '',
      cidade: '',
      uf: '',
      endereco: '',
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  // Pré-preenche o nome com o que a pessoa digitou no cadastro. Ele viaja em
  // `options.data` do signUp e fica em `user_metadata` — é a única fonte aqui,
  // porque nesta tela ainda NÃO existe linha em `usuarios` (o perfil nasce na
  // RPC, logo adiante). Sem isso a pessoa redigita o nome que acabou de
  // informar, e nada impede que os dois valores divirjam.
  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const nome = data?.user?.user_metadata?.nome;
        if (cancelado || typeof nome !== 'string' || !nome.trim()) return;
        // Não sobrescreve o que já foi digitado: a leitura é assíncrona e pode
        // chegar depois de a pessoa começar a preencher.
        if (getValues('gestorNome')?.trim()) return;
        setValue('gestorNome', nome.trim());
      } catch (error) {
        // Falha aqui só custa o pré-preenchimento; o campo continua editável.
        logger.warn(
          '[Onboarding] Não foi possível ler o nome do cadastro',
          error,
        );
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [getValues, setValue]);

  // Cidade e UF saem do próprio endereço da sede. Digitados à mão eles podem
  // divergir das coordenadas — a unidade nasceria dizendo "Recife" com a sede
  // em João Pessoa, sem nenhum aviso. Por isso o endereço é a fonte de verdade
  // e sobrescreve o que já estiver nos campos.
  //
  // O place details já foi buscado pelo AddressAutocomplete para resolver as
  // coordenadas (src/lib/geocoding.ts:227), então esta chamada cai no cache de
  // 30 minutos em vez de custar uma nova sessão do Places.
  async function preencherCidadeUF(placeId?: string) {
    // Sugestões do ViaCEP entram na mesma lista, mas com place_id sintético no
    // formato `cep_58030000` (src/lib/viacep.ts:176) — o Places não sabe
    // resolver isso, e a ida à Edge Function só voltaria vazia.
    if (!placeId || placeId.startsWith('cep_')) return;

    try {
      const detalhes = await googlePlacesService.getPlaceDetails(placeId);
      if (!detalhes) return;

      // A Edge Function extrai os componentes com `longText`, então `estado`
      // chega como "Paraíba" e precisa virar "PB" — o campo tem maxLength 2 e
      // truncaria para "Pa".
      const uf = nomeEstadoParaUF(detalhes.estado);

      // `setValue` sem opções não revalida: sem o clearErrors, um "Informe a
      // cidade" de um submit anterior fica preso embaixo do campo que este
      // preenchimento acabou de preencher. Se o valor ainda for inválido, o
      // próximo submit reintroduz o erro.
      if (detalhes.cidade) {
        setValue('cidade', detalhes.cidade);
        clearErrors('cidade');
      }
      if (uf) {
        setValue('uf', uf);
        clearErrors('uf');
      }
    } catch (error) {
      // Não-crítico: o preenchimento é conveniência. As coordenadas já vieram
      // do onSelectAddress e os dois campos continuam editáveis à mão — travar
      // o onboarding inteiro por causa disso seria desproporcional.
      logger.warn(
        '[Onboarding] Não foi possível preencher cidade e UF pelo endereço',
        error,
      );
    }
  }

  async function onSubmit(data: CriarUnidadeInput) {
    // O `.refine` do schema já barra este caso; a checagem existe para o
    // TypeScript estreitar o tipo, sem cast.
    const { latitude, longitude } = data;
    if (latitude === undefined || longitude === undefined) return;

    try {
      await criarUnidade({ ...data, latitude, longitude });
      showSuccess(
        'Tudo pronto!',
        'Sua unidade foi criada. Bem-vindo ao Rota Mestre.',
        () => router.replace('/gestor/inicio'),
      );
    } catch (error: unknown) {
      logger.error('[criar-unidade] Falha no onboarding', error);
      // Passar `error` como 1º argumento (em vez de {title, message}) aciona o
      // mapeamento de src/lib/errorMapping.ts: sentinelas cruas do Postgres
      // (ex.: COORDENADAS_INVALIDAS) viram uma mensagem genérica em pt-BR em
      // vez de vazar pro usuário. `fallbackOptions.title` só sobrescreve o
      // título; a mensagem mapeada é preservada.
      showError(error, { title: 'Não foi possível criar a unidade' });
    }
  }

  // Réplica do padrão de app/onboarding/first-password.tsx (sessão sem
  // usuário → signOut + volta pro login): sem esta saída, quem cai aqui com a
  // RPC indisponível (ex.: PGRST202 antes da migration aplicar) fica preso —
  // o Stack deste layout tem headerBackVisible=false e gestureEnabled=false, e
  // reabrir o app cai na mesma tela de novo.
  async function handleSair() {
    await supabase.auth.signOut();
    router.replace('/auth/login');
  }

  return (
    <ScrollView contentContainerStyle={{ padding: isDesktop ? 32 : 16 }}>
      {/* useAlert só exibe se o dialog estiver na árvore (padrão de
          app/onboarding/first-password.tsx:140). Sem esta linha, showSuccess e
          showError viram no-op silencioso. */}
      {AlertDialog}
      <ResponsiveContainer>
        <Card>
          <View style={{ alignSelf: 'flex-end' }}>
            <Button
              title="Sair"
              variant="ghost"
              size="small"
              onPress={handleSair}
            />
          </View>

          <Text variant="title">Falta pouco</Text>
          <Text variant="body">
            Cadastre sua empresa para começar a criar rotas.
          </Text>

          <Controller
            control={control}
            name="gestorNome"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Seu nome"
                value={value}
                onChangeText={onChange}
                error={errors.gestorNome?.message}
                autoCapitalize="words"
              />
            )}
          />

          <Controller
            control={control}
            name="unidadeNome"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Nome da empresa"
                value={value}
                onChangeText={onChange}
                error={errors.unidadeNome?.message}
              />
            )}
          />

          {/* O endereço vem antes de cidade e UF de propósito: selecionar uma
              sugestão preenche os dois campos abaixo, então pedi-los antes
              faria a pessoa digitar algo que o app sobrescreve em seguida. */}
          <Controller
            control={control}
            name="endereco"
            render={({ field: { onChange, value } }) => (
              <AddressAutocomplete
                value={value || ''}
                onChangeText={(text) => {
                  // Editar o texto invalida as coordenadas: elas só são
                  // confiáveis quando vêm de uma sugestão selecionada.
                  if (text !== value) {
                    setValue('latitude', undefined);
                    setValue('longitude', undefined);
                  }
                  onChange(text);
                }}
                onSelectAddress={(address, placeId, coords?: Coordenadas) => {
                  if (coords) {
                    setValue('latitude', coords.latitude);
                    setValue('longitude', coords.longitude);
                  }
                  onChange(address);
                  // Sem await: a seleção do endereço não pode ficar presa
                  // esperando a rede. O preenchimento chega quando chegar.
                  void preencherCidadeUF(placeId);
                  // O erro do schema mora em `endereco` (refine com
                  // path: ['endereco'] em src/lib/schemas/onboarding.ts) mas
                  // quem o causa é a ausência de lat/long. `setValue` sem
                  // opções não revalida, e nem a revalidação do `onChange` nem
                  // um `trigger('endereco')` derrubam o erro aqui — ambos são
                  // assíncronos e perdem a corrida. Sem esta limpeza explícita
                  // o erro fica preso ao lado do "Validado" verde, mandando o
                  // gestor refazer o que ele acabou de fazer. Se o endereço
                  // ainda for inválido por outro motivo, o próximo submit o
                  // reintroduz.
                  if (coords) {
                    clearErrors('endereco');
                  }
                }}
                error={errors.endereco?.message}
                placeholder="Endereço da sede"
                required
                multiline
              />
            )}
          />

          <Controller
            control={control}
            name="cidade"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Cidade"
                value={value}
                onChangeText={onChange}
                error={errors.cidade?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="uf"
            render={({ field: { onChange, value } }) => (
              <Input
                label="UF (opcional)"
                value={value ?? ''}
                onChangeText={(t) => onChange(t.toUpperCase())}
                maxLength={2}
                error={errors.uf?.message}
              />
            )}
          />

          <View>
            <Button
              title="Criar unidade"
              onPress={handleSubmit(onSubmit)}
              loading={loading}
            />
          </View>
        </Card>
      </ResponsiveContainer>
    </ScrollView>
  );
}

export default function CriarUnidadeRoute() {
  return (
    <ErrorBoundary>
      <CriarUnidadeScreen />
    </ErrorBoundary>
  );
}
