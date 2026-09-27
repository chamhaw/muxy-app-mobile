import {
  ADDON_CANVAS_JS,
  ADDON_FIT_JS,
  ADDON_WEBGL_JS,
  XTERM_CSS,
  XTERM_JS,
} from './xtermBundle';
import { TERMINAL_BOOTSTRAP_SCRIPT } from './terminalBootstrapScript';

export type TerminalTheme = {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
};

export type TerminalInitOptions = {
  theme: TerminalTheme;
  fontFamily: string;
  fontSize: number;
  commandShortcutsEnabled?: boolean;
  forwardTerminalScroll?: boolean;
};

export function buildTerminalHtml(init: TerminalInitOptions): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<style>
${XTERM_CSS}
html, body { margin: 0; padding: 0; height: 100%; width: 100%; background: ${init.theme.background}; overflow: hidden; -webkit-text-size-adjust: 100%; }
#root { position: absolute; inset: 0; padding: 8px; box-sizing: border-box; }
.xterm, .xterm-screen { user-select: text; -webkit-user-select: text; -webkit-touch-callout: default; }
.xterm-viewport { background-color: transparent !important; }
.xterm-screen canvas { pointer-events: none !important; }
.xterm .xterm-scrollable-element > .scrollbar.vertical { width: 4px !important; }
.xterm .xterm-scrollable-element > .scrollbar.vertical > .slider { width: 4px !important; left: 0 !important; border-radius: 2px; }
@keyframes terminal-focus-cursor-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
.terminal-focus-cursor { position: absolute; display: none; pointer-events: none; z-index: 6; animation: terminal-focus-cursor-blink 1.2s steps(1, end) infinite; }
.xterm, .xterm-rows {
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
  font-feature-settings: "liga" 0, "calt" 0;
  font-variant-ligatures: none;
}
</style>
</head>
<body>
<div id="root"></div>
<script>${XTERM_JS}</script>
<script>${ADDON_FIT_JS}</script>
<script>${ADDON_WEBGL_JS}</script>
<script>${ADDON_CANVAS_JS}</script>
<script>
(function () {
  var Terminal = window.Terminal;
  var FitAddon = window.FitAddon && window.FitAddon.FitAddon;
  var WebglAddon = window.WebglAddon && window.WebglAddon.WebglAddon;
  var CanvasAddon = window.CanvasAddon && window.CanvasAddon.CanvasAddon;
  var INITIAL = ${JSON.stringify(init)};
  var terminalHandleMessage = null;
  var terminalFocused = false;
  var initializationStarted = false;
  var root = document.getElementById('root');
${TERMINAL_BOOTSTRAP_SCRIPT}

  function startTerminal() {
  var term = new Terminal({
    cursorBlink: true,
    convertEol: false,
    scrollback: 5000,
    allowProposedApi: true,
    theme: INITIAL.theme,
    fontFamily: INITIAL.fontFamily,
    fontSize: INITIAL.fontSize,
    customGlyphs: true,
    letterSpacing: 0,
    lineHeight: 1.0,
    macOptionIsMeta: true,
  });

  var fit = new FitAddon();
  term.loadAddon(fit);

  term.open(root);

  var cursorOverlay = document.createElement('div');
  cursorOverlay.className = 'terminal-focus-cursor';
  cursorOverlay.setAttribute('aria-hidden', 'true');
  var terminalScreen = term.element && term.element.querySelector('.xterm-screen');
  if (terminalScreen) terminalScreen.appendChild(cursorOverlay);
  var cursorUpdateFrame = 0;
  function refreshTerminalCursor() {
    var buffer = term.buffer.active;
    var cursorRow = buffer.baseY + buffer.cursorY - buffer.viewportY;
    if (cursorRow < 0 || cursorRow >= term.rows) return;
    term.refresh(cursorRow, cursorRow);
  }
  function focusCursorGeometry(cursorColumn, cursorRow, cols, rows, screenWidth, screenHeight) {
    if (cols <= 0 || rows <= 0 || cursorRow < 0 || cursorRow >= rows) return null;
    var cellWidth = screenWidth / cols;
    var cellHeight = screenHeight / rows;
    if (!isFinite(cellWidth) || !isFinite(cellHeight) || cellWidth <= 0 || cellHeight <= 0) return null;
    return {
      left: Math.min(Math.max(cursorColumn, 0), cols - 1) * cellWidth,
      top: cursorRow * cellHeight,
      width: Math.max(2, cellWidth * 0.18),
      height: cellHeight,
    };
  }
  function updateFocusCursor() {
    cursorUpdateFrame = 0;
    if (!terminalFocused || !terminalScreen) {
      cursorOverlay.style.display = 'none';
      return;
    }
    var buffer = term.buffer.active;
    var cursorRow = buffer.baseY + buffer.cursorY - buffer.viewportY;
    var geometry = focusCursorGeometry(
      buffer.cursorX,
      cursorRow,
      term.cols,
      term.rows,
      terminalScreen.clientWidth,
      terminalScreen.clientHeight
    );
    if (!geometry) {
      cursorOverlay.style.display = 'none';
      return;
    }
    cursorOverlay.style.display = 'block';
    cursorOverlay.style.backgroundColor = term.options.theme.cursor || INITIAL.theme.cursor;
    cursorOverlay.style.width = geometry.width + 'px';
    cursorOverlay.style.height = geometry.height + 'px';
    cursorOverlay.style.transform = 'translate3d(' + geometry.left + 'px, ' + geometry.top + 'px, 0)';
  }
  function scheduleFocusCursorUpdate() {
    if (cursorUpdateFrame) return;
    cursorUpdateFrame = requestAnimationFrame(updateFocusCursor);
  }
  function setTerminalFocused(focused) {
    term.options.cursorInactiveStyle = focused ? 'none' : 'outline';
    refreshTerminalCursor();
    scheduleFocusCursorUpdate();
  }
  term.onCursorMove(scheduleFocusCursorUpdate);
  term.onRender(scheduleFocusCursorUpdate);
  term.onScroll(scheduleFocusCursorUpdate);

  if (INITIAL.commandShortcutsEnabled !== false) {
    window.addEventListener('keydown', function (e) {
      if (!e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      var key = String(e.key || '').toLowerCase();
      if (key === 't') {
        e.preventDefault();
        e.stopPropagation();
        post({ type: 'newTerminalShortcut' });
        return;
      }
      if (/^[1-9]$/.test(key)) {
        e.preventDefault();
        e.stopPropagation();
        post({ type: 'selectTabShortcut', digit: Number(key) });
        return;
      }
    }, true);
  }

  var activeRenderer = 'dom';
  var canvasAddon = null;
  function loadCanvas() {
    if (!CanvasAddon) return false;
    try {
      canvasAddon = new CanvasAddon();
      term.loadAddon(canvasAddon);
      activeRenderer = 'canvas';
      return true;
    } catch (err) {
      canvasAddon = null;
      reportError('canvas renderer init failed', err);
      return false;
    }
  }
  function disposeCanvas() {
    if (!canvasAddon) return;
    try { canvasAddon.dispose(); } catch (_) {}
    canvasAddon = null;
  }
  function loadWebgl() {
    if (!WebglAddon) return false;
    try {
      var webgl = new WebglAddon();
      webgl.onContextLoss(function () {
        try { webgl.dispose(); } catch (_) {}
        if (loadCanvas()) {
          post({ type: 'info', renderer: activeRenderer, reason: 'webgl-context-loss' });
        } else {
          activeRenderer = 'dom';
          post({ type: 'info', renderer: activeRenderer, reason: 'webgl-context-loss' });
        }
      });
      term.loadAddon(webgl);
      activeRenderer = 'webgl';
      return true;
    } catch (err) {
      reportError('webgl renderer init failed', err);
      return false;
    }
  }
  if (!loadWebgl()) loadCanvas();
  post({ type: 'info', renderer: activeRenderer });

  function encodeUtf8ToBase64(str) {
    var utf8 = unescape(encodeURIComponent(str));
    return btoa(utf8);
  }
  term.onData(function (data) {
    post({ type: 'data', bytes: encodeUtf8ToBase64(data) });
  });
  term.onBinary(function (data) {
    post({ type: 'data', bytes: btoa(data) });
  });

  var helperTa = document.querySelector('.xterm-helper-textarea');
  if (helperTa) {
    helperTa.addEventListener('focus', function () {
      post({ type: 'focusChanged', value: true });
    }, true);
    helperTa.addEventListener('blur', function () {
      post({ type: 'focusChanged', value: false });
    }, true);
  }

  var touchStartX = 0;
  var touchStartY = 0;
  var lastTouchX = 0;
  var lastTouchY = 0;
  var touchMoved = false;
  var hadSelectionAtStart = false;
  var velocitySamples = [];
  var momentumRaf = 0;
  var scrollAccumulator = 0;
  var pendingLines = 0;
  var pendingRemoteDeltaY = 0;
  var pendingClientX = 0;
  var pendingClientY = 0;
  var flushRaf = 0;
  var lastFollowingBottom = null;
  var takeoverInProgress = false;
  var takeoverId = 0;
  var takeoverStartedAt = 0;
  var takeoverByteCount = 0;
  var takeoverWrites = [];
  var takeoverRenderSubscription = null;

  function getLineHeightPx() {
    var fontSize = term.options.fontSize || INITIAL.fontSize;
    return (term.options.lineHeight || 1) * fontSize;
  }
  function isAltBuffer() {
    try {
      return term.buffer && term.buffer.active && term.buffer.active.type === 'alternate';
    } catch (err) {
      return false;
    }
  }
  function scrollToBottom() {
    cancelMomentum();
    cancelFlush();
    scrollAccumulator = 0;
    try { term.scrollToBottom(); } catch (e) {}
    syncFollowingBottom();
  }
  function isViewportFollowingBottom(viewportY, baseY) {
    return viewportY >= baseY;
  }
  function readFollowingBottom() {
    try {
      var buffer = term.buffer && term.buffer.active;
      return !buffer || isViewportFollowingBottom(buffer.viewportY, buffer.baseY);
    } catch (e) {
      return true;
    }
  }
  function syncFollowingBottom() {
    if (takeoverInProgress) return;
    var followingBottom = readFollowingBottom();
    if (followingBottom === lastFollowingBottom) return;
    lastFollowingBottom = followingBottom;
    post({ type: 'followingBottom', value: followingBottom });
  }
  function cancelTakeoverPresentation() {
    if (takeoverRenderSubscription) takeoverRenderSubscription.dispose();
    takeoverRenderSubscription = null;
  }
  function completeTakeover(id) {
    if (!takeoverInProgress || id !== takeoverId) return;
    cancelTakeoverPresentation();
    scrollToBottom();
    takeoverRenderSubscription = term.onRender(function () {
      takeoverRenderSubscription.dispose();
      takeoverRenderSubscription = null;
      if (id !== takeoverId) return;
      if (!readFollowingBottom()) {
        completeTakeover(id);
        return;
      }
      takeoverInProgress = false;
      root.removeAttribute('aria-busy');
      syncFollowingBottom();
      scheduleFocusCursorUpdate();
      drainWriteQueue();
      post({
        type: 'takeoverComplete',
        id: id,
        bytes: takeoverByteCount,
        durationMs: Math.round(performance.now() - takeoverStartedAt),
      });
    });
    term.refresh(0, term.rows - 1);
  }
  function writeTakeoverSnapshot(snapshot, id) {
    var bytes = snapshot ? decodeBase64(snapshot) : new Uint8Array(0);
    takeoverByteCount += bytes.length;
    takeoverWrites.push(bytes);
    var combined = combineWrites(takeoverWrites);
    takeoverWrites = [];
    term.write(combined, function () { completeTakeover(id); });
  }
  function sendArrowKeys(lines) {
    if (lines === 0) return;
    var seq = lines > 0 ? '\\x1b[B' : '\\x1b[A';
    var count = Math.abs(lines);
    var out = '';
    for (var i = 0; i < count; i++) out += seq;
    post({ type: 'data', bytes: btoa(out) });
  }
  function flushPendingLines() {
    flushRaf = 0;
    var remoteDeltaY = pendingRemoteDeltaY;
    pendingRemoteDeltaY = 0;
    if (remoteDeltaY !== 0) {
      post({ type: 'scroll', deltaX: 0, deltaY: remoteDeltaY, precise: true });
    }
    var lines = pendingLines;
    if (lines === 0) return;
    pendingLines = 0;
    if (isMouseTrackingActive()) {
      if (INITIAL.forwardTerminalScroll) return;
      dispatchWheel(lines, pendingClientX, pendingClientY);
      return;
    }
    if (isAltBuffer()) {
      if (INITIAL.forwardTerminalScroll) return;
      sendArrowKeys(lines);
      return;
    }
    try { term.scrollLines(lines); } catch (e) {}
  }
  function scheduleScrollFlush() {
    if (!flushRaf) flushRaf = requestAnimationFrame(flushPendingLines);
  }
  function queueLines(lines, clientX, clientY) {
    if (lines === 0) return;
    pendingLines += lines;
    pendingClientX = clientX;
    pendingClientY = clientY;
    scheduleScrollFlush();
  }
  function queueScrollPixels(dy, clientX, clientY) {
    var scrollDelta = consumeViewportOffset(dy);
    if (scrollDelta === 0) return;
    if (INITIAL.forwardTerminalScroll) {
      pendingRemoteDeltaY -= scrollDelta;
      scheduleScrollFlush();
    }
    scrollAccumulator += scrollDelta;
    var lineHeight = getLineHeightPx();
    if (lineHeight <= 0) return;
    var lines = (scrollAccumulator / lineHeight) | 0;
    if (lines === 0) return;
    scrollAccumulator -= lines * lineHeight;
    queueLines(lines, clientX, clientY);
  }
  function hasSelection() {
    var sel = window.getSelection && window.getSelection();
    return !!(sel && sel.toString().length > 0);
  }
  function cancelMomentum() {
    if (momentumRaf) cancelAnimationFrame(momentumRaf);
    momentumRaf = 0;
  }
  cancelTerminalMomentum = function () {
    cancelMomentum();
    scrollAccumulator = 0;
  };
  function cancelFlush() {
    if (flushRaf) cancelAnimationFrame(flushRaf);
    flushRaf = 0;
    pendingLines = 0;
    pendingRemoteDeltaY = 0;
  }
  function dispatchWheel(deltaLines, clientX, clientY) {
    var target = term.element;
    if (!target) return;
    var ev;
    try {
      ev = new WheelEvent('wheel', {
        deltaMode: 1,
        deltaY: deltaLines,
        clientX: clientX,
        clientY: clientY,
        bubbles: true,
        cancelable: true,
      });
    } catch (err) {
      ev = new Event('wheel', { bubbles: true, cancelable: true });
      ev.deltaY = deltaLines;
      ev.deltaMode = 1;
      ev.clientX = clientX;
      ev.clientY = clientY;
    }
    target.dispatchEvent(ev);
  }

  function isMouseTrackingActive() {
    try {
      var mode = term.modes && term.modes.mouseTrackingMode;
      return !!mode && mode !== 'none';
    } catch (err) {
      return false;
    }
  }

  term.onScroll(syncFollowingBottom);
  term.onWriteParsed(syncFollowingBottom);
  syncFollowingBottom();

  function computeVelocity() {
    if (velocitySamples.length < 2) return 0;
    var endSample = velocitySamples[velocitySamples.length - 1];
    var startSample = velocitySamples[0];
    var cutoff = endSample.t - 80;
    for (var i = velocitySamples.length - 1; i >= 0; i--) {
      if (velocitySamples[i].t <= cutoff) {
        startSample = velocitySamples[i];
        break;
      }
      startSample = velocitySamples[i];
    }
    var dt = endSample.t - startSample.t;
    if (dt <= 0) return 0;
    return (startSample.y - endSample.y) / dt;
  }

  function startMomentum(initialVelocity, clientX, clientY) {
    cancelMomentum();
    var velocity = initialVelocity;
    var lastTime = performance.now();
    var step = function () {
      var now = performance.now();
      var dt = Math.min(now - lastTime, 33);
      lastTime = now;
      queueScrollPixels(velocity * dt, clientX, clientY);
      velocity *= Math.pow(0.96, dt / 16);
      if (Math.abs(velocity) > 0.03) {
        momentumRaf = requestAnimationFrame(step);
      } else {
        momentumRaf = 0;
      }
    };
    momentumRaf = requestAnimationFrame(step);
  }

  root.addEventListener('touchstart', function (e) {
    e.stopPropagation();
    cancelMomentum();
    cancelFlush();
    scrollAccumulator = 0;
    viewportOffsetAwaitingCursor = false;
    viewportOffsetFollowsCursor = false;
    captureRenderedViewportOffset();
    touchMoved = false;
    if (e.touches && e.touches[0]) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      lastTouchX = touchStartX;
      lastTouchY = touchStartY;
      velocitySamples = [{ t: performance.now(), y: touchStartY }];
    }
    hadSelectionAtStart = hasSelection();
  }, { passive: true, capture: true });

  root.addEventListener('touchmove', function (e) {
    e.stopPropagation();
    if (!e.touches || !e.touches[0]) return;
    var tx = e.touches[0].clientX;
    var ty = e.touches[0].clientY;
    var totalDx = Math.abs(tx - touchStartX);
    var totalDy = Math.abs(ty - touchStartY);
    if (totalDx > 8 || totalDy > 8) touchMoved = true;

    if (totalDy > totalDx) {
      var dy = lastTouchY - ty;
      if (dy !== 0) queueScrollPixels(dy, tx, ty);
      lastTouchX = tx;
      lastTouchY = ty;
      velocitySamples.push({ t: performance.now(), y: ty });
      while (velocitySamples.length > 6) velocitySamples.shift();
    }
  }, { passive: true, capture: true });

  root.addEventListener('touchend', function (e) {
    e.stopPropagation();
    if (touchMoved) {
      var v = computeVelocity();
      if (Math.abs(v) > 0.1) startMomentum(v, lastTouchX, lastTouchY);
      return;
    }
    if (hadSelectionAtStart || hasSelection()) return;
    try { term.focus(); } catch (_) {}
    post({ type: 'tap' });
  }, { passive: true, capture: true });

  var dimensionsInitialized = false;
  getTerminalCursorBounds = function () {
    if (!dimensionsInitialized) return undefined;
    try {
      var buffer = term.buffer && term.buffer.active;
      var screen = term.element && term.element.querySelector('.xterm-screen');
      if (!buffer || !screen || term.rows <= 0) return undefined;
      var cursorRow = buffer.baseY + buffer.cursorY - buffer.viewportY;
      if (cursorRow < 0 || cursorRow >= term.rows) return null;
      var rootRect = root.getBoundingClientRect();
      var screenRect = screen.getBoundingClientRect();
      var cellHeight = screenRect.height / term.rows;
      if (!isFinite(cellHeight) || cellHeight <= 0) return undefined;
      var top = screenRect.top - rootRect.top + cursorRow * cellHeight;
      return { top: top, bottom: top + cellHeight };
    } catch (e) {
      return undefined;
    }
  };
  function initializeDimensions() {
    if (dimensionsInitialized) return;
    if (root.clientWidth <= 0 || root.clientHeight <= 0) {
      requestAnimationFrame(initializeDimensions);
      return;
    }
    var proposed = fit.proposeDimensions();
    if (!proposed || !isFinite(proposed.cols) || !isFinite(proposed.rows)) {
      requestAnimationFrame(initializeDimensions);
      return;
    }
    try {
      fit.fit();
    } catch (e) {
      requestAnimationFrame(initializeDimensions);
      return;
    }
    dimensionsInitialized = true;
    scheduleFocusCursorUpdate();
    if (viewportOffsetAwaitingCursor && viewportOffsetLimit > 0) {
      viewportOffset = chooseInitialViewportOffset(viewportOffsetLimit);
      applyViewportOffset(0);
    }
    post({ type: 'dimensions', cols: term.cols, rows: term.rows });
    post({ type: 'ready' });
  }

  var pendingWrites = [];
  var flushScheduled = false;
  var writeFlushRaf = 0;
  var writeQueue = [];
  var writeInProgress = false;
  function combineWrites(writes) {
    if (writes.length === 1) return writes[0];
    var total = 0;
    for (var i = 0; i < writes.length; i++) total += writes[i].length;
    var combined = new Uint8Array(total);
    var offset = 0;
    for (var j = 0; j < writes.length; j++) {
      combined.set(writes[j], offset);
      offset += writes[j].length;
    }
    return combined;
  }
  function finishWriteJob(afterWrite) {
    if (afterWrite) afterWrite();
    writeInProgress = false;
    drainWriteQueue();
  }
  function drainWriteQueue() {
    if (writeInProgress || takeoverInProgress) return;
    var job = writeQueue.shift();
    if (!job) return;
    writeInProgress = true;
    try {
      if (job.kind === 'snapshot') {
        term.reset();
        if (job.bytes.length === 0) {
          finishWriteJob(scrollToBottom);
          return;
        }
        term.write(job.bytes, function () {
          finishWriteJob(scrollToBottom);
        });
        return;
      }
      if (job.kind === 'clear') {
        term.clear();
        term.reset();
        finishWriteJob(scrollToBottom);
        return;
      }
      if (job.bytes.length === 0) {
        finishWriteJob();
        return;
      }
      term.write(job.bytes, finishWriteJob);
    } catch (e) {
      writeInProgress = false;
      reportError('terminal write failed', e);
      drainWriteQueue();
    }
  }
  function enqueueWriteJob(job) {
    writeQueue.push(job);
    drainWriteQueue();
  }
  function cancelPendingWriteBatch() {
    if (writeFlushRaf) cancelAnimationFrame(writeFlushRaf);
    writeFlushRaf = 0;
    flushScheduled = false;
    pendingWrites = [];
  }
  function scheduleFlush() {
    if (flushScheduled) return;
    flushScheduled = true;
    writeFlushRaf = requestAnimationFrame(function () {
      writeFlushRaf = 0;
      flushScheduled = false;
      if (pendingWrites.length === 0) return;
      var combined = combineWrites(pendingWrites);
      pendingWrites = [];
      enqueueWriteJob({ kind: 'write', bytes: combined });
    });
  }

  function decodeBase64(b64) {
    var bin = atob(b64);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  terminalHandleMessage = function (msg) {
    try {
      switch (msg.type) {
        case 'write':
          if (Array.isArray(msg.bytes)) {
            for (var writeIndex = 0; writeIndex < msg.bytes.length; writeIndex++) {
              pendingWrites.push(decodeBase64(msg.bytes[writeIndex]));
            }
          } else {
            pendingWrites.push(decodeBase64(msg.bytes));
          }
          scheduleFlush();
          break;
        case 'loadSnapshot':
          cancelPendingWriteBatch();
          writeQueue = [];
          enqueueWriteJob({ kind: 'snapshot', bytes: msg.bytes ? decodeBase64(msg.bytes) : new Uint8Array(0) });
          break;
        case 'takeover':
          pendingWrites = [];
          flushScheduled = false;
          if (writeFlushRaf) cancelAnimationFrame(writeFlushRaf);
          writeFlushRaf = 0;
          writeQueue = [];
          cancelTakeoverPresentation();
          takeoverInProgress = true;
          takeoverId = msg.id;
          takeoverStartedAt = performance.now();
          takeoverByteCount = 0;
          takeoverWrites = [];
          root.setAttribute('aria-busy', 'true');
          var resetTakeoverId = takeoverId;
          term.write('', function () {
            if (resetTakeoverId !== takeoverId) return;
            term.reset();
          });
          if (Array.isArray(msg.replay)) {
            for (var replayIndex = 0; replayIndex < msg.replay.length; replayIndex++) {
              var replayBytes = decodeBase64(msg.replay[replayIndex]);
              takeoverByteCount += replayBytes.length;
              takeoverWrites.push(replayBytes);
            }
          }
          if (msg.snapshot) {
            writeTakeoverSnapshot(msg.snapshot, takeoverId);
          } else if (msg.complete) {
            writeTakeoverSnapshot(null, takeoverId);
          }
          scrollToBottom();
          break;
        case 'takeoverWrite':
          if (!takeoverInProgress || msg.id !== takeoverId) break;
          var takeoverBytes = decodeBase64(msg.bytes);
          takeoverByteCount += takeoverBytes.length;
          takeoverWrites.push(takeoverBytes);
          break;
        case 'takeoverEnd':
          if (!takeoverInProgress || msg.id !== takeoverId) break;
          writeTakeoverSnapshot(msg.snapshot, takeoverId);
          break;
        case 'setTheme':
          term.options.theme = msg.theme;
          scheduleFocusCursorUpdate();
          break;
        case 'setFocused':
          setTerminalFocused(terminalFocused);
          break;
        case 'focusTerminal':
          term.focus();
          break;
        case 'blurTerminal':
          term.blur();
          break;
        case 'clear':
          cancelPendingWriteBatch();
          writeQueue = [];
          enqueueWriteJob({ kind: 'clear' });
          break;
        case 'scrollToBottom':
          scrollToBottom();
          break;
      }
    } catch (e) {
      reportError('handleMessage failed', e);
    }
  };

  setTerminalFocused(terminalFocused);
  requestAnimationFrame(initializeDimensions);
  }

  post({ type: 'bootstrapReady' });
})();
</script>
</body>
</html>`;
}
