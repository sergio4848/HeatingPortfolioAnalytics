import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Draggable } from "gsap/Draggable";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger, Draggable);

export function mountLandingMotion(root: HTMLElement) {
  const media = gsap.matchMedia();
  media.add(
    "(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    () => {
      const lenis = new Lenis({
        autoRaf: false,
        anchors: { offset: -96 },
        lerp: 0.12,
        syncTouch: false,
      });
      const tick = (seconds: number) => lenis.raf(seconds * 1000);
      const update = () => ScrollTrigger.update();
      lenis.on("scroll", update);
      let ticking = false;
      const visibility = () => {
        if (document.hidden) {
          lenis.stop();
          gsap.ticker.remove(tick);
          ticking = false;
        } else if (!ticking) {
          lenis.start();
          gsap.ticker.add(tick);
          ticking = true;
        }
      };
      visibility();
      document.addEventListener("visibilitychange", visibility);
      let drags: Draggable[] = [];
      let resize: ResizeObserver | undefined;
      const context = gsap.context(() => {
        const duration =
          parseFloat(
            getComputedStyle(root).getPropertyValue("--motion-reveal"),
          ) / 1000 || 0.65;
        gsap.from(".hero-line", {
          y: 32,
          opacity: 0,
          duration,
          stagger: 0.07,
          ease: "power2.out",
          immediateRender: false,
        });
        gsap.from(".hero-surface", {
          y: 24,
          opacity: 0,
          duration,
          delay: 0.1,
          ease: "power2.out",
          immediateRender: false,
        });
        root
          .querySelectorAll<HTMLElement>(".showcase-frame img")
          .forEach((image, index) => {
            gsap.fromTo(
              image,
              { xPercent: index % 2 ? -1 : 1 },
              {
                xPercent: index % 2 ? 1 : -1,
                ease: "none",
                scrollTrigger: {
                  trigger: image.closest(".product-showcase"),
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 0.35,
                },
              },
            );
          });
        const gallery = root.querySelector<HTMLElement>(".showcase-scroll");
        if (gallery) {
          const proxy = document.createElement("div");
          drags = Draggable.create(proxy, {
            type: "x",
            trigger: gallery,
            dragClickables: false,
            allowNativeTouchScrolling: true,
            minimumMovement: 6,
            onPressInit(this: Draggable) {
              gsap.set(proxy, { x: -gallery.scrollLeft });
              this.update();
            },
            onDrag(this: Draggable) {
              gallery.scrollLeft = -this.x;
            },
          });
          const bounds = () =>
            drags[0]?.applyBounds({
              minX: Math.min(0, gallery.clientWidth - gallery.scrollWidth),
              maxX: 0,
            });
          resize = new ResizeObserver(bounds);
          resize.observe(gallery);
          bounds();
        }
      }, root);
      return () => {
        context.revert();
        drags.forEach((drag) => drag.kill());
        resize?.disconnect();
        document.removeEventListener("visibilitychange", visibility);
        gsap.ticker.remove(tick);
        lenis.off("scroll", update);
        lenis.destroy();
      };
    },
    root,
  );
  return () => media.revert();
}
