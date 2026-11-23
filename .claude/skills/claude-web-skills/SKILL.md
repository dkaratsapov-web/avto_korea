---
name: claude-web-skills
description: One combined rulebook for designing and building premium websites. Covers reading the brief, design taste and anti-AI-slop rules, navigation systems (static, sticky, dynamic, floating, overlay), animation and motion, scroll-driven experiences, native-feeling mobile, redesigns of existing sites, private /admin back offices, brand-kit image boards, and a final pre-flight checklist. Use for any website, landing page, portfolio, redesign, navbar, animation, scroll site, admin panel, or brand kit.
---

# Claude Web Skills

One file. Read Part 0, then jump to the parts the task needs. Every rule here exists because the
opposite shipped once and looked cheap, broke on a phone, or failed someone using a keyboard.

## Contents

0. How to use this file
1. Read the brief before anything else
2. Design foundations (type, color, layout, depth, images, copy, states)
3. AI tells: the refuse list
4. Navigation
5. Motion and animation
6. Scroll-driven experiences
7. Feeling native on mobile
8. Redesigning an existing site
9. Admin OS: a private back office behind a website
10. Brand-kit image boards
11. Working loop: references, screenshots, verification
12. Final pre-flight checklist
Appendix A: animation vocabulary
Appendix B: design-system map and install commands

---

# 0. How to use this file

## Routing

| The task is... | Read |
| --- | --- |
| Any new website or landing page | 1, 2, 3, 4, 5, 7, 11, 12 |
| A navbar, menu, dropdown, mega menu | 4 (plus 5 for motion, 7 for mobile) |
| "Animate this", "make it feel alive", a transition | 5, Appendix A |
| A scrollytelling / scroll-scrubbed video / Apple-style page | 6, then 2, 3, 5 |
| "It feels wrong on my phone", PWA, bottom sheet, carousel | 7 |
| Improve or modernize an existing site | 8, then 2, 3 |
| Admin panel, dashboard for the owner, CMS-lite, lead inbox | 9 |
| Logo, identity board, brand guidelines image | 10 |
| Matching a screenshot or reference design | 11 first |

## When rules conflict

1. The user's explicit instruction and the brand's own assets win over everything here.
2. Accessibility and the taste floor (contrast, focus, reduced motion, real content) never flex.
3. A specific section beats a general one (Part 4 beats Part 2 on navbars; Part 9 beats Part 2 inside /admin).
4. When unsure, choose the quieter, simpler option and say why in one line.

## Working posture

- Make the call. Do not present design choices as a menu unless the brief genuinely forks. State the
  reasoning in one line and build.
- Inspect before writing: framework, styling method, Tailwind version, existing tokens, routes,
  `package.json`. Never import a library you have not confirmed is installed; print the install
  command first.
- Extend the project's tokens. Never fork a second design system next to the existing one.
- Verify on the rendered result (Part 11). "It should work" is not done.

---

# 1. Read the brief before anything else

Most bad AI design comes from jumping to a default aesthetic instead of reading the room.

## 1.1 Signals to read first

1. **Page kind**: landing (SaaS, consumer, agency, event), portfolio, editorial, redesign, admin.
2. **Vibe words** the user used: minimalist, calm, Linear-style, Apple-y, playful, brutalist, editorial, dark tech, luxury.
3. **References**: URLs, screenshots, named brands or competitors.
4. **Audience**: the audience picks the aesthetic, not your taste.
5. **Existing brand assets**: logo, colors, type, photography. Check a `brand_assets/` (or similar) folder before designing. If assets exist, use them; never invent brand colors when a palette is defined.
6. **Quiet constraints**: accessibility-first audiences, public sector, regulated industries, kids, trust-first commerce. These override aesthetic preference.

## 1.2 Declare a design read

Before code, state one line:

> Reading this as: <page kind> for <audience>, with a <vibe> language, leaning toward <system or aesthetic family>.

If the brief is genuinely ambiguous, ask exactly one question ("Closer to Linear-clean or Awwwards-experimental?"). If you can infer it, do not ask.

## 1.3 Set three dials

| Dial | 1 | 10 |
| --- | --- | --- |
| `DESIGN_VARIANCE` | perfect symmetry | artsy asymmetry |
| `MOTION_INTENSITY` | static | cinematic, physics |
| `VISUAL_DENSITY` | art gallery, airy | cockpit, packed data |

Baseline `8 / 6 / 4` unless the read says otherwise:

| Signal | Variance | Motion | Density |
| --- | --- | --- | --- |
| minimalist, calm, editorial, Linear-style | 5-6 | 3-4 | 2-3 |
| premium consumer, Apple-y, luxury | 7-8 | 5-7 | 3-4 |
| playful, Awwwards, agency, experimental | 9-10 | 8-10 | 3-4 |
| landing / portfolio default | 7-9 | 6-8 | 3-5 |
| trust-first, public sector, regulated | 3-4 | 2-3 | 4-5 |
| redesign, preserve | match existing | +1 | match |
| redesign, overhaul | +2 | +2 | match |

What the dials mean in practice:

- **Variance 1-3**: symmetric 12-column grids, equal padding. **4-7**: offsets, mixed aspect ratios, left-aligned headers over centered data. **8-10**: masonry, fractional grids (`2fr 1fr 1fr`), large empty zones. At 4 and above, every asymmetric layout must collapse to a strict single column below 768px (`w-full px-4`).
- **Motion 1-3**: hover and active states only. **4-7**: CSS transitions on transform/opacity, cascaded load-ins. **8-10**: scroll-driven reveals, pinning, parallax (Part 5, Part 6). If motion is above 4 the page must actually move; if you cannot ship working motion, drop the dial to 3 and ship a clean static page.
- **Density 1-3**: section gaps `py-32` to `py-48`. **4-7**: `py-16` to `py-24`. **8-10**: tight, no card boxes, 1px dividers, monospace or tabular numbers.

## 1.4 Pick the foundation

If the brief reads as an established design system (enterprise SaaS, Shopify app, public sector, GitHub-style devtool), install and use the official package rather than recreating its CSS. One system per project. See Appendix B.

Otherwise the default stack: React/Next.js (Server Components by default; anything with motion, scroll listeners, or pointer physics is an isolated `'use client'` leaf), Tailwind v4 (v3 only if the project already uses it; in v4 use `@tailwindcss/postcss` or the Vite plugin), Motion (`motion/react`) for UI animation, GSAP + ScrollTrigger only for pinning and scrubbing, fonts via `next/font` or self-hosted `@font-face` with `font-display: swap`.

For a quick single-file build with no framework: one `index.html`, Tailwind via CDN, mobile-first, unless told otherwise.

---

# 2. Design foundations

## 2.1 Typography

- **Two families maximum.** Display carries voice, text carries prose.
- **Inter is discouraged as a default.** Reach first for Geist, Outfit, Satoshi, Cabinet Grotesk, Archivo, General Sans, or the brand's own face. Inter is fine when the user asks for neutral/Linear-style or the brief is accessibility-first.
- **Serif is not a synonym for premium.** Use one only when the brand names it, or the work is genuinely editorial, luxury, publication, or heritage and you can say why this serif fits this brand. Never default to Fraunces or Instrument Serif. If a serif is justified, rotate from: PP Editorial New, GT Sectra, Reckless Neue, Tiempos Headline, Canela, Domaine Display, Saol, Cormorant Garamond, EB Garamond, Playfair Display.
- **Emphasis inside a headline** uses italic or bold of the same family. Never drop a random serif word into a sans headline.
- **Tracking tightens as size grows**: about `-0.02em` to `-0.04em` on display, normal on body, positive on small caps labels.
- **Line height inverse to measure**: display 0.94 to 1.1, body about 1.6. Italic display words with descenders (g j p q y) need at least `leading-[1.1]` plus a little bottom padding or they clip.
- **Measure 45 to 75 characters** (about `max-w-[65ch]`).
- **Light text on dark** needs slightly more line height, a touch more tracking, and one step more weight.
- `text-wrap: balance` on headings, `text-wrap: pretty` on body. Sentence case on headers, not Title Case On Every Word.
- Use Medium (500) and SemiBold (600), not only 400 and 700.
- `font-variant-numeric: tabular-nums` on anything that counts, tabulates, or ticks.
- Sensible display defaults: `text-4xl md:text-5xl lg:text-6xl` for most heroes, `text-6xl md:text-7xl` only for 3-5 word headlines. Step the hero down one size below about 700px wide; a desktop floor wraps to six lines on a phone.

## 2.2 Color

- **Six roles, one accent**: canvas, surface, ink, ink-soft, accent, accent-ink. Saturation under about 80%.
- **Lock the accent for the whole page.** A warm-gray site does not grow a blue CTA in section seven.
- **One gray family.** Never mix warm and cool grays. Secondary text is tinted from the ink or surface hue, never flat `#888`.
- **No pure black or pure white.** Use off-black (`#0a0a0a`, zinc-950, a tinted charcoal) and off-white.
- **Contrast measured on the render**: body at least 4.5:1, large text 3:1, controls and focus indicators 3:1.
- **The AI-purple trap**: violet-to-blue gradients, neon glows, glowing buttons. Not unless the brand asks. If the brand is purple, embrace it with intent: harmonized neutrals, restrained gradients.
- **The premium-consumer palette trap**: warm cream background + brass/clay/oxblood accent + espresso text is the default reach for every artisan, food, wellness, and craft brief, and makes every such brand look identical. Do not default to it. Rotate: cold silver and chrome; deep forest with bone and amber; true off-black with warm tan; cobalt against one neutral; terracotta with slate; olive with brick; monochrome plus one saturated pop. Use cream-and-brass only when the brand names those colors.
- **Page theme lock**: one theme for the page. Sections do not flip from dark to light mid-scroll unless a single deliberate color-block moment is the design. Tints within one family are fine.
- **Dark mode**: for consumer-facing pages, design both modes from the start with tokens (CSS variables or Tailwind `dark:`, one strategy per project), respect `prefers-color-scheme`, and test both. Hierarchy and brand color must survive the switch.
- When a section redefines a color token (say `--ink`), also restate `color: var(--ink)` on that subtree. Inherited `color` already resolved on `body` will not update on its own, and the text silently fails contrast.

## 2.3 Layout

- Contain content: `max-w-7xl mx-auto` or a 1200-1440px container. Full-bleed media goes edge to edge; text never does.
- **Grid over flex math.** Never `w-[calc(33%-1rem)]`; use `grid grid-cols-1 md:grid-cols-3 gap-6`.
- **Never `h-screen` for full-height sections.** Use `min-h-[100svh]` for heroes (stable) and `100dvh` for app shells and drawers (Part 7).
- **More space above a heading than below it.** The gap belongs to the section boundary, not the heading-body pair. Getting this backwards makes a page read as a list.
- Group by proximity before reaching for a border or a card.
- Correct optically, not mathematically: icons beside text, play glyphs in circles, and bottom padding often need 1-2px nudges.
- Use a 4px-based spacing scale and fluid section padding so a phone does not inherit desktop air.
- **Anti-center bias**: when variance is above 4, avoid the centered hero. Use split screen, left content with right asset, or asymmetric whitespace. Centered is fine for manifesto or launch-announcement briefs where the message is the design.
- **Section-layout repetition**: a layout family (3-image-cards, split text-image, full-width quote) appears at most once per page. Eight sections means at least four different families.
- **Zigzag cap**: at most two consecutive image-text split sections. Break the third with a full-width, stacked, bento, or rail section.
- **Bento grids**: exactly as many cells as content items (no blank tiles), real rhythm, and at least 2-3 cells with real visual variation (image, brand gradient, pattern, tint).
- **Mobile collapse is explicit per section.** Declare the under-768px layout in the same component. Remove rotations and overlaps on mobile; they cause tap conflicts.
- Equal-height card rows pin their buttons to the bottom so CTAs form a clean line; feature lists in comparison columns start at the same Y.
- Z-index is a documented scale (nav, overlay, modal, toast, grain), not `z-50` and `z-[9999]` sprinkled around.

## 2.4 The hero

- Fits the first viewport: headline max 2 lines on desktop, subtext max 20 words and 4 lines, CTAs visible without scroll.
- Hero top padding max about `pt-24` on desktop; more reads as a bug.
- Max 4 text elements: (eyebrow OR brand strip OR neither), headline, subtext, CTAs (1 primary + at most 1 secondary).
- Trust logos, pricing teasers, micro-taglines under the CTA, feature bullets, avatar rows: all move to their own section directly below the hero.
- A hero needs a real visual. Text plus a gradient blob is a placeholder.

## 2.5 Depth, surfaces, cards

- **Cards only when elevation communicates hierarchy.** Otherwise use space, a hairline, or `divide-y`. Never nest cards. Never a page built from identical icon-heading-text cards. Never three equal feature cards in a row.
- **Shape consistency lock**: one radius system for the page (all sharp, all soft 12-16px, or pill for interactive), with any mix written down as a rule (for example buttons pill, cards 16px, inputs 8px) and followed everywhere. Inner radius = outer radius minus padding for concentric curves.
- **Shadows have offset and blur, and are tinted to the canvas hue.** No zero-offset colored halos, no pure black shadows on light grounds, no generic `shadow-md`. Layered, low-opacity shadows; one consistent light direction.
- **Edge light**: a 1px top highlight (`inset 0 1px 0 rgb(255 255 255 / .1)`) sells a raised surface better than blur.
- **Overlap** establishes depth for free. Things further away are smaller, softer, lower contrast.
- **Three elevation steps max** (base, raised, floating). If everything is elevated, nothing is.
- **Grain**: a fixed, `pointer-events-none` noise layer at about 3-5% opacity removes banding on flat dark grounds. Never attach grain or blur to scrolling containers (continuous repaints kill mobile frame rate).
- **Glass**: `backdrop-filter` only on fixed or sticky elements (nav, overlays), always with a solid fallback, a 1px inner border, and an inner highlight. Provide an opaque fallback under `prefers-reduced-transparency`. Label any "Liquid Glass" as a web approximation; there is no official web package.
- **Double-bezel (optional premium move)**: for a hero card or showcase image, an outer shell (subtle tint, hairline ring, 6-8px padding, large radius) holding an inner core (own surface, inner highlight, radius minus padding). Use for a few hero objects, not every container.
- **Button-in-button (optional)**: a pill CTA whose trailing arrow sits in its own small circle; on hover the circle nudges diagonally. One pattern for primary CTAs, used consistently.

## 2.6 Images and visual assets

Priority order:

1. **An image-generation tool**, if one exists in the environment, for section-specific assets at the right aspect ratio. One shared style preamble, reused verbatim in every prompt, so the set reads as one shoot. Look at every generated image before using it.
2. **Real images**: the brand's own, or `https://picsum.photos/seed/<descriptive-seed>/<w>/<h>`, or `https://placehold.co/WxH` for pure placeholders.
3. **Last resort**: leave labeled slots (`<!-- TODO: hero product photo, 1600x1200 -->`) and tell the user exactly which images are needed.

Rules:

- Even minimalist pages need 2-3 real images. A pure-text page is incomplete, not minimal.
- **No div-built fake screenshots** (fake dashboards, fake terminals, fake task lists). Use a real screenshot, a generated image, a real working mini-component, or editorial photography.
- **No hand-rolled decorative SVG illustrations** as a default. Simple geometric marks are fine.
- **Logo walls**: real SVG logos (Simple Icons, devicon), logos only (no category labels under them), working in light and dark. Invented brand names get a simple generated monogram, not a styled text span.
- Text over media: never a full-frame dark overlay. Use a corner scrim where corner-anchored copy sits, a bottom band when copy spans the width, or mask the image away from the text column. Measure contrast at the brightest frame under the text.
- Reserve image space (`width` and `height` attributes, or `aspect-ratio`) to prevent layout shift. If you override one dimension in CSS, override both (`width: 100%; height: auto`).
- Icons: Phosphor, Hugeicons, Radix, Tabler, or Heroicons. One family per project, one stroke width. Lucide only if the user asks or the project already uses it. Never hand-draw icon paths. Avoid cliché metaphors (rocket for launch, shield for security).
- Always ship a favicon, `<title>`, meta description, and Open Graph image.

## 2.7 Copy and content

- **Real copy, never lorem ipsum.** Every visible string is re-read before shipping; anything grammatically broken, cute-but-meaningless, or "LLM trying to sound thoughtful" is rewritten as a plain functional sentence. Boring beats fake-clever.
- **No filler verbs**: elevate, seamless, unleash, next-gen, revolutionize, supercharge, game-changer, delve, tapestry, "in the world of".
- **No invented statistics.** Numbers come from the brief or are labeled as sample data. Fake precision (`92%`, `4.1x`, `48k`) is a credibility liability. No number, no counter.
- **No "Jane Doe" effect**: realistic, locale-appropriate names; unique avatars; organic data (`47.2%`, `+1 (312) 847-1928`); believable invented brand names (not Acme, Nexus, SmartFlow).
- **One copy register per page.** Do not mix terminal-mono metrics, editorial prose, and marketing punch unless the brand voice calls for it.
- **Sections**: headline 8 words or fewer, sub-paragraph 25 words or fewer, one visual or one CTA. More must be justified.
- **No data-dump sections.** Top 3-5 plus "View all". Lists over 5 items become a grouped 2-column split, a card grid, tabs, horizontal snap pills, or a carousel, not a long `divide-y` list. Spec sheets become grouped clusters or featured-vs-rest, not 10 hairlined rows.
- **Quotes**: max 3 lines, attribution with name and role, typographic quotes.
- Success messages without exclamation marks. Errors are direct ("Connection failed. Try again."), not "Oops!". Active voice.
- **Em dashes: zero, anywhere visible.** Not in headlines, body, quotes, buttons, captions, or alt text. Use a period, comma, colon, or parentheses. En dashes too; ranges use a hyphen (`2018-2026`).

## 2.8 Interactive states and forms

- Every interactive element has hover (gated, Part 7), focus-visible, active/pressed, and disabled. A page with only resting states is half built.
- Press feedback: `scale(0.97)` or `translateY(1px)` on `:active`.
- Focus rings visible, themed to the accent, with offset, at least 3:1 contrast, never clipped.
- **CTA rules**: one label per intent across the whole page ("Get in touch" and "Let's talk" are the same button; pick one). Primary CTA labels are 1-3 words, specific verbs ("Book a call", "Start trial"), never "Learn more". A CTA label never wraps at desktop. Button text passes contrast against its own background, including ghost buttons over photos.
- Loading: skeletons shaped like the final layout, not generic spinners. Empty states: composed, explain what will appear, offer the first action. Errors: inline for forms, toasts only for transient events, never `window.alert()`.
- Forms: label above input, helper text below, error text below, never placeholder-as-label. Inputs, placeholders, labels, and focus rings all pass AA on their section background. Validate email and required fields client-side and server-side.
- No dead `#` links. Real destinations or visibly disabled.
- Smooth anchor scrolling (`scroll-behavior: smooth`) only outside reduced motion.

## 2.9 Code quality

- Semantic HTML (`header`, `nav`, `main`, `section`, `article`, `footer`), a skip link, logical heading order, meaningful alt text.
- No inline styles mixed into a class-based system, no commented-out dead code, no arbitrary 9999 z-index, relative units over hardcoded pixel widths.
- Strategic omissions AI forgets: privacy and terms links, a custom 404, a way back from every page, cookie consent where the jurisdiction requires it.
- Core Web Vitals: LCP under 2.5s (hero image preloaded or `priority`), INP under 200ms, CLS under 0.1. Lazy-load anything heavy below the fold (Three.js, large Motion trees, video).

---

# 3. AI tells: the refuse list

These are defaults with a look. The brief's own words can earn any of them; reaching for one when nobody asked means you were not deciding.

**Structure**
- Three equal feature cards. Identical cards as page structure. Nested cards.
- The hero-metric template (huge number, small label, supporting stats).
- 3+ consecutive zigzag splits. The same layout family twice.
- Split section header: giant headline left, tiny explainer paragraph floating top right. Stack them instead, unless the right column carries a real visual.
- Centered hero over a dark mesh gradient as the automatic choice.

**Labels and micro-text**
- An eyebrow (small uppercase tracked label) above every section. Max one per three sections, hero counts as one.
- Section numbers (`01 / 06`, `002 · Capabilities`), image pagination (`01 / 4`), "Stage 1 / Step 2 / Phase 03" labels. The step content is the label.
- Scroll cues ("Scroll", "scroll to explore", animated mouse icons).
- Version stamps (`v0.6`, `BETA`, `Build 0048`) on marketing pages, unless it is genuinely a launch.
- Decoration strips (`BRAND. MOTION. SPATIAL.`) along the hero bottom.
- Locale, time, or weather strips ("Lisbon 14:23 · 18°C") unless the brand is about a place.
- Pills or tags overlaid on photos; fake photo-credit captions ("Plate 03 · House archive").
- Middle-dot chains (`a · b · c · d`): max one per line.
- Decorative colored dots before nav items, list rows, or badges. Only for real live status.
- Micro-meta sentences under headings ("Each of these is a feature we ship today...").
- Poetic performative labels ("From the field", "Quietly trusted by", "On our desks"). Use plain labels.

**Surface**
- Gradient text on large headings. Neon and outer glows. Oversaturated accents.
- Glass and blur as decoration rather than a specific effect.
- Hairline crosshair grids drawn to "feel designed". Vertical rotated text (unless agency/experimental and compositional).
- `border-t` plus `border-b` on every row of a long list.
- Progress or score bars with filled gray tracks as comparison visuals on a landing page.
- Colored `border-left` thicker than 1px on cards and callouts.
- Monospace as a "technical" costume rather than for code, data, or labels.
- Custom mouse cursors. Emoji standing in for an icon system (unless the brief is playful/social-native).
- More than one marquee per page.
- Infinite-loop micro-animations on every card.

**Content**
- Em dashes. Lorem ipsum. Filler verbs. Fake-precise numbers. Generic names and brands.
- Div-built fake product UI. Text baked into generated images (always real markup).
- Pill-shaped "New" badges everywhere, 3-card testimonial carousels with dots, 4-column footer link farms, sun/moon toggles as the only theme control.

**The squint test**: blur the page until detail disappears. You should still be able to name the primary element, the secondary element, and the major groups, in order. If everything is one even gray field, the problem is hierarchy, and no shadow or motion fixes it.

---

# 4. Navigation

Navigation is orientation infrastructure, not decoration. Choose the least complex system that keeps the visitor oriented and the primary action available. Preserve the site's information architecture and brand.

## 4.1 Ship exactly one primary system

1. **Static**: in document flow, scrolls away. Default for short, simple, content-first pages where persistent chrome steals space.
2. **Sticky**: stays at the top edge once reached. Default for long marketing, commerce, docs, and conversion journeys that need persistent wayfinding or a CTA.
3. **Dynamic (scroll-reactive)**: sticky/fixed and intentionally changes with scroll (hide on scroll down and reveal on scroll up, compact after the hero, theme per section, active section). Only when the page is long or immersive enough for the recovered space or context to matter.
4. **Floating**: a persistent inset surface visibly detached from the viewport edges. For premium, focused sites with a small IA (3-6 items). Avoid with dense menus.
5. **Overlay**: a compact trigger opens a full-screen or near-full-screen navigation layer. For visual portfolios, editorial, agencies, immersive campaigns, where the menu is an intentional destination. Never hide high-frequency tasks behind it on utility-heavy sites.

Dropdowns, mega menus, search, announcement bars, breadcrumbs, and in-page anchors are features composed into the chosen system, not extra systems.

## 4.2 Selection procedure

Inspect the current site, routes, header, tokens, breakpoints, and dependencies first. Then, in order:

1. **Overlay** only when an immersive menu is a design requirement, or the visible IA cannot fit without harming the composition.
2. **Dynamic** only when scroll response has a named purpose: recover vertical space, preserve context, or adapt contrast. "It looks premium" is not a purpose.
3. **Floating** only when the inset silhouette supports the brand and the primary tier stays compact.
4. **Sticky** when persistent access has clear utility.
5. Otherwise **static**.

When reporting, name the chosen system and the evidence for it.

## 4.3 Anatomy and design rules

- Four ordered zones: brand/home, primary destinations, utilities, one primary CTA. Visually distinct groups. DOM order stays logical even when CSS realigns.
- Desktop primary tier: about 4-7 items. More means fix the hierarchy (grouping, dropdown, mega menu, search, secondary nav).
- Labels familiar and concrete, usually one or two words. Recognition beats cleverness.
- **Single line on desktop.** If items do not fit at about 1024px, shorten labels, drop secondary items, or collapse.
- Height: desktop 64-80px (default 64-72), mobile 56-68px. Never an "agency" bar eating 15% of the viewport.
- Container matches the page grid, usually `min(100% - 2rem, 75rem)`.
- Current location: `aria-current="page"` plus at least two visual cues that are not color alone (weight + underline, or shape + contrast).
- One dominant CTA. A secondary account action is text or a quiet outline, never a second filled button. Same CTA label and destination on desktop and mobile. No destructive actions in global nav.
- Hit targets at least 44x44px. The visible glyph is never the only clickable area.
- Solid surface by default. Translucency only with a solid fallback and contrast verified over real content in every hero/theme state.
- Shadows: static uses none or a border; sticky gets a small separation cue after scroll; floating gets a broad low-opacity shadow plus a subtle border; overlay needs none.
- Logo has explicit width or height and keeps its aspect ratio.
- Reserve space for fixed headers deliberately, and make anchors land below the header (`scroll-padding-top` on the scroller or `scroll-margin-top` on targets).
- Tokens for surface, text, muted, border, accent, focus, height, gutter, radius, shadow, motion. No scattered magic numbers.

## 4.4 System specs

**Static**
- Normal flow. No scroll observers, no placeholder offsets. Quiet bottom border or a spacing transition into the hero.
- Fragment links use real targets with `scroll-margin-top`.
- One CTA allowed when it is the page's clear next step; it need not persist. A mega menu usually means static is the wrong system.
- Navbar itself never animates on scroll. Long pages need contextual or footer wayfinding once the header is gone.

**Sticky**
- Prefer `position: sticky; top: 0` over `fixed` (keeps flow, no manual offsets). Audit ancestors: `overflow`, `transform`, and containment break sticky.
- Opaque or reliably contrasting surface. A border or shadow may appear after leaving the top (detect with an IntersectionObserver on a 1px marker above the header, not a scroll listener). That visual state does not make it dynamic.
- Safe-area top padding for edge-to-edge sites. No duplicate spacer for true sticky.
- On mobile keep it compact; persistent chrome should not exceed about 15% of the initial viewport.
- Sticky position is not animated. Separation styling transitions in 140-200ms.

**Dynamic**
- Start from an always-usable sticky/fixed bar. One passive scroll listener, coalesced through `requestAnimationFrame`, compared against the last committed position. (This is the one sanctioned raw scroll listener; everything else uses IntersectionObserver, ScrollTrigger, Motion `useScroll`, or CSS scroll-driven animations.)
- Always visible within the first 64-96px of the page. Hide/reveal needs 8-16px of accumulated movement in one direction (larger deadband on touch). Never hide while focus is inside, a menu is open, or reduced motion is on.
- Section theme changes come from authored section metadata via IntersectionObserver with a header-aligned root margin, never from sampling pixels.
- Animate only transform, opacity, background, border, and color. Hide/reveal is a direct 180-240ms translate, no bounce.
- Compact state keeps 44px targets; shrink whitespace, not targets.
- Must initialize correctly on refresh at a scrolled position. Never make critical navigation disappear based on scroll alone.

```tsx
// Dynamic navbar core: one passive listener, rAF-coalesced, deadband, always reveal near top / on focus / when menu open.
useEffect(() => {
  let previous = window.scrollY, frame = 0, accumulated = 0, direction = 0;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const update = () => {
    const current = window.scrollY;
    const delta = current - previous;
    const next = Math.sign(delta);
    accumulated = next === direction ? accumulated + Math.abs(delta) : Math.abs(delta);
    direction = next;
    setCompact(current > 48);
    if (current < 80 || reduced.matches || menuOpen.current || focusInside.current) setVisible(true);
    else if (accumulated >= 12) { setVisible(direction < 0); accumulated = 0; }
    previous = current;
    frame = 0;
  };
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener("scroll", onScroll, { passive: true });
  update();
  return () => { window.removeEventListener("scroll", onScroll); if (frame) cancelAnimationFrame(frame); };
}, []);
```

**Floating**
- Fixed or sticky with logical inset tokens, safe-area support (`top: max(1rem, env(safe-area-inset-top))`), and a page-width cap. Reserve hero space if fixed.
- Radius follows height; 16-24px usually reads more refined than a 999px cartoon pill.
- Broad, low-opacity shadow plus a subtle border. Solid fallback before any `backdrop-filter`.
- At narrow widths reduce outer inset and gaps; if logo plus 44px controls cannot fit, collapse. One compact CTA. Mega menus conflict with this form; pick sticky or overlay if IA is broad.
- Optional one-time entrance (240-320ms opacity + small translate), never replayed on scroll. No hover-lift on the whole bar.

**Overlay**
- Trigger is a native button with `aria-expanded` and `aria-controls`, visible and stable. The overlay renders near the document root (portal) to escape transform/stacking traps.
- It is a modal: `role="dialog"`, `aria-modal="true"`, a label, initial focus inside, Tab contained, Escape closes, background `inert`, body scroll locked (save and restore the previous overflow value), focus returns to the trigger, closes after navigation.
- Close button in the same corner as the trigger, reachable during internal scrolling and at 200%+ zoom. Internal `overflow-y: auto`, `dvh` with fallback, safe-area padding, tested in short landscape.
- Large typography only while labels stay scannable; secondary details (social, contact) visually subordinate. Nested nav uses accordions, never a modal inside the overlay.
- Motion: 280-360ms opacity/translate for the surface, links interactive as soon as visible, exit faster, instant under reduced motion. A hamburger that morphs into an X is fine; a stagger that delays orientation is not.

```tsx
// Overlay essentials: scroll lock, inert background, focus in, Tab trap, Escape, focus return.
useEffect(() => {
  if (!open) return;
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  const main = document.getElementById("main-content");
  main?.setAttribute("inert", "");
  requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus());
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") return setOpen(false);
    if (e.key !== "Tab" || !dialogRef.current) return;
    const nodes = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener("keydown", onKey);
  return () => {
    document.removeEventListener("keydown", onKey);
    document.body.style.overflow = prevOverflow;
    main?.removeAttribute("inert");
    triggerRef.current?.focus();
  };
}, [open]);
```

## 4.5 Dropdowns and mega menus

- **Dropdown** for about 3-8 closely related children. **Mega menu** when several labeled groups must be visible together (commerce, platforms, broad services). One or two children: expose them directly. A mega menu that looks like the sitemap means simplify the IA and move exhaustive links to the footer.
- Trigger is a button with `aria-expanded` and `aria-controls`. If the parent also has a destination, use a link plus an adjacent disclosure button, or include an "Overview" link inside. Never one target with two meanings.
- Click/tap is authoritative. Hover may preview on desktop only with an intent delay and a forgiving pointer corridor; keep open while pointer or focus is in trigger or panel.
- Escape closes and returns focus to the trigger. Outside click closes without stealing focus. Route change closes.
- **Do not use `role="menu"` / `menuitem` / arrow-key roving focus for site navigation.** It is a disclosure pattern, not an application menu.
- Dropdown rows are full-width targets; one flyout level max on desktop, becoming an accordion on touch.
- Mega menu: grouped by the user's mental model, 2-4 columns with plain headings, optional featured card that does not compete with the global CTA, kept inside the viewport. On mobile, stacked disclosure groups, never a scaled-down panel.
- Animate the panel as one surface, 140-220ms opacity/translate. Never animate layout height across a large mega menu.
- Reject it if the panel closes while moving toward it, cannot be exited by keyboard, leaves invisible focusable links in tab order, overflows the viewport, or relies on hover.

## 4.6 Responsive and mobile nav

- Mobile is a separate composition of the same IA, not a squeezed desktop row. One link model drives both; mobile may reorder but never silently drops destinations. Never duplicate nav markup with different link sets.
- Collapse at the first width where labels wrap or gaps break, measured with real labels, logo, CTA, translations, and zoom. Do not assume 768px.
- Visible on mobile: logo, menu trigger, at most one essential action. Everything else in the panel.
- Trigger: native `button`, accessible name (a visible "Menu" label is good), `aria-expanded`, `aria-controls`.
- Small menus: a disclosure panel under the header. Larger: a modal drawer or overlay with the full modal contract (focus trap, scroll lock, inert background, `aria-modal`).
- Links stacked with generous rhythm, 44-50px rows. Submenus are accordions opened by tap, never hover. Close control in a stable corner.
- Close the menu after client-side navigation and move focus per the router's accessibility strategy.
- Test at 320px, 400% zoom reflow, landscape, long translated labels, touch, and with the on-screen keyboard.

## 4.7 Accessibility contract

- `<header>` and `<nav aria-label="Primary">`. Multiple navs get unique labels (Primary, Utility, Footer, Breadcrumb).
- Skip link before the header, visible on focus.
- Real links for navigation, buttons for state. No nested interactive elements.
- DOM and tab order match the visual order. Every state works by keyboard. Focus never lands on off-screen controls.
- WCAG contrast: 4.5:1 text, 3:1 large text, UI graphics, and focus indicators.
- Actions fire on click/up, not pointer-down. Never block zoom.
- With JavaScript unavailable, core links stay reachable when the architecture allows.
- Icon-only controls have accessible names; decorative icons are `aria-hidden="true"`.

## 4.8 Nav motion and performance

- One motion grammar per navbar. Disclosure: about 180ms opacity + 4-8px translate. Mobile drawer: 220-300ms transform plus fading scrim. Overlay: 280-360ms. Exits 15-25% faster. Never delay link usability for stagger.
- Reduced motion: transitions effectively zero, smooth scroll off, but visibility and focus changes still happen.
- Navigation is first-paint infrastructure: small CSS, no heavy animation library for two-state transitions, no logo/menu visibility depending on hydration, font loading must not shift navbar geometry.

## 4.9 Nav verification gate

1. Pointer, keyboard, touch-sized viewport, reduced motion.
2. Open, close, Escape, outside click, focus containment, focus return.
3. Top, mid-page, direction changes, anchor jumps, route changes, refresh at a scrolled position.
4. Contrast in every theme and hero state, focus visibility, zoom/reflow, safe areas, no horizontal overflow from 320px up.
5. Active states come from the real router or URL; no demo `#` links.
6. Project lint, typecheck, tests, build. Visual inspection at desktop and mobile widths.

Common failures: dynamic behavior with no named benefit; `position: fixed` called sticky without content offset; hover-only dropdowns; tiny chevrons as the only target; glass that fails contrast over unpredictable content; animating `height: auto`; several scroll listeners; React re-rendering on every scroll pixel; closing a menu without restoring focus; an invisible layer left blocking the page.

---

# 5. Motion and animation

Motion communicates; it does not perform. Two failure modes, and the first is worse: animating something that should not animate, and animating the right thing with the wrong ingredients.

## 5.1 The build sequence (in order)

**Step 1. Should this animate at all?**

| How often it is seen | Decision |
| --- | --- |
| 100+ times a day (keyboard shortcuts, command palette) | No animation. Ever. |
| Tens of times a day (hovers, list navigation) | Near-imperceptible or nothing |
| Occasionally (modals, drawers, toasts) | Standard animation |
| Rarely / first time (onboarding, success, celebration) | Delight lives here |

Keyboard-initiated actions never animate. "No animation" is a valid, successful answer.

**Step 2. Name the purpose**: feedback, spatial consistency, state indication, preventing a jarring change, explanation (marketing/onboarding), or delight (rare tier only). Marketing-page motion may also serve hierarchy or storytelling. If you cannot name it in one sentence, do not build it. Data the user is reading should not move for style.

**Step 3. Cheapest tool that works**

| Need | Tool |
| --- | --- |
| Hover, press, color, class/attribute toggles | CSS transition |
| Entry on mount, no JS state | CSS `@starting-style` |
| Predetermined motion that must stay smooth while the page loads | CSS animation (off main thread) |
| Programmatic control with CSS performance | WAAPI (`element.animate()`) |
| Springs, layout animations, exits, gesture-driven values | Motion (`motion/react`) |
| Pinning, scrubbing, horizontal pans | GSAP + ScrollTrigger, isolated in client leaves with cleanup |
| Canvas / 3D | Three.js / WebGL, isolated, lazy-loaded |

Never mix GSAP or Three.js with Motion in the same component tree. If you need a component (dropdown, drawer, toast, command menu), use a headless accessible primitive rather than hand-rolling a `<div>` with no focus management.

**Step 4. Properties**

- `transform` and `opacity` only. `clip-path` is the sanctioned third (reveals, wipes). `height` is tolerated only for accordions. Never animate `width`, `height`, `top`, `left`, `margin`, `padding`. Never `transition: all`; name the properties.
- Never enter from `scale(0)`. Start at `scale(0.9-0.97)` plus `opacity: 0`.
- Popovers, dropdowns, tooltips scale from their trigger (`transform-origin: var(--transform-origin)`). Modals are exempt and stay centered.
- `translateY(100%)` moves by the element's own height; prefer percentages to hardcoded pixels.
- In Motion, prefer the full transform string (`animate={{ transform: "translateX(100px)" }}`) for elements animating while the page is busy; the `x`/`y`/`scale` shorthands run on the main thread and drop frames under load.
- Never drive a child's transform through a CSS variable on a parent (it recalculates styles for every child). Set `transform` on the element directly.
- `will-change: transform` only on elements actively animating.

**Step 5. Easing and duration**

| Situation | Easing |
| --- | --- |
| Entering or exiting | ease-out |
| Moving or morphing on screen | ease-in-out |
| Hover / color change | ease |
| Constant motion (marquee, progress, hold-to-confirm fill) | linear |

Never `ease-in` on UI; it delays the moment the eye is watching. Built-in curves are too weak; use these tokens (or extend the project's existing ones):

```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);       /* UI enter/exit */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);   /* on-screen movement */
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);    /* iOS-like drawers and sheets */
}
```

Need another curve: take it from easing.dev or easings.co, do not invent one.

| Element | Duration |
| --- | --- |
| Button press | 100-160ms |
| Tooltip, small popover | 125-200ms |
| Dropdown, select | 150-250ms |
| Modal, drawer | 200-500ms |
| Marketing reveals, explanatory motion | 500-900ms is fine |

UI animations stay under 300ms. A 180ms dropdown feels faster than a 400ms one.

**Springs** for drag with momentum, elements that should feel alive, interruptible gestures, and decorative pointer tracking:

```js
{ type: "spring", duration: 0.5, bounce: 0.2 }            // easy to reason about
{ type: "spring", mass: 1, stiffness: 100, damping: 20 }  // more control
```

Bounce 0.1-0.3, and avoid it in most UI (keep it for drag-to-dismiss and playful moments). Springs keep velocity when interrupted; keyframes restart from zero.

**Step 6. Interruption and exit**

- CSS transitions, not keyframes, for anything triggered rapidly (toasts, toggles); transitions retarget from the current value.
- Exit the way it entered. A toast from the bottom leaves through the bottom.
- Asymmetric timing: slow where the user is deciding (hold-to-confirm: 2s linear), fast where the system responds (release: 200ms ease-out). Exits are generally faster than entrances.

**Step 7. Reduced motion and pointer gating ship with the animation**

```css
@media (prefers-reduced-motion: reduce) {
  .element { animation: fade 0.2s ease; } /* keep opacity/color, drop movement */
}
@media (hover: hover) and (pointer: fine) {
  .element:hover { transform: scale(1.02); } /* touch fires false hovers on tap */
}
```

Reduced motion means fewer and gentler, not zero: keep opacity and color changes that aid comprehension; remove position changes, parallax, scroll hijacks, infinite loops, and magnetic physics.

## 5.2 Recipes

```css
/* Button press */
.button { transition: transform 160ms var(--ease-out); }
.button:active { transform: scale(0.97); }

/* Popover / dropdown / menu (origin-aware) */
.popover {
  transform-origin: var(--transform-origin);
  transition: opacity 200ms var(--ease-out), transform 200ms var(--ease-out);
}
.popover[data-starting-style], .popover[data-ending-style] { opacity: 0; transform: scale(0.95); }

/* Tooltip: once one is open, neighbours open instantly */
.tooltip { transition: transform 125ms var(--ease-out), opacity 125ms var(--ease-out); }
.tooltip[data-instant] { transition-duration: 0ms; }

/* Modal (centered) with backdrop fading alongside */
.modal { transition: opacity 250ms var(--ease-out), transform 250ms var(--ease-out); }
.modal[data-starting-style], .modal[data-ending-style] { opacity: 0; transform: scale(0.96); }

/* Drawer / sheet */
.drawer { transform: translateY(0); transition: transform 500ms var(--ease-drawer); }
.drawer[data-closed] { transform: translateY(100%); }

/* Toast entering with @starting-style */
.toast {
  transition: opacity 400ms ease, transform 400ms ease;
  @starting-style { opacity: 0; transform: translateY(100%); }
}

/* Stagger: 30-80ms between items, never blocking interaction */
.item { opacity: 0; transform: translateY(8px); animation: fadeIn 300ms var(--ease-out) forwards; }
.item:nth-child(2) { animation-delay: 50ms; }
.item:nth-child(3) { animation-delay: 100ms; }
@keyframes fadeIn { to { opacity: 1; transform: translateY(0); } }

/* Hold to confirm (destructive actions) */
.overlay { clip-path: inset(0 100% 0 0); transition: clip-path 200ms var(--ease-out); }
.button:active .overlay { clip-path: inset(0 0 0 0); transition: clip-path 2s linear; }

/* Scroll reveal (marketing only, fire once via IntersectionObserver or useInView({ once: true, margin: "-100px" })) */
.reveal { clip-path: inset(0 0 100% 0); transition: clip-path 600ms var(--ease-in-out); }
.reveal[data-visible] { clip-path: inset(0 0 0 0); }

/* Crossfade that will not settle: blur the seam (keep under 20px) */
.content.transitioning { filter: blur(2px); opacity: 0.7; }
```

More techniques:

- **Tabs with perfect color transitions**: duplicate the tab list, style the copy as active, clip it to the active tab, animate the clip.
- **Comparison slider**: two overlaid images, clip the top one with `inset(0 50% 0 0)`, drive the inset from drag.
- **Accordion**: animate measured height and opacity for about 200ms; never animate to `auto`.
- **Drag to dismiss**: dismiss on distance OR velocity (`Math.abs(dx) / ms > 0.11`); pointer capture once dragging starts; ignore extra touch points mid-drag; damping and rising friction past boundaries instead of hard walls; settle with a spring.
- **Pointer tracking**: interpolate with a spring (`useSpring`) rather than mapping directly; direct tracking has no momentum and feels artificial. Only for decoration, never functional UI.
- **Magnetic CTA / tilt / spotlight**: tilt 5-9 degrees (past 12 is a toy), magnet strength 0.2-0.35 on the primary CTA only, all gated to fine pointers and disabled under reduced motion. Drive with motion values (`useMotionValue`, `useTransform`), never `useState`.
- **Never use `useState` for continuous values** (scroll progress, mouse position). Use motion values or CSS custom properties.
- **Layout animations**: Motion `layout` / `layoutId` for real state changes (reordering, shared elements); do not wrap static content "for safety".
- **Marketing scroll reveals**: a gentle fade-up (opacity + 16-24px translate, optional small blur) over 500-800ms, fired once, on key sections. Not on every element of a page users revisit daily.

## 5.3 GSAP pin and pan skeletons

Real sticky stacks and horizontal pans pin at `start: "top top"`. Starting at `"top center"` or `"top 80%"` is the classic bug (half a slide visible before the pin).

```tsx
"use client";
// Sticky stack: each card pins; the NEXT card's arrival scales the previous one down.
useEffect(() => {
  if (reduce || !ref.current) return;
  const ctx = gsap.context(() => {
    const cards = gsap.utils.toArray<HTMLElement>(".stack-card");
    cards.forEach((card, i) => {
      if (i === cards.length - 1) return;
      ScrollTrigger.create({ trigger: card, start: "top top", endTrigger: cards[cards.length - 1], end: "top top", pin: true, pinSpacing: false });
      gsap.to(card, { scale: 0.92, opacity: 0.55, ease: "none",
        scrollTrigger: { trigger: cards[i + 1], start: "top bottom", end: "top top", scrub: true } });
    });
  }, ref);
  return () => ctx.revert();
}, [reduce]);

// Horizontal pan: pin the wrapper, scrub the inner track by its overflow distance.
useEffect(() => {
  if (reduce || !wrap.current || !track.current) return;
  const ctx = gsap.context(() => {
    const distance = track.current!.scrollWidth - window.innerWidth;
    gsap.to(track.current, { x: -distance, ease: "none",
      scrollTrigger: { trigger: wrap.current, start: "top top", end: () => `+=${distance}`, pin: true, scrub: 1, invalidateOnRefresh: true } });
  }, wrap);
  return () => ctx.revert();
}, [reduce]);
```

Every `useEffect` animation has strict cleanup. Use cards with `min-h-[100dvh]` and `sticky top-0`.

## 5.4 Performance

- CSS animations beat JS under load because they run off the main thread. Use CSS for predetermined motion and JS for dynamic, interruptible motion.
- WAAPI gives JS control with CSS performance and no bundle cost.
- `backdrop-filter` and large blurs are expensive, especially in Safari. Keep blur under 20px and off scrolling content.
- Lazy-load Motion-heavy and 3D sections below the fold.

## 5.5 Never ship

| Never | Instead |
| --- | --- |
| `transition: all` | Name the properties |
| `scale(0)` entrance | `scale(0.95)` + `opacity: 0` |
| `ease-in` on UI | `--ease-out` or a strong custom curve |
| Animation on keyboard shortcuts or 100+/day actions | No animation |
| UI duration over 300ms without a reason | 150-250ms |
| `transform-origin: center` on a trigger-anchored popover | `var(--transform-origin)` (modals exempt) |
| Keyframes on toasts and toggles | Transitions |
| Animating width/height/top/left/margin/padding | transform / opacity / clip-path |
| Ungated `:hover` motion | `(hover: hover) and (pointer: fine)` |
| Missing reduced-motion handling | A gentler variant |
| Everything appearing at once | 30-80ms stagger |
| `window.addEventListener("scroll")` driving animation | IntersectionObserver, ScrollTrigger, `useScroll`, CSS `animation-timeline` |
| Two marquees on one page | One, where it serves the content |

When reporting animation work, say in a few lines: the frequency tier and purpose, the ingredients (tool, properties, curve, duration or spring), and what needs a feel check (play at 2-5x duration, step frames in DevTools, test gestures on a real device, look again the next day).

---

# 6. Scroll-driven experiences

For sites where scroll is the timeline: video that scrubs under the wheel, pinned sections that advance, rails that pan sideways, headlines that assemble, grounds that shift color, pointer-reactive moments. The goal is an experience a visitor can describe afterwards, not a template with a video behind it.

## 6.1 Interview first, always

Ask before generating anything, in one pass:

1. The vibe in 3-5 words, plus up to three references from any medium (a film, an album cover, a magazine). Not "sites you like".
2. The scroll journey, section by section, in their words.
3. The energy curve: where calm, where intense.
4. How they should feel at each stage, and the ONE moment they should remember.
5. One thing this site should do that no site they have seen does (seed of the signature move).
6. How far from premium-minimal: brutalist, maximalist, playful, retro, dense, editorial, premium-minimal.
7. One unbroken world the camera flies through, or distinct scenes and chapters?
8. What assets they already own (footage, photos, product shots, brand kit). "Nothing" means a fully generated world.

Also: what must the visitor believe by the end (one sentence), and what is the one action (one CTA label, used everywhere). Ask the subject as an open question, never a made-up multiple-choice list of industries.

Write the answers verbatim into a `BRIEF.md` in the build folder, plus: the feeling curve, the peak, and the sentence "It's the site where ___" filled with an experience (not a device name). If the human is unreachable, write it yourself and mark it "Self-authored, not interviewed".

## 6.2 Journey, feeling curve, peak

- **Journey**: 4-7 beats, each a shift in what the visitor knows or feels (for example Recognition, Tension, Turn, Substance, Range, Commitment). A section that serves no beat is cut, however nice the shot.
- **Feeling curve before acts**: one line per act, the emotion first, then what on screen causes it. Two adjacent acts with the same feeling means one is filler. Relief needs tension before it, awe needs quiet before it, intimacy needs scale before it.
- **One peak** (peak-end rule): written as the sentence a visitor would tell a friend. The peak gets the asset budget, a quiet act or authored silence before it, and the largest scroll span on the page. Three peaks means none.
- **The ending resolves and holds.** The last screen arrives somewhere and stops; it never fades to nothing or just becomes a footer.
- **Pacing is emotion**: short acts and hard cuts read as adrenaline; a long pin reads as held breath; an empty viewport before a reveal reads as the drop; a slow settle mid-act reads as the shot landing. Compress the administrative parts (specs, FAQ, logistics) into ordinary flow sections. Total page length about 8-14 viewport heights.
- **Being in it**: one or two embodiment touches, not more (pointer parallax that moves the world, dwell-triggered detail, scroll velocity shaping grain or blur, one line that addresses "you" at the turn, a trace of where they have been). All gated to fine pointers and off under reduced motion; never the only carrier of meaning.

## 6.3 Pick a page grammar (structure, not skin)

A different color palette is not a different page. Pick one grammar deliberately; each forbids things:

1. **Filmic one-shot**: one linear arc, continuous handoffs. Forbids visible sequence, hard cuts, tool-like chrome. The default everyone drifts to; justify it.
2. **Chaptered editorial**: a printed feature. Title-page hero with no media above the fold, chapters with hard cuts and their own grounds, a folio in the margin instead of a fixed bar, colophon close with the CTA as a running-text link. Forbids full-bleed scrub heroes, continuous drift, magnetic CTAs.
3. **Live surface**: the page is the actual product running, and scroll drives its state. Forbids marketing chrome, scrims, kinetic headline stacks, fake div UIs.
4. **Continuous world**: one place the camera travels through (see 6.6).
5. **Typographic poster**: type is the image.
6. **Gallery / catalog**: the work or the range is the argument.
7. **Split stage**: two halves in dialogue.
8. **Rhythmic cutlist**: many short hard cuts, pulse over flow; paint grounds per section instead of drifting.

Do not blend two. If a grammar bans the device the peak wants, move the peak into persistent chrome rather than breaking the grammar.

**Signature move**: every build invents one bespoke interaction that lives on this site alone, coded in the page (not a parameter change to a stock effect). Examples of what counts: a persistent trace rail where scroll is the playhead and each section stamps a marker; a wordmark the pointer pulls apart that settles back into perfect lockup; an SVG technical drawing whose stroke draws itself with scroll, then dimension lines, then callouts; a running receipt that totals real figures as claims pass; one control (time of day, temperature) that regrades the whole page at once. A recolored spotlight, a stronger tilt, or a third video is not one.

**Do not repeat yourself**: if you keep a log of past builds, compare grammar, nav treatment, hero device, act sequence (order, count, total length), close pattern, and signature move. A new build should differ from every previous one on at least four of six.

## 6.4 The device kit

Assign each beat a device and write the score as a table (beat, device, why). Rules: at least four device families per page, never the same device twice in a row, at most two video scrub acts, one reason per act.

- **Scrub**: a pre-rendered camera move plays under the wheel. Spend it on the open or the peak. Hero span about 2.2-3.0 viewport heights (under 1.8 it flies past, over 3.5 it feels broken). Add a "dwell" remap so the camera settles mid-act exactly where the copy peaks. Map the clip across the stage's entire visible life (including its slide in and slide out), not just the pinned travel, or the film freezes while the stage slides, which reads as the site breaking. Lerp the playhead toward the scroll target (about 0.18 per frame), use a deadband (about 8ms desktop, 20ms mobile), and never queue a new seek while one is resolving. Keep the poster image up until a real video frame has painted.
- **Pin**: the stage holds while copy states cross over inside it. Minimum useful span about 1.2 viewports (below that progress snaps 0 to 1). Overlap cue windows by about 15% so the reader never faces empty space.
- **Pan**: vertical scroll, lateral travel. Reads as "options" or "range".
- **Reveal**: a wipe (clip-path) is a change of state; use at turns and chapter boundaries.
- **Kinetic**: type that assembles line by line.
- **Parallax**: layers at slightly different rates. Cut the hero into planes with the product between mid and foreground; add scale, blur, and lower contrast for distance or it reads as sliding.
- **Count**: numbers that land. Real numbers only.
- **Flow**: ordinary sections done well, with entrance stagger.
- **Pointer**: tilt, magnet, spotlight. Interpolated, fine-pointer only.
- **Drift**: the page ground interpolates between 3-5 close stops within one theme family as acts take over. If several short acts can be part-way through at once, paint grounds per section instead.

Text over scrubbing video: real markup (never text baked into frames), a scrim that is a sibling of the copy (not a child pseudo-element), contrast measured on the brightest frame. Vary copy anchors (lead, trail, center, split), not centered in every act. No scroll cues, no `01 / 06` counters, no eyebrow on every act.

## 6.5 Worlds and assets

- **Default to photographic** unless the brand is genuinely illustrated. Soft matte clay diorama / low-poly / claymation is banned as a default. Useful worlds: low-key cinematic, high-key editorial, natural documentary, hard-light graphic, macro texture, architectural, nocturne, technical drawing.
- One style preamble, reused verbatim in every still and clip prompt. Review every frame and reroll anything off-style.
- Real footage and photos from the client beat generated ones; grade them to the world.
- No audio on scrub clips.

**Encode for scrubbing, not playback** (seeking walks from the previous keyframe):

```bash
# Desktop: native resolution, small GOP, no audio, faststart, light sharpening
ffmpeg -i src.mp4 -an -vf "unsharp=5:5:0.8:5:5:0.0" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart out.mp4

# Mobile: 720 wide, denser keyframes (phone decoders pay per GOP length)
ffmpeg -i src.mp4 -an -vf "scale=720:-2" -c:v libx264 -preset slow -crf 23 \
  -pix_fmt yuv420p -g 4 -keyint_min 4 -sc_threshold 0 -movflags +faststart out-m.mp4
```

- **Fetch clips as a Blob and play from an object URL.** Many hosts do not serve byte ranges, which pins `video.seekable` to `[0,0]` and freezes every seek on frame 0. Blobs are always seekable, so all-intra encodes are unnecessary.
- Serve `-m.mp4` variants on coarse pointers or narrow screens. A real mobile version is natively portrait (9:16), not a center crop; if only crops are possible, say so.
- iOS keeps a muted, never-played video blank after seeking: keep the poster until a frame paints, keep `playsinline muted`, and prime each video on first touch.
- Ignore height-only resizes on touch (URL bar show/hide) or the page jumps.
- Under reduced motion, skip clip fetches and show the stills.

## 6.6 Continuous camera flights (one unbroken world)

When the brief is literally one continuous journey, the visitor flies from scene to scene with no visible cuts.

- **Seams must be frame-identical.** Each generated clip starts from the previous clip's actual last rendered frame, never from the original still (every render differs slightly; a still at the seam causes a visible pop).
- **Architecture A, continuous forward take** (grounded, photoreal, walkthroughs): generate legs sequentially, each leg's start image = previous leg's extracted last frame, prompt "continue gliding smoothly forward into <scene>, never pulling back", no end image. No connectors.
- **Architecture B, dive in plus aerial connector** (miniature, map-like worlds only): each scene gets a dive-in clip; each connector starts on the previous dive's last frame and ends on the next dive's first frame. The pull-out reverses camera direction at every seam, which reads as charming in miniature and as a rewind stutter in realism.
- **Motion handoff contract**: inside a leg the camera is free (orbit, crane, track), but every leg ends by settling into a slow forward drift and the next begins by continuing it. Velocity must never reverse across a seam; remember visitors scroll backwards too.
- One video model for the whole chain; mixing models shifts grain and motion character at the seam.
- A short crossfade at each seam is insurance, never a substitute for the frame handoff.
- Extract boundary frames with ffmpeg: `ffmpeg -sseof -0.15 -i leg.mp4 -frames:v 1 -q:v 2 last.png` and `ffmpeg -ss 0 -i next.mp4 -frames:v 1 -q:v 2 first.png`.
- Generation is slow and sometimes flagged by content filters on innocuous interiors (bed, pool, spa, wine). Reroll, strip trigger words and add "empty, unoccupied, architectural", or switch provider for that single clip. Calibrate costs with one still and one clip, state the estimate, and get a go before spending.
- QA: screenshot just before and just after every seam; judge by composition, not raw pixel difference.

## 6.7 Verify by scrolling it

A scroll page has no single state. Serve it on localhost and capture each act at several scroll positions (desktop, a 390x844 phone, and reduced motion), waiting for the video playhead to settle before each shot. Check for:

- Dead scroll (screens where nothing is happening that you did not author as silence).
- Cues that never reach full opacity; clips that freeze while their stage slides.
- Contrast on the composited page at the brightest frame under each line of text.
- Focus order by tabbing through.
- `video.seekable.end(0) > 0`, `currentTime` tracking scroll, and no console errors.

Then look at the contact sheet yourself, scroll the page cold, write one word per act for what you felt, and diff it against the intended curve in `BRIEF.md`. Where they disagree, the page is wrong. Confirm the peak is the biggest change and holds the most scroll, and the last screen resolves.

Say plainly what a green run does not cover: a real phone (video decoder, autoplay policy, Low Power Mode, touch scrolling). When a mobile defect is reported, put a small diagnostic page on the device first rather than theorizing from a desktop.

Report: the grammar and why the others lost, the signature move, the journey, the feeling curve and peak, the feel-check diff, the score table, what was generated, what was verified, and what was not.

---

# 7. Feeling native on mobile

A desktop browser with device emulation is not a phone. Most "it feels janky on mobile" reports are not animation problems; they are a tap delay, a gray flash, or a hover state that will not let go. Almost every fix is one declaration. Use capability media queries, never user-agent sniffing, and remember touch and mouse are not exclusive (iPads with trackpads, touchscreen laptops).

## 7.1 Symptom table

| Problem | Fix |
| --- | --- |
| Hover state stuck after tap | Wrap hover styles in `@media (hover: hover) and (pointer: fine)` |
| Gray/blue flash on tap | `-webkit-tap-highlight-color: transparent` on `html`, then give every tappable element its own `:active` |
| Layout has the wrong height | `100dvh` for app shells, drawers, bottom-pinned UI; `100svh` for heroes |
| Page zooms into an input | Inputs at least 16px font size (never `maximum-scale=1` or `user-scalable=no`) |
| Tap feels laggy | `touch-action: manipulation` on controls; feedback on `:active` / `pointerdown`, not `click` |
| Pull-to-refresh hijacks scroll | `overscroll-behavior: none` on `html, body`; `contain` on inner scrollers |
| Content stops at the notch | `viewport-fit=cover` plus `env(safe-area-inset-*)` padding |
| Long-press selects button text | `user-select: none` and `-webkit-touch-callout: none` on controls only, never on `body` |
| Carousel scrolls the page vertically | `touch-action: pan-y` on a horizontal carousel; or native `scroll-snap-type: x mandatory` |
| Status bar color mismatched | One `theme-color` per color scheme, matching the top of the page |
| Right in Chrome, wrong on the phone | Test on real hardware |

## 7.2 Baseline (ship before the first component)

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0a0a0a" />
<meta name="color-scheme" content="light dark" />
```

```css
html {
  -webkit-tap-highlight-color: transparent;
  -webkit-text-size-adjust: 100%;
  overscroll-behavior: none; /* drop this for a plain scrolling document where pull-to-refresh is welcome */
}
input, textarea, select { font-size: 16px; }
button, a, [role="button"] {
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}
.app-header { padding-top: env(safe-area-inset-top); }
.bottom-bar { padding-bottom: env(safe-area-inset-bottom, 0px); }
.sheet { padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px)); }
.sheet-content { overflow-y: auto; overscroll-behavior: contain; }
@media (hover: hover) and (pointer: fine) {
  /* all :hover rules live here */
}
```

Also set the keyboard: `inputmode="numeric"` for codes, `inputmode="decimal"` for amounts, `type="email"` and `type="tel"`, `autocapitalize="none"` and `autocorrect="off"` for usernames and codes, `enterkeyhint="send" | "search" | "done"`. In Next.js set theme color through the `viewport` export. In Tailwind v4 `hover:` is already gated; in v3 enable `future.hoverOnlyWhenSupported`.

`touch-action` names what the browser may still do: `pan-y` on a horizontal carousel (browser keeps vertical), `none` only on a surface that truly handles every axis (a slider, a drag-to-dismiss sheet), `pan-x` on a vertical sheet handle. Never use `touchmove` + `preventDefault()` to stop overscroll.

## 7.3 Test on hardware

Run the dev server on `0.0.0.0`, open it by LAN IP on the phone, inspect with Safari Develop (iOS) or `chrome://inspect` (Android). Test an older phone, keyboard open, landscape once, and as an installed PWA if that is a target. When you cannot run hardware, say which fixes are verified from code and which the user must confirm on a device.

---

# 8. Redesigning an existing site

Misclassifying the mode is the biggest source of bad redesigns.

## 8.1 Detect the mode

- **Greenfield**: no existing site, or full overhaul approved.
- **Redesign, preserve**: modernize without breaking the brand. Audit first, extract tokens, evolve.
- **Redesign, overhaul**: new visual language over existing content and IA.

If ambiguous, ask once: "Should this preserve the existing brand, or start visually from scratch?"

## 8.2 Sequence

1. **Scan**: framework, styling method, Tailwind version, current patterns.
2. **Audit**, documenting: brand tokens; IA (page tree, nav, conversion paths); what content is working and what is filler; signature patterns to keep; AI tells, broken layouts, dead links, generic stock, performance traps to retire; the current dial reading; the SEO baseline (ranking pages, titles, structured data, OG cards). SEO migration is the number one redesign risk.
3. **Fix** with targeted upgrades in the existing stack. Do not rewrite from scratch, do not migrate frameworks or styling libraries, test after every change, keep changes reviewable.

## 8.3 Audit checklist

- **Type**: browser defaults or Inter everywhere; weak headlines; paragraphs wider than 65ch; only 400/700 weights; proportional numbers in data; no tracking adjustments; orphans.
- **Color**: pure black; oversaturated or multiple accents; mixed warm and cool grays; AI-purple gradients; untinted shadows; flat sections with no depth; random dark section in a light page; inconsistent light direction.
- **Layout**: everything centered; three equal cards; `100vh`; flex percentage math; no max-width; forced equal heights; identical radius on everything; no overlap or depth; cramped spacing; CTAs at random heights in card rows; misaligned baselines across columns.
- **States**: no hover, no pressed, no focus ring, no loading, empty, or error states; dead `#` links; no current-page indication; instant zero-duration transitions; animations on layout properties.
- **Content**: generic names, round fake numbers, startup-slop brand names, AI clichés, exclamation marks, "Oops!", passive voice, identical blog dates, repeated avatars, lorem ipsum, Title Case.
- **Components**: generic bordered cards; always filled + ghost button pairs; pill "New" badges; accordion FAQ by reflex; 3-card testimonial carousel; three-tower pricing distinguished only by height; modals for everything; only circle avatars; 4-column footer link farm.
- **Icons**: Lucide/Feather by default, cliché metaphors, mixed stroke widths, missing favicon, uncanny stock "team" photos.
- **Code**: div soup, inline styles, hardcoded pixel widths, missing alt text, z-index 9999, dead code, imports that do not exist, missing meta and OG tags.
- **Omissions**: legal links, back navigation, custom 404, form validation, skip link, cookie consent where required.

## 8.4 Fix priority (stop when the brief is satisfied)

1. Typography refresh (biggest lift, lowest risk).
2. Color cleanup (one accent, one gray family, desaturate).
3. Hover, active, and focus states.
4. Layout and spacing (grid, max-width, rhythm).
5. Replace generic components; recompose the hero and key sections.
6. Loading, empty, and error states.
7. Motion layer appropriate to the dial.
8. Full block replacement only when a block is unsalvageable.

If IA, content, and SEO are sound, targeted evolution (steps 1-4) gives most of the value at a fraction of the risk. Full redesign only when the debt is structural.

## 8.5 Never change silently

URL structure and slugs, primary nav labels, form field names and order (they break analytics and autofill), anchor IDs and section IDs that tracking depends on, the logo or wordmark, and legal/consent/cookie copy. Preserve the copy voice unless asked for a rewrite, and never regress existing accessibility wins. A brand that is already purple stays purple.

---

# 9. Admin OS: a private back office behind a website

The admin is the client's operating system for their business. A non-technical owner opens it daily to answer "what needs me today?" and then does the work: reply to a lead, publish an article, add a product, export a list. Plain language, few clicks, no surprises, nothing they can break. The public site and the admin share one database, one token set, and one set of rendering components, so what the owner previews is exactly what visitors see.

Not for public-site visual design, navigation, or multi-tenant SaaS.

## 9.1 Required outcome

1. **Access gate**: identity from a trusted provider, an allow-list, owner and admin roles, re-checked on every request.
2. **Shell**: sidebar nav, page-header pattern, shared UI kit (cards, metrics, tables, pills, forms, alerts, empty states).
3. **Overview**: greeting, setup checklist, four KPI tiles, "latest / top" lists linking into modules.
4. **Only the business modules the client actually runs.**
5. **Settings**: business details, legal/consent copy, admin access.
6. **Security guarantees on every write.**

## 9.2 Workflow

1. **Discover**: interview the client; output a module list, a data-boundary decision (health, financial, or children's data stays out of marketing tools and free-text notes), and a phase plan in `PRODUCT-PLAN.md`.
2. **Model the data first**: each module is one or two tables, plus a key/value `settings` table.
3. **Foundation**: auth, security helpers, shell, UI kit, Overview skeleton.
4. **Modules one at a time as vertical slices**: schema + migration, public write endpoint (if any), admin list, editor/detail, server actions, revalidation, export, empty state, Overview tile.
5. **Wire the public site** to published data only, through loaders that never throw.
6. **Verify** with the QA list (9.8).

## 9.3 Module menu

| Module | When the business has |
| --- | --- |
| Content / blog | articles, news, guides, case studies |
| Testimonials | social proof on the site |
| Catalog | products, services, affiliate links, menu items, portfolio, with images, order, publish state |
| Leads / enquiries | contact, booking, quote, or discovery-call requests (status new, contacted, booked, closed) |
| Newsletter / audience | an email list with marketing consent |
| Forms, surveys, quizzes | scored questionnaires, intake, applications |
| Media uploads | any image the owner can change |
| CSV exports | any list the owner takes elsewhere |
| Settings | always |

Defer payments, customer accounts, course libraries, email builders, and automation builders. Link out to the specialist (Stripe, Brevo/Mailchimp, Calendly) and show synced summaries instead of rebuilding them.

## 9.4 Data model rules

- Every table gets `id` and `created_at`; editable content also `updated_at`.
- Content has an explicit `status` (`draft | published`). The public site reads published rows only.
- Enums in the schema plus a matching `as const` array in code for validation.
- Counters live on the row (`views`, `clicks`), incremented atomically (`SET x = x + 1`). Add an events table only when time series are genuinely needed; never fake trends from totals.
- Settings are key/value with defaults in code, merged on read, so new settings need no migration.
- Subscribers unsubscribe softly (status) and can also be hard-deleted. Deleting a child keeps the parent (`ON DELETE SET NULL`).
- Store consent as the exact text the person agreed to, plus a timestamp, on the row.
- Seed starter content so the site never launches empty.
- Public loaders catch their own errors and return an empty state. A database problem never takes down the homepage.
- After every write, revalidate the admin layout and every public path that shows that data (one `revalidateX()` helper per module). Settings changes revalidate the whole site layout.

Typical layout (Next.js App Router): `app/admin/layout.tsx` (gate + shell, `noindex`, `force-dynamic`), `app/admin/actions.ts` (all mutations, grouped by module with section banners), `app/admin/<module>/page.tsx | new | [id] | export/route.ts`, `app/admin/upload/route.ts`, public writes in `app/api/*`, outbound click tracking in `app/go/[slug]`, file serving in `app/files/[...key]`, shared client-safe code in `lib/<module>-shared.ts` and server loaders in `lib/<module>.ts`. Prefix admin CSS classes (`ad-`) and build them on the site's existing tokens.

## 9.5 Security (non-negotiable)

- Private: `noindex, nofollow`, disallowed in robots.txt, absent from the sitemap, dynamically rendered (never statically cached), no admin data in public bundles.
- Identity only from a verified source (provider session, edge-injected headers). Never from a cookie you parse yourself, a query string, or a form field.
- **Every** admin page, route handler, and server action checks authorization itself. The layout gate is UX, not a security boundary. Never rely on hiding a button.
- Every mutation passes a same-origin (CSRF) check inside the shared `assertAdmin()`: reject when `sec-fetch-site` is present and not `same-origin`/`none`, and when the `Origin` host does not match `host` / `x-forwarded-host`.
- Fail closed: if the allow-list cannot be read, only env-configured owners get in. Invited admins cannot change the access list (field read-only and ignored server-side). Dev test users are rejected in production.
- Validate and clamp every input server-side: one `str(form, key)` helper, `.slice(0, N)` on every text field, enums via `ALLOWED.find(s => s === input) ?? default` (never cast), URLs must be `https?://`, recompute scores, totals, and slugs on the server.
- Public endpoints: honeypot field (filled means respond success and store nothing), email validation, consent booleans must be exactly `true`, accept JSON and HTML form posts (JSON response or 303 redirect with `?status=ok#anchor`, so forms work without JavaScript), upsert subscribers on email, counters touch published rows only, rate limit if spammed.
- Files: detect type from magic bytes (JPEG, PNG, GIF, WebP, AVIF only; no SVG), check size before and after reading, server-generated keys `<folder>/<timestamp>-<uuid>.<ext>` from an allow-listed folder, serving route rejects `..` and leading `/`, sets `x-content-type-options: nosniff` and `content-security-policy: default-src 'none'; sandbox`, forces non-images to download. Replacing or deleting an item deletes its old file.
- CSV: prefix cells starting with `= + - @` with `'`, quote cells containing quotes, commas, or newlines, `\r\n` rows, `text/csv; charset=utf-8`, attachment filename with date, `cache-control: private, no-store`. Export URLs return 403 when signed out.
- Outbound redirects only to URLs stored by an admin on published rows, never from the query string.
- Render user text as text. Never `dangerouslySetInnerHTML` on owner or visitor content; parse any light markup into elements yourself.

## 9.6 Owner experience

- Labels in the owner's words ("Waiting for a reply", "Why we recommend it"), not schema names.
- Every list has an empty state explaining what will appear and offering the first action.
- Editors show a live preview built from the real public component, never a lookalike.
- After saving, redirect to the list with a confirmation that names the item ("Saved. "X" is up to date.").
- Errors inline at the top of the form, one human sentence saying how to fix it, typed values preserved.
- Buttons show a pending label and disable while running, so nothing double-submits.
- Deletes confirm by naming the item and the consequence ("Delete "X"? This can't be undone." / "The lead stays in Leads.").
- Toggles show state and action (`[Published] Unpublish`, `Featured / Feature`).
- Helper text prevents mistakes ("Lower numbers appear first.", "Leave empty to use the default photo.").
- Warm, short, second-person voice. Greeting uses the client's timezone, not the server's.

## 9.7 Shell and Overview

- Grid: about 16rem sidebar plus main, `min-height: 100dvh`. Sidebar sticky, brand mark + "<Client> Admin", nav, footer with "View website", user name, sign out. At 860px and below the sidebar becomes a sticky top bar with a horizontally scrolling nav, and grids collapse to one column.
- Nav order follows daily priority: Overview, content modules, audience and leads, submissions, Settings last. Active item via `aria-current`.
- Page header on every page: eyebrow (module group, or a back link on detail pages), title, actions (ghost "View on site" / "Export CSV", one primary "+ Add X"). Exactly one primary button per view.
- Components: card, card head with "See all", metric tiles (4, then 2, then 1 column; the tile is a link into the filtered module), scrollable tables with right-aligned tabular numbers, thumbnail cells, row actions, status pills (published green, draft amber, new blue), URL-driven filter tabs with counts, search toolbar as a GET form, success and error alerts, empty states, forms with labels above and helpers below, editor plus sticky live preview, image picker with URL fallback, danger zone at the bottom.
- Admin motion: 160-180ms color/opacity only, no layout animation. Targets at least 2.5rem for primary buttons, 2rem for row actions. AA contrast, including white text on a dark sidebar and on pills.
- **Overview**: greeting with first name; a setup checklist built from real data checks that disappears when complete; exactly four KPIs: one action-needed (new leads, pending submissions), one audience, one content reach, one revenue proxy (clicks, bookings, orders), each with a context line; then two-column "latest" lists (5 rows, "See all", one-sentence empty states). Load everything in one `Promise.all` with SQL `count()` / `sum()`, never by loading rows (`sum()` returns a string or null: `Number(x ?? 0)`).

## 9.8 QA before handover

- Signed out, every admin route shows the sign-in gate and returns after sign-in. A non-listed email sees a forbidden screen with a switch-account link. Cross-origin POSTs to actions and upload are blocked.
- Every module: empty state, create, edit (preview matches the public page), validation errors keep typed values, publish/unpublish updates the public site immediately, delete confirms and removes files, pending states prevent duplicates, filters are URL-driven with correct counts, very long names and URLs do not break layout.
- Public pages show only published rows and still render if the DB errors. Forms work with JavaScript disabled. Honeypot swallows bots. Consent text stored. Unknown or draft `/go/` slugs fall back to the catalog page.
- Renamed `.html` or `.svg` uploads rejected; oversized files rejected with a friendly message.
- Tested at 1440x900, 1280x720, 768, and 375 wide. Keyboard-only works with visible focus.
- Handover: owner emails configured in env, seed content migrated, a short guide for the owner (how to add, publish, and follow up on leads), and project notes updated with the data boundary, providers chosen, and deferred modules.

---

# 10. Brand-kit image boards

For generating a premium brand-guidelines board, logo system, or identity deck as an image. The board is a visual argument for why the brand exists, not decoration.

## 10.1 Strategy first

Infer category, audience, product function, emotional promise, cultural position, trust level, the core metaphor, and what the brand must avoid. Every board answers: what does the brand represent, what is the metaphor, how does the logo express it, how does the system scale across UI, print, image, and detail, and why is it ownable.

| Category | Core ideas | Symbol logic |
| --- | --- | --- |
| Developer tool | building, speed, precision | cursor, frame, scaffold, grid |
| AI assistant | delegation, clarity | spark, orbit, signal, path |
| Security | protection, vigilance | shield, eye, seal, protected core |
| Voice / audio | rhythm, command | waveform, orb, speech path |
| Compliance / legal | trust, order | seal, badge, document, monogram |
| Luxury / editorial | taste, ritual, restraint | monogram, emboss, vessel |
| Productivity | focus, momentum | path, check, block, light |

## 10.2 The logo

Simple, memorable, symbolic, scalable, ownable, usable as icon, wordmark, badge, UI mark, and pattern. Use one or at most two methods: monogram plus meaning (an initial cut, folded, or completed by a metaphor); product action made abstract; metaphor fusion of two ideas; crisp negative space (hidden arrow, protected center, cutout); construction geometry (circles, diagonal cuts, modular blocks). Avoid generic bolts and sparkles, random animals, fake crests, clipart, copies of famous marks, and inconsistent variants.

## 10.3 Layout and panels

Default: one overview image, 3x3 grid, 4:3 or 16:10, consistent gutters, minimal text. Other layouts: 2x3 deck, 2x2 concept, 1x3 strip, 4x2 contact sheet.

Default 3x3: logo cover; logo construction; digital application (browser bar, app header, terminal, app icon); brand essence tagline; color system; typography specimen; physical application (card, badge, label, packaging); image direction (cinematic, halftone, material); system detail (UI chips, input bar, icon row, pattern). Give the board rhythm: quiet, functional, emotional, technical, atmospheric, detailed. Not every panel equally loud.

Visual modes to choose from: dark developer/builder (near-black, mono accents, terminal, grid); dark product/operator (black, amber/red, chips, flows); dark nature/calm (deep green, lime, misty landscapes); dark security (navy, radar lines, alert chips); light editorial/compliance (ivory, paper texture, seals, deep blue and red); luxury/beauty (stone, serif wordmark, emboss, editorial crops); voice/communication (indigo, lilac, waveforms); cultural/experimental (halftone, CRT, poster panels, one bold accent).

## 10.4 Rules

- Very little text: brand name, one short specific tagline ("Nothing random.", "On guard."), a URL or command, 2-5 labels, short UI chips. No paragraphs, tiny fake copy, or lorem ipsum.
- One dominant palette (base, primary accent, secondary accent, neutrals) with accents repeating across panels. No rainbow, no default purple-blue glow unless it fits.
- Images art-directed and matched to palette and metaphor; no generic stock people or robot clichés.
- Mockups are identity applications, minimal and believable, not feature demos or busy dashboards.
- Premium detail rewards looking closer (page numbers, alignment marks, thin rules, low-opacity texture), used sparingly.
- With references: extract rhythm, grid, spacing, type scale, density, image treatment; never copy their logo, name, composition, or slogan.

Prompt skeleton: brand name; strategy (category, audience, personality, core metaphor, logo idea); layout and canvas; panel list; visual mode; palette; style ("premium, sparse, cinematic, brand-guidelines deck, no clutter, no copied real-world logos"); typography ("readable, minimal, high hierarchy, no tiny fake text"); logo ("symbolic, simple, ownable, repeated consistently across panels").

---

# 11. Working loop: references, screenshots, verification

## 11.1 Matching a reference image

- Match layout, spacing, typography, and color exactly. Swap in placeholder content. Do not add sections or "improve" the reference.
- Serve on localhost (never screenshot a `file://` URL). If a dev server is already running, do not start a second one.
- Screenshot, compare against the reference, list specific mismatches ("heading is 32px, reference is about 24px", "card gap 16px, should be 24px"), fix, screenshot again. At least two comparison rounds; stop when no visible differences remain or the user says so.
- Check spacing, font size, weight, line height, exact colors, alignment, radius, shadows, and image sizing.

## 11.2 Verifying any build

- Screenshot at desktop (1440 and a short 1280x720 laptop), tablet (768), and phone (375-390). Look at the images; do not assume.
- Both color modes if dark mode exists. Reduced motion on.
- Keyboard pass: tab through everything, check focus visibility and order.
- Console clean, no 404s on assets, no horizontal overflow from 320px.
- Run the project's lint, typecheck, tests, and build.
- Report what you verified and what you could not (for example, real-phone behavior).

---

# 12. Final pre-flight checklist

If any box cannot honestly be ticked, the work is not done.

**Read and plan**
- [ ] Design read declared; dials set and reasoned; design system or aesthetic named honestly.
- [ ] Redesign mode detected and audit done (if applicable); nothing in 8.5 changed silently.
- [ ] Brand assets checked and used.

**Copy**
- [ ] Zero em dashes or en dashes anywhere visible.
- [ ] Every string re-read; no filler verbs, fake stats, generic names, lorem ipsum.
- [ ] One label per CTA intent; CTAs 1-3 words, one line at desktop, readable contrast.

**Visual system**
- [ ] One theme for the page; one accent; one gray family; no pure black.
- [ ] One radius system; shadows tinted with offset; cards only where they earn it.
- [ ] Fonts: max two families; no default Inter, Fraunces, or Instrument Serif without reason; italic descenders clear.
- [ ] Premium-consumer brief does not use cream + brass + espresso by default.

**Layout**
- [ ] Hero fits the viewport, max 4 text elements, top padding capped, real visual.
- [ ] Eyebrows at most one per three sections; no section numbers, scroll cues, version stamps, decoration strips, locale strips.
- [ ] No three equal cards, no split headers, no 3+ zigzags, no repeated layout family, bento cell count exact.
- [ ] Explicit mobile collapse per section; `min-h-[100svh]` / `100dvh`, never `h-screen`.
- [ ] Real images; no div-built fake screenshots; logo walls are logos only.

**Navigation**
- [ ] One of the five systems, chosen with stated evidence.
- [ ] Single line on desktop, height within 64-80px, 44px targets, `aria-current` with two cues.
- [ ] Mobile trigger is a button with `aria-expanded` / `aria-controls`; Escape, focus trap where modal, focus return, scroll lock restored.
- [ ] Anchors land below the header; no `role="menu"` on site nav; nav passes the 4.9 gate.

**Motion**
- [ ] Every animation has a named purpose; nothing animates on keyboard-driven or very frequent actions.
- [ ] Only transform, opacity, clip-path; no `transition: all`; no `scale(0)`; no `ease-in` on UI.
- [ ] UI durations under 300ms; exits faster; stagger 30-80ms.
- [ ] Hover gated to fine pointers; reduced motion handled; `useEffect` animations cleaned up.
- [ ] No raw scroll listeners except the single passive rAF nav listener; pins start at `"top top"`.

**Mobile, accessibility, performance**
- [ ] Mobile baseline applied (16px inputs, tap highlight, safe areas, theme-color per scheme, `touch-action`).
- [ ] Skip link, semantic landmarks, logical tab order, visible focus, AA contrast measured on the render.
- [ ] Every interactive element has hover, focus-visible, active, disabled; loading, empty, and error states exist.
- [ ] Core Web Vitals plausible; images sized; heavy sections lazy-loaded; blur and grain off scrolling content.
- [ ] Screenshots taken at desktop and phone widths and actually looked at; build passes.

---

# Appendix A: animation vocabulary

Use these exact terms to describe or request motion. When a description is vague, map the feeling to the closest term and name close alternates.

**Entrances and exits**: Fade in/out (opacity). Slide in (from off-screen). Scale in (grows from smaller, usually with fade). Pop in (slight overshoot). Reveal (uncovered via clip-path or mask). Enter/exit (plays on add/remove).

**Sequencing**: Keyframes (defined points the browser fills between). Interpolation/tween (generated in-between frames). Stagger (items one after another with small delays). Orchestration (several animations timed as one motion). Delay. Duration. Fill mode (keeps first or last frame styles). Stepped animation (discrete steps).

**Transforms**: Translate, Scale, Rotate, Skew, 3D tilt/flip (rotateX/rotateY), Perspective (lower value exaggerates depth), Transform origin (the anchor point), Origin-aware animation (grows out of its trigger instead of its own center).

**State transitions**: Crossfade (one fades out as another fades in, same spot). Continuity transition (connects before and after so the user stays oriented). Morph (one shape becomes another, like Dynamic Island). Shared element transition (an element travels and transforms into another position, thumbnail into card). Layout animation (size or position change animates instead of snapping). Accordion/collapse. Direction-aware transition (forward slides one way, back the other).

**Scroll**: Scroll reveal (enters as it reaches the viewport). Scroll-driven animation (progress tied to scroll position). Parallax (layers at different speeds). Page transition. View transition (browser morphs between states or pages via shared elements). Scrub (video time follows scroll). Pin (section holds while content advances). Horizontal scroll hijack (vertical scroll pans sideways). Sticky stack (cards pin and stack).

**Feedback**: Hover effect. Press/tap feedback (subtle scale-down). Hold to confirm (fills while held). Drag. Drag to reorder. Swipe to dismiss. Rubber-banding (resistance and snap-back past a boundary). Shake/wiggle (error). Ripple (circle from the tap point). Magnetic button (drifts toward the cursor). Spotlight border (border lights under the cursor).

**Easing**: Ease-out (fast then slow; default for UI). Ease-in (slow then fast; avoid on UI). Ease-in-out (slow, fast, slow; on-screen moves). Linear (constant; spinners, marquees, progress). Cubic-bezier (custom curve). Asymmetric easing (different acceleration and deceleration).

**Springs**: Spring (physics instead of fixed duration). Stiffness/tension (snappier when higher). Damping (lower means more bounce). Mass (heavier feels slower). Bounce (overshoot and settle). Perceptual duration (when it feels finished). Momentum and velocity (carried through interruption). Interruptible animation (redirects mid-flight).

**Ambient**: Marquee. Loop. Alternate/yoyo. Orbit. Pulse. Float. Idle animation.

**Polish**: Blur (softens or masks imperfect transitions). Clip-path (hard-edged reveals and masks). Mask (soft, fadeable edges). Before/after slider. Line drawing (SVG path draws itself). Text morph (characters animate when text changes). Text scramble. Skeleton/shimmer. Number ticker. Tabular numbers. Typewriter.

**Performance**: FPS (60 baseline, 120 on newer displays). Jank (visible stutter). Dropped frame. Compositing (GPU moves a layer without layout or paint). will-change. Layout thrashing (animating layout properties forces recalculation every frame).

**Principles**: Purposeful animation. Anticipation (small wind-up). Follow-through (parts settle after the main motion). Squash and stretch. Perceived performance (the right motion makes things feel faster). Frequency of use (the more often seen, the shorter and subtler). Spatial consistency. Hardware acceleration. Reduced motion.

---

# Appendix B: design-system map and install commands

| Brief reads as | Use | Install |
| --- | --- | --- |
| Microsoft / enterprise SaaS | Fluent UI | `npm i @fluentui/react-components` |
| Google / Material product | Material Web (M3) | `npm i @material/web` |
| IBM-style enterprise analytics | Carbon | `npm i @carbon/react @carbon/styles` |
| Shopify app surfaces | Polaris web components | `<script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script>` |
| Atlassian-style product | Atlaskit | `yarn add @atlaskit/tokens @atlaskit/button @atlaskit/css-reset` |
| GitHub-style devtool / community | Primer | `npm i @primer/css` or `@primer/react-brand` |
| UK public sector | GOV.UK Frontend | `npm i govuk-frontend` |
| US public sector, trust-first | USWDS | `npm i uswds` |
| Fast local-business MVP | Bootstrap 5.3 | `npm i bootstrap` |
| Accessible React foundation | Radix Themes | `npm i @radix-ui/themes` |
| Modern SaaS, owned components | shadcn/ui (never ship its default look) | `npx shadcn@latest init` |
| Indie / small-team marketing | Tailwind v4 + `dark:` | `npm i tailwindcss @tailwindcss/postcss` |

Aesthetics that are not systems (build honestly with native CSS plus Tailwind): glassmorphism (`backdrop-filter`, layered borders, solid fallback), bento (CSS Grid with mixed cells), brutalism (raw borders, mono), editorial (serif only if justified, asymmetric grid), dark tech (mono plus one neon accent), aurora/mesh (layered radial gradients or SVG), kinetic type (CSS or scroll-driven animation, GSAP for pins).

Out of scope for the marketing-page rules in Parts 2-3: dense dashboards, data tables (use TanStack Table or AG Grid), multi-step wizards, code editors (Monaco, CodeMirror), native mobile apps, realtime collaboration UIs. Say so and use the right tool; for an owner-facing back office use Part 9.
