"use client";

import { useEffect, useRef } from "react";

export function useOceanNarrative() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const hero = element.querySelector<HTMLElement>(".hero");
    const photos = [
      ...element.querySelectorAll<HTMLElement>("[data-parallax]"),
    ];
    const steps = [...element.querySelectorAll<HTMLElement>("[data-step]")];
    const nodes = [...element.querySelectorAll<SVGElement>("[data-node]")];
    const evidence = element.querySelector<HTMLElement>(".evidence");
    let queued = 0;
    const update = () => {
      queued = 0;
      const range = Math.max(
        1,
        document.documentElement.scrollHeight - innerHeight,
      );
      element.style.setProperty(
        "--scroll",
        String(Math.min(1, scrollY / range)),
      );
      hero?.style.setProperty(
        "--hero-shift",
        reduced.matches ? "0px" : `${Math.min(scrollY, hero.offsetHeight)}px`,
      );
      photos.forEach((photo) => {
        const r = photo.getBoundingClientRect();
        const shift = reduced.matches
          ? 0
          : Math.max(
              -38,
              Math.min(
                38,
                (innerHeight / 2 - r.top - r.height / 2) *
                  Number(photo.dataset.parallax),
              ),
            );
        photo.style.setProperty("--image-shift", `${shift}px`);
      });
      let current = 0,
        nearest = Infinity;
      steps.forEach((step, i) => {
        const r = step.getBoundingClientRect();
        const distance = Math.abs(
          r.top + Math.min(r.height, innerHeight) * 0.45 - innerHeight * 0.52,
        );
        if (distance < nearest) {
          current = i;
          nearest = distance;
        }
      });
      steps.forEach((step, i) =>
        step.classList.toggle("is-current", i === current),
      );
      nodes.forEach((node, i) =>
        node.classList.toggle("is-current", i <= current),
      );
      evidence?.style.setProperty("--trace", String((current + 0.25) / 3.25));
    };
    const queue = () => {
      if (!queued) queued = requestAnimationFrame(update);
    };
    const pointer = (event: PointerEvent) => {
      if (reduced.matches || event.pointerType !== "mouse" || !hero) return;
      const r = hero.getBoundingClientRect();
      hero.style.setProperty("--pointer-x", `${event.clientX - r.left}px`);
      hero.style.setProperty("--pointer-y", `${event.clientY - r.top}px`);
    };
    const reveal =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) =>
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  entry.target.classList.add("is-visible");
                  reveal?.unobserve(entry.target);
                }
              }),
            { threshold: 0.1 },
          );
    if (reveal) {
      element.classList.add("has-js");
      element
        .querySelectorAll("[data-reveal]")
        .forEach((node) => reveal.observe(node));
    }
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue, { passive: true });
    reduced.addEventListener("change", queue);
    hero?.addEventListener("pointermove", pointer, { passive: true });
    update();
    return () => {
      if (queued) cancelAnimationFrame(queued);
      reveal?.disconnect();
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      reduced.removeEventListener("change", queue);
      hero?.removeEventListener("pointermove", pointer);
    };
  }, []);
  return root;
}

export function OceanAtmosphere() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const field = canvas.current,
      hero = field?.parentElement;
    const ctx = field?.getContext("2d");
    if (!field || !hero || !ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      width = 1,
      height = 1,
      last = -100,
      visible = true;
    const draw = (time: number) => {
      frame = 0;
      if (!visible || document.hidden) return;
      if (!reduced.matches) frame = requestAnimationFrame(draw);
      if (!reduced.matches && time - last < 40) return;
      last = time;
      const t = reduced.matches ? 0 : time * 0.00013;
      ctx.clearRect(0, 0, width, height);
      const rows = width < 600 ? 18 : 28,
        cols = width < 600 ? 34 : 65;
      for (let row = 0; row < rows; row++) {
        ctx.beginPath();
        for (let col = 0; col < cols; col++) {
          const u = col / (cols - 1),
            v = row / (rows - 1),
            x = u * width * 1.2 - width * 0.1;
          const y =
            height * 0.49 +
            Math.sin(u * 5.5 + t + v * 0.9) * height * 0.11 +
            (v - 0.5) * height * 0.64 +
            Math.sin(u * 12 - v * 4 + t * 0.8) * height * 0.018;
          if (!col) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          ctx.fillStyle = `rgba(160,225,244,${0.025 + 0.045 * Math.pow(Math.sin(u * 3 + v * 5 + t) * 0.5 + 0.5, 3)})`;
          if ((row + col) % 2 === 0) ctx.fillRect(x, y, 1.6, 1.6);
        }
        ctx.strokeStyle = `rgba(102,200,228,${0.013 + 0.008 * Math.sin(row * 0.8 + t)})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    };
    const restart = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      last = -100;
      draw(performance.now());
    };
    const fit = () => {
      width = hero.clientWidth;
      height = hero.clientHeight;
      const dpr = Math.min(devicePixelRatio, 1.5);
      field.width = Math.round(width * dpr);
      field.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      restart();
    };
    const resize = new ResizeObserver(fit);
    resize.observe(hero);
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      restart();
    });
    observer.observe(hero);
    reduced.addEventListener("change", restart);
    document.addEventListener("visibilitychange", restart);
    fit();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      reduced.removeEventListener("change", restart);
      document.removeEventListener("visibilitychange", restart);
    };
  }, []);
  return (
    <>
      <canvas ref={canvas} className="ocean-ambient" aria-hidden="true" />
      <div className="hero-light" aria-hidden="true" />
      <div className="hero-grain" aria-hidden="true" />
    </>
  );
}
