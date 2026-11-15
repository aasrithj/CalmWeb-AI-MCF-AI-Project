// CalmWeb AI - reading comfort: font, text size, line spacing, calm palettes and reading mask.
(() => {
  const CW = globalThis.CalmWeb;
  const html = document.documentElement;

  const FONTS = {
    default: null,
    dyslexic: '"OpenDyslexic", "Comic Sans MS", "Comic Neue", "Trebuchet MS", Verdana, sans-serif',
    easy: 'Verdana, Tahoma, "Segoe UI", sans-serif',
    serif: 'Georgia, "Iowan Old Style", "Times New Roman", serif'
  };

  const PALETTES = {
    none: null,
    cream: { bg: "#fbf6ea", fg: "#2b2a26", link: "#2e6b4f", border: "#e6dcc4" },
    mint: { bg: "#eaf5ee", fg: "#1f2d26", link: "#23704a", border: "#cfe3d6" },
    sky: { bg: "#eaf2fb", fg: "#1d2a3a", link: "#1f5fa8", border: "#cddcee" },
    dusk: { bg: "#2b3442", fg: "#e8ecf1", link: "#9fd4b5", border: "#475366" }
  };

  // Use the real OpenDyslexic font if it was added to the fonts folder.
  let fontChecked = false;
  const loadDyslexicFont = async () => {
    if (fontChecked) return;
    fontChecked = true;
    for (const file of ["OpenDyslexic-Regular.woff2", "OpenDyslexic-Regular.otf", "OpenDyslexic-Regular.woff"]) {
      const url = chrome.runtime.getURL(`fonts/${file}`);
      try {
        const res = await fetch(url, { method: "HEAD" });
        if (!res.ok) continue;
        const face = new FontFace("OpenDyslexic", `url("${url}")`);
        await face.load();
        document.fonts.add(face);
        return;
      } catch (_) {
        /* file not added - fall back to Comic Sans / Verdana */
      }
    }
  };

  // ---------- Reading mask ----------
  let mask = null;
  let maskY = innerHeight / 2;
  const BAND = 96;
  const placeMask = () => {
    if (!mask) return;
    const top = Math.max(0, maskY - BAND / 2);
    mask.firstChild.style.height = `${top}px`;
    mask.lastChild.style.top = `${top + BAND}px`;
  };
  const onMove = (e) => {
    maskY = e.clientY;
    requestAnimationFrame(placeMask);
  };
  const setMask = (on) => {
    if (on && !mask) {
      mask = document.createElement("div");
      mask.setAttribute("data-calmweb-ui", "");
      mask.id = "calmweb-reading-mask";
      mask.innerHTML = '<div class="cw-mask-top"></div><div class="cw-mask-bottom"></div>';
      html.appendChild(mask);
      addEventListener("mousemove", onMove, { passive: true });
      placeMask();
    } else if (!on && mask) {
      removeEventListener("mousemove", onMove);
      mask.remove();
      mask = null;
    }
  };

  CW.applyReading = () => {
    const s = CW.settings;
    const on = CW.active();

    const font = on ? FONTS[s.font] : null;
    html.classList.toggle("cw-font", !!font);
    if (font) {
      html.style.setProperty("--cw-font", font);
      if (s.font === "dyslexic") loadDyslexicFont();
    }

    const scale = on ? Number(s.textScale) || 100 : 100;
    html.classList.toggle("cw-scale", scale !== 100);
    html.style.setProperty("--cw-scale", String(scale / 100));

    const lh = on ? Number(s.lineHeight) || 0 : 0;
    html.classList.toggle("cw-lh", lh > 0);
    if (lh > 0) html.style.setProperty("--cw-lh", String(lh));

    const pal = on ? PALETTES[s.palette] : null;
    html.classList.toggle("cw-pal", !!pal);
    if (pal) {
      html.style.setProperty("--cw-bg", pal.bg);
      html.style.setProperty("--cw-fg", pal.fg);
      html.style.setProperty("--cw-link", pal.link);
      html.style.setProperty("--cw-border", pal.border);
    }

    setMask(on && !!s.readingMask && !!document.body);
  };
})();
