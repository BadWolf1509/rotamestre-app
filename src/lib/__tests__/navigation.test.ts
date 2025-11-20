import { navigation } from '../navigation';

describe('navigation helper', () => {
    describe('navigate', () => {
        it('should be a function', () => {
            expect(typeof navigation.navigate).toBe('function');
        });
    });

    describe('goBack', () => {
        it('should be a function', () => {
            expect(typeof navigation.goBack).toBe('function');
        });
    });

    describe('reset', () => {
        it('should be a function', () => {
            expect(typeof navigation.reset).toBe('function');
        });
    });

    describe('canGoBack', () => {
        it('should be a function', () => {
            expect(typeof navigation.canGoBack).toBe('function');
        });
    });
});
