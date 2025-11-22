import { renderHook, act } from '@testing-library/react-hooks';

import { useToast } from '../useToast';

describe('useToast', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('deve inicializar com estado padrão', () => {
        const { result } = renderHook(() => useToast());

        expect(result.current.toast).toEqual({
            visible: false,
            message: '',
            type: 'success',
            duration: 3000,
        });
    });

    it('deve mostrar toast corretamente', () => {
        const { result } = renderHook(() => useToast());

        act(() => {
            result.current.showToast('Teste de mensagem', 'error', 5000);
        });

        expect(result.current.toast).toEqual({
            visible: true,
            message: 'Teste de mensagem',
            type: 'error',
            duration: 5000,
        });
    });

    it('deve esconder toast corretamente', () => {
        const { result } = renderHook(() => useToast());

        act(() => {
            result.current.showToast('Teste');
        });

        expect(result.current.toast.visible).toBe(true);

        act(() => {
            result.current.hideToast();
        });

        expect(result.current.toast.visible).toBe(false);
    });

    describe('withToast', () => {
        it('deve lidar com sucesso', async () => {
            const { result } = renderHook(() => useToast());
            const mockFn = jest.fn().mockResolvedValue('resultado');

            let promise: Promise<any>;
            await act(async () => {
                promise = result.current.withToast(mockFn, {
                    loading: 'Carregando...',
                    success: 'Sucesso!',
                });
            });

            // Verificar estado de loading (difícil de pegar exatamente durante, mas podemos verificar chamadas)
            // Como é async, verificamos o resultado final
            const valor = await promise!;
            expect(valor).toBe('resultado');

            expect(result.current.toast).toEqual({
                visible: true,
                message: 'Sucesso!',
                type: 'success',
                duration: 3000,
            });
        });


    });
});
