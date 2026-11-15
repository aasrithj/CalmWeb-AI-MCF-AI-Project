// CalmWeb AI - on-page summarizer.
// 1. Finds the real article (not menus, sidebars, info boxes or reference lists).
// 2. Splits it into clean sentences.
// 3. Scores each sentence by how many of the page's important words it contains
//    and where it appears, then picks a short overview and a few key points.
// Everything runs on this device: no page text leaves the browser.
(() => {
  const CW = globalThis.CalmWeb;

  const ROOT_SELECTORS = [
    "#mw-content-text .mw-parser-output",
    '[itemprop="articleBody"]',
    "article",
    '[role="main"]',
    "main",
    ".post-content",
    ".entry-content",
    ".article-body",
    ".article-content",
    ".story-body",
    "#content",
    ".content"
  ];

  const SKIP =
    'nav, aside, footer, header, table, figure, figcaption, form, button, dialog, [role="navigation"], [role="complementary"], [role="contentinfo"], [role="dialog"], [aria-hidden="true"], [data-calmweb-hidden], [data-calmweb-ui], .infobox, .navbox, .vertical-navbox, .sidebar, .hatnote, .reflist, .references, .mw-references-wrap, .refbegin, .toc, #toc, .thumb, .gallery, .metadata, .ambox, .shortdescription, .mw-editsection, .noprint, .catlinks, .mw-empty-elt, [class*="related" i], [class*="newsletter" i], [class*="promo" i], [class*="share" i], [class*="comment" i], [class*="caption" i], [class*="byline" i], [class*="breadcrumb" i], [class*="cookie" i]';

  const STOP = new Set(
    "a about above after again against all also am an and any are aren't as at be because been before being below between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves one two first second new many much may might also however although though since among including include includes included called known well like often used use using became become later early another within around per even still must made make makes upon thus whether either several various"
      .split(" ")
  );

  const textOf = (el) => (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();

  const clean = (s) =>
    s
      .replace(/\[(?:\d+|[a-z]|citation needed|note \d+|nb \d+|clarification needed|when\?|who\?|by whom\?)\]/gi, "")
      .replace(/\(\s*(?:listen|help|info|pronounced?[^)]*)\s*\)/gi, "")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();

  const paragraphScore = (root) =>
    Array.from(root.querySelectorAll("p")).reduce((sum, p) => {
      const t = p.textContent || "";
      return t.length > 80 ? sum + t.length : sum;
    }, 0);

  const findRoot = () => {
    let best = null;
    let bestScore = 0;
    for (const sel of ROOT_SELECTORS) {
      for (const el of document.querySelectorAll(sel)) {
        const score = paragraphScore(el);
        if (score > bestScore * 1.15) {
          best = el;
          bestScore = score;
        }
      }
      if (best && sel.startsWith("#mw-content-text")) return best; // Wikipedia
    }
    if (bestScore > 600) return best;

    // Fallback: the element that directly contains the most paragraph text.
    const scores = new Map();
    for (const p of document.querySelectorAll("p")) {
      const len = (p.textContent || "").length;
      if (len < 80) continue;
      const parent = p.parentElement;
      if (!parent) continue;
      scores.set(parent, (scores.get(parent) || 0) + len);
      const grand = parent.parentElement;
      if (grand) scores.set(grand, (scores.get(grand) || 0) + len / 2);
    }
    for (const [el, score] of scores) {
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }
    return best || document.body;
  };

  const collectParagraphs = (root) => {
    const out = [];
    for (const p of root.querySelectorAll("p, blockquote > p, dd")) {
      if (p.closest(SKIP)) continue;
      const text = clean(textOf(p));
      if (text.length < 60 || text.split(" ").length < 10) continue;
      const linkText = Array.from(p.querySelectorAll("a")).reduce((n, a) => n + (a.textContent || "").length, 0);
      if (linkText / text.length > 0.6) continue; // mostly links = navigation
      if (/^(this article|for other uses|see also|main article|further information)/i.test(text)) continue;
      out.push({ el: p, text });
      if (out.length >= 120) break;
    }
    return out;
  };

  const ABBREV = /(?:\b(?:c|ca|e\.g|i\.e|vs|etc|approx|Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|No|Fig|Vol|U\.S|U\.K|Gen|Gov|Sen|Rev|Inc|Ltd|Co|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)|\b[A-Z])\.\s*$/;

  const splitSentences = (text) => {
    let parts;
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const seg = new Intl.Segmenter("en", { granularity: "sentence" });
      parts = Array.from(seg.segment(text), (s) => s.segment);
    } else {
      parts = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [text];
    }
    const merged = [];
    for (const part of parts) {
      if (merged.length && ABBREV.test(merged[merged.length - 1])) merged[merged.length - 1] += part;
      else merged.push(part);
    }
    return merged.map((s) => s.trim()).filter(Boolean);
  };

  const tokens = (s) => (s.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter((w) => !STOP.has(w));

  const LEADING_LINK =
    /^(however|moreover|furthermore|in addition|additionally|in particular|for example|for instance|thus|therefore|meanwhile|nevertheless|consequently|as a result|indeed|also|similarly|in contrast|by contrast|overall|today|historically),\s+/i;

  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // Make a sentence short enough to read at a glance.
  const tighten = (sentence, max) => {
    let s = sentence
      .replace(/\s*\([^()]{0,90}\)/g, "")
      .replace(/\s*\[[^\]]{0,40}\]/g, "")
      .replace(LEADING_LINK, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    s = capitalize(s);
    if (s.length > max) {
      const cut = s.slice(0, max);
      const breaks = [cut.lastIndexOf("; "), cut.lastIndexOf(", "), cut.lastIndexOf(" – "), cut.lastIndexOf(" — ")];
      const at = Math.max(...breaks);
      s = at > max * 0.55 ? cut.slice(0, at) : cut.slice(0, cut.lastIndexOf(" "));
      s = s.replace(/[,;:\s–—-]+$/, "") + "…";
    }
    if (!/[.!?…"”]$/.test(s)) s += ".";
    return s;
  };

  const overlap = (a, b) => {
    const A = new Set(a);
    const B = new Set(b);
    let same = 0;
    for (const w of A) if (B.has(w)) same++;
    return same / Math.max(1, Math.min(A.size, B.size));
  };

  const DETAIL = [
    { name: "Brief", overview: 1, points: 3, overviewChars: 260, pointChars: 160, preferShort: true },
    { name: "Balanced", overview: 2, points: 4, overviewChars: 440, pointChars: 190 },
    { name: "Detailed", overview: 3, points: 6, overviewChars: 680, pointChars: 230 }
  ];

  CW.lastSummaryParagraphs = [];

  CW.summarize = (detailLevel = 1) => {
    const level = DETAIL[Math.max(0, Math.min(2, Number(detailLevel)))] || DETAIL[1];
    const title = clean((document.querySelector("h1") || {}).textContent || document.title || "This page");
    const root = findRoot();
    const paragraphs = collectParagraphs(root);
    CW.lastSummaryParagraphs = paragraphs.map((p) => p.el);

    const sentences = [];
    paragraphs.forEach((p, pi) => {
      splitSentences(p.text).forEach((text, si) => {
        const words = text.split(/\s+/).length;
        if (words < 8 || words > 70 || text.length < 40) return;
        if (/\?$/.test(text)) return;
        sentences.push({ text, pi, si, toks: tokens(text), words });
      });
    });

    const articleWords = paragraphs.reduce((n, p) => n + p.text.split(/\s+/).length, 0);

    if (sentences.length < 3) {
      const meta = document.querySelector('meta[name="description"], meta[property="og:description"]');
      const desc = meta && clean(meta.getAttribute("content") || "");
      if (desc && desc.length > 40) {
        return { ok: true, title, overview: [desc], points: [], words: articleWords, minutes: 1, level: level.name, note: "This page has very little article text, so this is the page's own description." };
      }
      return { ok: false, title, error: "This page doesn't have enough article text to summarize. Try it on an article, lesson or story page." };
    }

    // Word importance = how often a word appears across the article.
    const freq = new Map();
    sentences.forEach((s) => new Set(s.toks).forEach((w) => freq.set(w, (freq.get(w) || 0) + 1)));
    const titleWords = new Set(tokens(title));
    const lastParagraph = Math.max(1, paragraphs.length - 1);

    let maxRaw = 0;
    sentences.forEach((s) => {
      const unique = new Set(s.toks);
      let raw = 0;
      unique.forEach((w) => {
        const f = freq.get(w) || 0;
        if (f > 1) raw += Math.log(1 + f);
      });
      s.raw = raw / Math.sqrt(unique.size + 4);
      maxRaw = Math.max(maxRaw, s.raw);
    });
    sentences.forEach((s) => {
      let score = s.raw / (maxRaw || 1);
      score += s.pi === 0 ? 0.6 : s.pi < 3 ? 0.25 : 0.2 * (1 - s.pi / lastParagraph);
      if (s.si === 0) score += 0.15;
      let titleHits = 0;
      s.toks.forEach((w) => titleWords.has(w) && titleHits++);
      score += Math.min(0.3, titleHits * 0.1);
      if ((s.text.match(/["“”]/g) || []).length >= 2) score *= 0.8;
      if (s.words > 45) score *= 0.85;
      if (/^(this|these|it|he|she|they|such|that)\b/i.test(s.text)) score *= 0.85;
      // The article's first sentence usually says what the topic is.
      s.overviewScore = score + (s.pi === 0 && s.si === 0 ? 0.5 : 0);
      // Key points should be short enough to read without being cut off.
      if (level.preferShort && s.words > 24) score *= 0.8;
      if (s.text.replace(/\s*\([^()]*\)/g, "").length > level.pointChars) score *= 0.75;
      s.score = score;
    });

    // Overview: the strongest sentences from the opening of the article, in reading order.
    const opening = sentences.filter((s) => s.pi < 3);
    const overview = (opening.length ? opening : sentences)
      .slice()
      .sort((a, b) => b.overviewScore - a.overviewScore)
      .slice(0, level.overview)
      .sort((a, b) => a.pi - b.pi || a.si - b.si);

    let overviewText = [];
    let used = 0;
    for (const s of overview) {
      const t = tighten(s.text, level.overviewChars);
      if (overviewText.length && used + t.length > level.overviewChars) break;
      overviewText.push(t);
      used += t.length;
    }

    // Key points: the strongest remaining sentences, no repeats, spread across the article.
    const chosen = [];
    const perParagraph = new Map();
    for (const s of sentences.slice().sort((a, b) => b.score - a.score)) {
      if (chosen.length >= level.points) break;
      if (overview.includes(s)) continue;
      if ((perParagraph.get(s.pi) || 0) >= 1 && chosen.length < level.points - 1) continue;
      if ([...overview, ...chosen].some((c) => overlap(c.toks, s.toks) > 0.5)) continue;
      chosen.push(s);
      perParagraph.set(s.pi, (perParagraph.get(s.pi) || 0) + 1);
    }
    chosen.sort((a, b) => a.pi - b.pi || a.si - b.si);

    return {
      ok: true,
      title,
      overview: overviewText,
      points: chosen.map((s) => ({ text: tighten(s.text, level.pointChars), paragraph: s.pi })),
      words: articleWords,
      minutes: Math.max(1, Math.round(articleWords / 200)),
      level: level.name
    };
  };

  // "Show me where this came from": scroll to the paragraph and highlight it.
  CW.jumpToParagraph = (index) => {
    const el = CW.lastSummaryParagraphs[index];
    if (!el || !el.isConnected) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("calmweb-flash");
    void el.offsetWidth;
    el.classList.add("calmweb-flash");
    setTimeout(() => el.classList.remove("calmweb-flash"), 2600);
    return true;
  };
})();
