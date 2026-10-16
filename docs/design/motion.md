# Motion rules

Only the landing route dynamically imports GSAP, ScrollTrigger, Draggable and Lenis. A scoped gsap.context and gsap.matchMedia own animations. Desktop >=1024px, fine pointer and no reduced-motion preference are required. Intro motion is short; text remains in natural accessible reading order. There is no split-text clone or pinned storytelling.

Lenis uses autoRaf:false and one GSAP ticker callback (`seconds * 1000`). No ScrollSmoother or second RAF is active. Hidden documents pause/remove the callback. Cleanup reverts context/media, kills drag instances, disconnects ResizeObserver, removes visibility/ticker/scroll listeners and destroys Lenis. Application route navigation restores scroll through the existing route hook.

Gallery arrows, ArrowLeft/ArrowRight/Home/End and native overflow are alternatives to localized drag. The gallery has data-lenis-prevent. Scroll padding aligns the first slide correctly after Home. Mobile/tablet and reduced motion use a vertical gallery, native scrolling and no parallax/pinning. Dashboard charts, tables and forms never mount the motion system. No gallery modal or autoplay video is used. Native source dialogs occur only inside the dashboard where Lenis is absent.

Browser tests verify keyboard/arrows/drag, reduced motion, mobile menu Escape and route cleanup. No measured frame-rate claim is made.
