// CalmWeb AI - shared settings, counters and the small "blocked" notice.
const CW = (globalThis.CalmWeb = globalThis.CalmWeb || {});

CW.DEFAULTS = {
  enabled: true,
  hideAds: true,
  blockPopups: true,
  protectLearning: true,
  font: "default",
  textScale: 100,
  lineHeight: 0,
  readingMask: false,
  palette: "none",
  simplifyOnSelect: true,
  summaryDetail: 1
};

CW.settings = { ...CW.DEFAULTS };
CW.paused = false; // "View original" pauses CalmWeb on this tab only
CW.stats = { popups: 0, overlays: 0, ads: 0, aiCaught: 0 };
CW.modelInfo = null;
CW.lastGesture = -1e9;

CW.loadSettings = () =>
  new Promise((resolve) => {
    try {
      chrome.storage.sync.get(CW.DEFAULTS, (stored) => {
        CW.settings = { ...CW.DEFAULTS, ...(stored || {}) };
        resolve(CW.settings);
      });
    } catch (_) {
      resolve(CW.settings);
    }
  });

CW.active = () => CW.settings.enabled && !CW.paused;
CW.popupsActive = () => CW.active() && CW.settings.blockPopups;
CW.adsActive = () => CW.active() && CW.settings.hideAds;

CW.totalBlocked = () => CW.stats.popups + CW.stats.overlays + CW.stats.ads;

let badgeTimer = null;
CW.sendCount = () => {
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(() => {
    try {
      chrome.runtime.sendMessage({ type: "calmweb:count", total: CW.totalBlocked() });
    } catch (_) {
      /* extension reloaded */
    }
  }, 300);
};

CW.report = (kind, amount = 1) => {
  if (kind === "popup" || kind === "notification") CW.stats.popups += amount;
  else if (kind === "overlay") CW.stats.overlays += amount;
  else CW.stats.ads += amount;
  CW.sendCount();
  if (kind !== "ad") CW.toast(kind === "overlay" ? "Hid a pop-up" : kind === "notification" ? "Blocked a notification request" : "Blocked a pop-up window");
};

// A small, calm notice in the corner. Lives in a shadow root so page styles can't change it.
let toastHost = null;
let toastTimer = null;
let lastToast = 0;
CW.toast = (message) => {
  const now = performance.now();
  if (now - lastToast < 2500 || !document.body) return;
  lastToast = now;
  if (!toastHost || !toastHost.isConnected) {
    toastHost = document.createElement("div");
    toastHost.setAttribute("data-calmweb-ui", "");
    toastHost.style.cssText = "all:initial;position:fixed;right:18px;bottom:18px;z-index:2147483647;pointer-events:none;";
    const shadow = toastHost.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        .t{font:500 13px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1f3d2d;background:#f1f8f3;
           border:1px solid #cfe5d7;border-radius:999px;padding:8px 14px 8px 10px;display:flex;gap:8px;align-items:center;
           box-shadow:0 6px 20px rgba(31,61,45,.15);opacity:0;transform:translateY(8px);transition:opacity .25s,transform .25s}
        .t.show{opacity:1;transform:none}
        .dot{width:18px;height:18px;border-radius:50%;background:#2e7d52;display:grid;place-items:center}
        .dot svg{width:11px;height:11px}
      </style>
      <div class="t"><span class="dot"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M5 12l5 5L19 7"/></svg></span><span class="m"></span></div>`;
    document.documentElement.appendChild(toastHost);
  }
  const box = toastHost.shadowRoot.querySelector(".t");
  toastHost.shadowRoot.querySelector(".m").textContent = `CalmWeb · ${message}`;
  requestAnimationFrame(() => box.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove("show"), 2600);
};
