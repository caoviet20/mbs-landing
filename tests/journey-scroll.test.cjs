const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const controller = readFileSync(path.join(__dirname, '../dist/journey-scroll.js'), 'utf8');

function createFixture({ viewportHeight = 891, viewportWidth = 1284, headerBottom = 84, visualViewport, scrollY = 0, reduced = false, observer = true } = {}) {
  const windowEvents = new Map();
  const viewportEvents = new Map();
  const motionEvents = new Map();
  const frames = new Map();
  const mutations = [];
  const headingPositions = [1050, 2100, 3300, 4500];
  let nextFrame = 1;

  function classList(owner) {
    const values = new Set();
    function change(token, present) {
      if (values.has(token) === present) return;
      if (present) values.add(token);
      else values.delete(token);
      mutations.push({ owner, token, present });
    }
    return {
      add: (...tokens) => tokens.forEach(token => change(token, true)),
      remove: (...tokens) => tokens.forEach(token => change(token, false)),
      contains: token => values.has(token),
      toggle(token, force) {
        const present = force === undefined ? !values.has(token) : Boolean(force);
        change(token, present);
        return present;
      }
    };
  }

  function listen(events, type, listener) {
    if (!events.has(type)) events.set(type, []);
    events.get(type).push(listener);
  }

  const motion = {
    matches: reduced,
    addEventListener: (type, listener) => listen(motionEvents, type, listener)
  };
  const window = {
    innerHeight: viewportHeight,
    innerWidth: viewportWidth,
    scrollY,
    location: { hash: '' },
    matchMedia: () => motion,
    addEventListener: (type, listener) => listen(windowEvents, type, listener),
    requestAnimationFrame(callback) {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: id => frames.delete(id)
  };
  if (visualViewport) {
    window.visualViewport = {
      ...visualViewport,
      addEventListener: (type, listener) => listen(viewportEvents, type, listener)
    };
  }
  const steps = headingPositions.map((position, index) => {
    const id = `step-${index + 1}`;
    const heading = { getBoundingClientRect: () => ({ top: position - window.scrollY }) };
    const step = {
      id,
      classList: classList(id),
      querySelector: selector => selector === '.journey-heading' ? heading : null,
      getBoundingClientRect: () => ({ top: position - window.scrollY, bottom: position + 900 - window.scrollY })
    };
    return step;
  });
  const links = steps.map(step => {
    const attributes = new Map([['href', `#${step.id}`]]);
    return {
      classList: classList(`link-${step.id}`),
      getAttribute: name => attributes.get(name) ?? null,
      setAttribute: (name, value) => attributes.set(name, value),
      removeAttribute: name => attributes.delete(name)
    };
  });
  const properties = new Map();
  const root = {
    classList: classList('root'),
    style: {
      setProperty: (name, value) => properties.set(name, String(value)),
      getPropertyValue: name => properties.get(name) ?? ''
    },
    getBoundingClientRect: () => ({ top: 1000 - window.scrollY, bottom: 5500 - window.scrollY }),
    querySelectorAll(selector) {
      if (selector === '.journey-step[id]') return steps;
      if (selector === ".journey-step-nav a[href^='#']") return links;
      return [];
    }
  };
  const header = { getBoundingClientRect: () => ({ top: 0, bottom: headerBottom }) };
  const document = {
    querySelector(selector) {
      if (selector === '#library .journey-layout') return root;
      if (selector === '.site-header') return header;
      return null;
    }
  };
  class SilentIntersectionObserver {
    constructor() { this.targets = new Set(); }
    observe(target) { this.targets.add(target); }
    disconnect() { this.targets.clear(); }
    // Deliberately never invoke a callback: native scroll must handle a missed intersection band.
  }
  if (observer) window.IntersectionObserver = SilentIntersectionObserver;
  const context = { window, document };
  if (observer) context.IntersectionObserver = SilentIntersectionObserver;
  vm.runInNewContext(controller, context, { filename: 'journey-scroll.js' });

  function emit(type) {
    for (const listener of windowEvents.get(type) ?? []) listener({ type });
  }
  function flushFrame() {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(0));
  }
  function expectCurrent(index) {
    assert.deepEqual(steps.map(step => step.classList.contains('is-current')), steps.map((_, i) => i === index));
    assert.deepEqual(steps.map(step => step.classList.contains('is-complete')), steps.map((_, i) => i < index));
    assert.deepEqual(links.map(link => link.classList.contains('is-active')), links.map((_, i) => i === index));
    assert.deepEqual(links.map(link => link.getAttribute('aria-current')), links.map((_, i) => i === index ? 'step' : null));
  }
  return {
    window, root, mutations, emit, flushFrame, expectCurrent,
    emitViewport(type) {
      for (const listener of viewportEvents.get(type) ?? []) listener({ type });
    },
    setHeaderBottom(value) { headerBottom = value; },
    expectReadingLine(expected) {
      const value = root.style.getPropertyValue('--journey-reading-line');
      assert.match(value, /^\d+(?:\.\d+)?px$/, 'timeline reading line must be published in pixels');
      assert.ok(Math.abs(Number.parseFloat(value) - expected) < 0.0001, `expected reading line ${expected}px, received ${value}`);
    },
    pendingFrames: () => frames.size,
    scrollHeadingTo(index, top) { window.scrollY = headingPositions[index] - top; },
    setReduced(value) {
      motion.matches = value;
      for (const listener of motionEvents.get('change') ?? []) listener({ matches: value });
    }
  };
}

test('native scrolling crosses the fractional reading line with no observer callbacks', () => {
  const fixture = createFixture();
  fixture.flushFrame();
  fixture.expectCurrent(0);
  assert.equal(fixture.root.classList.contains('journey-scroll-ready'), true);

  fixture.scrollHeadingTo(1, 568.3);
  fixture.emit('scroll');
  fixture.flushFrame();
  fixture.expectCurrent(0);

  fixture.scrollHeadingTo(1, 568.1);
  fixture.emit('scroll');
  assert.equal(fixture.pendingFrames(), 1, 'native scroll must request an update');
  fixture.flushFrame();
  fixture.expectCurrent(1);

  fixture.scrollHeadingTo(3, 200);
  fixture.emit('scroll');
  fixture.flushFrame();
  fixture.expectCurrent(3);

  fixture.scrollHeadingTo(2, 568.1);
  fixture.emit('scroll');
  fixture.flushFrame();
  fixture.expectCurrent(2);

  fixture.scrollHeadingTo(1, 568.3);
  fixture.emit('scroll');
  fixture.flushFrame();
  fixture.expectCurrent(0);
});

test('scroll bursts coalesce into one frame and resolve the latest geometry', () => {
  const fixture = createFixture();
  fixture.flushFrame();
  for (const index of [1, 2, 1, 3]) {
    fixture.scrollHeadingTo(index, 100);
    fixture.emit('scroll');
  }
  assert.equal(fixture.pendingFrames(), 1);
  fixture.flushFrame();
  fixture.expectCurrent(3);
  assert.equal(fixture.pendingFrames(), 0);
});

test('resize recomputes the reading line without interrupting enabled emphasis', () => {
  const fixture = createFixture({ scrollY: 1520 });
  fixture.flushFrame();
  fixture.expectCurrent(0);
  fixture.mutations.length = 0;

  fixture.window.innerHeight = 1000;
  fixture.emit('resize');
  fixture.flushFrame();
  fixture.expectCurrent(1);
  assert.equal(fixture.root.classList.contains('journey-scroll-ready'), true);
  assert.deepEqual(fixture.mutations.filter(change => change.owner === 'root' && change.token === 'journey-scroll-ready'), [], 'resize must not remove and restore the ready class');

  fixture.window.innerHeight = 800;
  fixture.emit('resize');
  fixture.flushFrame();
  fixture.expectCurrent(0);
});

test('initial position, hashes and restored pages keep the navigation in sync', () => {
  const fixture = createFixture({ scrollY: 3200 });
  fixture.expectCurrent(2);
  fixture.flushFrame();
  for (const [index, type] of [[3, 'hashchange'], [1, 'hashchange'], [2, 'pageshow'], [0, 'load']]) {
    fixture.window.location.hash = index === 2 ? '#nested-feature' : `#step-${index + 1}`;
    fixture.scrollHeadingTo(index, 100);
    fixture.emit(type);
    fixture.flushFrame();
    fixture.expectCurrent(index);
  }
});

test('reduced motion disables emphasis and can re-enable it at the current position', () => {
  const fixture = createFixture({ reduced: true, scrollY: 3200 });
  fixture.flushFrame();
  fixture.expectCurrent(2);
  assert.equal(fixture.root.classList.contains('journey-scroll-ready'), false);

  fixture.setReduced(false);
  fixture.flushFrame();
  assert.equal(fixture.root.classList.contains('journey-scroll-ready'), true);
  fixture.scrollHeadingTo(3, 100);
  fixture.setReduced(true);
  fixture.flushFrame();
  fixture.expectCurrent(3);
  assert.equal(fixture.root.classList.contains('journey-scroll-ready'), false);

  fixture.setReduced(false);
  fixture.flushFrame();
  fixture.expectCurrent(3);
  assert.equal(fixture.root.classList.contains('journey-scroll-ready'), true);
});

test('missing IntersectionObserver keeps the readable fallback and hash navigation', () => {
  const fixture = createFixture({ observer: false, scrollY: 3200 });
  fixture.flushFrame();
  fixture.expectCurrent(2);
  assert.equal(fixture.root.classList.contains('journey-scroll-ready'), false);
  fixture.scrollHeadingTo(1, 100);
  fixture.emit('hashchange');
  fixture.flushFrame();
  fixture.expectCurrent(1);
  assert.equal(fixture.root.classList.contains('journey-scroll-ready'), false);
});

test('mobile activates below the header at 60% of usable height and reverses at the same line', () => {
  const fixture = createFixture({ viewportWidth: 375, headerBottom: 68 });
  fixture.flushFrame();

  fixture.scrollHeadingTo(1, 561.9);
  fixture.emit('scroll');
  fixture.flushFrame();
  fixture.expectCurrent(0);

  fixture.scrollHeadingTo(1, 561.7);
  fixture.emit('scroll');
  fixture.flushFrame();
  fixture.expectCurrent(1);
  fixture.expectReadingLine(561.8);

  fixture.scrollHeadingTo(3, 550);
  fixture.emit('scroll');
  fixture.flushFrame();
  fixture.expectCurrent(3);

  fixture.scrollHeadingTo(1, 561.9);
  fixture.emit('scroll');
  fixture.flushFrame();
  fixture.expectCurrent(0);
});

test('tablet and desktop widths share the same reading line without flashing emphasis', () => {
  const fixture = createFixture({ viewportWidth: 1099, scrollY: 1535 });
  fixture.flushFrame();
  fixture.expectCurrent(1);
  fixture.expectReadingLine(568.2);
  fixture.mutations.length = 0;

  for (const width of [1100, 1284, 1099]) {
    fixture.window.innerWidth = width;
    fixture.emit('resize');
    fixture.flushFrame();
    fixture.expectCurrent(1);
    fixture.expectReadingLine(568.2);
  }
  assert.deepEqual(fixture.mutations.filter(change => change.owner === 'root' && change.token === 'journey-scroll-ready'), [], 'resizing across widths must preserve enabled emphasis');
});

test('mobile uses the visual viewport and remeasures header and viewport offsets', () => {
  const fixture = createFixture({
    viewportWidth: 820,
    headerBottom: 150,
    visualViewport: { height: 600, offsetTop: 120 },
    scrollY: 1607
  });
  fixture.flushFrame();
  fixture.expectCurrent(0);
  fixture.expectReadingLine(492);

  fixture.scrollHeadingTo(1, 491);
  fixture.emit('scroll');
  fixture.flushFrame();
  fixture.expectCurrent(1);

  fixture.window.visualViewport.height = 500;
  fixture.emitViewport('resize');
  fixture.flushFrame();
  fixture.expectCurrent(0);
  fixture.expectReadingLine(432);

  fixture.scrollHeadingTo(1, 450);
  fixture.setHeaderBottom(220);
  fixture.emit('resize');
  fixture.flushFrame();
  fixture.expectCurrent(1);
  fixture.expectReadingLine(460);

  fixture.scrollHeadingTo(1, 550);
  fixture.emit('scroll');
  fixture.flushFrame();
  fixture.expectCurrent(0);
  fixture.window.visualViewport.offsetTop = 300;
  fixture.emitViewport('scroll');
  fixture.flushFrame();
  fixture.expectCurrent(1);
  fixture.expectReadingLine(600);
});

test('desktop also uses 60% of the visual viewport below its measured header', () => {
  const fixture = createFixture({
    headerBottom: 200,
    visualViewport: { height: 600, offsetTop: 120 },
    scrollY: 1587.9
  });
  fixture.flushFrame();
  fixture.expectCurrent(0);
  fixture.expectReadingLine(512);
  fixture.scrollHeadingTo(1, 511.9);
  fixture.emit('scroll');
  fixture.flushFrame();
  fixture.expectCurrent(1);
});
