"use strict";
/*
 * Cross-browser shim. Firefox exposes the promise-based `browser` namespace;
 * Chromium only exposes `chrome`. In Chromium MV3 (110+) the APIs we use are
 * already promise-based, so aliasing covers most of it — except onMessage:
 * Chrome ignores a promise returned by a listener (Firefox resolves it and
 * sends the result back), so we adapt promise-returning listeners to the
 * sendResponse / `return true` protocol. On Firefox this file is a no-op.
 */
(function (g) {
  if (typeof g.browser !== "undefined" || typeof g.chrome === "undefined") return;
  g.browser = g.chrome;

  const om = g.chrome.runtime && g.chrome.runtime.onMessage;
  if (!om || !om.addListener) return;
  const origAdd = om.addListener.bind(om);
  om.addListener = function (fn) {
    origAdd(function (msg, sender, sendResponse) {
      const ret = fn(msg, sender, sendResponse);
      if (ret && typeof ret.then === "function") {
        ret.then(sendResponse, (e) => sendResponse({ error: String(e) }));
        return true; // keep the message channel open for the async reply
      }
      return ret;
    });
  };
})(typeof self !== "undefined" ? self : this);
