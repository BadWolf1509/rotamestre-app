import { render } from '@testing-library/react-native';
import React from 'react';
import { Image } from 'react-native';

// Mock useSignedUrl so Avatar uses signed URLs, not raw bucket paths
jest.mock('@/hooks/storage/useSignedUrl', () => ({
  useSignedUrl: jest.fn(),
}));

import { useSignedUrl } from '@/hooks/storage/useSignedUrl';

import { Avatar } from '../Avatar';

const mockUseSignedUrl = useSignedUrl as jest.MockedFunction<
  typeof useSignedUrl
>;

describe('Avatar Component', () => {
  beforeEach(() => {
    // Default: hook returns a signed URL equal to the input (pass-through for http URLs)
    mockUseSignedUrl.mockImplementation((value) => ({
      url: typeof value === 'string' && value.startsWith('http') ? value : null,
      loading: false,
      error: false,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Iniciais', () => {
    it('deve gerar iniciais de nome simples', () => {
      const { getByText } = render(<Avatar name="João" />);
      expect(getByText('JO')).toBeTruthy();
    });

    it('deve gerar iniciais de nome composto', () => {
      const { getByText } = render(<Avatar name="João Silva" />);
      expect(getByText('JS')).toBeTruthy();
    });

    it('deve gerar iniciais de nome completo', () => {
      const { getByText } = render(<Avatar name="João Pedro Silva Santos" />);
      expect(getByText('JS')).toBeTruthy();
    });

    it('deve mostrar ? para nome vazio', () => {
      const { getByText } = render(<Avatar name="" />);
      expect(getByText('?')).toBeTruthy();
    });

    it('deve gerar iniciais em maiúsculas', () => {
      const { getByText } = render(<Avatar name="maria oliveira" />);
      expect(getByText('MO')).toBeTruthy();
    });

    it('deve ignorar espaços extras', () => {
      const { getByText } = render(<Avatar name="  Carlos   Souza  " />);
      expect(getByText('CS')).toBeTruthy();
    });
  });

  describe('Imagem via signed URL', () => {
    it('deve renderizar imagem usando signed URL quando hook retorna url', () => {
      mockUseSignedUrl.mockReturnValue({
        url: 'https://signed.example.com/perfis/x.jpg?token=abc',
        loading: false,
        error: false,
      });
      const { UNSAFE_getByType } = render(
        <Avatar name="João Silva" imageUrl="perfis/x.jpg" />,
      );
      const image = UNSAFE_getByType(Image);
      expect(image).toBeTruthy();
      expect(image.props.source.uri).toBe(
        'https://signed.example.com/perfis/x.jpg?token=abc',
      );
    });

    it('deve renderizar iniciais quando hook retorna null (bare path sem signed url)', () => {
      mockUseSignedUrl.mockReturnValue({
        url: null,
        loading: false,
        error: true,
      });
      const { getByText } = render(
        <Avatar name="João Silva" imageUrl="perfis/x.jpg" />,
      );
      expect(getByText('JS')).toBeTruthy();
    });

    it('deve renderizar imagem http passada diretamente pelo hook', () => {
      mockUseSignedUrl.mockReturnValue({
        url: 'https://exemplo.com/foto.jpg',
        loading: false,
        error: false,
      });
      const { UNSAFE_getByType } = render(
        <Avatar name="João Silva" imageUrl="https://exemplo.com/foto.jpg" />,
      );
      const image = UNSAFE_getByType(Image);
      expect(image).toBeTruthy();
      expect(image.props.source.uri).toBe('https://exemplo.com/foto.jpg');
    });

    it('deve renderizar iniciais quando imageUrl é null', () => {
      mockUseSignedUrl.mockReturnValue({
        url: null,
        loading: false,
        error: false,
      });
      const { getByText } = render(
        <Avatar name="João Silva" imageUrl={null} />,
      );
      expect(getByText('JS')).toBeTruthy();
    });

    it('deve renderizar iniciais quando imageUrl não fornecido', () => {
      mockUseSignedUrl.mockReturnValue({
        url: null,
        loading: false,
        error: false,
      });
      const { getByText } = render(<Avatar name="João Silva" />);
      expect(getByText('JS')).toBeTruthy();
    });
  });

  describe('Tamanhos', () => {
    it('deve renderizar com size sm', () => {
      const { getByText } = render(<Avatar name="João" size="sm" />);
      expect(getByText('JO')).toBeTruthy();
    });

    it('deve renderizar com size md (padrão)', () => {
      const { getByText } = render(<Avatar name="João" />);
      expect(getByText('JO')).toBeTruthy();
    });

    it('deve renderizar com size lg', () => {
      const { getByText } = render(<Avatar name="João" size="lg" />);
      expect(getByText('JO')).toBeTruthy();
    });

    it('deve renderizar com size xl', () => {
      const { getByText } = render(<Avatar name="João" size="xl" />);
      expect(getByText('JO')).toBeTruthy();
    });
  });

  describe('Cor de Fundo', () => {
    it('deve aceitar backgroundColor customizado', () => {
      const { getByText } = render(
        <Avatar name="João" backgroundColor="#FF5733" />,
      );
      expect(getByText('JO')).toBeTruthy();
    });

    it('deve usar cor padrão quando backgroundColor não fornecido', () => {
      const { getByText } = render(<Avatar name="João" />);
      expect(getByText('JO')).toBeTruthy();
    });
  });

  describe('Combinações de Props', () => {
    it('deve renderizar avatar grande com cor customizada', () => {
      const { getByText } = render(
        <Avatar name="Maria" size="xl" backgroundColor="#00AA00" />,
      );
      expect(getByText('MA')).toBeTruthy();
    });

    it('deve renderizar avatar pequeno com imagem', () => {
      mockUseSignedUrl.mockReturnValue({
        url: 'https://exemplo.com/pedro.jpg',
        loading: false,
        error: false,
      });
      const { UNSAFE_getByType } = render(
        <Avatar
          name="Pedro"
          size="sm"
          imageUrl="https://exemplo.com/pedro.jpg"
        />,
      );
      const image = UNSAFE_getByType(Image);
      expect(image).toBeTruthy();
    });

    it('deve renderizar avatar médio com iniciais e cor customizada', () => {
      const { getByText } = render(
        <Avatar name="Ana Costa" size="md" backgroundColor="#FF6B6B" />,
      );
      expect(getByText('AC')).toBeTruthy();
    });
  });

  describe('Casos Especiais', () => {
    it('deve tratar nome com números', () => {
      const { getByText } = render(<Avatar name="João123 Silva456" />);
      expect(getByText('JS')).toBeTruthy();
    });

    it('deve tratar nome com apenas uma letra', () => {
      const { getByText } = render(<Avatar name="A" />);
      expect(getByText('A')).toBeTruthy();
    });

    it('deve tratar nome com caracteres especiais', () => {
      const { getByText } = render(<Avatar name="João-Pedro Silva" />);
      // Deve pegar J de João-Pedro e S de Silva
      expect(getByText('JS')).toBeTruthy();
    });
  });
});
