(() => {
  const root = document.querySelector("#library .journey-layout");
  if (!root) return;

  const steps = Array.from(root.querySelectorAll(".journey-step[id]"));
  const links = Array.from(root.querySelectorAll(".journey-step-nav a[href^='#']"));
  if (!steps.length || !links.length) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const header = document.querySelector(".site-header");
  let visibilityObserver = null;
  let frame = null;
  let activeId = null;
  let previousReadingLine = null;

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
      return;
    }

    const visibleTop = window.visualViewport?.offsetTop || 0;
    const visibleBottom = visibleTop + (window.visualViewport?.height || viewportHeight);
    const headerBottom = header?.getBoundingClientRect().bottom || 0;
    const readingTop = Math.min(visibleBottom, Math.max(visibleTop, headerBottom));
    const readingLine = readingTop + (visibleBottom - readingTop) * 0.6;
    // Selection and the CSS progress rail share one visible reading coordinate.
    if (readingLine !== previousReadingLine) {
      root.style.setProperty("--journey-reading-line", `${readingLine}px`);
      previousReadingLine = readingLine;
    }
    let current = steps[0];
    steps.forEach(step => {
      const heading = step.querySelector(".journey-heading") || step;
      if (heading.getBoundingClientRect().top <= readingLine) current = step;
    });
    if (bounds.top <= 0 && bounds.bottom <= viewportHeight) {
      current = steps[steps.length - 1];
    }
    setActive(current.id);
  }

  function scheduleUpdate() {
    if (frame === null) frame = window.requestAnimationFrame(update);
  }

  function configure() {
    visibilityObserver?.disconnect();
    visibilityObserver = null;
    const supportsObserver = "IntersectionObserver" in window;
    if (supportsObserver) {
      // Observers supplement scroll updates when document layout changes.
      visibilityObserver = new IntersectionObserver(scheduleUpdate, { root: document, threshold: [0, 1] });
      visibilityObserver.observe(root);
      steps.forEach(step => visibilityObserver.observe(step));
    }
    // Resolve the current step before dimming any surrounding content.
    update();
    root.classList.toggle("journey-scroll-ready", supportsObserver && !reducedMotion.matches);
    scheduleUpdate();
  }

  // Native touch scrolling can cross a heading between observer notifications.
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleUpdate, { passive: true });
  window.visualViewport?.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("hashchange", scheduleUpdate);
  window.addEventListener("pageshow", scheduleUpdate);
  window.addEventListener("load", scheduleUpdate, { once: true });
  reducedMotion.addEventListener("change", configure);
  configure();
})();
