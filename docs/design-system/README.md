# Academy Library Design System

A premium, restrained UI foundation for `apps/web`, built on native CSS
(custom properties + CSS Modules) — no Tailwind, no component-library
dependency, no CSS-in-JS. This document covers the visual principles,
token architecture, component APIs, theming, accessibility stance, and
how to extend it.

Browse it live at **`/dev/design-system`** (dev builds only — see
[Showcase route](#showcase-route) below).

## Table of contents

- [Visual principles](#visual-principles)
- [Design tokens](#design-tokens)
- [Theming](#theming)
- [Component catalog](#component-catalog)
- [Accessibility](#accessibility)
- [Showcase route](#showcase-route)
- [Adding a new component](#adding-a-new-component)

## Visual principles

1. **Premium but restrained.** Soft tinted surfaces over loud solid
   fills (badges, alerts), subtle shadows (`--shadow-xs`/`sm`, never
   oversized), no gradients or glassmorphism.
2. **Density with hierarchy.** A deliberate type scale (`xs` → `3xl`)
   and a 4px spacing unit keep rhythm consistent without feeling sparse.
3. **Light-first, dark from day one.** Every token has a light default
   and a dark override — dark mode isn't a palette inversion, it's a
   separately tuned set of values (see [Theming](#theming)).
4. **One interaction language.** Every interactive primitive shares the
   same hover/active/disabled/focus vocabulary via tokens, so a new
   component composed from existing primitives looks native by
   construction.

## Design tokens

All tokens live in `apps/web/src/styles/tokens.css`, in two layers:

- **`--palette-*`** — raw color primitives (a short scale per hue:
  neutral, accent, success, warning, danger). Components never
  reference these directly.
- **`--color-*`** — semantic tokens components actually consume
  (`--color-bg`, `--color-text-secondary`, `--color-accent-fill`, …),
  redefined per theme.

Everything else — `--font-*`, `--space-*`, `--radius-*`, `--shadow-*`,
`--duration-*`/`--ease-*`, `--z-*` — is theme-independent.

### Why some tokens have both a "text" and a "fill" variant

`--color-accent` vs. `--color-accent-fill` (and the `danger` equivalents)
exist because they solve different contrast problems:

- `--color-accent` is used for **text/icons/links** and is tuned against
  the **page background**, so it differs per theme (a lighter purple on
  dark backgrounds, since a value dark enough to read on white doesn't
  have enough contrast against near-black).
- `--color-accent-fill` is used for **solid button backgrounds paired
  with a white label**, and is tuned against **white** — a fixed
  problem independent of page background, so it's intentionally the
  _same_ value in both themes.

A couple of the brief's suggested colors (`#7565E8` accent, `#D44D5C`
danger) were a little under the 4.5:1 AA threshold for white-label
buttons specifically — darkened slightly for `--color-*-fill`/`-hover`,
while the original brief values still appear as the lighter "text on
dark background" tone in dark mode. This was checked with a manual WCAG
contrast calculation, not an automated audit — run axe/Lighthouse before
relying on it for a real compliance sign-off.

### Breakpoints

`--breakpoint-sm/md/lg/xl` are declared for documentation only — CSS
custom properties can't be interpolated into `@media` conditions. Media
queries in component CSS use the literal pixel values directly; keep
them in sync by hand if the scale changes.

## Theming

- **Mechanism:** `ThemeProvider` (`apps/web/src/app/theme/`) tracks a
  `'light' | 'dark' | 'system'` preference in React state, applies it as
  `data-theme="light"|"dark"` on `<html>` (or removes the attribute
  entirely for `'system'`), and persists an explicit choice to
  `localStorage` under `academy-library:theme` — never anything
  sensitive.
- **CSS precedence:** `tokens.css` defines light values on bare `:root`,
  dark values under `@media (prefers-color-scheme: dark)` scoped to
  `:root:not([data-theme="light"])`, and again unconditionally under
  `:root[data-theme="dark"]`. Net effect: system preference governs
  until the user picks explicitly, and an explicit pick always wins.
- **No flash:** an inline script in `index.html` reads the stored
  preference and sets `data-theme` before React boots, so there's no
  flash of the wrong theme on load.
- **No extra re-renders:** the theme context value is memoized, and
  since almost everything is driven by CSS variables cascading from
  `<html>`, components don't need to read theme state to react to it —
  only `ThemeToggle` itself subscribes to the context.
- **UI:** `ThemeToggle` is a three-way button group (Light/Dark/System),
  shown in the real app header (`RootLayout`) and again in the
  [showcase](#showcase-route)'s Theming section.

## Component catalog

All components live under `apps/web/src/shared/ui/<Name>/`, each with
its own `.tsx`, `.module.css`, and a barrel `index.ts`; the top-level
`shared/ui/index.ts` re-exports everything. Shared interaction logic
(portals, focus trap, outside-click, escape, scroll lock, focus
restoration) lives in `apps/web/src/shared/hooks/` — no new runtime
dependency was added for any of it.

| Component                                                                      | Notes                                                                                                                                                      |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                                                       | 5 variants (`primary`/`secondary`/`outline`/`ghost`/`destructive`) × 3 sizes, `isLoading`, `leadingIcon`/`trailingIcon`, `fullWidth`.                      |
| `IconButton`                                                                   | Icon-only button; `label` is **required** and becomes `aria-label`.                                                                                        |
| `Spinner`                                                                      | Standalone or embedded in `Button`'s loading state.                                                                                                        |
| `Badge`                                                                        | Soft tinted variants: `neutral`/`accent`/`success`/`warning`/`danger`.                                                                                     |
| `Avatar`                                                                       | Image with initials fallback (on missing `src` or an `onError`).                                                                                           |
| `Card` + `CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter` | Composable surface primitive.                                                                                                                              |
| `Alert`                                                                        | Inline banner, 4 variants, optional dismiss button. Defaults `role="status"` for info/success and `role="alert"` for warning/danger (override via `role`). |
| `EmptyState`                                                                   | Icon + title + description + action slot.                                                                                                                  |
| `Skeleton`, `SkeletonText`, `SkeletonAvatar`, `SkeletonCard`                   | Decorative placeholders (`aria-hidden`); shimmer respects `prefers-reduced-motion`.                                                                        |
| `Input`, `Textarea`, `Select`                                                  | `label`/`helperText`/`error`, `forwardRef`, spread native props — drop-in with React Hook Form's `register()`.                                             |
| `Checkbox`, `Radio`, `Switch`                                                  | Native inputs styled via `accent-color` (Checkbox/Radio) or a custom track/thumb with `role="switch"` (Switch) — all keyboard-native.                      |
| `Tabs` + `TabList`/`Tab`/`TabPanel`                                            | Roving tabindex, Arrow/Home/End navigation, skips disabled tabs.                                                                                           |
| `Modal`                                                                        | Portaled, focus-trapped, scroll-locked, closes on Escape/outside click, restores focus to the trigger.                                                     |
| `Dropdown` + `DropdownTrigger`/`DropdownMenu`/`DropdownItem`                   | **Not** portaled (keeps natural Tab order) — absolutely positioned relative to the trigger. Arrow/Home/End navigation; Tab closes it.                      |
| `Tooltip`                                                                      | Shows on hover _and_ focus, dismisses on Escape, wired via `aria-describedby`. Single-child API via `cloneElement`.                                        |
| `ToastProvider` + `useToast()`                                                 | App-wide queue in one polite live region; auto-dismiss (default 5s) or manual.                                                                             |

### Usage example

```tsx
import { Button, Input } from '@/shared/ui'; // or '../../shared/ui' — see note below
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({ title: z.string().min(3) });

function Example() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(() => {})(e);
      }}
    >
      <Input label="Title" error={errors.title?.message} {...register('title')} />
      <Button type="submit">Save</Button>
    </form>
  );
}
```

> The codebase's existing convention is relative imports (not the `@/`
> alias) — match whatever's already used in the file you're editing.

## Accessibility

Targeted at WCAG 2.2 AA. What's actually in place:

- Every interactive primitive is keyboard-operable (native elements
  where possible — buttons, native `<select>`, `accent-color` checkboxes
  — custom keyboard handling only where there's no native equivalent:
  Tabs, Dropdown, Modal's focus trap).
- A single global `:focus-visible` rule (`styles/global.css`) covers
  focus visibility by default; a few components (Input/Select/Textarea,
  Switch) draw a more deliberate ring on a wrapping element instead,
  documented inline where that happens.
- `Modal` and `Dropdown` both: trap or manage focus appropriately, close
  on Escape, close on an outside click, and restore focus to whatever
  triggered them on close.
- Icon-only controls (`IconButton`) require a `label` prop at the type
  level — there's no way to render one without an accessible name.
- Form controls associate `label`/`helperText`/`error` via `id` +
  `aria-describedby`, and set `aria-invalid` when there's an error.
- Skeletons are `aria-hidden`; pair them with `aria-busy` or
  `role="status"` on their container if you need the loading state
  itself announced.
- Animations (shimmer, spinner, modal/menu/toast transitions) respect
  `prefers-reduced-motion` — most via the global `--duration-*` tokens
  collapsing to ~0, `Spinner` and `Skeleton` with a dedicated override
  since they're not a one-off transition.
- Status is never color-only: `Badge`/`Alert`/`Toast` all pair color
  with an icon and/or text label.

**What this is not:** a certified audit. Contrast was checked with a
manual WCAG formula during token design (see
[Design tokens](#design-tokens)), not with axe/Lighthouse/a screen
reader pass. Run one before treating this as a compliance sign-off.

## Showcase route

`/dev/design-system` (`apps/web/src/features/dev-design-system/`) is a
sectioned gallery exercising every component with realistic examples,
including the live theme toggle and an end-to-end React Hook Form + Zod
form using every form control at once.

It's excluded from production, not just hidden: the route is only
pushed into the router array when `import.meta.env.DEV` is true
(`apps/web/src/app/routes.tsx`), a condition Vite replaces with a
literal `false` in production builds — Rollup then dead-code-eliminates
the branch, including the dynamic `import()` for the page, so **no
chunk for it exists in `dist/`** (verified: `grep` the production build
output for `DesignSystemPage` and you'll only find a sourcemap path
reference, never any executable code).

## Adding a new component

1. Create `apps/web/src/shared/ui/<Name>/` with `<Name>.tsx`,
   `<Name>.module.css`, and `index.ts` re-exporting the component and its
   prop types.
2. Reuse tokens — if you reach for a raw hex value or a one-off pixel
   size, check whether an existing `--color-*`/`--space-*`/etc. token
   already covers it before adding a new one.
3. If it needs hover/open/overlay logic, check `shared/hooks/` first
   (`usePortal`, `useFocusTrap`, `useOutsideClick`, `useEscapeKey`,
   `useScrollLock`, `useRestoreFocus`) before writing new DOM-event
   wiring — focus-restoration in particular has a real ordering
   footgun (see the comment in `useRestoreFocus.ts`: it must run in
   `useLayoutEffect`, not `useEffect`, or a sibling effect that moves
   focus into the new content can win the race).
4. Export it from `shared/ui/index.ts`.
5. Add a section to the showcase (`features/dev-design-system/sections/`)
   with a realistic example, and register it in `sections.ts`'s nav
   list.
6. Write interaction tests, not render-only ones — see
   `Button.test.tsx`/`Modal.test.tsx`/`Dropdown.test.tsx` for the
   pattern (click/keyboard behavior, disabled/loading states, focus
   management). Two environment quirks to know about:
   - RTL's auto-cleanup between tests only self-registers against a
     _global_ `afterEach`; this project doesn't enable Vitest's
     `test.globals`, so cleanup is wired explicitly in
     `src/test/setup.ts` instead — you don't need to do anything extra,
     but don't remove that `afterEach(cleanup)` call.
   - jsdom here doesn't give you a working `localStorage` or
     `window.matchMedia` — both are polyfilled in the same setup file.
