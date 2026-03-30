(() => {
  'use strict';

  // ===== CONFIGURATION =====
  const MODES = {
    auto: { maxVisible: 100, buffer: 100 },      // 200 total - Balanced
    aggressive: { maxVisible: 50, buffer: 50 },  // 100 total - Max performance
    minimal: { maxVisible: 150, buffer: 50 },    // 200 total - Light virtualization
    off: { maxVisible: Infinity, buffer: 0 }     // Disabled
  };

  const CONFIG = {
    mode: 'auto',           // 'auto' | 'aggressive' | 'minimal' | 'off'
    showOverlay: false,     // No visible UI - runs silently
    debug: false            // Console logging
  };

  // ===== STATE =====
  const state = {
    container: null,
    messages: new Map(),    // id -> { element, role, virtualized, placeholder }
    observer: null,
    mutationObserver: null,
    overlay: null,
    initialized: false,
    paused: false,
    strategy: 'unknown'     // 'react' | 'structural' | 'selector'
  };

  // ===== UTILITIES =====
  const log = (...args) => CONFIG.debug && console.log('[Grok Speed Booster]', ...args);

  function getMode() {
    return MODES[CONFIG.mode] || MODES.auto;
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).slice(0, 8);
  }

  function generateMessageId(element, index) {
    // Use stable attributes if available
    const explicitId = element.dataset?.messageId ||
                      element.dataset?.id ||
                      element.id;
    if (explicitId) return `msg_${explicitId}`;

    // Hash of content + position for stability
    const content = element.textContent?.slice(0, 200) || '';
    const contentHash = hashString(content);
    return `msg_${index}_${contentHash}`;
  }

  // ===== REACT FIBER DETECTION =====
  function findReactRoot() {
    // Method 1: Via React internal properties
    const body = document.body;
    const keys = Object.keys(body);
    const reactKey = keys.find(k =>
      k.startsWith('__reactContainer') ||
      k.startsWith('__reactFiber')
    );
    if (reactKey) return body[reactKey];

    // Method 2: Find via DOM traversal
    const containers = document.querySelectorAll('[data-reactroot], [data-reactid]');
    for (const container of containers) {
      const rootKey = Object.keys(container).find(k =>
        k.startsWith('_reactRootContainer') ||
        k.startsWith('__reactContainer')
      );
      if (rootKey && container[rootKey]) {
        const root = container[rootKey];
        return root._internalRoot?.current || root.current;
      }
    }

    return null;
  }

  function traverseFibers(fiber, callback) {
    if (!fiber) return;

    callback(fiber);

    let child = fiber.child;
    while (child) {
      traverseFibers(child, callback);
      child = child.sibling;
    }
  }

  function getDomNodeFromFiber(fiber) {
    let node = fiber;
    while (node) {
      if (node.stateNode instanceof HTMLElement) {
        return node.stateNode;
      }
      node = node.child;
    }
    return null;
  }

  function detectViaReactFibers() {
    const fiberRoot = findReactRoot();
    if (!fiberRoot) return null;

    log('Found React fiber root, scanning...');
    const messages = [];

    traverseFibers(fiberRoot, (fiber) => {
      const componentName = fiber.type?.name || fiber.type?.displayName;

      // Look for message-like component names
      if (componentName?.match(/Message|ChatMessage|Turn|ConversationItem|Bubble/i)) {
        const domNode = getDomNodeFromFiber(fiber);
        if (domNode && isValidMessageNode(domNode)) {
          messages.push({
            element: domNode,
            role: detectRole(domNode, messages.length),
            componentName
          });
        }
      }
    });

    log(`React Fiber detection found ${messages.length} messages`);
    return messages.length >= 2 ? messages : null;
  }

  // ===== STRUCTURAL DETECTION =====
  function findScrollableContainer() {
    const candidates = document.querySelectorAll('div, main, section, article');

    for (const el of candidates) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      // Must be reasonably sized scrollable area
      const isScrollable = (
        style.overflowY === 'auto' ||
        style.overflowY === 'scroll' ||
        el.scrollHeight > el.clientHeight + 50
      );

      if (!isScrollable) continue;
      if (rect.height < 200) continue; // Too small

      // Must have multiple substantial children
      const children = Array.from(el.children).filter(c => {
        const text = c.textContent?.trim();
        return text && text.length > 10 && c.offsetHeight > 30;
      });

      if (children.length >= 2) {
        log('Found scrollable container:', el.tagName, el.className?.slice(0, 50));
        return el;
      }
    }

    return null;
  }

  function detectViaStructure() {
    const container = findScrollableContainer();
    if (!container) return null;

    const candidates = Array.from(container.children).filter(child => {
      // Must be visible block element with content
      if (child.offsetHeight < 20) return false;
      const text = child.textContent?.trim();
      return text && text.length > 5;
    });

    const messages = candidates.map((el, index) => ({
      element: el,
      role: detectRole(el, index)
    }));

    log(`Structural detection found ${messages.length} messages`);
    return messages.length >= 2 ? { container, messages } : null;
  }

  // ===== SELECTOR FALLBACK =====
  const FALLBACK_SELECTORS = [
    '[data-message-id]',
    '[data-testid*="message"]',
    '[data-testid*="conversation"]',
    '.message',
    '.chat-message',
    '.response-content-markdown',
    'article'
  ];

  function detectViaSelectors() {
    for (const selector of FALLBACK_SELECTORS) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length >= 2) {
          const messages = Array.from(elements).map((el, index) => ({
            element: el,
            role: detectRole(el, index)
          }));
          log(`Selector "${selector}" found ${messages.length} messages`);
          return { messages };
        }
      } catch (e) {
        // Invalid selector, continue
      }
    }
    return null;
  }

  // ===== DETECTION HYBRID =====
  function detectMessages() {
    // Try React fibers first
    const viaReact = detectViaReactFibers();
    if (viaReact) {
      state.strategy = 'react';
      return { messages: viaReact };
    }

    // Try structural analysis
    const viaStructure = detectViaStructure();
    if (viaStructure) {
      state.strategy = 'structural';
      state.container = viaStructure.container;
      return { messages: viaStructure.messages };
    }

    // Fallback to selectors
    const viaSelectors = detectViaSelectors();
    if (viaSelectors) {
      state.strategy = 'selector';
      return viaSelectors;
    }

    return null;
  }

  // ===== MESSAGE UTILITIES =====
  function isValidMessageNode(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.offsetHeight < 20) return false;

    const text = el.textContent?.trim();
    return text && text.length > 5;
  }

  function detectRole(element, index) {
    // Check for visual alignment
    const style = window.getComputedStyle(element);
    const marginLeft = parseInt(style.marginLeft, 10) || 0;
    const marginRight = parseInt(style.marginRight, 10) || 0;

    if (style.alignSelf === 'flex-end' || marginLeft > marginRight * 2) {
      return 'user';
    }
    if (style.alignSelf === 'flex-start' || marginRight > marginLeft * 2) {
      return 'assistant';
    }

    // Check for role attributes
    const ariaRole = element.getAttribute('role');
    if (ariaRole === 'user') return 'user';
    if (ariaRole === 'assistant') return 'assistant';

    // Alternating pattern
    return index % 2 === 0 ? 'assistant' : 'user';
  }

  // ===== VIRTUALIZATION =====
  function createPlaceholder(original) {
    const rect = original.getBoundingClientRect();
    const height = rect.height || original.offsetHeight;

    if (!height || height < 10) return null;

    const placeholder = document.createElement('div');
    placeholder.className = 'gsb-placeholder';
    placeholder.style.cssText = `
      height: ${height}px;
      background: linear-gradient(90deg,
        rgba(74, 222, 128, 0.05) 0%,
        rgba(74, 222, 128, 0.1) 50%,
        rgba(74, 222, 128, 0.05) 100%);
      background-size: 200% 100%;
      border-radius: 8px;
      margin: 4px 0;
      opacity: 0.5;
      transition: opacity 0.2s;
    `;

    return placeholder;
  }

  function virtualizeMessage(id) {
    if (CONFIG.mode === 'off' || state.paused) return;

    const msg = state.messages.get(id);
    if (!msg || msg.virtualized) return;

    const placeholder = createPlaceholder(msg.element);
    if (!placeholder) return;

    msg.placeholder = placeholder;
    msg.originalDisplay = msg.element.style.display;

    msg.element.replaceWith(placeholder);
    msg.virtualized = true;

    log('Virtualized:', id.slice(0, 30));
    updateOverlay();
  }

  function restoreMessage(id) {
    const msg = state.messages.get(id);
    if (!msg || !msg.virtualized) return;

    msg.placeholder.replaceWith(msg.element);
    msg.element.style.display = msg.originalDisplay || '';
    msg.virtualized = false;
    msg.placeholder = null;

    log('Restored:', id.slice(0, 30));
    updateOverlay();
  }

  // ===== OBSERVERS =====
  function setupIntersectionObserver() {
    const mode = getMode();

    state.observer = new IntersectionObserver((entries) => {
      if (CONFIG.mode === 'off' || state.paused) return;

      entries.forEach(entry => {
        const id = entry.target.dataset.gsbId;
        if (!id) return;

        const msg = state.messages.get(id);
        if (!msg) return;

        if (entry.isIntersecting) {
          if (msg.virtualized) {
            restoreMessage(id);
          }
        } else {
          // Only virtualize if we have too many visible
          const visibleCount = Array.from(state.messages.values())
            .filter(m => !m.virtualized).length;

          if (visibleCount > mode.maxVisible && !msg.virtualized) {
            virtualizeMessage(id);
          }
        }
      });
    }, {
      root: state.container || null,
      rootMargin: `${mode.buffer}px`,
      threshold: 0
    });

    // Observe all messages
    state.messages.forEach((msg, id) => {
      msg.element.dataset.gsbId = id;
      state.observer.observe(msg.element);
    });
  }

  function setupMutationObserver() {
    const target = state.container || document.body;

    state.mutationObserver = new MutationObserver((mutations) => {
      if (CONFIG.mode === 'off') return;

      let hasNewMessages = false;

      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this is a new message
            if (isValidMessageNode(node)) {
              hasNewMessages = true;
            }
          }
        });
      });

      if (hasNewMessages) {
        setTimeout(() => scanForMessages(), 100);
      }
    });

    state.mutationObserver.observe(target, {
      childList: true,
      subtree: true
    });
  }

  // ===== MESSAGE SCANNING =====
  function scanForMessages() {
    const detected = detectMessages();
    if (!detected) {
      log('No messages detected');
      return false;
    }

    // Update message map
    detected.messages.forEach((msg, index) => {
      const id = generateMessageId(msg.element, index);

      if (!state.messages.has(id)) {
        // New message
        state.messages.set(id, {
          id,
          element: msg.element,
          role: msg.role,
          virtualized: false,
          placeholder: null
        });

        if (state.observer) {
          msg.element.dataset.gsbId = id;
          state.observer.observe(msg.element);
        }
      }
    });

    log(`Tracking ${state.messages.size} messages (${state.strategy})`);
    return true;
  }

  // ===== OVERLAY =====
  // Overlay functions disabled - extension runs silently
  function createOverlay() {
    // No-op - no visible UI
  }

  function updateOverlay() {
    // No-op - no visible UI
  }

  function togglePause() {
    state.paused = !state.paused;

    if (state.paused) {
      // Restore all when paused
      state.messages.forEach((msg, id) => {
        if (msg.virtualized) restoreMessage(id);
      });
      showToast('Paused - press Ctrl+Shift+P to resume');
    } else {
      showToast('Resumed');
      runOptimization();
    }
  }

  // ===== OPTIMIZATION =====
  function runOptimization() {
    if (CONFIG.mode === 'off' || state.paused) return;

    const mode = getMode();
    const allMessages = Array.from(state.messages.values());
    const visibleMessages = allMessages.filter(m => !m.virtualized);

    if (visibleMessages.length <= mode.maxVisible) return;

    // Virtualize oldest messages (those furthest from viewport)
    const toVirtualize = visibleMessages
      .slice(0, visibleMessages.length - mode.maxVisible);

    toVirtualize.forEach(msg => {
      virtualizeMessage(msg.id);
    });

    log(`Optimized: ${toVirtualize.length} messages virtualized`);
  }

  // ===== TOAST NOTIFICATION =====
  function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 20px;
      background: rgba(10, 10, 15, 0.95);
      border: 1px solid rgba(74, 222, 128, 0.3);
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      color: #fff;
      z-index: 2147483647;
      animation: fade-in 0.3s ease;
      pointer-events: none;
    `;
    toast.textContent = message;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes fade-in {
        from { opacity: 0; transform: translateX(-50%) translateY(10px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2000);
  }

  // ===== KEYBOARD COMMANDS =====
  function handleKeydown(e) {
    // Ctrl+Shift shortcuts (matching manifest)
    if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey) {
      switch (e.code) {
        case 'KeyO':
          e.preventDefault();
          runOptimization();
          showToast('Optimized');
          break;
        case 'KeyP':
          e.preventDefault();
          togglePause();
          break;
      }
    }
  }

  // ===== INITIALIZATION =====
  async function loadConfig() {
    try {
      const stored = await chrome.storage.sync.get(['mode', 'showOverlay', 'debug']);

      // Validate and merge stored config
      if (stored.mode && MODES[stored.mode]) {
        CONFIG.mode = stored.mode;
      }
      if (typeof stored.showOverlay === 'boolean') {
        CONFIG.showOverlay = stored.showOverlay;
      }
      if (typeof stored.debug === 'boolean') {
        CONFIG.debug = stored.debug;
      }
    } catch (e) {
      // Use defaults
      log('Failed to load config, using defaults');
    }
  }

  function init() {
    if (state.initialized) return;

    log('Initializing...');

    // Scan for messages
    if (!scanForMessages()) {
      log('No messages found, retrying in 2s...');
      setTimeout(init, 2000);
      return;
    }

    // Setup observers
    setupIntersectionObserver();
    setupMutationObserver();

    // Keyboard shortcuts
    window.addEventListener('keydown', handleKeydown);

    // Periodic optimization (check if paused)
    setInterval(() => {
      if (!state.paused) runOptimization();
    }, 5000);

    state.initialized = true;
    log('Initialized successfully');
  }

  // ===== MESSAGE HANDLING =====
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'getStatus':
        sendResponse({
          mode: CONFIG.mode,
          paused: state.paused,
          messages: state.messages.size,
          virtualized: Array.from(state.messages.values())
            .filter(m => m.virtualized).length,
          strategy: state.strategy
        });
        break;

      case 'setMode':
        CONFIG.mode = request.mode;
        chrome.storage.sync.set({ mode: request.mode });
        if (request.mode === 'off') {
          state.messages.forEach((msg, id) => restoreMessage(id));
        } else {
          runOptimization();
        }
        sendResponse({ success: true });
        break;

      case 'manualOptimize':
        runOptimization();
        showToast('Optimized');
        sendResponse({ success: true });
        break;
    }
    return true;
  });

  // ===== STARTUP =====
  loadConfig().then(() => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  });

  // Handle navigation changes (SPA)
  let lastUrl = location.href;
  let navigationTimeout = null;

  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;

      // Debounce navigation changes
      if (navigationTimeout) clearTimeout(navigationTimeout);
      navigationTimeout = setTimeout(() => {
        state.initialized = false;
        state.messages.clear();
        if (state.observer) state.observer.disconnect();
        if (state.mutationObserver) state.mutationObserver.disconnect();
        init();
      }, 500);
    }
  });

  // Only observe body, not entire document
  if (document.body) {
    urlObserver.observe(document.body, { childList: true });
  }
})();
