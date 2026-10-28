"use strict";

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

const content = window.membershipContent;
if (content) {
  const faqList = $("#faq-list");
  for (const item of content.faq) {
    const detail = document.createElement("details");
    detail.className = "faq-item";
    const summary = document.createElement("summary");
    const title = document.createElement("span");
    title.textContent = item.question;
    summary.append(title, icon("plus"));
    const answer = document.createElement("div");
    answer.className = "faq-answer";
    const paragraph = document.createElement("p");
    paragraph.textContent = item.answer;
    const linkIndex = item.answerLink ? item.answer.indexOf(item.answerLink.label) : -1;
    if (linkIndex >= 0) {
      const link = document.createElement("a");
      link.href = item.answerLink.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = item.answerLink.label;
      paragraph.replaceChildren(
        item.answer.slice(0, linkIndex),
        link,
        item.answer.slice(linkIndex + item.answerLink.label.length)
      );
    }
    answer.append(paragraph);
    if (item.review) {
      const note = document.createElement("span");
      note.className = "review-note";
      note.textContent = "Chính sách minh họa · cần review";
      answer.append(note);
    }
    detail.append(summary, answer);
    faqList.append(detail);
  }

  const table = document.createElement("table");
  const caption = document.createElement("caption");
  caption.className = "sr-only";
  caption.textContent = "So sánh đầy đủ quyền lợi Membership và Membership Plus";
  const columns = document.createElement("colgroup");
  for (let index = 0; index < 3; index++) columns.append(document.createElement("col"));
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const [key, title] of [["benefit", "Quyền lợi"], ["standard", "Membership"], ["plus", "Membership Plus"]]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.id = `comparison-${key}`;
    if (key === "plus") th.className = "comparison-plus";
    th.textContent = title;
    headerRow.append(th);
  }
  head.append(headerRow);
  table.append(caption, columns, head);
  const isPlusExclusive = item => item.standard === "Không" && item.plus === "Có";
  const groups = [
    { key: "shared", exclusive: false },
    { key: "exclusive", exclusive: true }
  ];
  for (const group of groups) {
    const body = document.createElement("tbody");
    body.className = `comparison-group comparison-group-${group.key}`;
    for (const [index, item] of content.comparison.entries()) {
      if (isPlusExclusive(item) !== group.exclusive) continue;
      const row = document.createElement("tr");
      row.className = "comparison-benefit";
      const label = document.createElement("th");
      label.scope = "row";
      label.id = `comparison-benefit-${index}`;
      label.textContent = item.label;
      row.append(label);
      for (const [key, plan] of [["standard", "Membership"], ["plus", "Membership Plus"]]) {
        const cell = document.createElement("td");
        cell.className = `comparison-${key}`;
        cell.setAttribute("data-label", plan);
        cell.setAttribute("headers", `${label.id} comparison-${key}`);
        const value = document.createElement("span");
        value.className = "comparison-value";
        value.textContent = item[key];
        if (item[key] === "Có") cell.append(icon("check"));
        else if (group.exclusive && key === "standard") cell.append(icon("close"));
        cell.append(value);
        row.append(cell);
      }
      body.append(row);
    }
    table.append(body);
  }
  const comparison = $("#comparison-table");
  const start = document.createElement("span");
  start.className = "comparison-start";
  start.setAttribute("aria-hidden", "true");
  const plans = document.createElement("div");
  plans.className = "comparison-plan-header";
  const heading = document.createElement("strong");
  heading.className = "comparison-heading";
  heading.textContent = "So sánh quyền lợi";
  plans.append(heading);
  const actions = document.createElement("div");
  actions.className = "comparison-mobile-actions";
  actions.setAttribute("aria-label", "Đăng ký gói đang so sánh");
  actions.setAttribute("role", "group");
  actions.inert = true;
  actions.setAttribute("aria-hidden", "true");
  for (const [key, title, price] of [["standard", "Membership", "3.900.000đ"], ["plus", "Membership Plus", "15.000.000đ"]]) {
    const plan = document.createElement("div");
    plan.className = `comparison-plan comparison-plan-${key}`;
    const name = document.createElement("strong");
    name.className = "comparison-plan-name";
    name.textContent = title;
    const amount = document.createElement("span");
    amount.className = "comparison-plan-price";
    amount.textContent = price;
    const term = document.createElement("span");
    term.className = "comparison-plan-term";
    term.textContent = "/ 3 tháng";
    const signup = document.createElement("button");
    signup.type = "button";
    signup.className = `button button-${key === "plus" ? "primary" : "secondary"} choose-plan`;
    signup.dataset.plan = key;
    signup.setAttribute("aria-label", `Đăng ký ${title}`);
    signup.textContent = "Đăng ký";
    plan.append(name, amount, term, signup);
    plans.append(plan);
    actions.append(signup.cloneNode(true));
  }
  const comparisonBody = document.createElement("div");
  comparisonBody.className = "comparison-body";
  comparisonBody.append(start, plans, table);
  comparison.append(comparisonBody, actions);
}

// Native sticky positioning keeps both controls inside the comparison only.
function setupComparisonControls() {
  const comparison = $("#comparison-table");
  const header = $(".comparison-plan-header", comparison);
  const actions = $(".comparison-mobile-actions", comparison);
  if (!header || !actions) return;
  const details = comparison.closest("details");
  const siteHeader = $(".site-header");
  const mobile = matchMedia("(max-width: 680px)");
  let controlsObserver;
  function sync() {
    const navHeight = Math.ceil(siteHeader.getBoundingClientRect().height);
    const started = $(".comparison-start", comparison).getBoundingClientRect().top <= navHeight;
    const visible = mobile.matches && details.open && started && $(".menu-toggle").getAttribute("aria-expanded") !== "true";
    actions.classList.toggle("is-visible", visible);
    actions.inert = !visible;
    actions.setAttribute("aria-hidden", String(!visible));
  }
  function measure() {
    const navHeight = Math.ceil(siteHeader.getBoundingClientRect().height);
    comparison.style.setProperty("--comparison-nav-height", `${navHeight}px`);
    controlsObserver?.disconnect();
    sync();
    if (!("IntersectionObserver" in window)) return;
    // Observe both controls so fast scrolling into the final rows still updates visibility.
    controlsObserver = new IntersectionObserver(sync, { rootMargin: `-${navHeight + 1}px 0px 0px`, threshold: [0, 1] });
    controlsObserver.observe(header);
    controlsObserver.observe(actions);
  }
  const resize = new ResizeObserver(measure);
  for (const element of [siteHeader, header, actions]) resize.observe(element);
  details.addEventListener("toggle", measure);
  window.addEventListener("resize", measure);
  window.visualViewport?.addEventListener("resize", measure);
  const state = new MutationObserver(sync);
  state.observe($(".menu-toggle"), { attributes: true, attributeFilter: ["aria-expanded"] });
  measure();
}
setupComparisonControls();

const stories = content && Array.isArray(content.stories) ? content.stories : [];
const storySelectors = $("#story-selectors");
const storyTitle = $("#story-title");
const storyContext = $("#story-context");
const storyReviewNote = $("#story-review-note");
const storyBeforeCopy = $("#story-before-copy");
const storyAfterCopy = $("#story-after-copy");
const storyBeforeMetric = $("#story-before-metric");
const storyAfterMetric = $("#story-after-metric");
const storyMetricLabel = $("#story-metric-label");
const storyResult = $("#story-result");
const storyImage = $("#story-image");
const storyPosition = $("#story-position");
const storyPrevious = $("#story-previous");
const storyNext = $("#story-next");

if (stories.length && [storySelectors, storyTitle, storyContext, storyReviewNote,
  storyBeforeCopy, storyAfterCopy, storyImage, storyPosition, storyPrevious, storyNext].every(Boolean)) {
  let selectedStory = 0;
  let manuallyPaused = false;
  let sectionVisible = false;
  let progressAnimation = null;
  const storyDuration = 10000;
  const motionPreference = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const storyButtons = stories.map((story, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "story-selector";
    button.dataset.storyIndex = String(index);
    button.setAttribute("aria-controls", "member-story");
    const track = document.createElement("span");
    track.className = "story-selector-track";
    track.setAttribute("aria-hidden", "true");
    const progress = document.createElement("span");
    progress.className = "story-selector-progress";
    progress.style.transform = "scaleX(0)";
    track.append(progress);
    const label = document.createElement("span");
    label.className = "story-selector-label";
    label.textContent = story.label;
    const body = document.createElement("span");
    body.className = "story-selector-body";
    const pauseIcon = icon("pause");
    pauseIcon.classList.add("story-selector-pause");
    body.append(label, pauseIcon);
    button.append(track, body);
    button.addEventListener("click", () => selectStory(index));
    return button;
  });

  function updateStoryPlayback() {
    const progress = $(".story-selector-progress", storyButtons[selectedStory]);
    const shouldPlay = !manuallyPaused && sectionVisible && !document.hidden &&
      !(motionPreference && motionPreference.matches) && typeof progress.animate === "function";
    storySelectors.dataset.playback = shouldPlay ? "running" : "paused";
    for (const [index, button] of storyButtons.entries()) {
      const active = index === selectedStory;
      button.classList.toggle("is-active", active);
      button.classList.toggle("is-paused", active && manuallyPaused);
      button.setAttribute("aria-pressed", String(active));
      const action = manuallyPaused ? "Tiếp tục tự động chuyển câu chuyện" : "Tạm dừng tự động chuyển câu chuyện";
      button.setAttribute("aria-label", active ? `${stories[index].label}. ${action}.` : stories[index].label);
      if (active) {
        button.setAttribute("aria-description", shouldPlay ? "Tự động chuyển đang chạy." : "Tự động chuyển đang tạm dừng.");
      } else {
        button.removeAttribute("aria-description");
      }
    }
    if (!shouldPlay) {
      if (progressAnimation) progressAnimation.pause();
      return;
    }
    if (progressAnimation && progressAnimation.currentTime >= storyDuration) {
      showStory((selectedStory + 1) % stories.length);
      return;
    }
    if (!progressAnimation) {
      progressAnimation = progress.animate(
        [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
        { duration: storyDuration, easing: "linear", fill: "forwards" }
      );
      progressAnimation.onfinish = updateStoryPlayback;
    } else {
      progressAnimation.play();
    }
  }

  function selectStory(index) {
    if (index < 0 || index >= stories.length) return;
    if (index === selectedStory) {
      manuallyPaused = !manuallyPaused;
      updateStoryPlayback();
    } else {
      manuallyPaused = false;
      showStory(index);
    }
  }

  function revealStorySelector() {
    const maxScroll = storySelectors.scrollWidth - storySelectors.clientWidth;
    if (maxScroll <= 0) return;
    const stripBounds = storySelectors.getBoundingClientRect();
    const buttonBounds = storyButtons[selectedStory].getBoundingClientRect();
    const centeredLeft = storySelectors.scrollLeft + buttonBounds.left - stripBounds.left -
      storySelectors.clientLeft + buttonBounds.width / 2 - storySelectors.clientWidth / 2;
    storySelectors.scrollTo({
      left: Math.max(0, Math.min(maxScroll, centeredLeft)),
      behavior: motionPreference && motionPreference.matches ? "auto" : "smooth"
    });
  }

  function showStory(index) {
    if (index < 0 || index >= stories.length) return;
    if (progressAnimation) {
      progressAnimation.onfinish = null;
      progressAnimation.cancel();
      progressAnimation = null;
    }
    selectedStory = index;
    const story = stories[index];
    storyTitle.textContent = story.title;
    storyContext.textContent = story.context;
    storyBeforeCopy.textContent = story.before;
    storyAfterCopy.textContent = story.after;
    if (storyBeforeMetric) storyBeforeMetric.textContent = story.beforeMetric || "";
    if (storyAfterMetric) storyAfterMetric.textContent = story.afterMetric || "";
    if (storyMetricLabel) storyMetricLabel.textContent = story.metricLabel || "";
    if (storyResult) storyResult.textContent = story.result || "";
    storyReviewNote.textContent = "Số liệu và hình ảnh minh họa · chờ review";
    storyReviewNote.hidden = !story.review;
    storyImage.src = story.image;
    storyImage.alt = story.imageAlt;
    storyPosition.textContent = `${index + 1} / ${stories.length}`;
    storyPrevious.disabled = index === 0;
    storyNext.disabled = index === stories.length - 1;
    revealStorySelector();
    updateStoryPlayback();
  }

  storySelectors.replaceChildren(...storyButtons);
  storyPrevious.addEventListener("click", () => selectStory(selectedStory - 1));
  storyNext.addEventListener("click", () => selectStory(selectedStory + 1));
  document.addEventListener("visibilitychange", updateStoryPlayback);
  if (motionPreference) {
    if (motionPreference.addEventListener) motionPreference.addEventListener("change", updateStoryPlayback);
    else motionPreference.addListener(updateStoryPlayback);
  }
  showStory(0);
  if ("IntersectionObserver" in window) {
    const storyObserver = new IntersectionObserver(entries => {
      sectionVisible = entries[0].isIntersecting;
      updateStoryPlayback();
    });
    storyObserver.observe($("#stories") || storySelectors);
  }
}

const menuToggle = $(".menu-toggle");
const mobileNav = $("#mobile-nav");
function closeMenu() {
  mobileNav.hidden = true;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Mở menu");
}
const mobileMenuViewport = window.matchMedia("(max-width: 900px)");
function syncMenuViewport() {
  if (!mobileMenuViewport.matches) closeMenu();
}
if (mobileMenuViewport.addEventListener) mobileMenuViewport.addEventListener("change", syncMenuViewport);
else mobileMenuViewport.addListener(syncMenuViewport);
syncMenuViewport();
menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  mobileNav.hidden = isOpen;
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Mở menu" : "Đóng menu");
});
$("#mobile-nav").addEventListener("click", event => {
  if (event.target.closest("a")) closeMenu();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !mobileNav.hidden) {
    closeMenu();
    menuToggle.focus();
  }
});
document.addEventListener("click", event => {
  if (!mobileNav.hidden && !event.target.closest(".site-header")) closeMenu();
});

for (const dialog of $$("dialog")) {
  $(".dialog-close", dialog).addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
}

const videoDialog = $("#video-dialog");
for (const trigger of $$(".video-trigger")) {
  trigger.addEventListener("click", () => {
    $("#video-dialog-title").textContent = trigger.dataset.videoTitle;
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(trigger.dataset.video)}?autoplay=1&rel=0`;
    iframe.title = trigger.dataset.videoTitle;
    iframe.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    $("#video-frame").replaceChildren(iframe);
    videoDialog.showModal();
  });
}
videoDialog.addEventListener("close", () => $("#video-frame").replaceChildren());

for (const trigger of $$(".choose-plan")) {
  trigger.addEventListener("click", () => {
    const isPlus = trigger.dataset.plan === "plus";
    $("#plan-dialog-title").textContent = isPlus ? "Membership Plus" : "Membership";
    $("#plan-dialog-price").textContent = isPlus ? "15.000.000đ / 3 tháng" : "3.900.000đ / 3 tháng";
    $("#plan-dialog").dataset.selectedPlan = trigger.dataset.plan;
    $("#plan-dialog").showModal();
  });
}

$("#copyright-year").textContent = String(new Date().getFullYear());
for (const svg of $$("svg:not(.icon-defs)")) {
  if (!svg.hasAttribute("aria-label")) svg.setAttribute("aria-hidden", "true");
}

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const link of $$(".desktop-nav a")) {
        const active = link.hash === `#${entry.target.id}`;
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      }
    }
  }, { rootMargin: "-15% 0px -65% 0px" });
  for (const section of $$("main section[id], main #how-it-works")) observer.observe(section);
}
