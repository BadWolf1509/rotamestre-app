import { render } from '@testing-library/react-native';

import { PaginationDesktop, PaginationMobile } from '../DataTablePagination';

describe('DataTablePagination accessibility', () => {
  describe('PaginationMobile', () => {
    it('renders mobile prev/next buttons with PT labels', () => {
      const { getAllByLabelText } = render(
        <PaginationMobile
          currentPage={2}
          totalPages={5}
          onPrevious={() => {}}
          onNext={() => {}}
        />,
      );
      expect(getAllByLabelText('Página anterior').length).toBeGreaterThan(0);
      expect(getAllByLabelText('Próxima página').length).toBeGreaterThan(0);
    });

    it('prev button is disabled on first page (accessibilityState)', () => {
      const { getAllByLabelText } = render(
        <PaginationMobile
          currentPage={1}
          totalPages={5}
          onPrevious={() => {}}
          onNext={() => {}}
        />,
      );
      const prevButtons = getAllByLabelText('Página anterior');
      prevButtons.forEach((btn) => {
        expect(btn.props.accessibilityState).toMatchObject({ disabled: true });
      });
    });

    it('next button is disabled on last page (accessibilityState)', () => {
      const { getAllByLabelText } = render(
        <PaginationMobile
          currentPage={5}
          totalPages={5}
          onPrevious={() => {}}
          onNext={() => {}}
        />,
      );
      const nextButtons = getAllByLabelText('Próxima página');
      nextButtons.forEach((btn) => {
        expect(btn.props.accessibilityState).toMatchObject({ disabled: true });
      });
    });

    it('prev button is not disabled when not on first page', () => {
      const { getAllByLabelText } = render(
        <PaginationMobile
          currentPage={3}
          totalPages={5}
          onPrevious={() => {}}
          onNext={() => {}}
        />,
      );
      const prevButtons = getAllByLabelText('Página anterior');
      prevButtons.forEach((btn) => {
        expect(btn.props.accessibilityState).toMatchObject({ disabled: false });
      });
    });

    it('next button is not disabled when not on last page', () => {
      const { getAllByLabelText } = render(
        <PaginationMobile
          currentPage={3}
          totalPages={5}
          onPrevious={() => {}}
          onNext={() => {}}
        />,
      );
      const nextButtons = getAllByLabelText('Próxima página');
      nextButtons.forEach((btn) => {
        expect(btn.props.accessibilityState).toMatchObject({ disabled: false });
      });
    });

    it('buttons have accessibilityRole="button"', () => {
      const { getAllByRole } = render(
        <PaginationMobile
          currentPage={2}
          totalPages={5}
          onPrevious={() => {}}
          onNext={() => {}}
        />,
      );
      expect(getAllByRole('button').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('PaginationDesktop', () => {
    const desktopProps = {
      startIndex: 10,
      endIndex: 20,
      totalItems: 50,
      onPrevious: () => {},
      onNext: () => {},
    };

    it('renders desktop prev/next buttons with PT labels', () => {
      const { getAllByLabelText } = render(
        <PaginationDesktop currentPage={2} totalPages={5} {...desktopProps} />,
      );
      expect(getAllByLabelText('Página anterior').length).toBeGreaterThan(0);
      expect(getAllByLabelText('Próxima página').length).toBeGreaterThan(0);
    });

    it('desktop prev button is disabled on first page', () => {
      const { getAllByLabelText } = render(
        <PaginationDesktop currentPage={1} totalPages={5} {...desktopProps} />,
      );
      const prevButtons = getAllByLabelText('Página anterior');
      prevButtons.forEach((btn) => {
        expect(btn.props.accessibilityState).toMatchObject({ disabled: true });
      });
    });

    it('desktop next button is disabled on last page', () => {
      const { getAllByLabelText } = render(
        <PaginationDesktop currentPage={5} totalPages={5} {...desktopProps} />,
      );
      const nextButtons = getAllByLabelText('Próxima página');
      nextButtons.forEach((btn) => {
        expect(btn.props.accessibilityState).toMatchObject({ disabled: true });
      });
    });
  });
});
