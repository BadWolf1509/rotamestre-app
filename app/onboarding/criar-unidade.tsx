import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
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
import { logger } from '@/lib/logger';
import {
  criarUnidadeSchema,
  type CriarUnidadeInput,
} from '@/lib/schemas/onboarding';
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

  return (
    <ScrollView contentContainerStyle={{ padding: isDesktop ? 32 : 16 }}>
      {/* useAlert só exibe se o dialog estiver na árvore (padrão de
          app/onboarding/first-password.tsx:140). Sem esta linha, showSuccess e
          showError viram no-op silencioso. */}
      {AlertDialog}
      <ResponsiveContainer>
        <Card>
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
                onSelectAddress={(address, _placeId, coords?: Coordenadas) => {
                  onChange(address);
                  if (coords) {
                    setValue('latitude', coords.latitude);
                    setValue('longitude', coords.longitude);
                  }
                }}
                error={errors.endereco?.message}
                placeholder="Endereço da sede"
                required
                multiline
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
