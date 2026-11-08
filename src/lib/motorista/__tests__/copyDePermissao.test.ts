import * as copies from '../copyDePermissao';

const todas = Object.entries(copies);

describe('copyDePermissao', () => {
  it('exporta as oito constantes esperadas', () => {
    expect(todas.map(([nome]) => nome).sort()).toEqual([
      'COPY_CAMERA_ENTREGA',
      'COPY_CAMERA_INCIDENTE',
      'COPY_CAMERA_PERFIL',
      'COPY_GALERIA_ENTREGA',
      'COPY_GALERIA_INCIDENTE',
      'COPY_GALERIA_PERFIL',
      'COPY_LOCALIZACAO',
      'COPY_LOCALIZACAO_SOS',
    ]);
  });

  it.each(todas)('%s tem título e as duas mensagens preenchidas', (_n, c) => {
    expect(c.titulo.trim()).not.toBe('');
    expect(c.mensagemNegada.trim()).not.toBe('');
    expect(c.mensagemBloqueada.trim()).not.toBe('');
  });

  // Assimetria deliberada: só a bloqueada manda para as Configurações.
  it.each(todas)(
    '%s: só a mensagem bloqueada nomeia as Configurações',
    (_n, c) => {
      expect(c.mensagemBloqueada).toContain('Configurações');
      expect(c.mensagemNegada).not.toContain('Configurações');
    },
  );

  it('cada permissão tem texto próprio por fluxo (nenhum par repetido)', () => {
    const negadas = todas.map(([, c]) => c.mensagemNegada);
    expect(new Set(negadas).size).toBe(negadas.length);
  });

  it('só a câmera e a galeria da entrega dizem que a foto comprova a entrega', () => {
    const dizemComprova = todas
      .filter(([, c]) => /comprova a entrega/.test(c.mensagemNegada))
      .map(([nome]) => nome)
      .sort();
    expect(dizemComprova).toEqual([
      'COPY_CAMERA_ENTREGA',
      'COPY_GALERIA_ENTREGA',
    ]);
  });

  it('o incidente fala do que aconteceu, e o perfil, do perfil', () => {
    expect(copies.COPY_CAMERA_INCIDENTE.mensagemNegada).toContain(
      'o que aconteceu',
    );
    expect(copies.COPY_GALERIA_INCIDENTE.mensagemNegada).toContain(
      'do que aconteceu',
    );
    expect(copies.COPY_CAMERA_PERFIL.mensagemNegada).toContain('perfil');
    expect(copies.COPY_GALERIA_PERFIL.mensagemNegada).toContain('perfil');
  });

  it('a localização da navegação fala de navegar; a do SOS, do gestor', () => {
    expect(copies.COPY_LOCALIZACAO.mensagemNegada).toContain('navegar');
    expect(copies.COPY_LOCALIZACAO_SOS.mensagemNegada).toContain('gestor');
    expect(copies.COPY_LOCALIZACAO_SOS.mensagemNegada).not.toContain('navegar');
  });
});
