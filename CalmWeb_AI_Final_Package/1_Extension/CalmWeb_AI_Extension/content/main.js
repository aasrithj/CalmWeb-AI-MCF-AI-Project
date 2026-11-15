// CalmWeb AI - starts everything on the page and answers the popup.
(() => {
  const CW = globalThis.CalmWeb;
  const html = document.documentElement;

  const syncPopupFlag = () => html.setAttribute("data-calmweb-popups", CW.popupsActive() ? "on" : "off");

  const applyAll = () => {
    syncPopupFlag();
    CW.applyReading();
    CW.applyBlocking();
  };

  // Remember real clicks/keys so pop-ups the student opened on purpose stay open.
  const markGesture = (e) => {
    if (e.isTrusted) CW.lastGesture = performance.now();
  };
  addEventListener("pointerdown", markGesture, true);
  addEventListener("keydown", markGesture, true);

  // Pop-up windows stopped by the page-world guard.
  addEventListener("calmweb:blocked", (e) => {
    let kind = "popup";
    try {
      kind = JSON.parse(e.detail).kind || "popup";
    } catch (_) {
      /* ignore */
    }
    CW.report(kind);
  });

  const start = async () => {
    await CW.loadModel();
    CW.startBlocker();
    CW.startSimplifier();
    applyAll();
  };

  CW.loadSettings().then(() => {
    syncPopupFlag();
    CW.applyReading();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [key, { newValue }] of Object.entries(changes)) CW.settings[key] = newValue;
    applyAll();
  });

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (!msg || typeof msg.type !== "string") return;
    switch (msg.type) {
      case "calmweb:state":
        reply({ ok: true, stats: CW.stats, model: CW.modelInfo, paused: CW.paused, title: document.title, host: location.hostname });
        break;
      case "calmweb:summarize":
        try {
          reply(CW.summarize(msg.detail));
        } catch (err) {
          reply({ ok: false, error: "Something went wrong while reading this page." });
        }
        break;
      case "calmweb:jump":
        reply({ ok: CW.jumpToParagraph(msg.paragraph) });
        break;
      case "calmweb:pause":
        CW.paused = !!msg.paused;
        if (CW.paused) CW.restoreAll();
        applyAll();
        reply({ ok: true, paused: CW.paused });
        break;
      default:
        return;
    }
  });
})();
