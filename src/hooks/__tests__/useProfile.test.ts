/**
 * useProfile: o perfil vem do `useUser` (busca compartilhada, guarda de conta
 * e de resposta velha); aqui ficam só a foto e os diálogos (R-NUC-3).
 *
 * B-NUC-2: abrir o Perfil regravava `ultimo_login`, e o "Último acesso" da
 * tela mostrava a última vez que a pessoa abriu o Perfil. O login já grava
 * (`src/lib/auth.ts`).
 * B-NUC-3: a consulta própria, sem guarda, deixava a resposta da conta
 * anterior sobrescrever a atual.
 */
import { User } from '@supabase/supabase-js';
import { act, renderHook } from '@testing-library/react-native';

import { supabase } from '@/lib/supabase';

import { useProfile } from '../useProfile';

jest.mock('@/lib/supabase');

let mockUserData: Record<string, unknown> | null = null;
let mockUserLoading = false;
jest.mock('../useUser', () => ({
  useUser: () => ({ userData: mockUserData, loading: mockUserLoading }),
}));

// Captura o setter que o useProfile entrega ao fluxo da foto
type SetProfile = (p: unknown) => void;
let mockSetProfile: SetProfile = () => undefined;
jest.mock('../profile/useProfilePhoto', () => ({
  useProfilePhoto: (args: { setProfile: SetProfile }) => {
    mockSetProfile = args.setProfile;
    return {
      uploadingPhoto: false,
      updateProfilePhoto: jest.fn(),
      showPhotoOptions: jest.fn(),
    };
  },
}));

const usuario = (id: string, email = `${id}@rotamestre.com`) =>
  ({ id, email, app_metadata: {}, user_metadata: {} }) as unknown as User;

const perfilDe = (id: string) => ({
  id,
  nome: `Pessoa ${id}`,
  email: `${id}@rotamestre.com`,
  papel: 'gestor',
  unidade_id: 'unidade-1',
  telefone: null,
  ativo: true,
  is_gestor_principal: true,
  primeira_senha: false,
  foto_url: null,
  ultimo_login: '2026-11-01T10:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const mockFrom = supabase.from as jest.Mock;

describe('useProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserData = null;
    mockUserLoading = false;
  });

  it('devolve o perfil do useUser, com os campos que a tela usa', () => {
    mockUserData = perfilDe('u1');
    const { result } = renderHook(() => useProfile(usuario('u1')));

    expect(result.current.profile).toEqual(
      expect.objectContaining({
        id: 'u1',
        nome: 'Pessoa u1',
        papel: 'gestor',
        primeira_senha: false,
        foto_url: null,
        ultimo_login: '2026-11-01T10:00:00Z',
      }),
    );
  });

  it('não consulta nem grava em usuarios (sem regravar ultimo_login)', () => {
    mockUserData = perfilDe('u1');
    renderHook(() => useProfile(usuario('u1')));
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('perfil de outra conta (troca sem fechar o app) não aparece', () => {
    mockUserData = perfilDe('conta-anterior');
    const { result } = renderHook(() => useProfile(usuario('u1')));
    expect(result.current.profile).toBeNull();
  });

  it('sem usuário, sem perfil', () => {
    mockUserData = perfilDe('u1');
    const { result } = renderHook(() => useProfile(null));
    expect(result.current.profile).toBeNull();
  });

  it('campos opcionais ausentes viram os valores neutros do tipo', () => {
    mockUserData = {
      id: 'u1',
      nome: 'Sem extras',
      email: 'u1@rotamestre.com',
      papel: 'motorista',
    };
    const { result } = renderHook(() => useProfile(usuario('u1')));
    expect(result.current.profile).toEqual({
      id: 'u1',
      nome: 'Sem extras',
      email: 'u1@rotamestre.com',
      papel: 'motorista',
      unidade_id: null,
      telefone: null,
      ativo: true,
      is_gestor_principal: false,
      primeira_senha: false,
      foto_url: null,
      ultimo_login: null,
    });
  });

  it('a foto trocada aparece na hora, antes de o useUser recarregar', () => {
    mockUserData = perfilDe('u1');
    const { result, rerender } = renderHook(() => useProfile(usuario('u1')));
    const { profile } = result.current;
    expect(profile).not.toBeNull();

    // useProfilePhoto: setProfile({ ...profile, foto_url }) e emitProfileUpdate
    act(() => {
      mockSetProfile({ ...profile, foto_url: 'perfis/u1.jpg' });
    });
    expect(result.current.profile?.foto_url).toBe('perfis/u1.jpg');

    // O useUser recarrega (emitProfileUpdate) com a foto nova: ela vale.
    mockUserData = { ...perfilDe('u1'), foto_url: 'perfis/u1-v2.jpg' };
    rerender({});
    expect(result.current.profile?.foto_url).toBe('perfis/u1-v2.jpg');
  });
});
