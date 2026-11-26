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
    let slider = null;
    let dragging = false;
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
        video.loop = true;
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
          if (!canPlay(items[index], index)) video.pause();
          else placeholder.hidden = true;
        });
        video.addEventListener("error", () => {
          placeholder.hidden = false;
          message.textContent = "Video hiện chưa tải được";
        });
      }
      const copy = element("div", "feature-card-copy");
      copy.append(element("h4", "feature-card-title", feature.title), element("p", "feature-card-description", feature.description));
      card.append(media, copy);
      rail.append(card);
      button.addEventListener("click", () => select(index, { announce: true }));
      return { button, description, card, media, video, placeholder, message, feature, visible: false, playRequest: 0, playPending: false };
    });

    function canPlay(item, index) {
      return item.visible && (carousel || index === active) && !document.hidden && !reducedMotion.matches;
    }

    function syncPlayback() {
      items.forEach((item, index) => {
        const video = item.video;
        if (!video) return;
        if (!canPlay(item, index)) {
          item.playRequest++;
          item.playPending = false;
          video.pause();
          return;
        }
        if (!video.hasAttribute("src")) {
          video.src = item.feature.video;
          item.message.textContent = "Đang tải video…";
        }
        if (video.error || item.playPending || !video.paused) return;
        const request = ++item.playRequest;
        item.playPending = true;
        video.play().then(() => {
          if (request === item.playRequest) item.playPending = false;
          if (!canPlay(item, index)) video.pause();
        }).catch(() => {
          if (request !== item.playRequest) return;
          item.playPending = false;
          if (!canPlay(item, index)) return;
          item.placeholder.hidden = false;
          item.message.textContent = "Trình duyệt chưa thể tự phát video";
        });
      });
    }

    function scrollToCard(behavior) {
      if (!railLayout()) return;
      if (slider) {
        scrolling = true;
        scrollTarget = active;
        const moved = slider.slideTo(active, behavior === "instant" ? 0 : slider.params.speed);
        if (!moved) {
          scrolling = slider.animating;
          scrollTarget = null;
        }
        return;
      }
      scrollTarget = active;
      const left = items[active].card.offsetLeft - items[0].card.offsetLeft;
      const destination = Math.min(left, rail.scrollWidth - rail.clientWidth);
      scrolling = Math.abs(rail.scrollLeft - destination) > 1;
      rail.scrollTo({ left: destination, behavior });
    }

    function select(index, { scroll = false, announce = false, instant = false } = {}) {
      active = index;
      items.forEach((item, itemIndex) => {
        const selected = itemIndex === active;
        item.button.setAttribute("aria-expanded", String(selected));
        item.button.classList.toggle("is-active", selected);
        item.description.hidden = !selected;
        item.card.classList.toggle("is-active", selected);
        item.card.hidden = !railLayout() && !selected;
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

    function nearestCardIndex() {
      const bounds = rail.getBoundingClientRect();
      const start = bounds.left + parseFloat(getComputedStyle(rail).paddingLeft);
      const maximum = rail.scrollWidth - rail.clientWidth;
      let nearest = active;
      let distance = Infinity;
      items.forEach(({ card }, index) => {
        const position = rail.scrollLeft + card.getBoundingClientRect().left - start;
        const delta = Math.abs(rail.scrollLeft - Math.max(0, Math.min(position, maximum)));
        if (delta <= distance) { nearest = index; distance = delta; }
      });
      return nearest;
    }

    rail.addEventListener("scroll", () => {
      clearTimeout(scrollTimer);
      if (slider || !railLayout()) return;
      if (!scrolling) {
        scrolling = true;
        syncPlayback();
      }
      scrollTimer = setTimeout(() => {
        scrolling = false;
        if (scrollTarget !== null) {
          scrollTarget = null;
          syncPlayback();
          return;
        }
        const nearest = nearestCardIndex();
        if (nearest !== active) select(nearest, { announce: true });
        else syncPlayback();
      }, 160);
    }, { passive: true });

    mobile.addEventListener("change", () => {
      clearTimeout(scrollTimer);
      scrolling = false;
      slider?.update();
      select(active, { scroll: true, instant: true });
    });
    reducedMotion.addEventListener("change", () => {
      if (slider) {
        slider.params.speed = reducedMotion.matches ? 0 : 300;
        slider.originalParams.speed = slider.params.speed;
        if (reducedMotion.matches) slider.slideTo(active, 0);
      }
      syncPlayback();
    });
    document.addEventListener("visibilitychange", syncPlayback);
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          const item = items.find(item => item.media === entry.target);
          item.visible = entry.isIntersecting && entry.intersectionRatio >= (item.visible ? 0.35 : 0.55);
        }
        syncPlayback();
      }, { threshold: [0, 0.35, 0.55] });
      items.forEach(item => observer.observe(item.media));
    } else {
      const updateVisible = () => {
        const clip = rail.getBoundingClientRect();
        items.forEach(item => {
          const rect = item.media.getBoundingClientRect();
          const width = Math.max(0, Math.min(rect.right, innerWidth, clip.right) - Math.max(rect.left, 0, clip.left));
          const height = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
          const ratio = rect.width && rect.height ? width * height / (rect.width * rect.height) : 0;
          item.visible = ratio >= (item.visible ? 0.35 : 0.55);
        });
        syncPlayback();
      };
      window.addEventListener("scroll", updateVisible, { passive: true });
      window.addEventListener("resize", updateVisible, { passive: true });
      rail.addEventListener("scroll", updateVisible, { passive: true });
      rail.addEventListener("transitionend", updateVisible);
      requestAnimationFrame(updateVisible);
    }
    if (carousel && window.Swiper) {
      const track = element("div", "swiper-wrapper feature-track");
      items.forEach(({ card }) => {
        card.classList.add("swiper-slide");
        track.append(card);
      });
      rail.append(track);
      rail.classList.add("swiper", "feature-swiper");
      function beginMotion() {
        if (scrolling) return;
        scrolling = true;
        syncPlayback();
      }
      slider = new window.Swiper(rail, {
        init: false,
        slidesPerView: "auto",
        spaceBetween: 16,
        breakpoints: { 901: { spaceBetween: 24 } },
        speed: reducedMotion.matches ? 0 : 300,
        grabCursor: true,
        mousewheel: { forceToAxis: true, releaseOnEdges: true },
        a11y: false,
        on: {
          sliderFirstMove() {
            scrollTarget = null;
            dragging = true;
            beginMotion();
          },
          beforeTransitionStart: beginMotion,
          slideChange(swiper) {
            select(scrollTarget ?? (swiper.isEnd ? items.length - 1 : swiper.activeIndex), { announce: true });
          },
          transitionEnd() {
            scrollTarget = null;
            scrolling = dragging;
            syncPlayback();
          },
          touchEnd(swiper) {
            dragging = false;
            requestAnimationFrame(() => {
              if (!swiper.animating) {
                scrolling = false;
                syncPlayback();
              }
            });
          }
        }
      });
      slider.init();
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
          slider?.update();
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
