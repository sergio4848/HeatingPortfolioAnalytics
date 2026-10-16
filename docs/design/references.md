# Design references / reviewed 16 October 2026

Sources were inspected locally at the commits below, including READMEs, licenses and implementation files. Inspection checkouts are ignored under work/references. No upstream demo imagery, fonts, branding or complete theme was copied.

| Source / reviewed version | Actual adoption | Adaptation and license |
| --- | --- | --- |
| [GSAP](https://github.com/greensock/GSAP), 3.15.0, `13e2b790546426a1a2e0e9b409f3f8dc6d6611f2` | `apps/web/src/features/landing-motion.ts`: GSAP, ScrollTrigger, Draggable. Runtime dependency pinned in web lockfile. | Scoped short hero entrances; small screenshot counter-motion; gallery-local drag proxy. [Standard no-charge license](https://gsap.com/community/standard-license/), not MIT. Preserve distribution notices; Portotherm is an ordinary website/app, not a competing visual animation builder. No ScrollSmoother. |
| [Horizontal Parallax Gallery](https://github.com/davidfaure/horizontal-parallax-gallery-codrops), `49c3ead7b70bf9acfee9d73664c26971b2381a19` | `landing.tsx`, `landing.css`, `landing-motion.ts`: independent DOM gallery illustrating four product stages. Reviewed README, LICENSE, src/main.ts and src/gallery/index.ts. | Architectural reference for translated gallery/counter-motion. Authored CSS grid/native overflow, arrow/keyboard alternatives, localized GSAP drag. No WebGL, upstream images, global wheel interception or private RAF copied. MIT, copyright 2009–2025 Codrops; notice retained in docs/design/licenses. |
| [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), `56ea9cf174ed86786187daa9de0e6247cb0747e4` | Read SKILL.md, pro-rules, README and CLI init implementation. Applied hierarchy, spacing, visible focus, touch targets, readable tables and reduced motion to tokens and workspace. | Design working resource, no runtime import. Current README package: `ui-ux-pro-max-cli`, command `uipro init --ai codex`, target `.agents/skills/ui-ux-pro-max`. No installer executed. Local Python design search was inspected and run; its real-time/glassmorphism/Fira suggestions were rejected for this monthly B2B product. MIT, copyright 2024 Next Level Builder. |
| [Lenis](https://github.com/darkroomengineering/lenis), 1.3.27, `e01eefb1f55cd08bc051521d74f5f8182b71ee9d` | `landing-motion.ts`: official README GSAP integration, pinned runtime dependency. | One autoRaf:false instance, one GSAP ticker callback, seconds → milliseconds, scroll → ScrollTrigger.update. Desktop fine pointer only; native mobile/reduced motion. Ticker/listeners/instance removed on cleanup. MIT, copyright 2024 darkroom.engineering. |

## Asset licenses

All showcase images are captures of the running Portotherm synthetic demo. They are not upstream reference assets or customer data. Updated captures are generated from browser test evidence. Portotherm SVG logo geometry is retained from the project. Inter is locally served under SIL OFL-1.1 (`packages/brand/licenses/Inter-OFL.txt`); no third-party gallery font was adopted. Lucide remains ISC. System fonts in presentation exports follow their existing vendor licensing. Repository-wide licensing remains the owner's decision.

## Implementation limits

Horizontal navigation stays native; no scroll pinning is used. At tablet/mobile widths or reduced motion the full gallery is a normal vertical list. Animation imports are isolated from direct dashboard loads. GSAP/Lenis do not determine data, metrics or task approval. The product remains usable when the motion module fails to load.
