const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const controller = readFileSync(path.join(__dirname, '../dist/faq-accordion.js'), 'utf8');

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    emit(type, event = { type }) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    }
  };
}

function createFixture({ reduced = false, animations = true, items = [{}, {}] } = {}) {
  const pendingToggles = new Set();
  const motion = Object.assign(eventTarget(), { matches: reduced });
  const window = Object.assign(eventTarget(), { innerWidth: 1280, innerHeight: 900, matchMedia: () => motion });

  function animateElement(element) {
    element.animations = [];
    if (!animations) return;
    element.animate = (keyframes, options) => {
      const animation = {
        // Copy across the VM boundary so assertions compare ordinary Node objects.
        keyframes: JSON.parse(JSON.stringify(keyframes)),
        options: JSON.parse(JSON.stringify(options)),
        active: true,
        cancelled: false,
        frame: { ...keyframes[0] },
        onfinish: null,
        cancel() {
          this.active = false;
          this.cancelled = true;
        },
        complete() {
          if (!this.active) return;
          this.active = false;
          this.onfinish?.();
        }
      };
      element.animations.push(animation);
      return animation;
    };
  }

  const entries = items.map(({ open = false, summaryHeight = 76, answerHeight = 123, borderTop = 0, borderBottom = 1 } = {}) => {
    let nativeOpen = open;
    const attributes = new Map();
    const summary = Object.assign(eventTarget(), {
      setAttribute: (name, value) => attributes.set(name, String(value)),
      getAttribute: name => attributes.get(name) ?? null,
      getBoundingClientRect: () => ({ height: summaryHeight })
    });
    const answer = { inert: false };
    const item = Object.assign(eventTarget(), {
      dataset: {},
      style: { removeProperty(name) { delete this[name]; } },
      querySelector: selector => selector === 'summary' ? summary : selector === '.faq-answer' ? answer : null,
      getBoundingClientRect() {
        const animation = this.animations.findLast(animation => animation.active);
        return { height: animation ? parseFloat(animation.frame.height) : summaryHeight + borderTop + borderBottom + (nativeOpen ? answerHeight : 0) };
      }
    });
    Object.defineProperty(item, 'open', {
      get: () => nativeOpen,
      set(value) {
        if (nativeOpen === Boolean(value)) return;
        nativeOpen = Boolean(value);
        // Native details coalesces open-attribute changes into a queued toggle.
        pendingToggles.add(item);
      }
    });
    animateElement(item);
    animateElement(answer);
    return { item, summary, answer, borderTop, borderBottom };
  });
  const document = {
    querySelectorAll(selector) {
      assert.equal(selector, '#faq-list .faq-item', 'enhancement must stay scoped to FAQ details');
      return entries.map(entry => entry.item);
    }
  };
  function getComputedStyle(element) {
    const entry = entries.find(entry => entry.item === element || entry.answer === element);
    if (entry.item === element) return { borderTopWidth: `${entry.borderTop}px`, borderBottomWidth: `${entry.borderBottom}px` };
    const animation = element.animations.findLast(animation => animation.active);
    return { opacity: String(animation?.frame.opacity ?? 1), transform: animation?.frame.transform ?? 'none' };
  }
  vm.runInNewContext(controller, { window, document, getComputedStyle }, { filename: 'faq-accordion.js' });

  return {
    entries, window,
    click(index = 0, { defaultPrevented = false } = {}) {
      const entry = entries[index];
      const event = { type: 'click', defaultPrevented, preventDefault() { this.defaultPrevented = true; } };
      entry.summary.emit('click', event);
      if (!event.defaultPrevented) entry.item.open = !entry.item.open;
      return event;
    },
    flushToggles() {
      const pending = [...pendingToggles];
      pendingToggles.clear();
      for (const item of pending) item.emit('toggle');
    },
    setReduced(value) {
      motion.matches = value;
      motion.emit('change', { matches: value });
    },
    current(index = 0) {
      const { item, answer } = entries[index];
      return { height: item.animations.at(-1), answer: answer.animations.at(-1) };
    },
    expectState(index, expanded, nativeOpen = expanded) {
      const { item, summary, answer } = entries[index];
      assert.equal(item.open, nativeOpen);
      assert.equal(item.dataset.faqExpanded, String(expanded));
      assert.equal(summary.getAttribute('aria-expanded'), String(expanded));
      assert.equal(answer.inert, !expanded);
    }
  };
}

test('initial state reflects native details without entrance animation', () => {
  const fixture = createFixture({ items: [{}, { open: true }] });
  fixture.expectState(0, false);
  fixture.expectState(1, true);
  for (const { item, answer } of fixture.entries) {
    assert.equal(item.animations.length, 0);
    assert.equal(answer.animations.length, 0);
  }
});

test('opening and closing measure content and both borders, then restore natural layout', () => {
  const fixture = createFixture({ items: [{ summaryHeight: 81.5, answerHeight: 137.25, borderTop: 1.5, borderBottom: 2 }] });
  assert.equal(fixture.click().defaultPrevented, true);
  const opening = fixture.current();
  fixture.expectState(0, true);
  assert.deepEqual(opening.height.keyframes, [{ height: '85px' }, { height: '222.25px' }]);
  assert.deepEqual(opening.answer.keyframes, [{ opacity: '0', transform: 'translateY(-6px)' }, { opacity: 1, transform: 'translateY(0)' }]);
  assert.deepEqual(opening.height.options, { duration: 380, easing: 'cubic-bezier(.22, 1, .36, 1)' });
  assert.deepEqual(opening.answer.options, opening.height.options);
  assert.equal(fixture.entries[0].item.style.overflow, 'hidden');
  fixture.flushToggles();
  assert.equal(opening.height.cancelled, false, 'native open notification must not interrupt opening');
  opening.height.complete();
  fixture.expectState(0, true);
  assert.equal(fixture.entries[0].item.getBoundingClientRect().height, 222.25);
  assert.equal(fixture.entries[0].item.style.overflow, undefined);
  assert.equal(opening.answer.cancelled, true);

  fixture.click();
  const closing = fixture.current();
  fixture.expectState(0, false, true);
  assert.deepEqual(closing.height.keyframes, [{ height: '222.25px' }, { height: '85px' }]);
  assert.equal(closing.answer.keyframes[1].opacity, 0);
  assert.equal(fixture.entries[0].item.open, true, 'answer must remain rendered throughout closing');
  closing.height.complete();
  fixture.flushToggles();
  fixture.expectState(0, false);
  assert.equal(fixture.entries[0].item.getBoundingClientRect().height, 85);
  assert.equal(fixture.entries[0].item.style.overflow, undefined);
});

test('rapid reversals start from the displayed height, opacity, and transform before cancellation', () => {
  const fixture = createFixture();
  fixture.click();
  const opening = fixture.current();
  opening.height.frame.height = '126.375px';
  opening.answer.frame = { opacity: '0.42', transform: 'matrix(1, 0, 0, 1, 0, -3.48)' };
  fixture.click();
  const closing = fixture.current();
  fixture.expectState(0, false, true);
  assert.deepEqual(closing.height.keyframes[0], { height: '126.375px' });
  assert.deepEqual(closing.answer.keyframes[0], opening.answer.frame);
  assert.equal(opening.height.cancelled, true);
  assert.equal(opening.answer.cancelled, true);
  assert.equal(opening.height.onfinish, null, 'cancelled opening must detach its completion handler');

  closing.height.frame.height = '103.25px';
  closing.answer.frame = { opacity: '0.19', transform: 'matrix(1, 0, 0, 1, 0, -4.86)' };
  fixture.click();
  const reopening = fixture.current();
  fixture.expectState(0, true);
  assert.deepEqual(reopening.height.keyframes, [{ height: '103.25px' }, { height: '200px' }]);
  assert.deepEqual(reopening.answer.keyframes[0], closing.answer.frame);
  assert.equal(closing.height.cancelled, true);
  assert.equal(closing.height.onfinish, null);
  // A cancelled animation cannot deliver an obsolete completion over the new motion.
  opening.height.complete();
  closing.height.complete();
  fixture.flushToggles();
  assert.equal(reopening.height.active, true);
  fixture.expectState(0, true);
  reopening.height.complete();
  fixture.expectState(0, true);
});

test('multiple answers open independently and finishing one does not finish another', () => {
  const fixture = createFixture();
  fixture.click(0);
  fixture.click(1);
  fixture.flushToggles();
  fixture.expectState(0, true);
  fixture.expectState(1, true);
  fixture.current(0).height.complete();
  assert.equal(fixture.current(1).height.active, true);
  fixture.click(0);
  fixture.current(0).height.complete();
  fixture.expectState(0, false);
  fixture.expectState(1, true);
  assert.equal(fixture.current(1).height.cancelled, false);
});

test('missing Web Animations leaves native details activation and answer availability intact', () => {
  const fixture = createFixture({ animations: false });
  const { item, answer, summary } = fixture.entries[0];
  assert.equal(summary.getAttribute('aria-expanded'), null);
  assert.equal(answer.inert, false);
  assert.equal(fixture.click().defaultPrevented, false);
  fixture.flushToggles();
  assert.equal(item.open, true);
  fixture.click();
  fixture.flushToggles();
  assert.equal(item.open, false);
  assert.equal(answer.inert, false, 'native fallback must not strand an answer in inert state');
  assert.equal(item.animations.length, 0);
});

test('reduced motion changes state immediately without creating animations', () => {
  const fixture = createFixture({ reduced: true });
  fixture.click();
  fixture.flushToggles();
  fixture.expectState(0, true);
  fixture.click();
  fixture.flushToggles();
  fixture.expectState(0, false);
  assert.equal(fixture.entries[0].item.animations.length, 0);
  assert.equal(fixture.entries[0].answer.animations.length, 0);
  assert.equal(fixture.entries[0].item.style.overflow, undefined);
});

test('motion preference changes settle every answer to its latest requested state', () => {
  const fixture = createFixture({ items: [{}, { open: true }] });
  fixture.click(0);
  fixture.click(1);
  const opening = fixture.current(0);
  const closing = fixture.current(1);
  fixture.setReduced(true);
  fixture.flushToggles();
  fixture.expectState(0, true);
  fixture.expectState(1, false);
  for (const pair of [opening, closing]) {
    assert.equal(pair.height.cancelled, true);
    assert.equal(pair.answer.cancelled, true);
    assert.equal(pair.height.onfinish, null);
  }
  fixture.click(0);
  fixture.expectState(0, false);
  assert.equal(fixture.entries[0].item.animations.length, 1);
  fixture.setReduced(false);
  fixture.click(0);
  assert.equal(fixture.entries[0].item.animations.length, 2, 'motion must resume after reduced motion is disabled');
  fixture.expectState(0, true);
});

test('height-only viewport resize preserves motion while width changes settle open and closed answers', () => {
  const fixture = createFixture({ items: [{}, { open: true }] });
  fixture.click(0);
  fixture.click(1);
  fixture.window.innerHeight = 650;
  fixture.window.emit('resize');
  const opening = fixture.current(0);
  const closing = fixture.current(1);
  assert.equal(opening.height.active, true, 'mobile browser chrome resize must not interrupt');
  assert.equal(closing.height.active, true);
  fixture.window.innerWidth = 375;
  fixture.window.emit('resize');
  fixture.flushToggles();
  fixture.expectState(0, true);
  fixture.expectState(1, false);
  assert.equal(opening.height.cancelled, true);
  assert.equal(closing.height.cancelled, true);
  fixture.click(0);
  const nextClosing = fixture.current(0);
  fixture.window.emit('resize');
  assert.equal(nextClosing.height.active, true, 'repeated resize at the recorded width must preserve motion');
  fixture.window.innerWidth = 820;
  fixture.window.emit('resize');
  fixture.expectState(0, false);
  assert.equal(nextClosing.height.cancelled, true);
});

test('activation already prevented by another handler leaves state and current animation untouched', () => {
  const fixture = createFixture();
  fixture.click(0, { defaultPrevented: true });
  fixture.expectState(0, false);
  assert.equal(fixture.entries[0].item.animations.length, 0);
  fixture.click();
  const opening = fixture.current();
  fixture.click(0, { defaultPrevented: true });
  fixture.expectState(0, true);
  assert.equal(opening.height.active, true);
  assert.equal(fixture.entries[0].item.animations.length, 1);
});

test('programmatic native open and close synchronize accessibility without adding motion', () => {
  const fixture = createFixture();
  const { item } = fixture.entries[0];
  item.open = true;
  fixture.flushToggles();
  fixture.expectState(0, true);
  item.open = false;
  fixture.flushToggles();
  fixture.expectState(0, false);
  assert.equal(item.animations.length, 0);
  fixture.click();
  const opening = fixture.current();
  item.open = false;
  fixture.flushToggles();
  fixture.expectState(0, false);
  assert.equal(opening.height.cancelled, true, 'external close must cancel a running opening');
  assert.equal(opening.answer.cancelled, true);
  assert.equal(item.style.overflow, undefined);
});
