// CalmWeb AI - distraction and pop-up blocker.
// Hides ads, sign-up / cookie / "special offer" overlays and sticky bars,
// then gives scrolling back to the page. Learning tools are never hidden.
(() => {
  const CW = globalThis.CalmWeb;
  const HIDDEN = "data-calmweb-hidden";

  // ---------- Ads and distracting widgets ----------
  const AD_SELECTORS = [
    "ins.adsbygoogle",
    '[id^="google_ads_iframe"]',
    'iframe[id^="google_ads"]',
    '[id^="div-gpt-ad"]',
    '[id^="gpt-ad"]',
    "[data-google-query-id]",
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication.com"]',
    'iframe[src*="amazon-adsystem.com"]',
    '[id^="taboola-"]',
    ".trc_related_container",
    ".OUTBRAIN",
    '[data-widget-id^="AR_"]',
    '[aria-label="Advertisement" i]',
    '[aria-label="Advertisements" i]',
    '[aria-label="Sponsored" i]',
    "[data-ad-slot]",
    "[data-ad-unit]",
    "[data-adunit]",
    "[data-ad-name]",
    "[data-ad]",
    '[data-testid*="ad-slot" i]',
    ".ad-slot",
    ".ad-container",
    ".ad-wrapper",
    ".ad-banner",
    ".ad-unit",
    ".adsbox",
    ".adbox",
    ".advertisement",
    ".advert",
    ".sponsored-content",
    ".sponsored-post",
    ".promoted-content",
    ".calmweb-test-ad"
  ].join(",");

  const AD_LABEL = /^(advertisement|advertisements|advertising|ad|ads|sponsored|sponsored content|promoted|paid content|paid post)$/i;
  const RECOMMEND_HEADING =
    /^(you might also like|you may also like|recommended( for you)?|around the web|promoted stories|sponsored stories|from our partners|more from our partners|trending now|don'?t miss)\b/i;

  const hide = (el, kind) => {
    if (!el || el.hasAttribute(HIDDEN) || el.hasAttribute("data-calmweb-ui")) return false;
    el.setAttribute(HIDDEN, kind);
    CW.report(kind === "ad" ? "ad" : "overlay");
    if (kind === "ad") collapseEmptyParents(el);
    return true;
  };

  // After an ad is removed, also remove the empty box it sat in.
  const collapseEmptyParents = (el) => {
    let parent = el.parentElement;
    for (let i = 0; i < 2 && parent && parent !== document.body; i++) {
      if (CW.holdsMainContent(parent) || parent.hasAttribute(HIDDEN)) return;
      const visibleChildren = Array.from(parent.children).filter(
        (c) => !c.hasAttribute(HIDDEN) && c.tagName !== "SCRIPT" && c.tagName !== "STYLE" && c.getBoundingClientRect().height > 0
      );
      const text = (parent.innerText || "").trim();
      if (visibleChildren.length || text.length > 0) return;
      parent.setAttribute(HIDDEN, "ad");
      parent = parent.parentElement;
    }
  };

  // Climb from a small "Advertisement" label to the box that holds the ad.
  const adBoxFor = (start) => {
    let best = null;
    let el = start;
    for (let i = 0; i < 5 && el && el !== document.body; i++) {
      const r = el.getBoundingClientRect();
      if (CW.holdsMainContent(el) || el.querySelector("h1")) break;
      if (r.height > 0 && r.height < 700 && r.width < 1100) best = el;
      el = el.parentElement;
    }
    return best;
  };

  const scanAds = (root) => {
    if (!CW.adsActive() || !root || !root.querySelectorAll) return;

    const found = root.matches && root.matches(AD_SELECTORS) ? [root] : [];
    found.push(...root.querySelectorAll(AD_SELECTORS));
    for (const el of found) {
      if (!CW.holdsMainContent(el)) hide(el, "ad");
    }

    // Small text labels like "Advertisement" or "Sponsored".
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    let count = 0;
    while ((node = walker.nextNode()) && count++ < 6000) {
      const value = node.nodeValue.trim();
      if (value.length < 2 || value.length > 20 || !AD_LABEL.test(value)) continue;
      const parent = node.parentElement;
      if (!parent || parent.closest(`[${HIDDEN}]`) || parent.closest("main p, article p, .mw-parser-output p")) continue;
      const box = adBoxFor(parent);
      if (box && !CW.isProtected(box)) hide(box, "ad");
    }

    // "You might also like" / "Around the web" link farms.
    for (const h of root.querySelectorAll("h2, h3, h4, h5, h6, [role='heading']")) {
      const t = (h.textContent || "").trim();
      if (t.length > 45 || !RECOMMEND_HEADING.test(t)) continue;
      const box =
        h.closest('aside, section, [class*="related" i], [class*="recommend" i], [id*="related" i], [id*="recommend" i]') ||
        (h.parentElement && h.parentElement.parentElement);
      if (box && !CW.holdsMainContent(box) && box.getBoundingClientRect().height < 1400) hide(box, "ad");
    }
  };

  // ---------- Overlay pop-ups and sticky bars ----------
  const POPUP_WORDS =
    /(subscribe|newsletter|sign ?up|join (now|free|us|today)|create (a |an )?(free )?account|log ?in to (continue|read)|cookie|consent|accept all|we value your privacy|\d+\s?% off|\bsale\b|discount|coupon|special offer|limited[- ]time|free trial|download (our|the) app|get (the|our) app|open in (the )?app|ad ?block|allow notifications|turn on notifications|advertisement|sponsored|don'?t miss|before you go|\bwait\b!?|unlock|go premium|upgrade now|shop now)/i;
  const STRONG_AD_WORDS =
    /(\d+\s?% off|\bsale\b|coupon|special offer|ad ?block|advertisement|sponsored|allow notifications|shop now|limited[- ]time)/i;

  const visibleArea = (r) => {
    const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0);
    const h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    return w > 0 && h > 0 ? (w * h) / (innerWidth * innerHeight) : 0;
  };

  const isDimmingLayer = (cs) => {
    const bg = cs.backgroundColor || "";
    const m = bg.match(/rgba?\(([^)]+)\)/);
    const alpha = m ? parseFloat(m[1].split(",")[3] ?? "1") : 0;
    return (alpha > 0.05 && alpha < 1) || (parseFloat(cs.opacity) < 1 && alpha > 0) || (cs.backdropFilter && cs.backdropFilter !== "none");
  };

  // Real pop-ups almost always have an "×", "Close" or "No thanks" button.
  const CLOSE_WORDS = /^(×|x|✕|✖|close|close this|no,? thanks|not now|maybe later|dismiss|skip|continue to site)$/i;
  const hasCloseButton = (el) =>
    Array.from(el.querySelectorAll('button, [role="button"], a, span, div')).slice(0, 80).some((c) => {
      const label = `${c.getAttribute("aria-label") || ""}`.trim();
      const text = (c.textContent || "").trim();
      return CLOSE_WORDS.test(text) || CLOSE_WORDS.test(label) || /(^|[-_ ])close([-_ ]|$)/i.test(c.getAttribute("class") || "");
    });

  let bodyTextLength = 0;
  const refreshBodyText = () => {
    bodyTextLength = document.body ? (document.body.innerText || "").length : 0;
  };

  const userOpenedOverlays = new WeakSet();
  const openedByUser = (el) => {
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      if (userOpenedOverlays.has(node)) return true;
    }
    return false;
  };

  const checkOverlay = (el) => {
    if (!(el instanceof HTMLElement) || el.hasAttribute(HIDDEN) || el.hasAttribute("data-calmweb-ui")) return;
    if (openedByUser(el)) return;
    if (el === document.body || el === document.documentElement || el.closest(`[${HIDDEN}]`)) return;

    const cs = getComputedStyle(el);
    const isOpenDialog = el.tagName === "DIALOG" && el.open;
    if (cs.position !== "fixed" && cs.position !== "sticky" && !isOpenDialog) return;
    if (cs.display === "none" || cs.visibility === "hidden") return;

    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 24) return;
    const cover = visibleArea(r);
    if (cover <= 0) return;

    const text = (el.innerText || "").slice(0, 800);
    const ruleWords = POPUP_WORDS.test(text) || POPUP_WORDS.test(`${el.id} ${el.getAttribute("class") || ""}`);
    // Machine-learning model: probability that this text is promotional / pop-up style.
    const ai = CW.promoScore(text);
    const words = ruleWords || ai >= 0.5;
    const strong = STRONG_AD_WORDS.test(text) || ai >= 0.9;
    const links = el.querySelectorAll("a[href]").length;
    const isNavigation =
      el.matches('nav, header, [role="navigation"], [role="banner"], [role="toolbar"], [role="menu"]') ||
      !!el.querySelector('nav, [role="navigation"]') ||
      links > 8;
    const userOpened = performance.now() - CW.lastGesture < 1500;
    const holdsPage = CW.holdsMainContent(el) || (bodyTextLength > 500 && text.length > bodyTextLength * 0.5);

    if (holdsPage || CW.isProtected(el)) return;
    if (isNavigation && !/cookie|consent|subscribe|newsletter/i.test(text)) return;
    if (userOpened && !strong) {
      // The student clicked something that opened this: leave it alone from now on.
      userOpenedOverlays.add(el);
      return;
    }

    let reason = null;
    if (cs.position === "sticky") {
      if (strong && r.height < innerHeight * 0.4) reason = "sticky ad";
    } else if (cover > 0.5 && text.trim().length < 20 && isDimmingLayer(cs) && !el.querySelector("video, img, iframe, canvas")) {
      reason = "backdrop";
    } else if (r.top <= 4 && r.height < 140 && !isOpenDialog) {
      // Top bars are usually the site's header: only hide clear promos or cookie notices.
      if (/cookie|consent|newsletter|subscribe|download (our|the) app|get (the|our) app|% off|\bsale\b|ad ?block/i.test(text)) reason = "bar";
    } else if (cover >= 0.015 && words) {
      reason = "popup";
    } else if (cover >= 0.35 && !isOpenDialog && (parseInt(cs.zIndex, 10) || 0) >= 10 && hasCloseButton(el)) {
      reason = "unrequested overlay";
    } else if (isOpenDialog && words) {
      reason = "dialog";
    } else if (words && r.height < innerHeight * 0.35 && r.width > innerWidth * 0.4 && (r.bottom >= innerHeight - 4 || r.top <= 4)) {
      reason = "bar";
    }
    if (!reason) return;

    if (isOpenDialog) {
      try { el.close(); } catch (_) { /* ignore */ }
    }
    if (hide(el, "overlay") && !ruleWords && ai >= 0.5) CW.stats.aiCaught += 1;
    requestAnimationFrame(unlockScroll);
  };

  // Many pop-ups freeze the page underneath. Give scrolling back.
  const unlockScroll = () => {
    if (!document.body) return;
    const html = document.documentElement;
    const hcs = getComputedStyle(html);
    const bcs = getComputedStyle(document.body);
    const locked = /hidden|clip/.test(hcs.overflow + hcs.overflowY + bcs.overflow + bcs.overflowY);
    if (locked) html.classList.add("calmweb-unlock");
    if (bcs.position === "fixed") html.classList.add("calmweb-unlock-position");
    if (bcs.pointerEvents === "none") html.classList.add("calmweb-unlock-pointer");
  };

  const topLevelCandidates = () => {
    if (!document.body) return [];
    return Array.from(document.body.querySelectorAll(":scope > *, :scope > * > *, :scope > * > * > *, dialog[open]")).slice(0, 600);
  };

  const sweep = () => {
    if (!CW.popupsActive()) return;
    refreshBodyText();
    topLevelCandidates().forEach(checkOverlay);
  };

  // ---------- Watching for new pop-ups ----------
  const queue = new Set();
  let timer = null;
  const flush = () => {
    timer = null;
    const items = Array.from(queue).slice(0, 400);
    queue.clear();
    if (!CW.active()) return;
    refreshBodyText();
    for (const el of items) {
      if (!el.isConnected) continue;
      if (CW.adsActive()) scanAds(el);
      if (CW.popupsActive()) {
        checkOverlay(el);
        el.querySelectorAll(":scope > *, :scope > * > *").forEach((child, i) => i < 60 && checkOverlay(child));
      }
    }
  };
  const enqueue = (el) => {
    if (!(el instanceof HTMLElement) || el.hasAttribute("data-calmweb-ui")) return;
    queue.add(el);
    if (!timer) timer = setTimeout(flush, 150);
  };

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList") m.addedNodes.forEach(enqueue);
      else enqueue(m.target);
    }
  });

  let scrollTimer = null;
  const onScroll = () => {
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => {
      scrollTimer = null;
      sweep();
    }, 900);
  };

  CW.startBlocker = () => {
    if (!document.body) return;
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "open", "hidden"]
    });
    addEventListener("scroll", onScroll, { passive: true });
    CW.applyBlocking();
    [800, 2000, 4000, 8000, 15000].forEach((ms) => setTimeout(() => CW.applyBlocking(true), ms));
  };

  CW.applyBlocking = (quiet) => {
    if (!document.body) return;
    if (CW.adsActive()) scanAds(document.body);
    else restore("ad");
    if (CW.popupsActive()) sweep();
    else if (!quiet) restore("overlay");
  };

  const restore = (kind) => {
    document.querySelectorAll(`[${HIDDEN}="${kind}"]`).forEach((el) => el.removeAttribute(HIDDEN));
    if (kind === "overlay") {
      document.documentElement.classList.remove("calmweb-unlock", "calmweb-unlock-position", "calmweb-unlock-pointer");
    }
  };

  CW.restoreAll = () => {
    restore("ad");
    restore("overlay");
  };
})();
