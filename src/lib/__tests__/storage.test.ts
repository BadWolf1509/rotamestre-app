import { logger } from '../logger';
import {
  uploadFotoEntrega,
  salvarFotoParada,
  uploadELinkFotoParada,
  deletarFoto,
  uploadFotoUsuario,
  uploadIncidentPhoto,
  getStoragePath,
  createSignedUrlForFoto,
} from '../storage';
import { supabase } from '../supabase';

// Mock do logger
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock do Platform para forçar comportamento web nos testes
jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
  },
}));

// Mock do expo-file-system/legacy (não será usado pois Platform.OS = 'web')
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}));

// Mock do supabase
jest.mock('../supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(),
    },
    from: jest.fn(),
  },
}));

// Mock do fetch global com suporte a arrayBuffer
global.fetch = jest.fn();

// Helper para criar mock de blob com arrayBuffer
function createMockBlob(sizeInBytes: number) {
  const mockArrayBuffer = new ArrayBuffer(sizeInBytes);
  const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' });
  Object.defineProperty(mockBlob, 'size', { value: sizeInBytes });
  (mockBlob as any).arrayBuffer = jest.fn().mockResolvedValue(mockArrayBuffer);
  return mockBlob;
}

// Helper para mockar fetch com blob
function mockFetchWithBlob(sizeInBytes: number) {
  const mockBlob = createMockBlob(sizeInBytes);
  (global.fetch as jest.Mock).mockResolvedValue({
    blob: () => Promise.resolve(mockBlob),
  });
  return mockBlob;
}

describe('Storage Functions', () => {
  const mockUnidadeId = 'unidade-123';
  const mockRotaId = 'rota-456';
  const mockParadaId = 'parada-789';
  const mockFotoUri = 'file:///path/to/photo.jpg';
  const mockFotoUrl =
    'https://xyz.supabase.co/storage/v1/object/public/fotos-entrega/unidade-123/rota-456/parada-789_1234567890.jpg';

  // Mock functions for storage.from(...) methods
  const mockCreateSignedUrl = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFotoEntrega', () => {
    it('deve fazer upload de foto e retornar o PATH (não a URL pública)', async () => {
      // Mock fetch para retornar blob com arrayBuffer
      mockFetchWithBlob(1024 * 500); // 500KB

      // Mock upload do Supabase
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'unidade-123/rota-456/parada-789_1234567890.jpg' },
        error: null,
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
      });

      const result = await uploadFotoEntrega(
        mockUnidadeId,
        mockRotaId,
        mockParadaId,
        mockFotoUri,
      );

      // Deve retornar o path (não a URL pública)
      expect(result).toMatch(/^unidade-123\/rota-456\/parada-789_\d+\.jpg$/);
      expect(global.fetch).toHaveBeenCalledWith(mockFotoUri);
      expect(mockUpload).toHaveBeenCalled();
    });

    it('deve rejeitar foto maior que 5MB', async () => {
      // Mock blob muito grande (6MB)
      mockFetchWithBlob(6 * 1024 * 1024);

      const result = await uploadFotoEntrega(
        mockUnidadeId,
        mockRotaId,
        mockParadaId,
        mockFotoUri,
      );

      expect(result).toBeNull();
      // O código agora lança erro ao invés de apenas logar
      expect(logger.error).toHaveBeenCalled();
    });

    it('deve retornar null quando upload falha', async () => {
      mockFetchWithBlob(1024 * 500);

      const mockUpload = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Upload failed'),
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
      });

      const result = await uploadFotoEntrega(
        mockUnidadeId,
        mockRotaId,
        mockParadaId,
        mockFotoUri,
      );

      expect(result).toBeNull();
    });

    it('deve gerar nome único com timestamp', async () => {
      mockFetchWithBlob(1024 * 500);

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
      });

      await uploadFotoEntrega(
        mockUnidadeId,
        mockRotaId,
        mockParadaId,
        mockFotoUri,
      );

      const uploadCall = mockUpload.mock.calls[0];
      const filePath = uploadCall[0];

      expect(filePath).toContain(mockUnidadeId);
      expect(filePath).toContain(mockRotaId);
      expect(filePath).toContain(mockParadaId);
      expect(filePath).toMatch(/\.jpg$/);
    });

    it('deve usar contentType correto no upload', async () => {
      mockFetchWithBlob(1024 * 500);

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
      });

      await uploadFotoEntrega(
        mockUnidadeId,
        mockRotaId,
        mockParadaId,
        mockFotoUri,
      );

      expect(mockUpload).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(ArrayBuffer),
        expect.objectContaining({
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        }),
      );
    });
  });

  describe('salvarFotoParada', () => {
    it('deve salvar foto_url com sucesso', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      const result = await salvarFotoParada(mockParadaId, mockFotoUrl);

      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({ foto_url: mockFotoUrl });
    });

    it('deve retornar false quando update falha', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: new Error('Update failed') }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      const result = await salvarFotoParada(mockParadaId, mockFotoUrl);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('deve usar filtro eq com parada ID correto', async () => {
      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      await salvarFotoParada(mockParadaId, mockFotoUrl);

      expect(mockEq).toHaveBeenCalledWith('id', mockParadaId);
    });
  });

  describe('uploadELinkFotoParada', () => {
    it('deve fazer processo completo com sucesso', async () => {
      // Mock upload — agora uploadFotoEntrega retorna o PATH, não a URL pública
      mockFetchWithBlob(1024 * 500);

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
      });

      // Mock salvar
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      const result = await uploadELinkFotoParada(
        mockUnidadeId,
        mockRotaId,
        mockParadaId,
        mockFotoUri,
      );

      expect(result).toBe(true);
      expect(mockUpload).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('deve retornar false se upload falhar', async () => {
      mockFetchWithBlob(1024 * 500);

      const mockUpload = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Upload failed'),
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
      });

      const result = await uploadELinkFotoParada(
        mockUnidadeId,
        mockRotaId,
        mockParadaId,
        mockFotoUri,
      );

      expect(result).toBe(false);
    });

    it('deve retornar false se salvar no banco falhar', async () => {
      // Mock upload com sucesso — retorna path
      mockFetchWithBlob(1024 * 500);

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      });

      const mockRemove = jest.fn().mockResolvedValue({ error: null });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        remove: mockRemove,
      });

      // Mock salvar com erro
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: new Error('Update failed') }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      const result = await uploadELinkFotoParada(
        mockUnidadeId,
        mockRotaId,
        mockParadaId,
        mockFotoUri,
      );

      expect(result).toBe(false);
      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe('deletarFoto', () => {
    it('deve deletar foto com sucesso a partir de URL pública', async () => {
      const mockRemove = jest.fn().mockResolvedValue({ error: null });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        remove: mockRemove,
      });

      const result = await deletarFoto(mockFotoUrl);

      expect(result).toBe(true);
      expect(mockRemove).toHaveBeenCalledWith([
        'unidade-123/rota-456/parada-789_1234567890.jpg',
      ]);
    });

    it('deve extrair path correto da URL', async () => {
      const mockRemove = jest.fn().mockResolvedValue({ error: null });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        remove: mockRemove,
      });

      await deletarFoto(mockFotoUrl);

      const removedPath = mockRemove.mock.calls[0][0][0];
      expect(removedPath).toBe(
        'unidade-123/rota-456/parada-789_1234567890.jpg',
      );
      expect(removedPath).not.toContain('http');
      expect(removedPath).not.toContain('fotos-entrega');
    });

    it('deve aceitar path puro (sem URL)', async () => {
      const mockRemove = jest.fn().mockResolvedValue({ error: null });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        remove: mockRemove,
      });

      const result = await deletarFoto('perfis/perfil_x.jpg');

      expect(result).toBe(true);
      expect(mockRemove).toHaveBeenCalledWith(['perfis/perfil_x.jpg']);
    });

    it('deve retornar false para valor inválido (URL http externa ou lixo)', async () => {
      const invalidUrl = 'https://xyz.supabase.co/invalid-url';

      const result = await deletarFoto(invalidUrl);

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('deve retornar false quando delete falha', async () => {
      const mockRemove = jest.fn().mockResolvedValue({
        error: new Error('Delete failed'),
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        remove: mockRemove,
      });

      const result = await deletarFoto(mockFotoUrl);

      expect(result).toBe(false);
    });
  });

  describe('Integração entre funções', () => {
    it('uploadELinkFotoParada deve chamar uploadFotoEntrega e salvarFotoParada com PATH', async () => {
      mockFetchWithBlob(1024 * 500);

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      await uploadELinkFotoParada(
        mockUnidadeId,
        mockRotaId,
        mockParadaId,
        mockFotoUri,
      );

      // Verifica que ambas funções foram chamadas
      expect(mockUpload).toHaveBeenCalled();
      // O PATH é passado para salvarFotoParada (não mais a URL pública)
      expect(mockUpdate).toHaveBeenCalledWith({
        foto_url: expect.stringMatching(
          /^unidade-123\/rota-456\/parada-789_\d+\.jpg$/,
        ),
      });
    });

    it('uploadELinkFotoParada deve capturar exceções gerais', async () => {
      // Mock que lança exceção
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await uploadELinkFotoParada(
        mockUnidadeId,
        mockRotaId,
        mockParadaId,
        mockFotoUri,
      );

      expect(result).toBe(false);
      // uploadFotoEntrega catch logs the error
      expect(logger.error).toHaveBeenCalledWith(
        '[Storage] Erro ao fazer upload de foto',
        expect.any(Error),
      );
    });
  });

  describe('uploadFotoUsuario', () => {
    const mockUsuarioId = 'usuario-123';

    it('deve fazer upload de foto de perfil e retornar PATH (não a URL pública)', async () => {
      mockFetchWithBlob(1024 * 200); // 200KB

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'perfis/perfil_usuario-123_1234567890.jpg' },
        error: null,
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      const result = await uploadFotoUsuario(mockUsuarioId, mockFotoUri);

      // Deve retornar o path (não a URL pública)
      expect(result).toMatch(/^perfis\/perfil_usuario-123_\d+\.jpg$/);
      expect(global.fetch).toHaveBeenCalledWith(mockFotoUri);
      expect(mockUpload).toHaveBeenCalled();
      // O banco deve ser atualizado com o PATH
      expect(mockUpdate).toHaveBeenCalledWith({
        foto_url: expect.stringMatching(/^perfis\//),
        updated_at: expect.any(String),
      });
    });

    it('deve rejeitar foto maior que 2MB', async () => {
      mockFetchWithBlob(3 * 1024 * 1024); // 3MB

      const result = await uploadFotoUsuario(mockUsuarioId, mockFotoUri);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        '[Storage] Foto muito grande! Máximo: 2MB',
      );
    });

    it('deve retornar null quando upload falha', async () => {
      mockFetchWithBlob(1024 * 200);

      const mockUpload = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Upload failed'),
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
      });

      const result = await uploadFotoUsuario(mockUsuarioId, mockFotoUri);

      expect(result).toBeNull();
    });

    it('deve retornar null quando update no banco falha', async () => {
      mockFetchWithBlob(1024 * 200);

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'perfis/perfil_usuario-123_1234567890.jpg' },
        error: null,
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: new Error('Update failed') }),
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      const result = await uploadFotoUsuario(mockUsuarioId, mockFotoUri);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        '[Storage] Erro ao atualizar foto_url no banco',
        expect.any(Error),
      );
    });

    it('deve usar upsert:false e caminho correto no upload', async () => {
      mockFetchWithBlob(1024 * 200);

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      await uploadFotoUsuario(mockUsuarioId, mockFotoUri);

      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringContaining('perfis/perfil_'),
        expect.any(ArrayBuffer),
        expect.objectContaining({
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        }),
      );
    });
  });

  describe('uploadIncidentPhoto', () => {
    const mockFileName = 'incidente_123_1234567890.jpg';

    beforeEach(() => {
      // Mock listBuckets
      (supabase.storage as any).listBuckets = jest.fn().mockResolvedValue({
        data: [{ name: 'incidentes' }],
      });
      (supabase.storage as any).createBucket = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });
    });

    it('deve fazer upload de foto de incidente e retornar PATH (não a URL pública)', async () => {
      mockFetchWithBlob(1024 * 500); // 500KB

      const expectedPath = `incidentes/${mockFileName}`;
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: expectedPath },
        error: null,
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
      });

      const result = await uploadIncidentPhoto(mockFotoUri, mockFileName);

      // Deve retornar o path (não a URL pública)
      expect(result).toBe(expectedPath);
      expect(global.fetch).toHaveBeenCalledWith(mockFotoUri);
      expect(mockUpload).toHaveBeenCalledWith(
        expectedPath,
        expect.any(ArrayBuffer),
        expect.objectContaining({
          contentType: 'image/jpeg',
          upsert: true,
        }),
      );
    });

    it('deve rejeitar foto maior que 5MB', async () => {
      mockFetchWithBlob(6 * 1024 * 1024); // 6MB

      const result = await uploadIncidentPhoto(mockFotoUri, mockFileName);

      expect(result).toBe('');
      expect(logger.error).toHaveBeenCalledWith(
        '[Storage] Foto muito grande! Máximo: 5MB',
      );
    });

    it('deve retornar string vazia quando upload falha', async () => {
      mockFetchWithBlob(1024 * 500);

      const mockUpload = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Upload failed'),
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
      });

      const result = await uploadIncidentPhoto(mockFotoUri, mockFileName);

      expect(result).toBe('');
    });

    it('nao deve criar bucket de incidentes mesmo se nao existir', async () => {
      // Mock listBuckets retornando vazio (bucket nao existe)
      (supabase.storage as any).listBuckets = jest.fn().mockResolvedValue({
        data: [],
      });

      const mockCreateBucket = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      (supabase.storage as any).createBucket = mockCreateBucket;

      mockFetchWithBlob(1024 * 500);

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: mockFileName },
        error: null,
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
      });

      await uploadIncidentPhoto(mockFotoUri, mockFileName);

      expect(mockCreateBucket).not.toHaveBeenCalled();
    });

    it('não deve criar bucket se já existir', async () => {
      // Mock listBuckets retornando bucket existente
      (supabase.storage as any).listBuckets = jest.fn().mockResolvedValue({
        data: [{ name: 'incidentes' }],
      });

      const mockCreateBucket = jest.fn();
      (supabase.storage as any).createBucket = mockCreateBucket;

      mockFetchWithBlob(1024 * 500);

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: mockFileName },
        error: null,
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
      });

      await uploadIncidentPhoto(mockFotoUri, mockFileName);

      expect(mockCreateBucket).not.toHaveBeenCalled();
    });
  });

  describe('getStoragePath', () => {
    it('extrai path de URL pública', () => {
      expect(
        getStoragePath(
          'https://x.supabase.co/storage/v1/object/public/fotos-entrega/u1/r1/p1_1.jpg',
        ),
      ).toBe('u1/r1/p1_1.jpg');
    });
    it('extrai path de URL assinada (remove query)', () => {
      expect(
        getStoragePath(
          'https://x.supabase.co/storage/v1/object/sign/fotos-entrega/perfis/p_1.jpg?token=abc',
        ),
      ).toBe('perfis/p_1.jpg');
    });
    it('aceita path puro', () => {
      expect(getStoragePath('incidentes/incident_1.jpg')).toBe(
        'incidentes/incident_1.jpg',
      );
    });
    it('retorna null para lixo sem pasta ("success")', () => {
      expect(getStoragePath('success')).toBeNull();
    });
    it('retorna null para vazio/null', () => {
      expect(getStoragePath('')).toBeNull();
      expect(getStoragePath(null)).toBeNull();
    });
    it('retorna null para URL http externa (não-bucket)', () => {
      expect(getStoragePath('https://gravatar.com/avatar/abc')).toBeNull();
    });
  });

  describe('createSignedUrlForFoto', () => {
    it('gera signed URL a partir de um path', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://x.supabase.co/sign/abc' },
        error: null,
      });
      (supabase.storage.from as jest.Mock).mockReturnValue({
        createSignedUrl: mockCreateSignedUrl,
      });

      const url = await createSignedUrlForFoto('perfis/p_1.jpg');
      expect(url).toBe('https://x.supabase.co/sign/abc');
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('perfis/p_1.jpg', 3600);
    });

    it('retorna null para valor inválido sem chamar a API', async () => {
      mockCreateSignedUrl.mockClear();
      (supabase.storage.from as jest.Mock).mockReturnValue({
        createSignedUrl: mockCreateSignedUrl,
      });

      const url = await createSignedUrlForFoto('success');
      expect(url).toBeNull();
      expect(mockCreateSignedUrl).not.toHaveBeenCalled();
    });

    it('retorna null em erro da API', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'boom' },
      });
      (supabase.storage.from as jest.Mock).mockReturnValue({
        createSignedUrl: mockCreateSignedUrl,
      });

      expect(await createSignedUrlForFoto('perfis/p_1.jpg')).toBeNull();
    });
  });
});
