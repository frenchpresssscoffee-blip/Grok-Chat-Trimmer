A lightweight Chromium extension that eliminates lag and freezing in long Grok conversations by intelligently
  virtualizing off-screen messages.

  What It Does

  - Runs automatically on https://grok.com/* and https://grok.x.ai/*
  - Detects chat messages using React Fiber analysis, DOM structure, and selector fallbacks
  - Virtualizes messages outside your viewport (replaces with lightweight placeholders)
  - Restores seamlessly when you scroll back - no lost conversation history
  - Keeps ~100-200 messages rendered depending on mode (configurable)
  - Optimizes automatically as you chat - no manual intervention needed
  - Runs silently - no visible UI, badges, or overlays
  - Supports keyboard shortcuts for quick control

  What It Does Not Do

  - It does not delete your conversation from Grok servers
  - It does not clear your account history
  - It does not send network requests
  - It does not modify prompts or responses
  - It only hides older message elements from the current page view (they restore on scroll)

  If the page reloads, all messages reappear as normal. This is expected.

  Why This Exists

  Grok (like other AI chat interfaces) keeps all conversation messages rendered in the DOM indefinitely. As chats grow
  to 50, 100, or 200+ messages, this causes:

  - Scrolling lag and stuttering
  - Input delay when typing
  - Browser memory pressure
  - Page freezing or unresponsiveness

  Speed Booster fixes this by virtualizing messages outside your viewport - replacing them with placeholders that
  preserve scroll position while freeing up DOM nodes and memory. When you scroll back up, messages restore seamlessly.

  Installation

  Brave / Chrome / Edge

  1. Download this repository to your computer
  2. Open your browser and go to chrome://extensions/ (or brave://extensions/)
  3. Turn on Developer mode (toggle in top-right corner)
  4. Click Load unpacked
  5. Select the speed-booster-grok folder
  6. The extension icon should appear in your toolbar

  Setting Keyboard Shortcuts

  1. Go to chrome://extensions/shortcuts
  2. Find "Speed Booster for Grok"
  3. Set your preferred shortcuts (or keep defaults):
    - Ctrl+Shift+O: Force optimize now
    - Ctrl+Shift+P: Pause/resume extension


  Privacy and Security

  - ✅ No background service worker
  - ✅ No external network access
  - ✅ No data collection
  - ✅ No cookies access
  - ✅ No account interaction
  - ✅ No remote code
  - ✅ Open source

  Troubleshooting

  Extension loads but nothing happens:
  1. Ensure you're on grok.com or grok.x.ai
  2. Reload the extension from the extensions page
  3. Refresh the Grok tab
  4. Open DevTools Console and check for [Grok Speed Booster] logs

  Page still feels slow:
  - Try switching to Aggressive mode in Options
  - Some slowdown may be from Grok's server response (not fixable by this extension)
  
  The extension is ready to use. Load it at chrome://extensions/ → Developer mode → Load unpacked → select
