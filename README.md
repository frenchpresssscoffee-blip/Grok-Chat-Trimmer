# Speed Booster for Grok

A lightweight Chromium extension that eliminates lag and freezing in long Grok conversations by intelligently virtualizing off-screen messages.

## What It Does

- **Runs automatically** on `https://grok.com/*` and `https://grok.x.ai/*`
- **Detects chat messages** using React Fiber analysis, DOM structure, and selector fallbacks
- **Virtualizes messages** outside your viewport (replaces with lightweight placeholders)
- **Restores seamlessly** when you scroll back - no lost conversation history
- **Keeps ~100-200 messages** rendered depending on mode (configurable)
- **Optimizes automatically** as you chat - no manual intervention needed
- **Runs silently** - no visible UI, badges, or overlays
- **Supports keyboard shortcuts** for quick control

## What It Does Not Do

- It does **not** delete your conversation from Grok servers
- It does **not** clear your account history
- It does **not** send network requests
- It does **not** modify prompts or responses
- It only hides older message elements from the current page view (they restore on scroll)

If the page reloads, all messages reappear as normal. This is expected.

## Why This Exists

Grok (like other AI chat interfaces) keeps all conversation messages rendered in the DOM indefinitely. As chats grow to 50, 100, or 200+ messages, this causes:

- Scrolling lag and stuttering
- Input delay when typing
- Browser memory pressure
- Page freezing or unresponsiveness

Speed Booster fixes this by **virtualizing** messages outside your viewport - replacing them with placeholders that preserve scroll position while freeing up DOM nodes and memory. When you scroll back up, messages restore seamlessly.

## How It Works

The extension injects a content script that runs when the Grok page loads.

### Detection Strategy

The extension uses a hybrid approach to find chat messages:

1. **React Fiber Analysis** (Primary)
   - Traverses React's internal component tree
   - Finds Message/ChatMessage/Conversation components
   - Most reliable method for React-based apps

2. **Structural Analysis** (Fallback)
   - Identifies scrollable conversation containers
   - Analyzes message-like children by content/position
   - Works even without React DevTools

3. **Selector Fallback** (Last resort)
   - Uses CSS selectors as backup
   - Catches edge cases the other methods miss

### Virtualization

- Messages outside viewport are replaced with height-preserving placeholders
- Original elements are stored in memory (not deleted)
- Scroll position is maintained exactly
- Messages restore instantly when scrolled into view
- IntersectionObserver tracks visibility efficiently

## Installation

### Brave / Chrome / Edge

1. Download this repository to your computer
2. Open your browser and go to `chrome://extensions/` (or `brave://extensions/`)
3. Turn on **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `speed-booster-grok` folder
6. The extension icon should appear in your toolbar

### Setting Keyboard Shortcuts

1. Go to `chrome://extensions/shortcuts`
2. Find "Speed Booster for Grok"
3. Set your preferred shortcuts (or keep defaults):
   - **Ctrl+Shift+O**: Force optimize now
   - **Ctrl+Shift+P**: Pause/resume extension

## Usage

Once installed, the extension runs automatically on supported Grok pages.

### Normal Behavior

1. Open a Grok conversation
2. Continue chatting as usual
3. The extension automatically manages message visibility as you scroll
4. No visible UI - it runs silently in the background
5. Open DevTools Console to see activity logs (if debug enabled)

### Controls

| Action | How |
|--------|-----|
| Pause/Resume | Press **Ctrl+Shift+P** |
| Force optimize | Press **Ctrl+Shift+O** |
| Change mode | Right-click extension icon → **Options** |

### Modes

Choose your optimization level in Options:

- **Auto** (Recommended): Balanced - keeps ~100 visible, 200 total max
- **Aggressive**: Max performance - keeps ~50 visible, 100 total max
- **Minimal**: Light virtualization - keeps ~150 visible, 200 total max
- **Off**: Disable completely

## File Structure

```
speed-booster-grok/
  manifest.json          # Extension manifest (Manifest V3)
  content.js             # Main optimization engine
  options.html           # Settings page
  icons/
    icon16.png
    icon32.png
    icon48.png
    icon128.png
  README.md
```

## Console Logs

The extension logs activity to DevTools Console with the prefix:

```
[Grok Speed Booster]
```

Enable debug mode in Options to see detailed logs including:
- Detection strategy used (react/structural/selector)
- Number of messages found
- Virtualization/restoration events

## Privacy and Security

This extension is intentionally minimal and privacy-focused:

- ✅ No background service worker
- ✅ No external network access
- ✅ No data collection
- ✅ No cookies access
- ✅ No account interaction
- ✅ No remote code
- ✅ Open source

It only runs as a content script on Grok URL patterns and stores settings locally in browser storage.

## Troubleshooting

### The extension loads but nothing happens

1. Make sure you loaded the correct folder
2. Ensure you're on `grok.com` or `grok.x.ai`
3. Reload the extension from the extensions page
4. Refresh the Grok tab
5. Open DevTools Console and check for logs

### Page still feels slow

- Try switching to **Aggressive** mode in Options
- Some slowdown may be from Grok's server response (not fixable by this extension)
- Check if other browser extensions are conflicting

### Want to temporarily disable

- Press **Ctrl+Shift+P** to pause/resume
- Or switch to **Off** mode in Options

## Comparison: Virtualization vs Trimming

| Feature | Virtualization (This Extension) | Trimming (Other Extensions) |
|---------|--------------------------------|------------------------------|
| Old messages | Hidden with placeholders | Permanently deleted |
| Scroll back | ✅ Messages restore | ❌ Gone until refresh |
| DOM size | Reduced | Reduced |
| History | Fully preserved | Partially lost |

## Development

The extension is intentionally kept small for easy modification:

- One `content.js` file (~600 lines)
- No build step required
- No external dependencies
- Vanilla JavaScript

To modify:

1. Edit files in the extension folder
2. Go to `chrome://extensions/`
3. Click **Reload** on Speed Booster
4. Refresh your Grok tab

## Browser Support

Any Chromium-based browser supporting Manifest V3:

- ✅ Brave
- ✅ Chrome (88+)
- ✅ Edge
- ✅ Opera

## License

MIT License - Feel free to modify and distribute.

## Contributing

Issues and pull requests welcome! Focus areas:

- Improving detection for Grok UI changes
- Additional browser support
- Performance optimizations
- Better mode presets

---

**Note:** This extension is not affiliated with xAI or Grok. Use at your own risk.
