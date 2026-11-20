## Web Design Review

### Snapshot of the current system
- **Stack**: React + TypeScript, Vite, Tailwind CSS, Shadcn UI
- **Theme**: CSS variables in `src/index.css` with light/dark tokens (colors, radii, shadows). Heavy use of gradients and glassmorphism
- **Layout**: Fixed header, collapsible sidebar on desktop, bottom navigation on mobile (`layout/Layout.tsx`), background effects (grid + blurred color blobs)
- **Patterns**: Modals for generation flows, glass cards, markdown in chat messages, mobile-safe-area utilities, dark mode supported

### What’s working well
- **Cohesive brand and aesthetic**: The purple/pink gradient and glassmorphism are consistent across pages and communicate a modern AI feel
- **Tokenized theming**: Centralized CSS variables for colors, radius, ring, etc., with dark mode overrides; Tailwind layers used well
- **Responsive scaffolding**: Desktop sidebar with collapse, mobile bottom nav, fixed header; sensible adaptive layout with `lg:` breakpoints
- **Chat UX details**: Markdown rendering, typing indicator, selectable messages, clear role distinction between user/assistant
- **Utilities for mobile ergonomics**: Safe-area padding, touch-target helpers, animation utilities present in CSS

### Key issues and risks
- **Contrast on glass surfaces**: `bg-white/10` + backdrop blur over gradients can underperform WCAG AA, especially for small text and muted grays
- **Performance of background effects**: Multiple full-screen blurred layers and masks may stutter on low-end devices and older Safari/iOS
- **Layout coupling**: Header’s `lg:left-64` and sidebar widths are tightly coupled; collapse/expand can cause noticeable layout shifts
- **Typography scale**: No explicit documented type ramp; headings/body sizes appear ad-hoc across components; risk of drift and inconsistent rhythm
- **Component consistency**: Mix of Shadcn primitives and custom glass components; variants/paddings differ slightly between places
- **Accessibility**: Limited evidence of skip links, focus-visible states, ARIA landmarks, and keyboard affordances for sidebar/menu
- **Motion preferences**: Animations and blurs do not appear to honor `prefers-reduced-motion`/reduced-transparency preferences

### Prioritized recommendations
1. Design tokens as a single source of truth
   - Move color, spacing, radius, shadows, and durations into a tokens module consumed by Tailwind config
   - Align naming with mobile tokens for cross-platform parity

2. Contrast and legibility pass
   - Increase surface opacity to `bg-white/15-20` or add a subtle neutral scrim behind glass content
   - Strengthen text colors on glass (avoid low-contrast grays), and ensure focus-visible rings are prominent

3. Performance-oriented background treatment
   - Reduce the number/size of blurred background blobs; use smaller, lower-res layers; turn them off below certain breakpoints
   - Provide a `prefers-reduced-transparency` fallback that swaps glass/blur for solid surfaces

4. Decouple layout metrics
   - Drive header left offset and content padding from a CSS variable bound to sidebar width; reduce layout shift on collapse/expand
   - Audit small-screen behavior at 320–360 px widths; ensure bottom nav + content have predictable safe-area spacing

5. Standardize component primitives
   - Wrap common elements (Button, Card, Input, Modal, Badge, Chip) with consistent spacing and variant tokens; prefer Shadcn variants
   - Document spacing rules (8px grid), hit areas, and default sizes for icons (e.g., 20/24 px)

6. Accessibility upgrades
   - Add skip-to-content link, landmark roles (`nav`, `main`, `header`), and `aria-current` on active nav links
   - Ensure all interactive elements have visible focus states and sufficient hit targets

7. Motion system and preferences
   - Define motion tokens (fast/normal/slow, easing curves), and honor `prefers-reduced-motion`; reduce parallax/blur intensity when requested

8. Documentation and QA
   - Add a simple Storybook/Ladle for core components; include dark mode and reduced motion stories
   - Include a brief design guide (usage, dos/don’ts, examples) next to tokens

### Quick wins (minimal effort, high impact)
- Increase border opacity on glass cards to `border-white/30` and raise surface opacity slightly to improve contrast
- Reduce one background blob layer and the blur radius on desktop; disable blobs on mobile
- Normalize paddings on modals and inputs (vertical ≥ 10–12 px) for better readability
- Ensure bottom navigation uses `safe-area` utilities consistently on all pages

### Suggested success metrics
- Lighthouse Accessibility ≥ 90 on key pages; axe-core violations = 0 critical
- Web Vitals: CLS < 0.1 (sidebar collapse shouldn’t cause major shifts), TBT/INP stable on mid-tier devices
- Manual audits for contrast (AA for body text, AAA for small text where feasible)


