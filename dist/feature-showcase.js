(() => {
  const allFeatures = window.membershipContent?.features;
  if (!allFeatures?.length) return;
  const roots = document.querySelectorAll("[data-feature-showcase], #feature-showcase");
  roots.forEach(initialize);

  function initialize(root) {
    const configuredIds = root.getAttribute("data-feature-ids");
    const features = configuredIds === null ? allFeatures : [...new Set(configuredIds.split(",").map(id => id.trim()).filter(Boolean))]
      .map(id => allFeatures.find(feature => feature.id === id)).filter(Boolean);
    if (!features.length) return;

    const selectors = root.querySelector(".feature-selectors");
    const rail = root.querySelector(".feature-rail");
    const previous = root.querySelector(".feature-previous");
    const next = root.querySelector(".feature-next");
    const status = root.querySelector(".feature-status");
    const carousel = root.hasAttribute("data-feature-carousel");
    const mobile = window.matchMedia("(max-width: 900px)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let active = 0;
    let scrolling = false;
    let scrollTimer;
    let scrollTarget = null;
    let playRequest = 0;
    const railLayout = () => carousel || mobile.matches;

    function element(tag, className, text) {
      const node = document.createElement(tag);
      node.className = className;
      if (text) node.textContent = text;
      return node;
    }

    function icon(id) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const use = document.createElementNS(svg.namespaceURI, "use");
      svg.classList.add("icon");
      svg.setAttribute("aria-hidden", "true");
      use.setAttribute("href", `#${id}`);
      svg.append(use);
      return svg;
    }

    const items = features.map((feature, index) => {
      const button = element("button", "feature-selector");
      button.type = "button";
      button.id = `feature-selector-${feature.id}`;
      button.setAttribute("aria-controls", `feature-card-${feature.id}`);
      const text = element("span", "feature-selector-copy");
      const name = element("span", "feature-name", feature.title);
      const description = element("span", "feature-description", feature.description);
      text.append(name, description);
      button.append(icon(feature.icon), text);
      selectors.append(button);

      const card = element("article", "feature-card");
      card.id = `feature-card-${feature.id}`;
      card.setAttribute("aria-label", feature.title);
      const media = element("div", "feature-media");
      const placeholder = element("div", "feature-placeholder");
      const mediaLabel = element("span", "feature-media-label", feature.title);
      const message = element("p", "feature-media-message", "Video sẽ được bổ sung");
      placeholder.append(icon("i-video"), mediaLabel, message);
      media.append(placeholder);
      let video = null;
      if (feature.video) {
        video = document.createElement("video");
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.preload = "none";
        video.controls = false;
        video.disablePictureInPicture = true;
        video.disableRemotePlayback = true;
        video.tabIndex = -1;
        video.setAttribute("aria-label", `Minh họa ${feature.title}`);
        if (feature.poster) {
          video.poster = feature.poster;
          placeholder.hidden = true;
        }
        media.prepend(video);
        message.textContent = "Video giới thiệu tính năng";
        video.addEventListener("playing", () => {
          if (index !== active || !canPlay()) video.pause();
          else placeholder.hidden = true;
        });
        video.addEventListener("error", () => {
          placeholder.hidden = false;
          message.textContent = "Video hiện chưa tải được";
        });
        video.addEventListener("ended", () => {
          if (items.length > 1 && index === active && canPlay()) select((active + 1) % items.length, { scroll: true });
        });
      }
      const copy = element("div", "feature-card-copy");
      copy.append(element("h4", "feature-card-title", feature.title), element("p", "feature-card-description", feature.description));
      card.append(media, copy);
      rail.append(card);
      button.addEventListener("click", () => select(index, { announce: true }));
      return { button, description, card, media, video, placeholder, message, feature, visible: false };
    });

    function canPlay() {
      return items[active].visible && !scrolling && !document.hidden && !reducedMotion.matches;
    }

    function syncPlayback() {
      const request = ++playRequest;
      items.forEach(({ video }, index) => {
        if (video && (index !== active || !canPlay())) video.pause();
      });
      const item = items[active];
      if (!item.video || !canPlay() || (items.length === 1 && item.video.ended)) return;
      if (!item.video.hasAttribute("src")) {
        item.video.src = item.feature.video;
        item.message.textContent = "Đang tải video…";
      }
      if (item.video.error) return;
      item.video.play().catch(() => {
        if (request !== playRequest) return;
        item.placeholder.hidden = false;
        item.message.textContent = "Trình duyệt chưa thể tự phát video";
      });
    }

    function scrollToCard(behavior) {
      if (!railLayout()) return;
      scrollTarget = active;
      const left = items[active].card.offsetLeft - items[0].card.offsetLeft;
      const destination = Math.min(left, rail.scrollWidth - rail.clientWidth);
      scrolling = Math.abs(rail.scrollLeft - destination) > 1;
      rail.scrollTo({ left: destination, behavior });
    }

    function select(index, { scroll = false, announce = false, instant = false } = {}) {
      const changed = index !== active;
      active = index;
      items.forEach((item, itemIndex) => {
        const selected = itemIndex === active;
        item.button.setAttribute("aria-expanded", String(selected));
        item.button.classList.toggle("is-active", selected);
        item.description.hidden = !selected;
        item.card.classList.toggle("is-active", selected);
        item.card.hidden = !railLayout() && !selected;
        if (changed && item.video) item.video.currentTime = 0;
      });
      previous.disabled = active === 0;
      next.disabled = active === items.length - 1;
      if (announce) status.textContent = items[active].feature.title;
      if (scroll) scrollToCard(instant || reducedMotion.matches ? "instant" : "smooth");
      syncPlayback();
    }

    previous.addEventListener("click", () => select(Math.max(0, active - 1), { scroll: true, announce: true }));
    next.addEventListener("click", () => select(Math.min(items.length - 1, active + 1), { scroll: true, announce: true }));
    selectors.addEventListener("keydown", event => {
      if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      const index = items.findIndex(item => item.button === event.target);
      if (index < 0) return;
      event.preventDefault();
      const target = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      select(target, { announce: true });
      items[target].button.focus();
    });
    rail.addEventListener("keydown", event => {
      if (!railLayout() || event.target !== rail ||
          !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const target = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 :
        Math.max(0, Math.min(items.length - 1, active + (event.key === "ArrowRight" ? 1 : -1)));
      select(target, { scroll: true, announce: true });
    });

    // Wait for horizontal scrolling to settle so intermediate cards do not restart playback.
    // Preserve explicit selection when two cards fit and share the same clamped end position.
    for (const event of ["pointerdown", "touchstart", "wheel", "keydown"]) {
      rail.addEventListener(event, event => {
        if (!event.defaultPrevented) scrollTarget = null;
      }, { passive: true });
    }
    rail.addEventListener("scroll", () => {
      clearTimeout(scrollTimer);
      if (!railLayout()) return;
      scrolling = true;
      syncPlayback();
      scrollTimer = setTimeout(() => {
        scrolling = false;
        if (scrollTarget !== null) {
          scrollTarget = null;
          syncPlayback();
          return;
        }
        const bounds = rail.getBoundingClientRect();
        const start = bounds.left + parseFloat(getComputedStyle(rail).paddingLeft);
        let nearest = active;
        let distance = Infinity;
        items.forEach(({ card }, index) => {
          const rect = card.getBoundingClientRect();
          const delta = Math.abs(rect.left - start);
          if (delta < distance) { nearest = index; distance = delta; }
        });
        if (nearest !== active) select(nearest, { announce: true });
        else syncPlayback();
      }, 160);
    }, { passive: true });

    mobile.addEventListener("change", () => {
      clearTimeout(scrollTimer);
      scrolling = false;
      select(active, { scroll: true, instant: true });
    });
    reducedMotion.addEventListener("change", syncPlayback);
    document.addEventListener("visibilitychange", syncPlayback);
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          const item = items.find(item => item.media === entry.target);
          item.visible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
        }
        syncPlayback();
      }, { threshold: [0, 0.15] });
      items.forEach(item => observer.observe(item.media));
    } else {
      items.forEach(item => { item.visible = true; });
    }
    select(0);
    if (carousel) {
      const content = root.closest(".journey-content");
      let previousWidth = 0;
      function sizeCarousel() {
        const extra = mobile.matches ? 0 : Math.max(0,
          document.documentElement.clientWidth - content.getBoundingClientRect().right);
        root.style.setProperty("--feature-bleed", `${extra}px`);
        const width = rail.clientWidth;
        if (width !== previousWidth) {
          previousWidth = width;
          clearTimeout(scrollTimer);
          scrolling = false;
          scrollToCard("instant");
          syncPlayback();
        }
      }
      if ("ResizeObserver" in window) new ResizeObserver(sizeCarousel).observe(content);
      window.addEventListener("resize", sizeCarousel, { passive: true });
      sizeCarousel();
    }
  }
})();
