// Teste simples para verificar se o Jest está funcionando
describe('Setup de Testes', () => {
  it('deve executar um teste básico', () => {
    expect(1 + 1).toBe(2);
  });

  it('deve validar strings', () => {
    expect('hello').toBe('hello');
  });

  it('deve validar arrays', () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
  });

  it('deve validar objetos', () => {
    const obj = { name: 'Test', value: 42 };
    expect(obj).toHaveProperty('name');
    expect(obj.value).toBe(42);
  });
});
