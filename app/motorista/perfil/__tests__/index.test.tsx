/**
 * Perfil do motorista (M-1): nome/telefone vêm de `useUser()`, que recarrega
 * por `emitProfileUpdate`. Antes a tela carregava uma vez em estado local e só
 * sincronizava a foto — editar o nome e voltar mostrava o nome velho.
 */
import { act, render, screen } from '@testing-library/react-native';

import { emitProfileUpdate } from '@/lib/profileEvents';

import PerfilMotorista from '../index';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

// Perfil "no banco": muda entre o primeiro desenho e o evento.
let mockPerfilNoBanco: Record<string, unknown> = {};

// Imita o `useUser`: recarrega quando o evento de perfil dispara.
jest.mock('@/hooks/useUser', () => ({
  useUser: () => {
    const { useEffect, useState } = require('react');
    const { onProfileUpdate } = require('@/lib/profileEvents');
    const [userData, setUserData] = useState({ ...mockPerfilNoBanco });
    // Dentro da fábrica do mock o `onProfileUpdate` é um local estável.
    useEffect(
      () => onProfileUpdate(() => setUserData({ ...mockPerfilNoBanco })),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );
    return { userData, loading: false };
  },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'm1' }, loading: false }),
}));

jest.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({
    profile: null,
    uploadingPhoto: false,
    showPhotoOptions: jest.fn(),
    confirmDialog: { visible: false, title: '', message: '' },
    closeConfirmDialog: jest.fn(),
    alertDialog: { visible: false, title: '', message: '' },
    closeAlertDialog: jest.fn(),
  }),
}));

jest.mock('@/lib/auth', () => ({
  authService: { getSession: jest.fn(), getUsuario: jest.fn() },
}));

describe('Perfil do motorista', () => {
  beforeEach(() => {
    mockPerfilNoBanco = {
      id: 'm1',
      nome: 'Maria Souza',
      email: 'maria@rotamestre.com',
      telefone: '(11) 98888-7777',
    };
  });

  it('mostra o nome novo depois de emitProfileUpdate', async () => {
    render(<PerfilMotorista />);
    expect((await screen.findAllByText('Maria Souza')).length).toBeGreaterThan(
      0,
    );

    mockPerfilNoBanco = {
      ...mockPerfilNoBanco,
      nome: 'Maria Nova',
      telefone: '(11) 91111-2222',
    };
    act(() => emitProfileUpdate());

    expect((await screen.findAllByText('Maria Nova')).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText('Maria Souza')).toBeNull();
    expect(screen.getByText('(11) 91111-2222')).toBeTruthy();
  });
});
