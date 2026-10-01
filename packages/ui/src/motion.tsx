// Movement between screens and for what opens on top of them, with GSAP:
// short, quiet and never in the way. Whoever asks their system for less
// motion gets none, and so do tests (no matchMedia).
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { cn } from "./cn.ts";

export function motionOk(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// A screen coming in: its blocks rise into place one after another, and the
// cards of any [data-stagger] list follow. Keyed on the address, so moving
// around runs it again while the frame around it stays put.
export function PageTransition({ routeKey, className, children }: { routeKey: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !motionOk()) return;
    const ctx = gsap.context(() => {
      const blocks = [...root.querySelectorAll<HTMLElement>("main > *")].slice(0, 10);
      const cards = [...root.querySelectorAll<HTMLElement>("[data-stagger] > *")].slice(0, 12);
      const tl = gsap.timeline({ defaults: { ease: "power3.out", clearProps: "opacity,transform" } });
      tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.18 });
      if (blocks.length) tl.fromTo(blocks, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.38, stagger: 0.04 }, 0);
      if (cards.length) tl.fromTo(cards, { opacity: 0, y: 18, scale: 0.985 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, stagger: 0.035 }, 0.08);
    }, root);
    return () => ctx.revert();
  }, [routeKey]);
  return (
    <div ref={ref} className={cn("flex flex-1 flex-col", className)}>
      {children}
    </div>
  );
}

// A dialog opening: it lifts in over a fading backdrop.
export function animateOpen(el: HTMLElement) {
  if (!motionOk()) return;
  gsap.fromTo(el, { opacity: 0, y: 18, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: "power3.out", clearProps: "opacity,transform" });
}
