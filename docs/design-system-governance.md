# Design System Governance

## Ownership
- Design: owns visual direction and token semantics.
- Frontend: owns implementation, accessibility, and platform parity.

## Change Process
1) Propose (issue or doc update).
2) Review (Design + Frontend).
3) Implement (tokens/components/docs).
4) Release (update snapshots and notes).

## Deprecation Policy
- Mark deprecated tokens/components in docs.
- Provide migration guidance.
- Remove after one release cycle.

## Versioning and Release
- Follows app SemVer; design-system changes must be called out in release notes.
- Token changes:
  - Patch: internal refactors or alias additions (no behavior change).
  - Minor: new tokens/components, backward compatible.
  - Major: token removals/renames or breaking visual changes.
- Release checklist:
  1) Update tokens/components/docs.
  2) Run `npm run build:tokens` and commit outputs.
  3) Update visual regression snapshots when UI changes are intentional.
  4) Record decisions in `docs/design-system-decisions.md`.
  5) Update `docs/design-system-release-notes.md`.

## Review Checklist (UI Changes)
- Uses semantic tokens (no raw hex).
- Reuses base components from `@/design-system`.
- Visual regression updated when needed.
- Docs updated if behavior or usage changes.
- Token build + hex report are up to date (CI drift check passes).
- Respects density/contrast preferences (use `theme.desktop.*` and semantic colors).
- Acessibilidade revisada (ver `docs/design-system-accessibility.md`).

## Exception Policy (Raw Hex)
- Raw hex is blocked by lint; temporary exceptions must go into `eslint.config.js` `hexColorAllowlist`.
- Each exception needs a clear reason and a follow-up task in `docs/design-system-migration.md`.
- Remove allowlist entries as soon as the file is migrated.
