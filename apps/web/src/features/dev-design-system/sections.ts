/**
 * The canonical section list for the in-page nav. Each `id` must match
 * the `id` passed to that section's `<Section>` wrapper exactly.
 */
export const SECTIONS = [
  { id: 'typography', label: 'Typography' },
  { id: 'colors', label: 'Colors' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'forms', label: 'Form controls' },
  { id: 'cards', label: 'Cards' },
  { id: 'badges', label: 'Badges' },
  { id: 'avatars', label: 'Avatars' },
  { id: 'tabs', label: 'Tabs' },
  { id: 'modal', label: 'Modal' },
  { id: 'dropdown', label: 'Dropdown' },
  { id: 'tooltip', label: 'Tooltip' },
  { id: 'skeletons', label: 'Skeletons' },
  { id: 'toast', label: 'Toast' },
  { id: 'states', label: 'Loading & errors' },
  { id: 'theming', label: 'Theming' },
] as const;
