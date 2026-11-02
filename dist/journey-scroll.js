(() => {
  const root = document.querySelector("#library .journey-layout");
  if (!root) return;

  const steps = Array.from(root.querySelectorAll(".journey-step[id]"));
  const links = Array.from(root.querySelectorAll(".journey-step-nav a[href^='#']"));
  if (!steps.length || !links.length) return;

  const desktop = window.matchMedia("(min-width: 1100px)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let revealObserver = null;
  let activeObserver = null;
  let visibilityObserver = null;
  let frame = null;
  let activeId = null;
  let enhanced = false;

  function reveal(step) {
    step.classList.add("is-revealed");
    revealObserver?.unobserve(step);
  }

  function setActive(id) {
    if (activeId === id) return;
    activeId = id;
    const currentIndex = steps.findIndex(step => step.id === id);
    steps.forEach((step, index) => {
      step.classList.toggle("is-current", index === currentIndex);
      step.classList.toggle("is-complete", index < currentIndex);
    });
    links.forEach(link => {
      const active = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "step");
      else link.removeAttribute("aria-current");
    });
  }

  function update() {
    frame = null;
    const viewportHeight = window.innerHeight;
    const bounds = root.getBoundingClientRect();
    if (bounds.top >= viewportHeight) {
      setActive(steps[0].id);
      return;
    }
    if (bounds.bottom <= 0) {
      setActive(steps[steps.length - 1].id);
      if (enhanced) steps.forEach(reveal);
      return;
    }

    const readingLine = viewportHeight * 0.35;
    let current = steps[0];
    steps.forEach(step => {
      const bounds = step.getBoundingClientRect();
      const heading = step.querySelector(".journey-heading") || step;
      if (heading.getBoundingClientRect().top <= readingLine) current = step;
      // Catch restored positions and fast scrolls that skip observer callbacks.
      if (enhanced && bounds.top <= viewportHeight * 0.9) reveal(step);
    });
    if (bounds.top <= 0 && bounds.bottom <= viewportHeight) {
      current = steps[steps.length - 1];
    }
    setActive(current.id);
  }

  function scheduleUpdate() {
    if (frame === null) frame = window.requestAnimationFrame(update);
  }

  function revealHashTarget() {
    let id;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    const target = document.getElementById(id);
    const step = target?.closest(".journey-step");
    if (step && root.contains(step)) reveal(step);
    scheduleUpdate();
  }

  function configure() {
    revealObserver?.disconnect();
    activeObserver?.disconnect();
    visibilityObserver?.disconnect();
    revealObserver = null;
    activeObserver = null;
    visibilityObserver = null;
    const supportsObserver = "IntersectionObserver" in window;
    const viewportHeight = window.innerHeight;
    enhanced = desktop.matches && !reducedMotion.matches && supportsObserver;
    root.classList.remove("journey-scroll-ready");
    if (supportsObserver) {
      const topMargin = Math.round(viewportHeight * 0.35);
      const bottomMargin = Math.max(0, viewportHeight - topMargin - 1);
      activeObserver = new IntersectionObserver(update, {
        root: document,
        rootMargin: `-${topMargin}px 0px -${bottomMargin}px 0px`,
        threshold: 0
      });
      steps.forEach(step => activeObserver.observe(step.querySelector(".journey-heading") || step));
      // Whole steps catch jumps that skip the narrow heading reading band.
      visibilityObserver = new IntersectionObserver(update, { root: document, threshold: [0, 1] });
      visibilityObserver.observe(root);
      steps.forEach(step => visibilityObserver.observe(step));
    }
    if (enhanced) {
      revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) reveal(entry.target);
        });
      }, { root: document, rootMargin: `0px 0px -${Math.round(viewportHeight * 0.1)}px 0px`, threshold: 0 });
      steps.forEach(step => {
        if (!step.classList.contains("is-revealed")) revealObserver.observe(step);
      });
      // Reveal the initial viewport before enabling the subdued entrance state.
      update();
      root.classList.add("journey-scroll-ready");
    }
    revealHashTarget();
    scheduleUpdate();
  }

  root.addEventListener("focusin", event => {
    const step = event.target.closest(".journey-step");
    if (step && root.contains(step)) reveal(step);
  });
  window.addEventListener("resize", configure, { passive: true });
  window.addEventListener("hashchange", revealHashTarget);
  window.addEventListener("pageshow", scheduleUpdate);
  window.addEventListener("load", scheduleUpdate, { once: true });
  desktop.addEventListener("change", configure);
  reducedMotion.addEventListener("change", configure);
  configure();
})();
