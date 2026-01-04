import { logger } from '../logger';
import {
  uploadFotoEntrega,
  salvarFotoParada,
  uploadELinkFotoParada,
  deletarFoto,
  uploadFotoUsuario,
  uploadIncidentPhoto,
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
  const mockFotoUrl = 'https://xyz.supabase.co/storage/v1/object/public/fotos-entrega/unidade-123/rota-456/parada-789_1234567890.jpg';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFotoEntrega', () => {
    it('deve fazer upload de foto com sucesso', async () => {
      // Mock fetch para retornar blob com arrayBuffer
      mockFetchWithBlob(1024 * 500); // 500KB

      // Mock upload do Supabase
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'unidade-123/rota-456/parada-789_1234567890.jpg' },
        error: null,
      });

      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: mockFotoUrl },
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      const result = await uploadFotoEntrega(
        mockUnidadeId,
        mockRotaId,
        mockParadaId,
        mockFotoUri
      );

      expect(result).toBe(mockFotoUrl);
      expect(global.fetch).toHaveBeenCalledWith(mockFotoUri);
      expect(mockUpload).toHaveBeenCalled();
      expect(mockGetPublicUrl).toHaveBeenCalled();
    });

    it('deve rejeitar foto maior que 5MB', async () => {
      // Mock blob muito grande (6MB)
      mockFetchWithBlob(6 * 1024 * 1024);

      const result = await uploadFotoEntrega(
        mockUnidadeId,
        mockRotaId,
        mockParadaId,
        mockFotoUri
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
        mockFotoUri
      );

      expect(result).toBeNull();
    });

    it('deve gerar nome único com timestamp', async () => {
      mockFetchWithBlob(1024 * 500);

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      });

      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: mockFotoUrl },
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      await uploadFotoEntrega(mockUnidadeId, mockRotaId, mockParadaId, mockFotoUri);

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

      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: mockFotoUrl },
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      await uploadFotoEntrega(mockUnidadeId, mockRotaId, mockParadaId, mockFotoUri);

      expect(mockUpload).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(ArrayBuffer),
        expect.objectContaining({
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        })
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
      // Mock upload
      mockFetchWithBlob(1024 * 500);

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      });

      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: mockFotoUrl },
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
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
        mockFotoUri
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
        mockFotoUri
      );

      expect(result).toBe(false);
    });

    it('deve retornar false se salvar no banco falhar', async () => {
      // Mock upload com sucesso
      mockFetchWithBlob(1024 * 500);

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      });

      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: mockFotoUrl },
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
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
        mockFotoUri
      );

      expect(result).toBe(false);
    });
  });

  describe('deletarFoto', () => {
    it('deve deletar foto com sucesso', async () => {
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
      expect(removedPath).toBe('unidade-123/rota-456/parada-789_1234567890.jpg');
      expect(removedPath).not.toContain('http');
      expect(removedPath).not.toContain('fotos-entrega');
    });

    it('deve retornar false para URL inválida', async () => {
      const invalidUrl = 'https://xyz.supabase.co/invalid-url';

      const result = await deletarFoto(invalidUrl);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
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
    it('uploadELinkFotoParada deve chamar uploadFotoEntrega e salvarFotoParada', async () => {
      mockFetchWithBlob(1024 * 500);

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      });

      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: mockFotoUrl },
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      await uploadELinkFotoParada(
        mockUnidadeId,
        mockRotaId,
        mockParadaId,
        mockFotoUri
      );

      // Verifica que ambas funções foram chamadas
      expect(mockUpload).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith({ foto_url: mockFotoUrl });
    });

    it('uploadELinkFotoParada deve capturar exceções gerais', async () => {
      // Mock que lança exceção
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await uploadELinkFotoParada(
        mockUnidadeId,
        mockRotaId,
        mockParadaId,
        mockFotoUri
      );

      expect(result).toBe(false);
      // uploadFotoEntrega catch logs the error
      expect(logger.error).toHaveBeenCalledWith(
        '[Storage] Erro ao fazer upload de foto',
        expect.any(Error)
      );
    });
  });

  describe('uploadFotoUsuario', () => {
    const mockUsuarioId = 'usuario-123';
    const mockFotoUsuarioUrl = 'https://xyz.supabase.co/storage/v1/object/public/fotos-entrega/perfis/perfil_usuario-123_1234567890.jpg';

    it('deve fazer upload de foto de perfil com sucesso', async () => {
      mockFetchWithBlob(1024 * 200); // 200KB

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'perfis/perfil_usuario-123_1234567890.jpg' },
        error: null,
      });

      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: mockFotoUsuarioUrl },
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      const result = await uploadFotoUsuario(mockUsuarioId, mockFotoUri);

      expect(result).toBe(mockFotoUsuarioUrl);
      expect(global.fetch).toHaveBeenCalledWith(mockFotoUri);
      expect(mockUpload).toHaveBeenCalled();
      expect(mockGetPublicUrl).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith({
        foto_url: mockFotoUsuarioUrl,
        updated_at: expect.any(String),
      });
    });

    it('deve rejeitar foto maior que 2MB', async () => {
      mockFetchWithBlob(3 * 1024 * 1024); // 3MB

      const result = await uploadFotoUsuario(mockUsuarioId, mockFotoUri);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('[Storage] Foto muito grande! Máximo: 2MB');
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

      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: mockFotoUsuarioUrl },
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: new Error('Update failed') }),
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      const result = await uploadFotoUsuario(mockUsuarioId, mockFotoUri);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        '[Storage] Erro ao atualizar foto_url no banco',
        expect.any(Error)
      );
    });

    it('deve usar upsert:false e caminho correto no upload', async () => {
      mockFetchWithBlob(1024 * 200);

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      });

      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: mockFotoUsuarioUrl },
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
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
        })
      );
    });
  });

  describe('uploadIncidentPhoto', () => {
    const mockFileName = 'incidente_123_1234567890.jpg';
    const mockIncidentUrl = 'https://xyz.supabase.co/storage/v1/object/public/incidentes/incidente_123_1234567890.jpg';

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

    it('deve fazer upload de foto de incidente com sucesso', async () => {
      mockFetchWithBlob(1024 * 500); // 500KB

      const expectedPath = `incidentes/${mockFileName}`;
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: expectedPath },
        error: null,
      });

      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: mockIncidentUrl },
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      const result = await uploadIncidentPhoto(mockFotoUri, mockFileName);

      expect(result).toBe(mockIncidentUrl);
      expect(global.fetch).toHaveBeenCalledWith(mockFotoUri);
      expect(mockUpload).toHaveBeenCalledWith(
        expectedPath,
        expect.any(ArrayBuffer),
        expect.objectContaining({
          contentType: 'image/jpeg',
          upsert: true,
        })
      );
    });

    it('deve rejeitar foto maior que 5MB', async () => {
      mockFetchWithBlob(6 * 1024 * 1024); // 6MB

      const result = await uploadIncidentPhoto(mockFotoUri, mockFileName);

      expect(result).toBe('');
      expect(logger.error).toHaveBeenCalledWith('[Storage] Foto muito grande! Máximo: 5MB');
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

      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: mockIncidentUrl },
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
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

      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: mockIncidentUrl },
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      await uploadIncidentPhoto(mockFotoUri, mockFileName);

      expect(mockCreateBucket).not.toHaveBeenCalled();
    });
  });
});
