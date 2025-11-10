# Unit Logo Assets

## Concept
The **Bracket Block** `[ ]` is an anti-logo: a minimal container symbolizing a programmable unit of identity. The empty interior invites connection and composition.

## Files
- `unit-bracket.svg` – Primary standalone mark.
- `unit-logo.svg` – Combination mark with wordmark and stylized pixel-dot “i”.

## Geometry
- Corner radius: 5–6px (soft machine aesthetic).
- Mark vertical bars sized to maintain a light internal negative space; recommended gap ≈ 2–2.5× bar width.
- Suggested bar width for small usage (16–32px height): width ≈ 28–32% of total mark height.

## Colors
- Default: Pure white `#FFFFFF` on dark backgrounds.
- Dark on light: Use `#111111` or `#1A1A1A`.
- Accent variant (rare, for celebratory states): apply a gradient fill (e.g. `linear-gradient(90deg,#26ffe6,#6b5cff)` via CSS mask) to the bars only.

## Clearspace
Maintain clearspace equal to the bar width around the bracket mark. For combination logo, clearspace equals height of the bracket bars on all sides.

## Accessibility
- High contrast monotone ensures WCAG text/logo contrast when sized ≥ 24px height.
- Provide `aria-label` and avoid embedding meaningful text solely in path shapes.

## Usage Examples
### HTML Inline
```html
<img src="/src/assets/logos/unit-bracket.svg" alt="Unit bracket logo" width="48" height="48" />
```

### CSS (Gradient Accent)
```css
.logo-accent rect { fill: url(#accentGradient); }
```

### React Component
```tsx
export function UnitLogo({ variant = 'full', size = 48 }: { variant?: 'full'|'mark'; size?: number }) {
  const file = variant === 'full' ? '/src/assets/logos/unit-logo.svg' : '/src/assets/logos/unit-bracket.svg';
  return <img src={file} width={size} height={variant==='full'? size*3.5 : size} alt={variant==='full'? 'Unit logo' : 'Unit bracket logo'} />;
}
```

## Do / Don’t
- Do keep proportions; scale uniformly.
- Don’t rotate the brackets.
- Don’t add drop shadows that reduce clarity at small sizes.
- Avoid placing on busy photographic backgrounds without a solid or blurred backdrop.

## Future Extensions
- Animated variant: subtle pulsing of inner negative space.
- Badge overlays: small top-right pixel for agent status (open / rate-limited / deprecated).

---
© 2025 Unit. "Stop Thinking. Start Connecting." 
