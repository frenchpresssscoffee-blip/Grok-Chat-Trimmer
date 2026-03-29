(() => {
  'use strict';

  const CONFIG = Object.freeze({
    maxMessages: 80,
    trimIntervalMs: 8000,
    trimDebounceMs: 80,
    minMessageTextLength: 8,
    maxAncestorDepth: 6,
    minMatchedMessages: 2,
    logPrefix: '[Grok DOM Trim]'
  });

  const SELECTORS = Object.freeze({
    messageNodes: [
      '.response-content-markdown',
      'article',
      '[data-testid*="conversation"]',
      '[data-testid*="message"]',
      '[data-message-id]',
      '[role="article"]'
    ],
    preferredContainers: [
      'div[class*="scrollbar-gutter-stable"][class*="px-gutter"][class*="overflow-y-auto"]',
      'div[class*="@container/chat"]',
      '[role="log"]'
    ],
    containerHints: [
      '[class*="scrollbar-gutter-stable"]',
      '[class*="px-gutter"]',
      '[class*="@container/chat"]',
      '[class*="response-content-markdown"]',
      '[aria-live="polite"]',
      '[aria-live="assertive"]',
      '[data-testid*="conversation"]',
      '[data-testid*="message-list"]',
      '[data-testid*="chat"]',
      'main',
      '[role="main"]'
    ]
  });

  const OBSERVER_OPTIONS = Object.freeze({
    childList: true,
    subtree: true
  });

  const MESSAGE_SELECTOR = SELECTORS.messageNodes.join(',');
  const DIRECT_MESSAGE_SELECTORS = SELECTORS.messageNodes.map((selector) => `:scope > ${selector}`);

  const state = {
    messageContainer: null,
    collectMessages: null,
    containerObserver: null,
    rootObserver: null,
    trimTimeoutId: 0,
    pendingReason: 'startup',
    isTrimming: false
  };

  function isSupportedPage() {
    return (
      location.hostname === 'grok.x.ai' ||
      (location.hostname === 'x.com' && location.pathname.startsWith('/grok'))
    );
  }

  function logTrim(removedCount, reason) {
    const suffix = removedCount === 1 ? '' : 's';
    console.info(
      CONFIG.logPrefix,
      `Trimmed ${removedCount} old message${suffix} (${reason}); kept last ${CONFIG.maxMessages}.`
    );
  }

  function uniqueElements(elements) {
    return [...new Set(elements)].filter((element) => element instanceof Element);
  }

  function disconnectObserver(key) {
    const observer = state[key];
    if (!observer) {
      return;
    }

    observer.disconnect();
    state[key] = null;
  }

  function clearScheduledTrim() {
    if (!state.trimTimeoutId) {
      return;
    }

    window.clearTimeout(state.trimTimeoutId);
    state.trimTimeoutId = 0;
  }

  function resetState() {
    disconnectObserver('containerObserver');
    disconnectObserver('rootObserver');
    clearScheduledTrim();

    state.messageContainer = null;
    state.collectMessages = null;
    state.pendingReason = 'startup';
    state.isTrimming = false;
  }

  function isLikelyMessageNode(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
      return false;
    }

    if (element.matches('form, nav, aside, header, footer, script, style')) {
      return false;
    }

    const text = (element.textContent || '').trim();
    return text.length >= CONFIG.minMessageTextLength;
  }

  function getDirectChild(ancestor, node) {
    let current = node;

    while (current && current.parentElement !== ancestor) {
      current = current.parentElement;
    }

    return current && current.parentElement === ancestor ? current : null;
  }

  function createCollector(sample, collect) {
    if (sample.length < CONFIG.minMatchedMessages) {
      return null;
    }

    return { sample, collect };
  }

  function createDirectCollector(container) {
    for (const selector of DIRECT_MESSAGE_SELECTORS) {
      const sample = uniqueElements(Array.from(container.querySelectorAll(selector)));
      if (sample.length >= CONFIG.minMatchedMessages) {
        return createCollector(sample, () => uniqueElements(Array.from(container.querySelectorAll(selector))));
      }
    }

    return null;
  }

  function collectDescendantMessages(container) {
    return uniqueElements(
      Array.from(container.querySelectorAll(MESSAGE_SELECTOR))
        .map((node) => getDirectChild(container, node))
        .filter(isLikelyMessageNode)
    );
  }

  function createDescendantCollector(container) {
    const sample = collectDescendantMessages(container);
    return createCollector(sample, () => collectDescendantMessages(container));
  }

  function createChildrenCollector(container) {
    const sample = Array.from(container.children).filter(isLikelyMessageNode);
    return createCollector(sample, () => Array.from(container.children).filter(isLikelyMessageNode));
  }

  function createMessageCollector(container) {
    if (!(container instanceof Element)) {
      return null;
    }

    return (
      createDirectCollector(container) ||
      createDescendantCollector(container) ||
      createChildrenCollector(container)
    );
  }

  function addCandidate(candidates, element, weight = 0) {
    if (!(element instanceof Element)) {
      return;
    }

    const currentWeight = candidates.get(element) || 0;
    candidates.set(element, currentWeight + weight);
  }

  function scoreContainer(container, weight) {
    const collector = createMessageCollector(container);
    if (!collector) {
      return null;
    }

    let score = (collector.sample.length * 20) + weight;

    if (container.scrollHeight > container.clientHeight) {
      score += 5;
    }

    for (const selector of SELECTORS.preferredContainers) {
      if (container.matches(selector)) {
        score += 15;
        break;
      }
    }

    return {
      container,
      collect: collector.collect,
      score
    };
  }

  function findBestMessageContainer() {
    const root = document.querySelector('main, [role="main"]') || document.body;
    if (!root) {
      return null;
    }

    const candidates = new Map();
    addCandidate(candidates, root);

    for (const selector of SELECTORS.preferredContainers) {
      root.querySelectorAll(selector).forEach((element) => addCandidate(candidates, element, 15));
    }

    for (const selector of SELECTORS.containerHints) {
      root.querySelectorAll(selector).forEach((element) => addCandidate(candidates, element, 5));
    }

    const messageNodes = Array.from(root.querySelectorAll(MESSAGE_SELECTOR));
    for (const node of messageNodes) {
      let current = node.parentElement;
      let depth = 0;

      while (current && current !== root.parentElement && depth < CONFIG.maxAncestorDepth) {
        if (current.childElementCount >= 2 && current.childElementCount <= 500) {
          addCandidate(candidates, current, 1);
        }

        if (current === root) {
          break;
        }

        current = current.parentElement;
        depth += 1;
      }
    }

    let bestMatch = null;

    for (const [candidate, weight] of candidates.entries()) {
      const scored = scoreContainer(candidate, weight);
      if (!scored) {
        continue;
      }

      if (!bestMatch || scored.score > bestMatch.score) {
        bestMatch = scored;
      }
    }

    return bestMatch;
  }

  function ensureRootObserver() {
    if (state.rootObserver || !document.body || !isSupportedPage()) {
      return;
    }

    state.rootObserver = new MutationObserver(() => {
      if (!isSupportedPage()) {
        resetState();
        return;
      }

      if (state.messageContainer && state.messageContainer.isConnected && state.collectMessages) {
        disconnectObserver('rootObserver');
        return;
      }

      if (ensureMessageContainer()) {
        scheduleTrim('container-detected');
      }
    });

    state.rootObserver.observe(document.body, OBSERVER_OPTIONS);
  }

  function observeMessageContainer(container, collectMessages) {
    disconnectObserver('containerObserver');

    state.messageContainer = container;
    state.collectMessages = collectMessages;

    state.containerObserver = new MutationObserver((mutations) => {
      if (!isSupportedPage()) {
        resetState();
        return;
      }

      if (state.isTrimming) {
        return;
      }

      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          scheduleTrim('mutation');
          return;
        }
      }
    });

    state.containerObserver.observe(container, OBSERVER_OPTIONS);
    disconnectObserver('rootObserver');
  }

  function ensureMessageContainer() {
    if (!isSupportedPage()) {
      resetState();
      return false;
    }

    if (state.messageContainer && state.messageContainer.isConnected && state.collectMessages) {
      return true;
    }

    const match = findBestMessageContainer();
    if (!match) {
      ensureRootObserver();
      return false;
    }

    observeMessageContainer(match.container, match.collect);
    return true;
  }

  function getTrackedMessages() {
    return state.collectMessages ? state.collectMessages() : [];
  }

  function refreshTrackedMessages() {
    let messages = getTrackedMessages();

    if (messages.length >= CONFIG.minMatchedMessages) {
      return messages;
    }

    state.messageContainer = null;
    state.collectMessages = null;

    if (!ensureMessageContainer()) {
      return [];
    }

    messages = getTrackedMessages();
    return messages;
  }

  function trimMessages(reason) {
    if (!ensureMessageContainer()) {
      return;
    }

    const messages = refreshTrackedMessages();
    if (messages.length <= CONFIG.maxMessages) {
      return;
    }

    const removeCount = messages.length - CONFIG.maxMessages;
    const containerObserver = state.containerObserver;

    if (containerObserver) {
      containerObserver.disconnect();
    }

    state.isTrimming = true;

    try {
      for (let index = 0; index < removeCount; index += 1) {
        messages[index].remove();
      }
    } finally {
      state.isTrimming = false;

      if (containerObserver && state.messageContainer && state.messageContainer.isConnected) {
        containerObserver.observe(state.messageContainer, OBSERVER_OPTIONS);
      } else {
        ensureRootObserver();
      }
    }

    logTrim(removeCount, reason);
  }

  function scheduleTrim(reason) {
    state.pendingReason = reason;

    if (state.trimTimeoutId) {
      return;
    }

    state.trimTimeoutId = window.setTimeout(() => {
      state.trimTimeoutId = 0;
      trimMessages(state.pendingReason);
    }, CONFIG.trimDebounceMs);
  }

  function isTypingTarget(target) {
    return (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.matches('input, textarea, select, [role="textbox"]'))
    );
  }

  function handleKeydown(event) {
    if (!isSupportedPage() || event.defaultPrevented || event.repeat) {
      return;
    }

    if (!event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.code !== 'KeyT') {
      return;
    }

    if (isTypingTarget(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    trimMessages('hotkey');
  }

  function start() {
    if (!isSupportedPage()) {
      return;
    }

    ensureMessageContainer();
    scheduleTrim('startup');
    ensureRootObserver();

    window.addEventListener('keydown', handleKeydown, true);
    window.setInterval(() => {
      trimMessages('interval');
    }, CONFIG.trimIntervalMs);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
