import { toast } from '../toast';
import Toast from 'react-native-toast-message';

// Mock react-native-toast-message
jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
  hide: jest.fn(),
}));

describe('toast utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve mostrar toast de sucesso', () => {
    toast.success('Mensagem de sucesso', 'Título Sucesso');
    expect(Toast.show).toHaveBeenCalledWith({
      type: 'success',
      text1: 'Título Sucesso',
      text2: 'Mensagem de sucesso',
      position: 'top',
      visibilityTime: 3000,
      topOffset: 60,
    });
  });

  it('deve mostrar toast de sucesso com título padrão', () => {
    toast.success('Mensagem de sucesso');
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
      text1: 'Sucesso!',
    }));
  });

  it('deve mostrar toast de erro', () => {
    toast.error('Mensagem de erro');
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error',
      text1: 'Erro',
      visibilityTime: 4000,
    }));
  });

  it('deve mostrar toast de info', () => {
    toast.info('Mensagem de info');
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
      type: 'info',
      text1: 'Informação',
    }));
  });

  it('deve mostrar toast de warning', () => {
    toast.warning('Mensagem de aviso');
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
      type: 'warning',
      text1: 'Atenção',
      visibilityTime: 3500,
    }));
  });
});
