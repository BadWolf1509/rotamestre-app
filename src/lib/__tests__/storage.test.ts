import {
  uploadFotoEntrega,
  salvarFotoParada,
  uploadELinkFotoParada,
  deletarFoto,
} from '../storage';
import { supabase } from '../supabase';

// Mock do supabase
jest.mock('../supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(),
    },
    from: jest.fn(),
  },
}));

// Mock do fetch global
global.fetch = jest.fn();

describe('Storage Functions', () => {
  const mockUnidadeId = 'unidade-123';
  const mockRotaId = 'rota-456';
  const mockParadaId = 'parada-789';
  const mockFotoUri = 'file:///path/to/photo.jpg';
  const mockFotoUrl = 'https://xyz.supabase.co/storage/v1/object/public/fotos-entrega/unidade-123/rota-456/parada-789_1234567890.jpg';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
    (console.error as jest.Mock).mockRestore();
  });

  describe('uploadFotoEntrega', () => {
    it('deve fazer upload de foto com sucesso', async () => {
      // Mock fetch para retornar blob
      const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' });
      Object.defineProperty(mockBlob, 'size', { value: 1024 * 500 }); // 500KB
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(mockBlob),
      });

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
      const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' });
      Object.defineProperty(mockBlob, 'size', { value: 6 * 1024 * 1024 });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await uploadFotoEntrega(
        mockUnidadeId,
        mockRotaId,
        mockParadaId,
        mockFotoUri
      );

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith('❌ Foto muito grande! Máximo: 5MB');
    });

    it('deve retornar null quando upload falha', async () => {
      const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' });
      Object.defineProperty(mockBlob, 'size', { value: 1024 * 500 });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(mockBlob),
      });

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
      const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' });
      Object.defineProperty(mockBlob, 'size', { value: 1024 * 500 });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(mockBlob),
      });

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
      const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' });
      Object.defineProperty(mockBlob, 'size', { value: 1024 * 500 });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(mockBlob),
      });

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
        expect.any(Blob),
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

    it('deve retornar null quando update falha', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: new Error('Update failed') }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      const result = await salvarFotoParada(mockParadaId, mockFotoUrl);

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
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
      const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' });
      Object.defineProperty(mockBlob, 'size', { value: 1024 * 500 });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(mockBlob),
      });

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
      const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' });
      Object.defineProperty(mockBlob, 'size', { value: 1024 * 500 });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(mockBlob),
      });

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
      const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' });
      Object.defineProperty(mockBlob, 'size', { value: 1024 * 500 });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(mockBlob),
      });

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
      expect(console.error).toHaveBeenCalled();
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
      const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' });
      Object.defineProperty(mockBlob, 'size', { value: 1024 * 500 });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(mockBlob),
      });

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
  });
});
