# Embedding a Game web bundle in the Hub's iframe (phone-first)

Research for #202 (map #200). Question: what limits does a Game built as a web bundle (Godot 4,
Unity, Phaser…) hit when it runs inside the Hub's iframe, mostly on iOS Safari and Android Chrome?
Context: a web Hub (likely React) embeds each Game as its own bundle in an `<iframe>`, landscape,
hosted on Vercel.

Checked 2026-11-20. Browser support comes from MDN's browser-compat-data (`@mdn/browser-compat-data`
`data.json`, the data behind MDN's tables), noted as "BCD".

## What the repo does today

- Godot 4.7.2, **single-threaded** web templates: `variant/thread_support=false` and
  `web_nothreads_*.zip` in `apps/client/export_presets.cfg`, `tools/godot/export.mjs`,
  `tools/godot/version.json`.
- **No COOP/COEP headers anywhere.** `vercel.json` sets only `Cache-Control` (immutable for
  `/content/*.pck`, `no-cache` for `/`, `index.html`, `manifest.json`). `scripts/web.mjs` just proxies
  `/api` and `/ws` and serves files.
- `apps/client/web-shell.html` already deals with phone quirks: `viewport-fit=cover`,
  `interactive-widget=overlays-content`, `env(safe-area-inset-*)` padding, a "stable size" override of
  `innerWidth/innerHeight` so the virtual keyboard does not shrink the canvas, and scroll resets on
  `focusin`/`visualViewport` events. These move into whichever document owns the screen.
- The release engine is large: `godot.wasm` is 39.5 MB uncompressed in the 4.7.2 nothreads template.

## Constraints

| Constraint | Impact on Hub + iframe Game | Mitigation |
| --- | --- | --- |
| **Godot threads need cross-origin isolation.** Threaded exports use `SharedArrayBuffer` and "will not run" without `COOP: same-origin` + `COEP: require-corp` ([Godot docs][godot-web]). Since 4.3 single-threaded is "the preferred and now default way", and is the one that "works well on macOS and iOS" ([Godot docs][godot-web]). | Turning on threads forces COOP/COEP on the **Hub** too: `crossOriginIsolated` needs COOP `same-origin` + COEP on the top document, and the `cross-origin-isolated` permission (default allowlist `self`) for frames ([MDN][mdn-coi]). | Stay on **nothreads** builds (as today). No COOP/COEP needed. |
| **COEP `credentialless` and `<iframe credentialless>` are Chromium-only.** BCD: COEP `credentialless` Chrome Android 96, Safari/iOS **no**; `iframe credentialless` Chrome Android 110, Safari **no**. COOP/COEP `require-corp` and `SharedArrayBuffer` are in Safari iOS 15.2+. | If isolation is ever needed, iOS forces `require-corp`: every cross-origin subresource (avatars, CDN fonts, analytics, OAuth widgets) must send `Cross-Origin-Resource-Policy` or be loaded with CORS ([MDN COEP][mdn-coep]). The `cross-origin-isolated` Permissions-Policy is not in Safari per BCD, so a cross-origin isolated iframe on iOS is untested ground. | Avoid. If a Game truly needs threads, serve it same-origin with the Hub and put COOP/COEP on both; test on a real iPhone first. |
| **Fullscreen API does not exist on iPhone.** BCD `Element.requestFullscreen` on iOS: "Only available on iPad, not on iPhone"; on iPad "Shows an overlay button which can not be disabled. Swiping down exits fullscreen mode, making it unsuitable for … games." Android Chrome supports it (71+); `<iframe allowfullscreen>` / `allow="fullscreen"` delegates it. Browsers allow it only inside a user input event ([Godot docs][godot-web]). | On iPhone the Game is always inside Safari's chrome (URL bar, home indicator). Fullscreen is a nice-to-have on Android only. | Call fullscreen on the **Hub's** element that wraps the iframe (or the iframe itself), from a tap in the Hub. iPhone: "Add to Home Screen" (PWA `display: fullscreen`/`standalone`) is the only way to drop browser UI. |
| **Orientation lock is Android-only and needs fullscreen.** BCD `ScreenOrientation.lock`: Safari/iOS **no**, Chrome Android 38+. MDN: locking is "typically … only enabled on mobile devices, and when the browser context is full screen"; a sandboxed iframe needs `allow-orientation-lock` ([MDN lock][mdn-lock]). | iPhone users can hold the phone portrait; the Game cannot force landscape. | Hub owns orientation: lock after entering fullscreen on Android; everywhere else show a "rotate your phone" overlay in the Hub when `screen.orientation`/aspect is portrait. Games just fill the iframe. |
| **Audio needs a user gesture, per frame.** Media/Web Audio started outside a user input event "is subject to autoplay rules" ([MDN autoplay][mdn-autoplay]); iOS has long required a gesture for audible media ([WebKit][webkit-video]). The `autoplay` policy defaults to `self`; cross-origin frames need `allow="autoplay"` ([MDN autoplay][mdn-autoplay]). The HTML spec sends user activation to the frame, its **ancestors**, and **same-origin descendants only**: a tap in the Hub does not activate a cross-origin Game iframe ([HTML spec][html-activation]). BCD: the `autoplay` Permissions-Policy is not in Safari. | A cross-origin Game cannot unlock audio from the Hub's "Play" tap; it needs its own first tap. A same-origin Game gets activated by the Hub's tap. Godot web default is sample playback (low latency without threads) ([Godot docs][godot-web]). | Same-origin Games, plus `allow="autoplay; fullscreen"` on the iframe anyway. Each Game still calls `AudioContext.resume()` on its first input (Godot, Phaser and Unity all do this on first input). Design the first Game screen to need a tap ("Sẵn sàng"). |
| **Storage is partitioned for third-party frames.** WebKit: third-party LocalStorage and IndexedDB are "partitioned per first-party website" and "made ephemeral"; third-party cookies are blocked with "no exceptions" (except Storage Access API) ([WebKit tracking prevention][webkit-itp]). A "website" is the registrable domain (eTLD+1), so `sub.news.example` is first-party under `news.example`. Godot: in an iframe "third-party cookies must also be enabled" for `user://` persistence ([Godot docs][godot-web]); Unity: "Safari doesn't support IndexedDB for content running in an iFrame" ([Unity docs][unity-compat]). **`vercel.app` is on the Public Suffix List**, so `hub.vercel.app` and `game-x.vercel.app` are different sites. | A Game on another site (e.g. its own `*.vercel.app` project) loses `user://`/IndexedDB saves on iOS and cannot use the Hub's auth cookie. | Same origin (Hub at `/`, Games at `/games/<id>/`), or at least same site (subdomains of one custom domain). Keep Player data on the backend and pass identity through the Bridge (`postMessage`), not via cookies or shared storage. |
| **Virtual keyboard.** BCD: `VirtualKeyboard` API Chrome Android 94+, Safari/iOS **no**. Opening the keyboard needs focus on an input from a user gesture. iOS pans/resizes the visual viewport. | A Game with text input (chat, names) fights the Hub's layout; on iOS the page scrolls under the keyboard. | Keep the Hub page fixed (`interactive-widget=overlays-content`, the stable-size and scroll-reset code already in `web-shell.html`). Prefer text entry in the Hub (lobby, names, chat) over in-Game text; Games stay tap-only where possible. |
| **Safe area.** `env(safe-area-inset-*)` only resolves with `viewport-fit=cover` on the top document (as in `web-shell.html`). | In landscape the notch/Dynamic Island and home indicator overlap the left/right/bottom edges. | The Hub pads the iframe container by the insets, so Games never see a notch. If a Game should bleed edge-to-edge, the Hub passes insets through the Bridge. |
| **Engine payload.** Godot 4.7.2 `godot.wasm` is 39.5 MB uncompressed. Serve `.wasm` as `application/wasm` and compressed ([Godot docs][godot-web]). Vercel compresses only allowlisted MIME types (includes `wasm`, `javascript`, `json`; not `application/octet-stream`, so `.pck` is sent raw) with gzip/brotli ([Vercel compression][vercel-compress]). | Every Godot Game ships its own engine: N Games × several MB brotli of wasm on a phone network; a separate engine per Game means no shared cache unless the files are byte-identical at the same URL. | Pin one Godot version for all Godot Games and serve one shared `godot.wasm`/`godot.js` URL with immutable caching; keep `.pck` small (compressed textures) and long-cached as today. Consider a custom slim export template. |
| **Vercel static hosting limits.** Hobby: CLI static upload 100 MB (Pro 1 GB), 15,000 source files per CLI deploy, 2048 routes per deployment (each `vercel.json` rewrite/redirect/header counts), 100 deployments/day, 45 min build, 25 projects per Git repo ([Vercel limits][vercel-limits]); Fast Data Transfer first 100 GB/month on Hobby ([Vercel fair use][vercel-fair]). Headers go in `vercel.json` `headers`, as today. | One project holding Hub + all Games: one build installs Godot and exports every Game (already ~45 min budget pressure). 100 GB/month ÷ ~10 MB per cold load ≈ 10k cold loads. | One Vercel project serving Hub and Games under one origin (`/games/<id>/`), each Game built by its own command into the output folder; cache-bust per build with hashed paths and `immutable`. Split into more projects only behind one custom domain via rewrites, so origin stays the same. |
| **Engines are not equal on iOS.** Godot: Safari "has WebGL 2.0 issues", nothreads "works well on … iOS", native beats web on mobile ([Godot docs][godot-web]). Unity supports iOS Safari 15+ and Chrome Android 58+ ([Unity docs][unity-compat]). | iOS Safari is the weakest target for every engine; it also has the least embedding support (no fullscreen, no orientation lock, no credentialless, no Permissions-Policy header). | Treat iPhone Safari as the baseline: test every Game there in the iframe. |

## Recommendations

1. **Same origin.** Serve the Hub and every Game from one origin: Hub at `/`, Game `<id>` at
   `/games/<id>/` in the same Vercel deployment (or rewrites behind one custom domain). This keeps
   user activation (audio), storage and cookies first-party on iOS, and makes Permissions-Policy
   delegation trivial. Cross-origin Games (another `*.vercel.app` project) lose saves on iOS, need
   their own audio tap, and gain nothing we need.
2. **Still treat the iframe as a boundary.** Talk only through the Bridge (`postMessage` with an origin
   check); give the iframe `allow="autoplay; fullscreen"`. A `sandbox` attribute is optional; if used,
   it needs `allow-scripts allow-same-origin` (Godot needs storage) and `allow-orientation-lock`.
   Note that `allow-scripts` + `allow-same-origin` on a same-origin frame is no real sandbox.
3. **No threads, no COOP/COEP.** Keep Godot nothreads templates (the 4.3+ default, best on iOS) and no
   cross-origin isolation headers. Isolation would bind every Hub subresource to CORP/CORS, has no
   `credentialless` escape hatch on Safari, and buys nothing for turn-based Games. Revisit only for a
   Realtime Game that measures a real need, and then add the headers to the Hub and that Game together.
4. **The Hub owns the screen.** Fullscreen (Android, from the Hub's tap), orientation lock (Android,
   after fullscreen), a portrait "rotate" overlay (everywhere, required on iPhone), safe-area padding,
   viewport and keyboard handling all live in the Hub page. Games fill the iframe and assume landscape.
   iPhone gets true fullscreen only as a Home Screen web app (ties into the PWA open question on #200).
5. **Audio.** Each Game resumes its audio on its own first input; with same origin the Hub's "Play" tap
   usually counts already, but do not rely on it across engines.
6. **Payload.** One pinned Godot version and a shared, immutable engine URL for all Godot Games;
   watch the Hobby 100 GB/month transfer.

## Sources

- godot-web: https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
- mdn-coi: https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated
- mdn-coep: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy
- mdn-lock: https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock
- mdn-autoplay: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- html-activation: https://html.spec.whatwg.org/multipage/interaction.html#activation-notification
- webkit-video: https://webkit.org/blog/6784/new-video-policies-for-ios/
- webkit-itp: https://webkit.org/tracking-prevention/
- unity-compat: https://docs.unity.com/en-us/engine/current/manual/platform-specific/webgl/intro/browsercompatibility
- vercel-limits: https://vercel.com/docs/limits
- vercel-fair: https://vercel.com/docs/limits/fair-use-guidelines
- vercel-compress: https://vercel.com/docs/cdn/compression
- Browser support: MDN browser-compat-data, https://unpkg.com/@mdn/browser-compat-data/data.json
- Public Suffix List (`vercel.app` entry): https://publicsuffix.org/list/public_suffix_list.dat

[godot-web]: https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
[mdn-coi]: https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated
[mdn-coep]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy
[mdn-lock]: https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock
[mdn-autoplay]: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
[html-activation]: https://html.spec.whatwg.org/multipage/interaction.html#activation-notification
[webkit-video]: https://webkit.org/blog/6784/new-video-policies-for-ios/
[webkit-itp]: https://webkit.org/tracking-prevention/
[unity-compat]: https://docs.unity.com/en-us/engine/current/manual/platform-specific/webgl/intro/browsercompatibility
[vercel-limits]: https://vercel.com/docs/limits
[vercel-fair]: https://vercel.com/docs/limits/fair-use-guidelines
[vercel-compress]: https://vercel.com/docs/cdn/compression
