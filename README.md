# Grok Chat Trimmer

Grok Chat Trimmer is a lightweight Chromium extension for long Grok conversations that start to lag because too many old message nodes stay mounted in the page DOM.

The extension runs directly on Grok pages, detects the active chat message container, and removes older message elements from the live page once the DOM grows beyond a configured limit. It keeps the latest messages visible while reducing the amount of DOM Grok has to render and update.

## What It Does

- Runs automatically on `https://grok.x.ai/*`
- Runs automatically on `https://x.com/grok*`
- Detects the active Grok message list without requiring manual setup
- Keeps only the last `80` message nodes in the DOM
- Trims on new messages using `MutationObserver`
- Trims every `8` seconds as a fallback
- Logs every successful trim to the browser console
- Supports a manual trim hotkey: `Shift + T`

## What It Does Not Do

- It does not delete your conversation from Grok or X servers
- It does not clear your account history
- It does not send network requests
- It does not modify prompts or responses
- It only removes older message elements from the current live page DOM

If the page reloads or Grok re-fetches old history, those messages can appear again. This is expected.

## Why This Exists

Some chat interfaces keep very large conversation histories mounted at once. As the DOM grows, scrolling, typing, and rendering can become noticeably slower. This extension reduces that DOM bloat by removing older message elements after they are no longer needed on screen.

The goal is simple:

- keep the latest part of the conversation visible
- reduce DOM size
- lower layout and repaint overhead
- improve responsiveness in long chats

## How It Works

The extension injects a single content script, `content.js`, after the Grok page reaches `document_idle`.

The script:

1. Checks whether the current page is a supported Grok URL.
2. Searches for the most likely message container using a combination of:
   - Grok-specific selectors seen on the live site
   - common message-node selectors
   - container scoring heuristics
3. Builds a lightweight collector for message nodes inside that container.
4. Watches the container for added child nodes using `MutationObserver`.
5. When the number of tracked message nodes exceeds `80`, removes the oldest nodes from the DOM.
6. Writes a console log entry describing how many messages were trimmed and why.

The script is designed to stay lightweight:

- it caches the detected container
- it debounces trim requests
- it disconnects the observer during DOM removal to avoid observer churn
- it avoids broad rescans unless the container becomes stale or disconnected

## Supported Browsers

Any Chromium-based browser that supports Manifest V3 should work, including:

- Brave
- Chrome
- Edge
- Opera

This project has been written specifically for Chromium extension behavior.

## File Structure

```text
grok-dom-trimmer-extension/
  manifest.json
  content.js
  README.md
```

## Installation

### Brave

1. Open Brave.
2. Go to `brave://extensions/`
3. Turn on `Developer mode` in the top-right corner.
4. Click `Load unpacked`.
5. Select this folder:

```text
C:\Users\Administrator\grok-dom-trimmer-extension
```

6. The extension should appear as `Grok Chat Trimmer`.

### Chrome

1. Open Chrome.
2. Go to `chrome://extensions/`
3. Turn on `Developer mode`.
4. Click `Load unpacked`.
5. Select:

```text
C:\Users\Administrator\grok-dom-trimmer-extension
```

### After Updating the Files

If you change the extension files later:

1. Return to the extensions page.
2. Find `Grok Chat Trimmer`.
3. Click `Reload`.
4. Refresh the Grok tab.

## Usage

Once installed, the extension runs automatically on supported Grok pages.

You do not need to click anything.

Normal behavior:

- Open a long Grok conversation
- Continue chatting as usual
- The extension watches for new message nodes
- Older nodes are removed only after the tracked count exceeds `80`

Manual trim:

- Press `Shift + T`

This triggers an immediate manual trim of older DOM messages if the tracked count is over the limit.

## Console Logs

The extension logs successful trims in DevTools Console with this prefix:

```text
[Grok DOM Trim]
```

Example:

```text
[Grok DOM Trim] Trimmed 24 old messages (mutation); kept last 80.
```

Possible reasons in the log:

- `startup`
- `mutation`
- `interval`
- `hotkey`
- `container-detected`

## Privacy and Security

This extension is intentionally minimal.

- No background service worker
- No external network access
- No storage permissions
- No cookies access
- No account interaction
- No remote code

It only runs as a content script on the two Grok URL patterns listed in `manifest.json`.

## Tuning

Current defaults are defined in `content.js`:

- `maxMessages: 80`
- `trimIntervalMs: 8000`
- `trimDebounceMs: 80`

If you want different behavior:

- Increase `maxMessages` to keep more history visible
- Decrease `maxMessages` to reduce DOM size more aggressively
- Lower `trimIntervalMs` for more frequent fallback trims
- Raise `trimDebounceMs` if Grok produces very bursty DOM updates

## Troubleshooting

### The extension loads but nothing happens

Check the following:

1. Make sure you loaded the correct folder:

```text
C:\Users\Administrator\grok-dom-trimmer-extension
```

2. Make sure you are on one of these pages:
   - `https://grok.x.ai/...`
   - `https://x.com/grok...`

3. Reload the extension from the browser extensions page.
4. Refresh the Grok tab.
5. Open DevTools Console and press `Shift + T`.

If the extension is working, you should eventually see a log line beginning with:

```text
[Grok DOM Trim]
```

### The page still feels slow

Possible reasons:

- Grok changed its DOM structure
- the slow-down is caused by other page scripts, not just message DOM size
- the conversation has embedded content or code blocks that are expensive even in smaller numbers

If needed, inspect the current DOM again and update the selector hints in `content.js`.

### It trims the wrong elements

This can happen if Grok changes the message tree significantly. In that case:

1. Inspect a real message wrapper in DevTools
2. Capture its parent container
3. Update the selectors in `content.js`

The extension already includes Grok-specific hints, but DOM-heavy web apps can change over time.

## Limitations

- This is a DOM-trimming solution, not a virtualization engine
- It depends on the current Grok page structure
- Removed messages are only removed from the current live page
- Browser refreshes or site rerenders may bring old messages back
- Future Grok UI changes may require selector updates

## Development Notes

The extension was intentionally kept small:

- one `manifest.json`
- one `content.js`
- no build step
- no framework
- no dependencies

That makes it easy to inspect, modify, and reload locally.

## Recommended Name

Use:

```text
Grok Chat Trimmer
```

It is simple, descriptive, and sounds like a real utility extension rather than a throwaway script.
