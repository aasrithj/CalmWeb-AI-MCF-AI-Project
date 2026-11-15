// CalmWeb AI - pop-up guard (runs in the page's own JavaScript world).
// Stops pages from opening new windows or tabs that you did not ask for
// (pop-ups, pop-unders and "click anywhere" ads), and blocks
// notification permission prompts. Real clicks on links and buttons still work.
(() => {
  if (window.__calmwebPopupGuard) return;
  window.__calmwebPopupGuard = true;

  const ATTR = "data-calmweb-popups";
  const INTERACTIVE =
    'a[href], button, input[type="button"], input[type="submit"], [role="button"], [role="link"], [role="menuitem"], summary, select';
  const CLICK_WINDOW_MS = 1000;

  const isOn = () => {
    const root = document.documentElement;
    return !root || root.getAttribute(ATTR) !== "off";
  };

  const report = (kind, url) => {
    try {
      window.dispatchEvent(
        new CustomEvent("calmweb:blocked", { detail: JSON.stringify({ kind, url: String(url || "") }) })
      );
    } catch (_) {
      /* ignore */
    }
  };

  // Remember the last real click and whether it was on a link or button.
  let lastClick = { time: -1e9, intended: false };

  window.addEventListener(
    "click",
    (event) => {
      if (!event.isTrusted) return;
      const target = event.target instanceof Element ? event.target : null;
      const control = target ? target.closest(INTERACTIVE) : null;
      let intended = !!control;
      if (control) {
        // Invisible full-page links are a common trick for click-anywhere ads.
        const rect = control.getBoundingClientRect();
        const cover = (rect.width * rect.height) / Math.max(1, window.innerWidth * window.innerHeight);
        const text = (control.textContent || "").trim();
        if (cover > 0.4 && text.length < 3) intended = false;
      }
      lastClick = { time: performance.now(), intended };
    },
    true
  );

  const userJustClicked = () =>
    lastClick.intended && performance.now() - lastClick.time < CLICK_WINDOW_MS;

  // 1. window.open() pop-ups
  const nativeOpen = window.open;
  function guardedOpen(url) {
    if (isOn() && !userJustClicked()) {
      report("popup", url);
      return null;
    }
    return nativeOpen.apply(this, arguments);
  }
  try {
    Object.defineProperty(window, "open", { value: guardedOpen, writable: true, configurable: true });
  } catch (_) {
    window.open = guardedOpen;
  }

  // 2. Links that scripts "click" for you to open a new tab
  const opensNewTab = (a) => {
    const t = (a.getAttribute("target") || "").toLowerCase();
    return t && t !== "_self" && t !== "_parent" && t !== "_top";
  };

  const nativeAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (isOn() && opensNewTab(this) && !userJustClicked()) {
      report("popup", this.href);
      return;
    }
    return nativeAnchorClick.call(this);
  };

  window.addEventListener(
    "click",
    (event) => {
      if (event.isTrusted || !isOn()) return;
      const a = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (a && opensNewTab(a) && !userJustClicked()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        report("popup", a.href);
      }
    },
    true
  );

  // 3. "Allow notifications?" prompts
  if (window.Notification && typeof Notification.requestPermission === "function") {
    const nativeRequest = Notification.requestPermission.bind(Notification);
    Notification.requestPermission = function (callback) {
      if (isOn() && Notification.permission === "default") {
        report("notification", location.href);
        const result = Promise.resolve("denied");
        if (typeof callback === "function") result.then(callback);
        return result;
      }
      return nativeRequest(callback);
    };
  }
})();
