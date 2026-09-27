export const TERMINAL_BOOTSTRAP_SCRIPT = `
  var viewportOffset = 0;
  var viewportOffsetLimit = 0;
  var pendingHideViewportOffset = null;
  var pendingHideViewportLimit = 0;
  var cancelTerminalMomentum = null;
  var getTerminalCursorBounds = null;
  var viewportOffsetAwaitingCursor = false;
  var viewportOffsetFollowsCursor = false;

  function post(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }

  function reportError(message, err) {
    post({ type: 'error', message: message + (err ? ': ' + (err && err.message ? err.message : String(err)) : '') });
  }

  if (!Terminal || !FitAddon) {
    reportError('xterm not loaded');
    return;
  }

  function installInitialFont(font) {
    if (!font) {
      return Promise.resolve();
    }
    var family = JSON.stringify(font.family);
    var styleEl = document.createElement('style');
    styleEl.textContent = '@font-face{font-family:' + family + ';src:url("data:font/ttf;base64,' + font.regular + '") format("truetype");font-weight:400;font-style:normal;font-display:block;}'
      + '@font-face{font-family:' + family + ';src:url("data:font/ttf;base64,' + font.bold + '") format("truetype");font-weight:700;font-style:normal;font-display:block;}';
    document.head.appendChild(styleEl);
    if (!document.fonts || !document.fonts.load) {
      return Promise.resolve();
    }
    return Promise.all([
      document.fonts.load('400 ' + INITIAL.fontSize + 'px ' + family),
      document.fonts.load('700 ' + INITIAL.fontSize + 'px ' + family),
    ]);
  }

  function initializeTerminal(msg) {
    if (initializationStarted) return;
    initializationStarted = true;
    INITIAL.fontFamily = msg.fontFamily;
    installInitialFont(msg.font).then(startTerminal, startTerminal);
  }

  function applyViewportOffset(duration) {
    var transitionDuration = Math.max(0, Number(duration) || 0);
    root.style.transition = transitionDuration > 0
      ? 'transform ' + transitionDuration + 'ms cubic-bezier(0.25, 0.1, 0.25, 1)'
      : 'none';
    root.style.transform = 'translate3d(0, ' + (-viewportOffset) + 'px, 0)';
  }

  function cursorViewportOffset(cursorBounds, viewportHeight, nextLimit) {
    if (cursorBounds === null) return 0;
    if (cursorBounds.bottom <= viewportHeight - nextLimit) return 0;
    if (cursorBounds.top - nextLimit < 0) return 0;
    return nextLimit;
  }

  function chooseInitialViewportOffset(nextLimit) {
    if (!getTerminalCursorBounds) {
      viewportOffsetAwaitingCursor = true;
      return 0;
    }
    var cursorBounds = getTerminalCursorBounds();
    if (cursorBounds === undefined) {
      viewportOffsetAwaitingCursor = true;
      return 0;
    }
    viewportOffsetAwaitingCursor = false;
    if (cursorBounds === null) return 0;
    return cursorViewportOffset(cursorBounds, root.clientHeight, nextLimit);
  }

  function reconcileVisibleViewport(nextLimit) {
    if (pendingHideViewportOffset !== null) {
      var wasPendingAboveKeyboard = pendingHideViewportLimit > 0
        && Math.abs(pendingHideViewportOffset - pendingHideViewportLimit) <= 0.5;
      viewportOffsetLimit = nextLimit;
      if (viewportOffsetFollowsCursor) {
        viewportOffset = chooseInitialViewportOffset(viewportOffsetLimit);
      } else {
        viewportOffset = wasPendingAboveKeyboard
          ? viewportOffsetLimit
          : Math.min(pendingHideViewportOffset, viewportOffsetLimit);
      }
      pendingHideViewportOffset = null;
      pendingHideViewportLimit = 0;
      return;
    }
    var previousLimit = viewportOffsetLimit;
    var wasAnchoredAboveKeyboard = previousLimit > 0 && Math.abs(viewportOffset - previousLimit) <= 0.5;
    viewportOffsetLimit = nextLimit;
    if (previousLimit === 0) {
      viewportOffsetFollowsCursor = true;
      viewportOffset = chooseInitialViewportOffset(viewportOffsetLimit);
      return;
    }
    if (viewportOffsetFollowsCursor) {
      viewportOffset = chooseInitialViewportOffset(viewportOffsetLimit);
      return;
    }
    if (wasAnchoredAboveKeyboard) {
      viewportOffset = viewportOffsetLimit;
      return;
    }
    viewportOffset = Math.min(viewportOffset, viewportOffsetLimit);
  }

  function setKeyboardOffset(offset, duration, phase) {
    var nextLimit = Math.max(0, Number(offset) || 0);
    var transitionDuration = Math.max(0, Number(duration) || 0);
    var limitChanged = Math.abs(nextLimit - viewportOffsetLimit) > 0.5;
    if (limitChanged && cancelTerminalMomentum) cancelTerminalMomentum();
    if (phase === 'willHide') {
      if (viewportOffsetLimit > 0) {
        pendingHideViewportOffset = viewportOffset;
        pendingHideViewportLimit = viewportOffsetLimit;
      }
      viewportOffsetLimit = 0;
      viewportOffset = 0;
      applyViewportOffset(transitionDuration);
      return;
    }
    if (phase === 'didHide' || nextLimit === 0) {
      viewportOffsetLimit = 0;
      viewportOffset = 0;
      pendingHideViewportOffset = null;
      pendingHideViewportLimit = 0;
      viewportOffsetAwaitingCursor = false;
      viewportOffsetFollowsCursor = false;
      applyViewportOffset(transitionDuration);
      return;
    }
    reconcileVisibleViewport(nextLimit);
    applyViewportOffset(transitionDuration);
  }

  function captureRenderedViewportOffset() {
    var transform = window.getComputedStyle(root).transform;
    var values;
    var translateY;
    if (transform && transform.indexOf('matrix3d(') === 0) {
      values = transform.slice(9, -1).split(',');
      translateY = Number(values[13]);
    } else if (transform && transform.indexOf('matrix(') === 0) {
      values = transform.slice(7, -1).split(',');
      translateY = Number(values[5]);
    }
    if (isFinite(translateY)) {
      viewportOffset = Math.min(viewportOffsetLimit, Math.max(0, -translateY));
    }
    applyViewportOffset(0);
  }

  function consumeViewportOffset(delta) {
    if (viewportOffsetLimit <= 0 || delta === 0) return delta;
    var nextOffset = Math.min(viewportOffsetLimit, Math.max(0, viewportOffset + delta));
    var consumed = nextOffset - viewportOffset;
    if (consumed === 0) return delta;
    viewportOffset = nextOffset;
    applyViewportOffset(0);
    return delta - consumed;
  }

  window.handleMessage = function (msg) {
    try {
      if (msg.type === 'initialize') {
        initializeTerminal(msg);
        return;
      }
      if (msg.type === 'setKeyboardOffset') {
        setKeyboardOffset(msg.offset, msg.duration, msg.phase);
        return;
      }
      if (msg.type === 'setFocused') {
        terminalFocused = Boolean(msg.focused);
      }
      if (terminalHandleMessage) terminalHandleMessage(msg);
    } catch (e) {
      reportError('handleMessage failed', e);
    }
  };
`;
