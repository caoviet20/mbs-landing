const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const controller = readFileSync(path.join(__dirname, '../dist/journey-scroll.js'), 'utf8');

function createFixture({ viewportHeight = 891, viewportWidth = 1284, headerBottom = 84, visualViewport, scrollY = 0, reduced = false, observer = true, headingPositions = [1050, 2100, 3300, 4500], headingOffsets = [0, 0, 0, 0], scrollPadding = 100, anchorBase = 112, anchorGap = 24, fonts = false } = {}) {
  const windowEvents = new Map();
  const documentEvents = new Map();
  const viewportEvents = new Map();
  const motionEvents = new Map();
  const frames = new Map();
  const mutations = [];
  const styleWrites = [];
  let nextFrame = 1;
  let resolveFonts;
  let anchorTargetHandler = () => {};
  class Element {}

  function style(owner) {
    const properties = new Map();
    return {
      setProperty(name, value) {
        properties.set(name, String(value));
        styleWrites.push({ owner, name, value: String(value) });
      },
      getPropertyValue: name => properties.get(name) ?? ''
    };
  }

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
    location: { href: 'https://membership.example/journey', origin: 'https://membership.example', pathname: '/journey', search: '', hash: '' },
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
  const steps = headingPositions.map((_, index) => {
    const id = `step-${index + 1}`;
    const heading = { getBoundingClientRect: () => ({ top: headingPositions[index] - window.scrollY }) };
    const step = {
      id,
      style: style(id),
      classList: classList(id),
      querySelector: selector => selector === '.journey-heading' ? heading : null,
      getBoundingClientRect: () => ({ top: headingPositions[index] - headingOffsets[index] - window.scrollY, bottom: headingPositions[index] + 900 - window.scrollY })
    };
    return step;
  });
  const links = steps.map(step => {
    const attributes = new Map([['href', `#${step.id}`]]);
    return Object.assign(new Element(), {
      href: `https://membership.example/journey#${step.id}`,
      target: '',
      classList: classList(`link-${step.id}`),
      closest: selector => ['a[href]', "a[href^='#']", 'a[href^="#"]', 'a[href*="#"]'].includes(selector) ? links[steps.indexOf(step)] : null,
      hasAttribute: name => attributes.has(name),
      getAttribute: name => attributes.get(name) ?? null,
      setAttribute: (name, value) => attributes.set(name, value),
      removeAttribute: name => attributes.delete(name)
    });
  });
  const root = {
    classList: classList('root'),
    style: style('root'),
    getBoundingClientRect: () => ({ top: 1000 - window.scrollY, bottom: 5500 - window.scrollY }),
    querySelectorAll(selector) {
      if (selector === '.journey-step[id]') return steps;
      if (selector === ".journey-step-nav a[href^='#']") return links;
      return [];
    }
  };
  const header = { getBoundingClientRect: () => ({ top: 0, bottom: headerBottom }) };
  const documentElement = {};
  const document = {
    documentElement,
    getElementById: id => steps.find(step => step.id === id) ?? null,
    addEventListener(type, listener, options) {
      listen(documentEvents, type, { listener, capture: options === true || Boolean(options?.capture) });
    },
    querySelector(selector) {
      if (selector === '#library .journey-layout') return root;
      if (selector === '.site-header') return header;
      return null;
    }
  };
  if (fonts) document.fonts = { ready: new Promise(resolve => { resolveFonts = resolve; }) };
  function getComputedStyle(element) {
    return {
      scrollPaddingTop: element === documentElement ? `${scrollPadding}px` : '0px',
      getPropertyValue(name) {
        if (name === '--journey-anchor-base') return `${anchorBase}px`;
        if (name === '--journey-anchor-gap') return `${anchorGap}px`;
        if (name === 'scroll-padding-top') return element === documentElement ? `${scrollPadding}px` : '0px';
        return element.style?.getPropertyValue(name) ?? '';
      }
    };
  }
  window.getComputedStyle = getComputedStyle;
  class SilentIntersectionObserver {
    constructor() { this.targets = new Set(); }
    observe(target) { this.targets.add(target); }
    disconnect() { this.targets.clear(); }
    // Deliberately never invoke a callback: native scroll must handle a missed intersection band.
  }
  if (observer) window.IntersectionObserver = SilentIntersectionObserver;
  const context = { window, document, Element, URL, location: window.location, getComputedStyle };
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
    window, root, steps, mutations, styleWrites, emit, flushFrame, expectCurrent,
    anchorMargin: index => Number.parseFloat(steps[index].style.getPropertyValue('--journey-anchor-margin') || anchorBase),
    headingTop: index => headingPositions[index] - window.scrollY,
    setHeadingPosition(index, value) { headingPositions[index] = value; },
    setHeadingOffset(index, value) { headingOffsets[index] = value; },
    setScrollPadding(value) { scrollPadding = value; },
    setAnchorTargetHandler(handler) { anchorTargetHandler = handler; },
    resolveFonts: () => resolveFonts(),
    anchorTo(index) {
      const event = { type: 'click', target: links[index], button: 0, defaultPrevented: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
      const listeners = documentEvents.get('click') ?? [];
      for (const { listener } of listeners.filter(entry => entry.capture)) listener(event);
      anchorTargetHandler(event);
      for (const { listener } of listeners.filter(entry => !entry.capture)) listener(event);
      // Lenis is registered after this controller; native navigation runs after bubbling.
      // Both consume the target margin plus root padding at this point.
      const margin = Number.parseFloat(steps[index].style.getPropertyValue('--journey-anchor-margin') || anchorBase);
      window.scrollY = headingPositions[index] - headingOffsets[index] - scrollPadding - margin;
      window.location.hash = `#step-${index + 1}`;
      emit('scroll');
      emit('hashchange');
    },
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

function createShortStepFixture(options = {}) {
  return createFixture({
    viewportHeight: 884,
    viewportWidth: 1210,
    headerBottom: 85,
    headingPositions: [1050, 1394, 2600, 3800],
    ...options
  });
}

test('short step anchor lands with its own heading selected and stays selected after settling', () => {
  const fixture = createShortStepFixture();
  fixture.flushFrame();

  // The reported 212px landing puts the next heading at 556px, above 564.4px.
  fixture.scrollHeadingTo(0, 212);
  fixture.emit('scroll');
  fixture.flushFrame();
  assert.equal(fixture.headingTop(1), 556);
  fixture.expectReadingLine(564.4);
  fixture.expectCurrent(1);

  fixture.anchorTo(0);
  fixture.flushFrame();
  fixture.expectCurrent(0);
  assert.ok(fixture.headingTop(0) >= 212, 'adaptive landing must keep the target below its normal anchor position');
  assert.ok(fixture.headingTop(1) >= 588.4, 'the next heading must remain below the reading line with the normal 24px gap');
  assert.ok(fixture.headingTop(1) < 589.4, 'anchor adjustment must only add the required space, rounded to pixels');
  const margin = fixture.anchorMargin(0);
  fixture.mutations.length = 0;
  fixture.styleWrites.length = 0;
  for (const type of ['scroll', 'hashchange', 'pageshow', 'load']) {
    fixture.emit(type);
    fixture.flushFrame();
    fixture.expectCurrent(0);
    assert.equal(fixture.anchorMargin(0), margin);
  }
  assert.deepEqual(fixture.mutations, [], 'settled updates must preserve the current step without a selection lock');
  assert.deepEqual(fixture.styleWrites.filter(write => write.name === '--journey-anchor-margin'), [], 'unchanged margins must not be rewritten on scroll');

  fixture.scrollHeadingTo(1, 564.3);
  fixture.emit('scroll');
  fixture.flushFrame();
  fixture.expectCurrent(1);
  fixture.scrollHeadingTo(1, 564.5);
  fixture.emit('scroll');
  fixture.flushFrame();
  fixture.expectCurrent(0);
});

test('every journey anchor and repeated first-step navigation uses the measured landing', () => {
  const fixture = createShortStepFixture();
  fixture.flushFrame();
  for (const index of [3, 0, 1, 2, 3, 0, 0]) {
    fixture.anchorTo(index);
    fixture.flushFrame();
    fixture.expectCurrent(index);
    fixture.emit('scroll');
    fixture.flushFrame();
    fixture.expectCurrent(index);
    if (index > 0) assert.equal(fixture.anchorMargin(index), 112, 'long steps and the last target must preserve the CSS base margin');
  }
});

test('reduced motion and missing observers share the adaptive native anchor landing', () => {
  for (const options of [{ reduced: true }, { observer: false }]) {
    const fixture = createShortStepFixture(options);
    fixture.flushFrame();
    for (const index of [3, 0, 1, 2, 0]) {
      fixture.anchorTo(index);
      fixture.flushFrame();
      fixture.expectCurrent(index);
      assert.equal(fixture.root.classList.contains('journey-scroll-ready'), false);
    }
  }
});

test('margins are measured offscreen and account for CSS padding and heading offsets on resize', () => {
  const fixture = createShortStepFixture();
  fixture.flushFrame();
  assert.ok(fixture.anchorMargin(0) > 112, 'the first margin must be ready while the entire journey is below the viewport');

  fixture.setHeadingPosition(1, 1494);
  fixture.emit('scroll');
  fixture.flushFrame();
  assert.equal(fixture.anchorMargin(0), 112, 'offscreen scroll updates must also measure changed layout');
  fixture.setHeadingPosition(1, 1394);
  fixture.emit('scroll');
  fixture.flushFrame();
  assert.ok(fixture.anchorMargin(0) > 112);

  fixture.setHeadingOffset(0, 80);
  fixture.emit('resize');
  fixture.flushFrame();
  assert.equal(fixture.anchorMargin(0), 112, 'a heading inset that already protects the next step must preserve the base');
  fixture.anchorTo(0);
  fixture.flushFrame();
  fixture.expectCurrent(0);
  assert.equal(fixture.headingTop(0), 292);

  fixture.setHeadingOffset(0, 0);
  fixture.setScrollPadding(60);
  fixture.window.innerHeight = 1000;
  fixture.emit('resize');
  fixture.flushFrame();
  fixture.anchorTo(0);
  fixture.flushFrame();
  fixture.expectCurrent(0);
  fixture.expectReadingLine(634);
  assert.equal(fixture.headingTop(1), 658, 'the new viewport and root padding must both inform the next landing');
});

test('anchor handler refreshes layout before an anchor consumer reads the margin', () => {
  const fixture = createFixture({ viewportHeight: 884, headerBottom: 85 });
  fixture.flushFrame();
  assert.equal(fixture.anchorMargin(0), 112);
  fixture.setHeadingPosition(1, 1394);
  // No resize, scroll or animation frame occurs between layout change and click.
  fixture.anchorTo(0);
  assert.ok(fixture.headingTop(1) >= 588.4, 'click must synchronously prepare the margin before native or Lenis navigation');
  fixture.flushFrame();
  fixture.expectCurrent(0);
});

test('anchor handler measures the collapsed mobile menu before navigation', () => {
  const fixture = createShortStepFixture({ viewportWidth: 375, headerBottom: 400 });
  fixture.flushFrame();
  fixture.expectReadingLine(690.4);
  fixture.setAnchorTargetHandler(() => fixture.setHeaderBottom(85));
  fixture.anchorTo(0);
  assert.ok(fixture.headingTop(1) >= 588.4 && fixture.headingTop(1) < 589.4, 'landing must use the header geometry after the target handler closes the menu');
  fixture.flushFrame();
  fixture.expectReadingLine(564.4);
  fixture.expectCurrent(0);
});

test('font readiness and load remeasure changed heading distances', async () => {
  const fixture = createShortStepFixture({ fonts: true });
  fixture.flushFrame();
  assert.ok(fixture.anchorMargin(0) > 112);
  fixture.setHeadingPosition(1, 1494);
  fixture.resolveFonts();
  await Promise.resolve();
  assert.equal(fixture.pendingFrames(), 1, 'font readiness must request a layout update');
  fixture.flushFrame();
  assert.equal(fixture.anchorMargin(0), 112, 'larger heading separation should restore the normal margin');

  fixture.setHeadingPosition(1, 1394);
  fixture.emit('load');
  fixture.flushFrame();
  assert.ok(fixture.anchorMargin(0) > 112);
  fixture.anchorTo(0);
  fixture.flushFrame();
  fixture.expectCurrent(0);
});

test('very close headings retain a usable gap without placing the target past the reading line', () => {
  const fixture = createShortStepFixture({ headingPositions: [1050, 1090, 2600, 3800] });
  fixture.flushFrame();
  fixture.anchorTo(0);
  fixture.flushFrame();
  fixture.expectCurrent(0);
  assert.ok(fixture.headingTop(0) < 564.4, 'the target itself must remain above the reading line');
  assert.ok(fixture.headingTop(1) > 564.4, 'the following heading must remain below the reading line');
  assert.ok(fixture.headingTop(1) <= 575.4, 'a short interval must scale the guard down to keep its target readable');
});

test('anchor placement consumes the CSS base and gap values', () => {
  const fixture = createShortStepFixture({ anchorBase: 96, anchorGap: 12 });
  fixture.flushFrame();
  fixture.anchorTo(0);
  fixture.flushFrame();
  fixture.expectCurrent(0);
  assert.ok(fixture.headingTop(1) >= 576.4 && fixture.headingTop(1) < 577.4, 'the configured 12px gap must control the landing');
  for (const index of [1, 2, 3]) assert.equal(fixture.anchorMargin(index), 96, 'unadjusted anchors must retain the configured base');
});
