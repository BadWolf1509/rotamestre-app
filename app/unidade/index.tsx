import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FieldError } from '@/components/auth/FieldError';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import {
  AddressAutocomplete,
  DesktopPageLayout,
  MobileCard,
  MobileLoading,
  Toast,
} from '@/design-system';
import { useAlert } from '@/hooks/useAlert';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { nomeEstadoParaUF } from '@/lib/estados';
import {
  carregarEquipeDaLoja,
  ehGestorPrincipalDaLoja,
  resumoDaEquipe,
} from '@/lib/gestor/equipeDaLoja';
import { googlePlacesService } from '@/lib/googlePlaces';
import { logger } from '@/lib/logger';
import { cleanPhone, formatPhone } from '@/lib/phone';
import { SELECT_UNIDADE_APP } from '@/lib/queries/colunasUnidade';
import { type UnidadeFormInput, unidadeSchema } from '@/lib/schemas/unidade';
import { supabase } from '@/lib/supabase';
import { maskCEP } from '@/lib/viacep';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface UnidadeData {
  id: string;
  nome: string;
  telefone: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  sede_endereco?: string | null;
}

const codigoDoErro = (erro: unknown): string | undefined =>
  typeof erro === 'object' && erro !== null && 'code' in erro
    ? String((erro as { code: unknown }).code)
    : undefined;

/** Valores do formulário a partir da linha da loja (máscaras aplicadas). */
const valoresDoForm = (dados?: UnidadeData | null): UnidadeFormInput => ({
  nome: dados?.nome || '',
  telefone: formatPhone(dados?.telefone || ''),
  endereco: dados?.endereco || '',
  cidade: dados?.cidade || '',
  estado: dados?.uf || '',
  cep: maskCEP(dados?.cep || ''),
});

const formatCnpj = (value?: string | null): string => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14) {
    return value;
  }
  return digits.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    '$1.$2.$3/$4-$5',
  );
};

export default function UnidadeScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { userData, loading: userLoading } = useUser();
  // A loja ABERTA, não o `usuarios.unidade_id` legado (gestor de várias
  // lojas editava a ficha de outra).
  const { unidadeAtiva, refresh: recarregarLojas } = useUnidadeAtiva();
  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
    userImageUrl: userData?.foto_url,
  });
  const { toast: toastState, showToast, hideToast } = useToast();
  const { showWarning, showError, AlertDialog } = useAlert();
  const { isDesktop } = useResponsive();
  const pageMeta = getGestorPageMeta('minhaUnidade');
  const [unidade, setUnidade] = useState<UnidadeData | null>(null);
  // O CNPJ vem da RPC de gestor `cnpj_da_unidade` (gestor com vínculo ativo
  // na loja); sem ela, o campo mostra "Não informado".
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [equipe, setEquipe] = useState({ total: 0, ativos: 0, inativos: 0 });

  // Campos da ficha no react-hook-form, validados pelo `unidadeSchema`. A sede
  // fica fora, em estado próprio: ela só vale com as coordenadas da sugestão
  // escolhida e já tem trava própria (`sedePrecisaConfirmacao`), com aviso no
  // campo enquanto o gestor edita.
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<UnidadeFormInput>({
    resolver: zodResolver(unidadeSchema),
    defaultValues: valoresDoForm(null),
  });
  const [sedeEndereco, setSedeEndereco] = useState('');
  const [sedeLatitude, setSedeLatitude] = useState<number | undefined>();
  const [sedeLongitude, setSedeLongitude] = useState<number | undefined>();
  const isDesktopView = isDesktop;
  const isLoading = userLoading || loading;

  // Derivados da sede, compartilhados entre a guarda do salvamento e o texto
  // de apoio do campo. Mantê-los numa fonte só impede que a mensagem exibida
  // e a regra que bloqueia o save saiam de sincronia.
  const sedeTemCoordenadas =
    sedeLatitude !== undefined && sedeLongitude !== undefined;
  const sedeFoiAlterada =
    sedeEndereco.trim() !== (unidade?.sede_endereco ?? '').trim();
  const sedePrecisaConfirmacao = sedeFoiAlterada && !sedeTemCoordenadas;

  // Guarda de sequência: ao trocar de loja com a carga anterior em voo, só
  // a resposta da carga MAIS RECENTE escreve no formulário.
  const cargaUnidadeRef = useRef(0);
  const cargaEquipeRef = useRef(0);

  const loadUnidade = useCallback(async () => {
    const unidadeId = unidadeAtiva;
    const minhaCarga = ++cargaUnidadeRef.current;
    if (!unidadeId) {
      setUnidade(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setCnpj('');
      // Em paralelo com a ficha (o builder só dispara no `then`, daí o
      // Promise.resolve); a falha do CNPJ não impede a tela.
      const cnpjEmVoo = Promise.resolve(
        supabase.rpc('cnpj_da_unidade', { p_unidade_id: unidadeId }),
      ).catch((erro: unknown) => ({ data: null, error: erro }));
      const { data, error } = await supabase
        .from('unidades')
        .select(SELECT_UNIDADE_APP)
        .eq('id', unidadeId)
        .single<UnidadeData>();

      if (minhaCarga !== cargaUnidadeRef.current) return;
      if (error) throw error;

      setUnidade(data);
      reset(valoresDoForm(data));
      setSedeEndereco(data.sede_endereco || '');

      // Campo só de leitura: sem CNPJ a tela segue, com "Não informado".
      const { data: cnpjDaLoja, error: erroCnpj } = await cnpjEmVoo;
      if (minhaCarga !== cargaUnidadeRef.current) return;
      if (erroCnpj) {
        // PGRST202 = RPC indisponível: o campo fica "Não informado", sem
        // log, como os demais campos vazios.
        if (codigoDoErro(erroCnpj) !== 'PGRST202') {
          logger.warn('CNPJ da unidade indisponível', erroCnpj);
        }
      } else if (typeof cnpjDaLoja === 'string') {
        setCnpj(cnpjDaLoja);
      }
    } catch (error) {
      logger.error('Erro ao carregar unidade', error);
      showToast('Erro ao carregar dados da unidade', 'error', 4000);
    } finally {
      if (minhaCarga === cargaUnidadeRef.current) setLoading(false);
    }
  }, [reset, showToast, unidadeAtiva]);

  const loadMembrosCount = useCallback(async () => {
    // Mesmo contador da ficha (`cargaUnidadeRef`): na troca de loja a
    // contagem lenta da anterior não sobrescreve a da atual.
    const minhaCarga = ++cargaEquipeRef.current;
    const unidadeId = unidadeAtiva;
    setEquipe({ total: 0, ativos: 0, inativos: 0 });
    if (!unidadeId) return;

    try {
      // A MESMA fonte da tela Equipe (vínculo com a loja, incluindo motorista
      // inativo só nesta loja): os dois números não podem divergir.
      const membros = await carregarEquipeDaLoja(unidadeId);
      if (minhaCarga !== cargaEquipeRef.current) return;
      setEquipe(resumoDaEquipe(membros));
    } catch (error) {
      if (minhaCarga !== cargaEquipeRef.current) return;
      logger.error('Erro ao contar membros', error);
    }
  }, [unidadeAtiva]);

  useEffect(() => {
    loadUnidade();
    loadMembrosCount();
  }, [loadMembrosCount, loadUnidade]);

  // Só chega aqui com os campos válidos pelo `unidadeSchema` (nome, telefone,
  // CEP, UF); o erro de cada um aparece no próprio campo, pelo handleSubmit.
  async function salvarFicha({
    nome,
    telefone,
    endereco,
    cidade,
    estado,
    cep,
  }: UnidadeFormInput) {
    // Texto da sede mudou mas sem coordenadas: a sugestão nunca foi
    // selecionada (usuário só digitou), ou o geocoding da sugestão falhou
    // (AddressAutocomplete cai no fallback sem coords — ver
    // src/components/AddressAutocomplete.tsx:301 e :310). Sem lat/long a RPC
    // calcula v_atualiza_sede = false e preserva a sede antiga em silêncio —
    // mas a tela mostraria sucesso do mesmo jeito. Bloqueia antes da RPC.
    if (sedePrecisaConfirmacao) {
      showWarning(
        'Confirme o endereço da sede',
        'Escolha uma das opções sugeridas no campo de sede. Endereço digitado sem confirmar não é salvo.',
      );
      return;
    }

    // O formulário tem de ser o da loja ABERTA: se a troca de loja ainda não
    // terminou de carregar, salvar gravaria os campos de uma loja na outra.
    if (!unidadeAtiva || unidade?.id !== unidadeAtiva) {
      showWarning(
        'Aguarde',
        'Os dados da loja aberta ainda estão carregando. Tente de novo em instantes.',
      );
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase.rpc('atualizar_unidade', {
        p_unidade_id: unidadeAtiva,
        p_nome: nome.trim(),
        p_telefone: cleanPhone(telefone),
        p_endereco: endereco.trim(),
        p_cidade: cidade.trim(),
        p_uf: estado.trim().toUpperCase(),
        p_cep: cep.trim(),
        p_sede_endereco: sedeEndereco.trim() || null,
        p_sede_latitude: sedeLatitude ?? null,
        p_sede_longitude: sedeLongitude ?? null,
      });

      if (error) throw error;

      showToast('Dados atualizados com sucesso!', 'success', 3000);
      setEditMode(false);
      // Nome e sede da loja vivem nas vinculações do UnidadeAtivaProvider da
      // raiz (que não desmonta): sem recarregar, a Nova Rota seguia com a sede
      // antiga até reabrir o app.
      void recarregarLojas();
      await loadUnidade();
    } catch (error) {
      logger.error('Erro ao atualizar unidade', error);
      showError(error, { title: 'Não foi possível salvar' });
    } finally {
      setSaving(false);
    }
  }

  const handleSave = handleSubmit(salvarFicha);

  // Selecionar uma sugestão de sede também preenche os campos de cadastro.
  // Sem isso dava para mudar a sede de cidade e deixar CEP e UF da cidade
  // antiga para trás, sem nenhum aviso. O place details já foi buscado pelo
  // AddressAutocomplete para resolver as coordenadas (src/lib/geocoding.ts:227),
  // então esta chamada cai no cache de 30 minutos.
  async function handleSelecionarSede(
    address: string,
    placeId?: string,
    coords?: { latitude: number; longitude: number },
  ) {
    setSedeEndereco(address);
    if (coords) {
      setSedeLatitude(coords.latitude);
      setSedeLongitude(coords.longitude);
    }

    // Sugestões do ViaCEP entram na mesma lista, mas com place_id sintético
    // no formato `cep_58068504` (src/lib/viacep.ts:176) — o Places não sabe
    // resolver isso. Sair aqui evita uma ida à Edge Function que só voltaria
    // vazia.
    if (!placeId || placeId.startsWith('cep_')) return;

    try {
      const detalhes = await googlePlacesService.getPlaceDetails(placeId);
      if (!detalhes) return;

      const logradouro = [detalhes.logradouro, detalhes.numero]
        .filter(Boolean)
        .join(', ');
      // A Edge Function extrai os componentes com `longText`, então `estado`
      // chega como "Paraíba" e precisa virar "PB" — o campo tem maxLength 2.
      const uf = nomeEstadoParaUF(detalhes.estado);

      // `setValue` sem opções não revalida: sem o clearErrors, um "CEP deve
      // ter 8 dígitos" de um submit anterior ficaria preso ao lado do CEP
      // certo que a sede acabou de escrever (regra "Erro cruzado em form").
      // Se o valor novo ainda for inválido, o próximo submit o reintroduz.
      const preencher = (campo: keyof UnidadeFormInput, valor: string) => {
        setValue(campo, valor);
        clearErrors(campo);
      };
      const preenchidos: string[] = [];
      if (logradouro) {
        preencher('endereco', logradouro);
        preenchidos.push('endereço');
      }
      if (detalhes.cidade) {
        preencher('cidade', detalhes.cidade);
        preenchidos.push('cidade');
      }
      if (uf) {
        preencher('estado', uf);
        preenchidos.push('UF');
      }
      if (detalhes.cep) {
        preencher('cep', maskCEP(detalhes.cep));
        preenchidos.push('CEP');
      }

      // Anuncia só o que de fato mudou: a resposta do Places nem sempre traz
      // os quatro componentes.
      if (preenchidos.length > 0) {
        showToast(
          `Preenchido a partir da sede: ${preenchidos.join(', ')}.`,
          'info',
          3000,
        );
      }
    } catch (error) {
      // Não-crítico: o preenchimento é conveniência. A sede em si já foi
      // definida acima e os demais campos continuam editáveis à mão.
      logger.warn('Não foi possível preencher os campos pela sede', error);
    }
  }

  function handleCancel() {
    // `reset` também limpa os erros dos campos.
    reset(valoresDoForm(unidade));
    setSedeEndereco(unidade?.sede_endereco || '');
    setSedeLatitude(undefined);
    setSedeLongitude(undefined);
    setEditMode(false);
  }

  // Principal DESTA loja, não o flag global (ver `ehGestorPrincipalDaLoja`).
  const isGestorPrincipal = ehGestorPrincipalDaLoja(userData, unidadeAtiva);
  // Editar os dados é diferente de ser o titular. `is_gestor_principal` é
  // false para todos os gestores hoje, então gatear a edição por ele esconde
  // o botão de todo mundo. O gate da UI é conveniência — quem decide de fato
  // é a guarda da RPC.
  const podeEditar = userData?.papel === 'gestor';

  // Componente Sidebar (Info Cards) - reutilizável
  // Funções de render, chamadas como `{renderX()}` e nunca como `<X />`.
  // Declaradas aqui dentro, elas ganham identidade nova a cada renderização:
  // usadas como componente, o React trata cada render como um TIPO diferente e
  // remonta a subárvore inteira a cada tecla. Isso zerava o `hasUserInteracted`
  // do AddressAutocomplete (src/components/AddressAutocomplete.tsx:135) e
  // limpava o debounce, então a busca de sede nunca chegava a rodar — e o campo
  // ainda perdia o foco a cada caractere. Chamadas como função, o JSX entra na
  // árvore do próprio UnidadeScreen e nada remonta.
  const renderSidebarInfo = () => (
    <View style={styles.sidebarContainer}>
      {/* Badge Gestor Principal */}
      {isGestorPrincipal && (
        <View style={styles.principalBadge}>
          <Text style={styles.principalBadgeText}>⭐ Gestor Principal</Text>
        </View>
      )}

      {/* Info Card - Membros */}
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Membros da Equipe</Text>
        {/* Total = o "Total" da Equipe; ativos/inativos dizem o que entra. */}
        <Text style={styles.infoValue}>{equipe.total}</Text>
        <Text style={styles.infoDetalhe}>
          {`${equipe.ativos} ${equipe.ativos === 1 ? 'ativo' : 'ativos'} · ${equipe.inativos} ${equipe.inativos === 1 ? 'inativo' : 'inativos'}`}
        </Text>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push('/unidade/equipe')}
        >
          <Text style={styles.linkButtonText}>Ver equipe {'>'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Campo de texto da ficha ligado ao form, com o erro do schema logo abaixo.
  // Também é função chamada como `{renderCampoTexto(...)}`, pelo mesmo motivo
  // das funções acima. `mascara` formata enquanto o gestor digita.
  const renderCampoTexto = (
    campo: keyof UnidadeFormInput,
    props: {
      placeholder: string;
      maxLength?: number;
      keyboardType?: 'phone-pad' | 'numeric';
      autoCapitalize?: 'characters';
      mascara?: (texto: string) => string;
    },
  ) => {
    const { mascara, ...propsDoInput } = props;
    const mensagem = errors[campo]?.message;
    return (
      <>
        <Controller
          control={control}
          name={campo}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[
                styles.input,
                isDesktopView && styles.inputDesktop,
                !editMode && styles.inputDisabled,
                !!mensagem && styles.inputError,
              ]}
              value={value}
              onChangeText={(texto) =>
                onChange(mascara ? mascara(texto) : texto)
              }
              onBlur={onBlur}
              editable={editMode}
              {...propsDoInput}
            />
          )}
        />
        <FieldError message={mensagem} />
      </>
    );
  };

  // Componente Formulário - reutilizável
  const renderFormularioUnidade = () => (
    <View style={styles.formContainer}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informações da Unidade</Text>

        {/* Nome */}
        <View
          style={[styles.inputGroup, isDesktopView && styles.inputGroupDesktop]}
        >
          <Text style={styles.inputLabel}>Nome da Unidade</Text>
          {renderCampoTexto('nome', {
            placeholder: 'Nome da unidade',
            maxLength: 255,
          })}
        </View>

        {/* CNPJ (sempre bloqueado) */}
        <View
          style={[styles.inputGroup, isDesktopView && styles.inputGroupDesktop]}
        >
          <Text style={styles.inputLabel}>CNPJ</Text>
          <TextInput
            style={[
              styles.input,
              isDesktopView && styles.inputDesktop,
              styles.inputDisabled,
            ]}
            value={formatCnpj(cnpj)}
            editable={false}
            placeholder="Não informado"
          />
        </View>

        {/* Telefone */}
        <View
          style={[styles.inputGroup, isDesktopView && styles.inputGroupDesktop]}
        >
          <Text style={styles.inputLabel}>Telefone</Text>
          {renderCampoTexto('telefone', {
            placeholder: '(00) 00000-0000',
            keyboardType: 'phone-pad',
            mascara: formatPhone,
          })}
        </View>

        {/* Endereço */}
        <View
          style={[styles.inputGroup, isDesktopView && styles.inputGroupDesktop]}
        >
          <Text style={styles.inputLabel}>Endereço</Text>
          {renderCampoTexto('endereco', {
            placeholder: 'Rua, número, complemento',
          })}
          <Text style={styles.helperText}>
            Endereço de cadastro da unidade. Não define de onde as rotas partem.
          </Text>
        </View>

        {/* Cidade e Estado */}
        <View style={styles.row}>
          <View
            style={[
              styles.inputGroup,
              styles.flex2,
              isDesktopView && styles.inputGroupDesktop,
            ]}
          >
            <Text style={styles.inputLabel}>Cidade</Text>
            {renderCampoTexto('cidade', {
              placeholder: 'Cidade',
              maxLength: 100,
            })}
          </View>

          <View
            style={[
              styles.inputGroup,
              styles.flex1,
              isDesktopView && styles.inputGroupDesktop,
            ]}
          >
            <Text style={styles.inputLabel}>UF</Text>
            {/* Caixa alta na digitação: o `autoCapitalize` não vale na web. */}
            {renderCampoTexto('estado', {
              placeholder: 'UF',
              maxLength: 2,
              autoCapitalize: 'characters',
              mascara: (texto) => texto.toUpperCase(),
            })}
          </View>
        </View>

        {/* CEP */}
        <View
          style={[styles.inputGroup, isDesktopView && styles.inputGroupDesktop]}
        >
          <Text style={styles.inputLabel}>CEP</Text>
          {renderCampoTexto('cep', {
            placeholder: '00000-000',
            keyboardType: 'numeric',
            maxLength: 9,
            mascara: maskCEP,
          })}
        </View>

        {/* Sede: define de onde toda rota parte e para onde volta. Aparece
              também fora do modo edição — antes o campo sumia, e o endereço
              mais consequente da tela era justamente o único invisível para
              quem só queria conferir os dados. */}
        <View
          style={[styles.inputGroup, isDesktopView && styles.inputGroupDesktop]}
        >
          <Text style={styles.inputLabel}>Endereço da Sede</Text>
          {editMode ? (
            <AddressAutocomplete
              value={sedeEndereco}
              onChangeText={(text) => {
                // Editar o texto invalida as coordenadas: elas só são
                // confiáveis quando vêm de uma sugestão selecionada.
                if (text !== sedeEndereco) {
                  setSedeLatitude(undefined);
                  setSedeLongitude(undefined);
                }
                setSedeEndereco(text);
              }}
              onSelectAddress={handleSelecionarSede}
              placeholder="Endereço da sede (partida e chegada das rotas)"
              multiline
            />
          ) : (
            // O AddressAutocomplete não tem estado somente-leitura, então
            // fora da edição a sede vira um campo comum desabilitado.
            <TextInput
              style={[
                styles.input,
                isDesktopView && styles.inputDesktop,
                styles.inputDisabled,
              ]}
              value={sedeEndereco}
              editable={false}
              placeholder="Nenhuma sede cadastrada"
              multiline
            />
          )}
          {/* A exigência de confirmar a sugestão só se manifestava no submit,
              como erro. Aqui ela aparece enquanto o gestor edita. */}
          <Text
            style={[
              styles.helperText,
              editMode && sedePrecisaConfirmacao && styles.helperTextWarning,
              editMode && sedeTemCoordenadas && styles.helperTextSuccess,
            ]}
          >
            {editMode && sedePrecisaConfirmacao
              ? 'Escolha uma das opções sugeridas para confirmar. Só assim as rotas passam a partir daqui.'
              : editMode && sedeTemCoordenadas
                ? '✓ Endereço confirmado. As rotas partem e retornam deste ponto.'
                : 'Ponto de partida e chegada de todas as rotas.'}
          </Text>
        </View>

        {/* Botões de Ação (apenas em modo edição) */}
        {editMode && !isDesktopView && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={handleCancel}
              disabled={saving}
            >
              <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                Cancelar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={styles.buttonText}>Salvar</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  if (isDesktopView) {
    const desktopActions = podeEditar
      ? editMode
        ? [
            {
              label: 'Cancelar',
              icon: 'close-circle-outline',
              onPress: handleCancel,
              variant: 'secondary',
              disabled: saving,
            },
            {
              label: saving ? 'Salvando...' : 'Salvar alterações',
              icon: 'save-outline',
              onPress: handleSave,
              disabled: saving,
            },
          ]
        : [
            {
              label: 'Editar informações',
              icon: 'create-outline',
              onPress: () => setEditMode(true),
            },
          ]
      : undefined;

    return (
      <ErrorBoundary>
        <DesktopPageLayout
          title={pageMeta.title}
          subtitle="Informações e Configurações"
          breadcrumbs={pageMeta.breadcrumbs}
          userMenuTrigger={userMenuTrigger}
          userMenuItems={userMenuItems}
          loading={isLoading}
          actions={desktopActions}
        >
          <View style={styles.twoColumnLayout}>
            <View style={styles.mainColumn}>{renderFormularioUnidade()}</View>
            <View style={styles.sideColumn}>{renderSidebarInfo()}</View>
          </View>
        </DesktopPageLayout>
        <Toast {...toastState} onDismiss={hideToast} />
        {AlertDialog}
        {logoutModal}
      </ErrorBoundary>
    );
  }

  if (isLoading) {
    return (
      <ErrorBoundary>
        <MobileLoading message="Carregando..." />
        {logoutModal}
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingBottom: Math.max(20, insets.bottom + 20),
        }}
      >
        <View style={styles.content}>
          {podeEditar && !editMode && (
            <View style={styles.mobileEditButtonContainer}>
              <TouchableOpacity
                style={styles.mobileEditButton}
                onPress={() => setEditMode(true)}
              >
                <Text style={styles.mobileEditButtonText}>
                  ✏️ Editar Informações
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <MobileCard title="Equipe" variant="bordered">
            {renderSidebarInfo()}
          </MobileCard>
          <MobileCard title="Informações da Unidade" variant="bordered">
            {renderFormularioUnidade()}
          </MobileCard>
        </View>
      </ScrollView>

      <Toast {...toastState} onDismiss={hideToast} />
      {AlertDialog}
      {logoutModal}
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
  mobileEditButtonContainer: {
    marginBottom: theme.spacing.lg,
  },
  mobileEditButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  mobileEditButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.md,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    maxWidth: theme.layout.containerMaxWidth,
    marginHorizontal: 'auto',
    width: '100%',
  },
  // Two-column layout (Desktop)
  twoColumnLayout: {
    flexDirection: 'row',
    gap: theme.spacing['2xl'],
    alignItems: 'flex-start',
  },
  mainColumn: {
    flex: 2,
    minWidth: 0,
  },
  sideColumn: {
    flex: 1,
    minWidth: 0,
  },
  sidebarContainer: {
    // Sidebar container
  },
  formContainer: {
    // Form container
  },
  principalBadge: {
    backgroundColor: theme.colors.warning + '20',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing['2xl'],
    alignItems: 'center',
  },
  principalBadgeText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.warning,
  },
  infoCard: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing['2xl'],
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing['2xl'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    // Elevated card (design system token)
    ...theme.shadows.md,
  },
  infoLabel: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.sm,
  },
  infoValue: {
    fontSize: theme.typography['3xl'],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  infoDetalhe: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.md,
  },
  linkButton: {
    paddingVertical: theme.spacing.sm,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  linkButtonText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },
  section: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing['2xl'],
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  sectionTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing['2xl'],
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  inputGroupDesktop: {
    marginBottom: theme.desktop.field.marginBottom,
  },
  inputLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    fontSize: theme.typography.base,
    backgroundColor: theme.colors.white,
    color: theme.colors.gray900,
    minHeight: 48,
  },
  inputDesktop: {
    paddingHorizontal: theme.desktop.input.paddingHorizontal,
    paddingVertical: 0,
    fontSize: theme.desktop.input.fontSize,
    minHeight: theme.desktop.input.height,
  },
  inputDisabled: {
    backgroundColor: theme.colors.gray100,
    color: theme.colors.gray500,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  helperText: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
  },
  helperTextWarning: {
    color: theme.colors.warning,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  helperTextSuccess: {
    color: theme.colors.success,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing['3xl'],
  },
  button: {
    flex: 1,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: theme.colors.secondary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.gray300,
  },
  buttonText: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
  buttonTextSecondary: {
    color: theme.colors.gray900,
  },
}));
