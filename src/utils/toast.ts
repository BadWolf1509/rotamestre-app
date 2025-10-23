import Toast from 'react-native-toast-message';

export const toast = {
  success: (message: string, title?: string) => {
    Toast.show({
      type: 'success',
      text1: title || 'Sucesso!',
      text2: message,
      position: 'top',
      visibilityTime: 3000,
      topOffset: 60,
    });
  },

  error: (message: string, title?: string) => {
    Toast.show({
      type: 'error',
      text1: title || 'Erro',
      text2: message,
      position: 'top',
      visibilityTime: 4000,
      topOffset: 60,
    });
  },

  info: (message: string, title?: string) => {
    Toast.show({
      type: 'info',
      text1: title || 'Informação',
      text2: message,
      position: 'top',
      visibilityTime: 3000,
      topOffset: 60,
    });
  },

  warning: (message: string, title?: string) => {
    Toast.show({
      type: 'warning',
      text1: title || 'Atenção',
      text2: message,
      position: 'top',
      visibilityTime: 3500,
      topOffset: 60,
    });
  },
};
