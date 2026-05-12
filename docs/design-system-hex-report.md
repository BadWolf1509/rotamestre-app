# Hex Color Report

## Scope

- Paths: `app/`, `src/`, `App.tsx`
- Pattern: `#RGB`, `#RRGGBB`, `#RRGGBBAA`
- Excludes: `__tests__`, `node_modules/`, `tokens/`, `dist/`, `build/`, `coverage/`

## Summary

- Files with hex colors: 10
- Total hex occurrences: 196

## Findings

- `app/+html.tsx`: L28 #284093, L77 #284093, L78 #ffffff
- `app/auth/login.tsx`: L29 #284093, L38 #284093
- `app/design-system.tsx`: L186 #16a34a, L189 #2563eb, L192 #ca8a04, L194 #dc2626, L383 #FFFFFF, L384 #000000, L387 #FFFFFF, L387 #000000, L1456 #FF0000
- `src/components/MapaWebMapLibre.tsx`: L690 #fff
- `src/components/motorista/NavigationMode.web.tsx`: L231 #4285F4
- `src/components/motorista/PictureInPictureMap.web.tsx`: L539 #000000
- `src/components/motorista/TurnByTurnNavigation.web.tsx`: L643 #000, L654 #000, L664 #000
- `src/components/Slider.web.tsx`: L31 #007AFF, L32 #d1d5db, L33 #007AFF
- `src/utils/mapMarkerColors.ts`: L41 #047857, L43 #d97706, L45 #284093, L47 #dc2626, L49 #6b7280
- `src/utils/styles.base.ts`: L28 #000000, L32 #000, L412 #284093, L413 #1b2c63, L414 #34699f, L415 #e6ecfb, L416 #d4820a, L416 #f7a02a, L417 #a66500, L418 #f7a02a, L419 #fff3d6, L420 #d49500, L421 #f9fafb, L422 #ffffff, L423 #ffffff, L424 #e5e7eb, L425 #e5e7eb, L426 #1f2937, L427 #4b5563, L427 #6b7280, L428 #6b7280, L428 #9ca3af, L429 #ffffff, L430 #10b981, L431 #047857, L432 #d1fae5, L433 #f59e0b, L434 #b45309, L435 #fef3c7, L436 #ef4444, L437 #dc2626, L438 #fee2e2, L439 #3b82f6, L440 #dbeafe, L441 #ffffff, L442 #000000, L443 #f9fafb, L444 #f3f4f6, L445 #e5e7eb, L446 #d1d5db, L447 #9ca3af, L448 #6b7280, L449 #4b5563, L450 #374151, L451 #1f2937, L452 #111827, L453 #d1d5db, L454 #000000, L456 #8b5cf6, L457 #7c3aed, L459 #eff6ff, L460 #dbeafe, L461 #3b82f6, L462 #f0fdf4, L463 #dcfce7, L464 #22c55e, L465 #fef2f2, L466 #fee2e2, L467 #ef4444, L468 #fef9c3, L469 #eab308, L470 #e0e7ff, L472 #f97316, L473 #93c5fd, L474 #166534, L475 #fef3c7, L476 #d97706, L477 #fee2e2, L478 #d1fae5, L479 #25D366, L481 #284093, L482 #f7a02a, L483 #34699f, L484 #ffbf14, L485 #0f766e, L486 #1b2c63, L489 #ef4444, L490 #f59e0b, L491 #3b82f6, L492 #8b5cf6, L493 #ec4899, L494 #06b6d4, L495 #6b7280, L840 #7a9bdf, L840 #5a7fcc, L841 #5a7fcc, L842 #9fb8eb, L843 #1e2a4a, L844 #f7a02a, L845 #d4820a, L846 #ffbf14, L847 #3d3020, L848 #f7a02a, L849 #0f1419, L850 #1a2029, L851 #1f2937, L852 #374151, L853 #374151, L854 #f3f4f6, L854 #e5e7eb, L855 #d1d5db, L855 #9ca3af, L856 #9ca3af, L856 #6b7280, L857 #111827, L858 #34d399, L859 #10b981, L860 #064e3b, L861 #065f46, L862 #fbbf24, L863 #fbbf24, L864 #451a03, L865 #78350f, L866 #b45309, L867 #f87171, L868 #ef4444, L869 #450a0a, L870 #7f1d1d, L871 #60a5fa, L872 #1e3a5f, L873 #111827, L874 #1f2937, L875 #374151, L876 #4b5563, L877 #6b7280, L878 #9ca3af, L879 #d1d5db, L880 #e5e7eb, L881 #f3f4f6, L882 #f9fafb, L883 #1a2029, L884 #f9fafb, L885 #4b5563, L886 #000000, L887 #a78bfa, L888 #8b5cf6, L889 #fb923c, L890 #1e3a5f, L891 #1e40af, L892 #3b82f6, L893 #60a5fa, L894 #064e3b, L895 #065f46, L896 #34d399, L897 #86efac, L898 #25D366, L899 #450a0a, L900 #7f1d1d, L901 #f87171, L902 #422006, L903 #fcd34d, L904 #312e81, L967 #4b5563, L967 #9ca3af, L968 #374151, L968 #6b7280, L969 #1f2937, L969 #4b5563, L970 #111827, L970 #374151, L982 #d1d5db, L982 #6b7280, L983 #e5e7eb, L983 #9ca3af, L984 #f3f4f6, L984 #d1d5db, L985 #f9fafb, L985 #e5e7eb

## Notes

- Some files are allowlisted in `eslint.config.js` while migration is in progress.
