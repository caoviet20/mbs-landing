(() => {
  "use strict";

  const items = [...document.querySelectorAll("#faq-list .faq-item")];
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const timing = { duration: 380, easing: "cubic-bezier(.22, 1, .36, 1)" };
  const controllers = [];

  for (const item of items) {
    const summary = item.querySelector("summary");
    const answer = item.querySelector(".faq-answer");
    if (!summary || !answer || typeof item.animate !== "function") continue;

    let expanded = item.open;
    let heightAnimation = null;
    let answerAnimation = null;

    function reflectState() {
      item.dataset.faqExpanded = String(expanded);
      summary.setAttribute("aria-expanded", String(expanded));
      answer.inert = !expanded;
    }

    function cancelAnimations() {
      if (heightAnimation) {
        heightAnimation.onfinish = null;
        heightAnimation.cancel();
        heightAnimation = null;
      }
      answerAnimation?.cancel();
      answerAnimation = null;
    }

    function finish() {
      cancelAnimations();
      item.open = expanded;
      item.style.removeProperty("overflow");
      reflectState();
    }

    summary.addEventListener("click", event => {
      if (event.defaultPrevented) return;
      event.preventDefault();

      // Read the displayed frame before cancellation so reversals stay continuous.
      const startHeight = item.getBoundingClientRect().height;
      const answerStyle = getComputedStyle(answer);
      const startOpacity = item.open ? answerStyle.opacity : "0";
      const startTransform = item.open ? answerStyle.transform : "translateY(-6px)";
      expanded = !expanded;
      cancelAnimations();
      reflectState();

      if (motion.matches) {
        finish();
        return;
      }

      item.open = true;
      const itemStyle = getComputedStyle(item);
      const borders = (parseFloat(itemStyle.borderTopWidth) || 0)
        + (parseFloat(itemStyle.borderBottomWidth) || 0);
      const endHeight = expanded
        ? item.getBoundingClientRect().height
        : summary.getBoundingClientRect().height + borders;

      item.style.overflow = "hidden";
      heightAnimation = item.animate([
        { height: `${startHeight}px` },
        { height: `${endHeight}px` }
      ], timing);
      answerAnimation = answer.animate([
        { opacity: startOpacity, transform: startTransform },
        { opacity: expanded ? 1 : 0, transform: expanded ? "translateY(0)" : "translateY(-6px)" }
      ], timing);
      heightAnimation.onfinish = finish;
    });

    item.addEventListener("toggle", () => {
      if (heightAnimation && item.open) return;
      expanded = item.open;
      finish();
    });

    reflectState();
    controllers.push(finish);
  }

  const finishAll = () => controllers.forEach(finish => finish());
  motion.addEventListener("change", finishAll);
  let width = window.innerWidth;
  window.addEventListener("resize", () => {
    if (width === window.innerWidth) return;
    width = window.innerWidth;
    finishAll();
  }, { passive: true });
})();
