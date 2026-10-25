/**
 * O lembrete diário "Bom dia!" é do motorista: só é agendado quando quem está
 * logado é motorista (o layout do motorista passa `ativo`), nunca para gestor,
 * e só com a permissão de notificação já concedida.
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { cancelRouteReminder, scheduleRouteReminder } from '@/lib/notifications';

import { useLembreteDiario } from '../useLembreteDiario';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));
jest.mock('@/lib/notifications', () => ({
  scheduleRouteReminder: jest.fn(async () => 'id-1'),
  cancelRouteReminder: jest.fn(async () => {}),
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const permissao = Notifications.getPermissionsAsync as jest.Mock;
const agendar = scheduleRouteReminder as jest.Mock;
const cancelar = cancelRouteReminder as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
  permissao.mockResolvedValue({ status: 'granted' });
});

describe('useLembreteDiario', () => {
  it('agenda para o motorista com permissão', async () => {
    renderHook(() => useLembreteDiario('motorista'));
    await waitFor(() => expect(agendar).toHaveBeenCalledTimes(1));
  });

  it('gestor: cancela o lembrete antigo, sem pedir nem consultar permissão e sem agendar', async () => {
    renderHook(() => useLembreteDiario('gestor'));
    await waitFor(() => expect(cancelar).toHaveBeenCalledTimes(1));
    expect(agendar).not.toHaveBeenCalled();
    expect(permissao).not.toHaveBeenCalled();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('gestor na web não cancela nada', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
    renderHook(() => useLembreteDiario('gestor'));
    await new Promise((r) => setTimeout(r, 20));
    expect(cancelar).not.toHaveBeenCalled();
  });

  it('motorista não cancela o lembrete', async () => {
    renderHook(() => useLembreteDiario('motorista'));
    await waitFor(() => expect(agendar).toHaveBeenCalled());
    expect(cancelar).not.toHaveBeenCalled();
  });

  it('sem papel (null) não faz nada', async () => {
    renderHook(() => useLembreteDiario(null));
    await new Promise((r) => setTimeout(r, 20));
    expect(cancelar).not.toHaveBeenCalled();
    expect(agendar).not.toHaveBeenCalled();
  });

  it('sem papel não agenda nem consulta permissão', async () => {
    renderHook(() => useLembreteDiario(null));
    await new Promise((r) => setTimeout(r, 20));
    expect(agendar).not.toHaveBeenCalled();
    expect(permissao).not.toHaveBeenCalled();
  });

  it('não agenda sem permissão de notificação', async () => {
    permissao.mockResolvedValue({ status: 'denied' });
    renderHook(() => useLembreteDiario('motorista'));
    await waitFor(() => expect(permissao).toHaveBeenCalled());
    expect(agendar).not.toHaveBeenCalled();
  });

  it('não agenda na web', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
    renderHook(() => useLembreteDiario('motorista'));
    await new Promise((r) => setTimeout(r, 20));
    expect(agendar).not.toHaveBeenCalled();
  });

  it('falha ao agendar não estoura', async () => {
    agendar.mockRejectedValueOnce(new Error('x'));
    renderHook(() => useLembreteDiario('motorista'));
    await waitFor(() => expect(agendar).toHaveBeenCalled());
  });
});
