// Avatar da conta: a exclusão só remove o arquivo `perfis/perfil_<uid>_<arquivo>`
// da própria conta, venha o valor como path puro ou como URL legada.
import { caminhoDoAvatarDaConta } from '../avatarDaConta';

const U = '11111111-2222-3333-4444-555555555555';
const OUTRO = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('caminhoDoAvatarDaConta', () => {
  it('devolve o path puro do avatar da conta', () =>
    expect(
      caminhoDoAvatarDaConta(`perfis/perfil_${U}_1766146374093.jpg`, U),
    ).toBe(`perfis/perfil_${U}_1766146374093.jpg`));

  it('aceita URL legada com querystring e codificação', () =>
    expect(
      caminhoDoAvatarDaConta(
        `https://x.supabase.co/storage/v1/object/public/fotos-entrega/perfis/perfil_${U}_1%2Ejpg?t=1`,
        U,
      ),
    ).toBe(`perfis/perfil_${U}_1.jpg`));

  it('não diferencia maiúsculas no uuid', () =>
    expect(
      caminhoDoAvatarDaConta(`perfis/perfil_${U.toUpperCase()}_1.jpg`, U),
    ).toBe(`perfis/perfil_${U.toUpperCase()}_1.jpg`));

  it('recusa avatar de outra conta', () =>
    expect(caminhoDoAvatarDaConta(`perfis/perfil_${OUTRO}_1.jpg`, U)).toBeNull());

  it('recusa foto de entrega, em path ou URL', () => {
    expect(
      caminhoDoAvatarDaConta(`${OUTRO}/${OUTRO}/${OUTRO}_1.jpg`, U),
    ).toBeNull();
    expect(
      caminhoDoAvatarDaConta(
        `https://x/storage/v1/object/public/fotos-entrega/${OUTRO}/${OUTRO}/p_1.jpg`,
        U,
      ),
    ).toBeNull();
  });

  it('recusa subpasta e volta de diretório', () => {
    expect(caminhoDoAvatarDaConta(`perfis/x/perfil_${U}_1.jpg`, U)).toBeNull();
    expect(
      caminhoDoAvatarDaConta(`perfis/perfil_${U}_1.jpg/../../${OUTRO}/a.jpg`, U),
    ).toBeNull();
    expect(
      caminhoDoAvatarDaConta(`perfis/../${OUTRO}/${OUTRO}/p.jpg`, U),
    ).toBeNull();
  });

  it('recusa volta de diretório codificada na URL legada', () =>
    expect(
      caminhoDoAvatarDaConta(
        `https://x/storage/v1/object/public/fotos-entrega/perfis/perfil_${U}_1.jpg%2F..%2F..%2F${OUTRO}%2Fa.jpg`,
        U,
      ),
    ).toBeNull());

  it('recusa foto de incidente', () =>
    expect(caminhoDoAvatarDaConta(`incidentes/${U}_1.jpg`, U)).toBeNull());

  it('vazio, null e não-string', () => {
    for (const v of [null, undefined, '', 42, {}]) {
      expect(caminhoDoAvatarDaConta(v, U)).toBeNull();
    }
  });
});
