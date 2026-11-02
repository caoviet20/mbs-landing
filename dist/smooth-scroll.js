(() => {
  "use strict";
  if (typeof window.Lenis !== "function") return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const dialogs = Array.from(document.querySelectorAll("dialog"));
  let lenis = null;

  function syncLock() {
    if (!lenis) return;
    const locked = document.hidden || dialogs.some(dialog => dialog.open);
    if (locked && !lenis.isStopped) lenis.stop();
    else if (!locked && lenis.isStopped) lenis.start();
  }

  function destroy() {
    lenis?.destroy();
    lenis = null;
  }

  function configure() {
    if (reducedMotion.matches) {
      destroy();
      return;
    }
    if (!lenis) {
      lenis = new window.Lenis({
        autoRaf: true,
        smoothWheel: true,
        syncTouch: false,
        duration: 1.2,
        anchors: false,
        respectReducedMotion: true,
        // Dialogs and horizontal rails keep their native scroll and snap behavior.
        prevent: node => node.matches("dialog"),
        virtualScroll: ({ deltaX, deltaY, event }) => !event.shiftKey && Math.abs(deltaX) <= Math.abs(deltaY)
      });
    }
    syncLock();
  }

  function resetToNativePosition() {
    if (lenis && !lenis.isStopped) {
      lenis.stop();
      lenis.start();
    }
  }

  function focusTarget(target) {
    if (target === document.documentElement) return;
    if (!target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "-1");
      target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
    }
    target.focus({ preventScroll: true });
  }

  document.addEventListener("click", event => {
    if (!lenis || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) return;
    const topLink = link.getAttribute("href") === "#";
    if (!url.hash && !topLink) return;
    let target;
    try {
      target = topLink ? document.documentElement : document.getElementById(decodeURIComponent(url.hash.slice(1)));
    } catch {
      return;
    }
    if (!target) return;
    syncLock();
    if (lenis.isStopped) return;
    event.preventDefault();
    const hash = topLink ? "#" : url.hash;
    const oldURL = window.location.href;
    if (new URL(hash, oldURL).href !== oldURL) {
      try {
        history.pushState(history.state, "", hash);
        window.dispatchEvent(new HashChangeEvent("hashchange", { oldURL, newURL: window.location.href }));
      } catch {
        // Opaque HTML preview frames may forbid history updates; local scrolling still works.
      }
    }
    // Lenis already accounts for scroll-padding and the target's scroll-margin.
    resetToNativePosition();
    lenis.resize();
    lenis.scrollTo(topLink ? 0 : target, { onComplete: () => focusTarget(target) });
  });

  const dialogState = new MutationObserver(syncLock);
  dialogs.forEach(dialog => dialogState.observe(dialog, { attributes: true, attributeFilter: ["open"] }));
  document.addEventListener("visibilitychange", syncLock);
  document.addEventListener("keydown", event => {
    if (event.defaultPrevented || !["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Tab"].includes(event.key)) return;
    if (event.target instanceof Element && event.target.closest("input,textarea,select,[contenteditable]:not([contenteditable='false'])")) return;
    // Let native keyboard scrolling take over from any wheel or anchor inertia.
    resetToNativePosition();
  });
  window.addEventListener("hashchange", resetToNativePosition);
  window.addEventListener("popstate", resetToNativePosition);
  window.addEventListener("pagehide", destroy);
  window.addEventListener("pageshow", configure);
  reducedMotion.addEventListener("change", configure);
  configure();
})();
