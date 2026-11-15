// CalmWeb AI - "Select to simplify".
// Select a word or passage and a calm card explains it in plain language.
// Works offline with a built-in school glossary and plain-English rewriting rules.
(() => {
  const CW = globalThis.CalmWeb;

  const GLOSSARY = {
    abolish: "to officially end a law, system or practice",
    absorb: "to take in or soak up",
    abundant: "existing in large amounts",
    accumulate: "to slowly collect or build up",
    adaptation: "a change that helps a living thing survive where it lives",
    advocate: "to publicly support an idea; or a person who does",
    agriculture: "farming: growing crops and raising animals",
    alliance: "an agreement between groups or countries to work together",
    ambiguous: "can be understood in more than one way",
    analogy: "a comparison that explains something by showing how it is like something else",
    analyze: "to study something closely to understand it",
    atom: "the tiny basic unit that all matter is made of",
    authority: "the power or right to make decisions; or a person with that power",
    bias: "an unfair leaning toward or against something",
    bourgeoisie: "the middle class, especially owners of businesses",
    capitalism: "an economic system where private people and companies own businesses to make a profit",
    catalyst: "something that speeds up a change without being used up",
    cell: "the smallest living unit that makes up all living things",
    chlorophyll: "the green pigment plants use to capture energy from sunlight",
    chloroplast: "the part of a plant cell where photosynthesis happens",
    circumstance: "a fact or condition that affects a situation",
    civilization: "a large, organized society with cities, government and culture",
    coherent: "clear, logical and easy to follow",
    colonization: "when a country takes control of another land and settles people there",
    commodity: "a product that can be bought and sold, like wheat or cotton",
    compound: "a substance made of two or more elements joined together",
    comprehensive: "complete and covering everything",
    consequence: "a result of an action",
    constitution: "the set of basic laws and rules for how a country is governed",
    contemplation: "deep, careful thinking",
    context: "the situation or surrounding words that help explain meaning",
    contradict: "to say the opposite of something",
    democracy: "a system where people choose their leaders by voting",
    derive: "to get or come from a source",
    diffusion: "the spreading of particles from a crowded area to a less crowded one",
    economy: "the system of making, buying and selling goods and services in a place",
    ecosystem: "all the living things in an area and how they interact with their surroundings",
    efficient: "doing something well without wasting time or energy",
    element: "a pure substance made of only one kind of atom; or one part of something",
    emancipation: "being set free, especially from slavery",
    empire: "a group of lands or peoples ruled by one powerful leader or country",
    energy: "the ability to do work or cause change",
    enzyme: "a protein that speeds up chemical reactions in living things",
    epoch: "a long period of time in history",
    equation: "a math statement showing two things are equal",
    evaporation: "when a liquid turns into a gas",
    evidence: "facts or information that show whether something is true",
    evolution: "the slow change of living things over many generations",
    exploitation: "treating someone unfairly to benefit from their work",
    factor: "something that helps cause a result",
    feudalism: "a medieval system where people worked land for a lord in return for protection",
    function: "the job or purpose of something",
    glucose: "a simple sugar that living things use for energy",
    habitat: "the natural home of a plant or animal",
    hypothesis: "an educated guess that can be tested",
    ideology: "a set of beliefs about how society should work",
    immigration: "moving to a new country to live there",
    imperialism: "when a powerful country controls other countries or regions",
    incredulity: "not being able to believe something",
    industrialization: "when a society switches from farming and handmade goods to factories and machines",
    industrial: "having to do with factories and making goods by machine",
    inference: "a conclusion you reach from clues and evidence",
    infrastructure: "basic systems a society needs, like roads, bridges and power lines",
    labor: "work, especially hard physical work; or workers as a group",
    legislation: "laws made by a government",
    manufacturing: "making goods in large amounts, usually with machines",
    mechanization: "using machines to do work that people or animals used to do",
    metabolism: "the chemical processes that keep a living thing alive",
    migration: "moving from one place to another",
    molecule: "two or more atoms joined together",
    monarchy: "a government ruled by a king or queen",
    nationalism: "strong pride in and loyalty to your own country",
    nuance: "a small, subtle difference in meaning",
    organism: "any living thing",
    osmosis: "the movement of water through a membrane from where there is more to where there is less",
    oxygen: "a gas in the air that people and animals need to breathe",
    perspective: "a point of view",
    philosopher: "a person who studies big questions about life, knowledge and truth",
    photosynthesis: "how plants use sunlight, water and carbon dioxide to make food (glucose) and release oxygen",
    pigment: "a substance that gives something its color",
    population: "the number of people or animals living in an area",
    precipitation: "rain, snow, sleet or hail falling from clouds",
    proletariat: "the working class",
    protein: "a nutrient that helps build and repair the body",
    reform: "a change made to improve something",
    renaissance: "a rebirth; the period in Europe (about 1300–1600) of new art and learning",
    republic: "a country where people elect leaders and there is no king or queen",
    respiration: "how living things turn food and oxygen into energy",
    revolution: "a big, sudden change, especially in government or how things are done",
    sanitation: "keeping places clean and healthy, like clean water and sewers",
    sovereignty: "a country's full right to govern itself",
    standard: "a level of quality; or a usual way of doing something",
    superlative: "the highest degree of something, like 'best' or 'worst'",
    sustainable: "able to continue without harming the environment",
    textile: "cloth or fabric",
    theory: "a well-tested explanation of how something works",
    transitional: "changing from one stage or state to another",
    treaty: "a formal agreement between countries",
    unprecedented: "never happened or seen before",
    urbanization: "when more people move from the countryside into cities",
    variable: "something that can change in an experiment or equation",
    velocity: "how fast something moves in a certain direction"
  };

  const SWAPS = [
    [/\bin order to\b/gi, "to"], [/\bprior to\b/gi, "before"], [/\bsubsequent to\b/gi, "after"],
    [/\bdue to the fact that\b/gi, "because"], [/\bin spite of\b/gi, "despite"], [/\ba (large|great) number of\b/gi, "many"],
    [/\bthe majority of\b/gi, "most"], [/\bwith regard to\b/gi, "about"], [/\bin addition,?\s/gi, "also, "],
    [/\bnevertheless\b/gi, "still"], [/\bnonetheless\b/gi, "still"], [/\btherefore\b/gi, "so"], [/\bconsequently\b/gi, "so"],
    [/\bhowever,\s/gi, "but "], [/\bapproximately\b/gi, "about"], [/\bnumerous\b/gi, "many"], [/\bsufficient\b/gi, "enough"],
    [/\butiliz(e|es|ed|ing)\b/gi, (m, e) => ({ e: "use", es: "uses", ed: "used", ing: "using" })[e.toLowerCase()]],
    [/\bcommenc(e|es|ed|ing)\b/gi, (m, e) => ({ e: "start", es: "starts", ed: "started", ing: "starting" })[e.toLowerCase()]],
    [/\bterminat(e|es|ed|ing)\b/gi, (m, e) => ({ e: "end", es: "ends", ed: "ended", ing: "ending" })[e.toLowerCase()]],
    [/\bdemonstrat(e|es|ed|ing)\b/gi, (m, e) => ({ e: "show", es: "shows", ed: "showed", ing: "showing" })[e.toLowerCase()]],
    [/\bfacilitat(e|es|ed|ing)\b/gi, (m, e) => ({ e: "help", es: "helps", ed: "helped", ing: "helping" })[e.toLowerCase()]],
    [/\bobtain(s|ed|ing)?\b/gi, (m, e = "") => ({ "": "get", s: "gets", ed: "got", ing: "getting" })[e.toLowerCase()]],
    [/\bacquir(e|es|ed|ing)\b/gi, (m, e) => ({ e: "get", es: "gets", ed: "got", ing: "getting" })[e.toLowerCase()]],
    [/\bassist(s|ed|ing)?\b/gi, (m, e = "") => "help" + e.toLowerCase()],
    [/\battempt(s|ed|ing)?\b/gi, (m, e = "") => ({ "": "try", s: "tries", ed: "tried", ing: "trying" })[e.toLowerCase()]],
    [/\bindicat(e|es|ed|ing)\b/gi, (m, e) => ({ e: "show", es: "shows", ed: "showed", ing: "showing" })[e.toLowerCase()]],
    [/\bpurchas(e|es|ed|ing)\b/gi, (m, e) => ({ e: "buy", es: "buys", ed: "bought", ing: "buying" })[e.toLowerCase()]],
    [/\breside(s|d)?\b/gi, (m, e = "") => ({ "": "live", s: "lives", d: "lived" })[e.toLowerCase()]],
    [/\bindividuals\b/gi, "people"], [/\bindividual\b/gi, "person"], [/\bcommence\b/gi, "start"],
    [/\bunprecedented\b/gi, "never-before-seen"], [/\bwidespread\b/gi, "common"], [/\bsubsequent\b/gi, "later"],
    [/\bsubsequently\b/gi, "later"], [/\bpredominantly\b/gi, "mostly"], [/\bprimarily\b/gi, "mainly"],
    [/\binitially\b/gi, "at first"], [/\bultimately\b/gi, "in the end"], [/\bfurthermore\b/gi, "also"], [/\bmoreover\b/gi, "also"],
    [/\bthereby\b/gi, "and so"], [/\bwhereas\b/gi, "while"], [/\bregarding\b/gi, "about"], [/\bpossess(es)?\b/gi, (m, e) => (e ? "has" : "have")],
    [/\btransitional period\b/gi, "time of change"], [/\bexhibit(s|ed)?\b/gi, (m, e = "") => "show" + ({ "": "", s: "s", ed: "ed" })[e.toLowerCase()]]
  ];

  const keepCase = (original, replacement) =>
    original && original[0] === original[0].toUpperCase() ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;

  const simplifyText = (text) => {
    let s = text
      .replace(/\[(?:\d+|[a-z]|citation needed)\]/gi, "")
      .replace(/\s*\([^()]{0,100}\)/g, "")
      .replace(/\s+/g, " ")
      .trim();
    for (const [pattern, rep] of SWAPS) {
      s = s.replace(pattern, (...args) => {
        const match = args[0];
        const out = typeof rep === "function" ? rep(...args) : rep;
        return keepCase(match, out);
      });
    }
    // Break long sentences into shorter ones.
    s = s
      .replace(/;\s+/g, ". ")
      .replace(/,\s+which\s+/gi, ". This ")
      .replace(/,\s+who\s+/gi, ". They ")
      .replace(/,\s+while\s+/gi, ". Meanwhile, ")
      .replace(/\s+[–—]\s+/g, ". ");
    s = s.replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
    return s;
  };

  const baseForms = (word) => {
    const w = word.toLowerCase().replace(/[^a-z-]/g, "");
    const forms = [w];
    if (w.endsWith("ies")) forms.push(w.slice(0, -3) + "y");
    if (w.endsWith("es")) forms.push(w.slice(0, -2));
    if (w.endsWith("s")) forms.push(w.slice(0, -1));
    if (w.endsWith("ed")) forms.push(w.slice(0, -2), w.slice(0, -1));
    if (w.endsWith("ing")) forms.push(w.slice(0, -3), w.slice(0, -3) + "e");
    if (w.endsWith("isation")) forms.push(w.replace(/isation$/, "ization"));
    if (w.endsWith("ise")) forms.push(w.replace(/ise$/, "ize"));
    if (w.endsWith("our")) forms.push(w.replace(/our$/, "or"));
    return forms;
  };

  const define = (word) => {
    for (const f of baseForms(word)) if (GLOSSARY[f]) return { word: f, meaning: GLOSSARY[f] };
    return null;
  };

  const sentenceAround = (range) => {
    const block = range.startContainer.parentElement && range.startContainer.parentElement.closest("p, li, dd, td, blockquote, div");
    if (!block) return "";
    const all = (block.innerText || "").replace(/\s+/g, " ");
    const picked = range.toString().trim();
    const at = all.indexOf(picked);
    if (at < 0) return "";
    const start = Math.max(all.lastIndexOf(". ", at) + 2, 0);
    let end = all.indexOf(". ", at + picked.length);
    end = end < 0 ? all.length : end + 1;
    return all.slice(start, end).trim();
  };

  // ---------- The card ----------
  let host = null;
  const closeCard = () => {
    if (host) host.remove();
    host = null;
  };

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const showCard = (rect, title, bodyHtml, original) => {
    closeCard();
    host = document.createElement("div");
    host.setAttribute("data-calmweb-ui", "");
    host.style.cssText = "all:initial;position:fixed;z-index:2147483647;";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        .card{width:330px;max-width:calc(100vw - 24px);background:#fff;border:1px solid #d7e8dd;border-radius:16px;
          box-shadow:0 14px 40px rgba(26,58,40,.18);font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1d2b23;
          overflow:hidden;animation:in .18s ease-out}
        @keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .head{display:flex;align-items:center;gap:8px;padding:10px 12px 8px;border-bottom:1px solid #edf4ef}
        .logo{width:22px;height:22px;border-radius:7px;background:#e2f2e8;display:grid;place-items:center}
        .brand{font-weight:650;font-size:13px;color:#24563b}.sub{font-size:12px;color:#6c8475;margin-left:auto}
        .x{border:0;background:none;font-size:18px;line-height:1;color:#6c8475;cursor:pointer;padding:0 2px}
        .body{padding:12px 14px}
        h3{margin:0 0 6px;font-size:15px;color:#173a28;background:#e6f4ec;border-radius:8px;padding:6px 9px}
        p{margin:6px 0}.muted{color:#5c7366;font-size:12.5px}
        .terms{margin:8px 0 0;padding:0;list-style:none}.terms li{margin:4px 0;font-size:13px}
        .orig{margin-top:10px;border-top:1px solid #edf4ef;padding-top:8px;font-size:12.5px;color:#4d6457}
        .orig q{display:block;margin-top:2px;font-style:italic}
      </style>
      <div class="card" role="dialog" aria-label="Plain-language explanation">
        <div class="head">
          <span class="logo"><svg width="13" height="13" viewBox="0 0 24 24"><path fill="#2e7d52" d="M20 4C9 4 4 10 4 17c0 1 .2 2 .4 3C6 13 11 9 16 8c-4 2-8 6-10 12 8 0 14-5 14-16z"/></svg></span>
          <span class="brand">CalmWeb AI</span><span class="sub">Plain-language helper</span>
          <button class="x" aria-label="Close">×</button>
        </div>
        <div class="body">
          <h3>${esc(title)}</h3>
          ${bodyHtml}
          <div class="orig">Original wording:<q>${esc(original)}</q></div>
        </div>
      </div>`;
    shadow.querySelector(".x").addEventListener("click", closeCard);
    document.documentElement.appendChild(host);

    const card = shadow.querySelector(".card");
    const w = card.offsetWidth || 330;
    const h = card.offsetHeight || 200;
    let left = Math.min(Math.max(12, rect.left), innerWidth - w - 12);
    let top = rect.bottom + 10;
    if (top + h > innerHeight - 12) top = Math.max(12, rect.top - h - 10);
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
  };

  const explainSelection = () => {
    if (!CW.active() || !CW.settings.simplifyOnSelect) return;
    const sel = getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const picked = sel.toString().replace(/\s+/g, " ").trim();
    if (picked.length < 2 || picked.length > 600) return;
    const range = sel.getRangeAt(0);
    const anchor = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    if (!anchor || anchor.closest('input, textarea, [contenteditable=""], [contenteditable="true"], [data-calmweb-ui]')) return;

    const rect = range.getBoundingClientRect();
    const wordList = picked.split(/\s+/);

    if (wordList.length <= 3) {
      const hit = define(wordList.length === 1 ? picked : wordList[wordList.length - 1]) || (wordList.length > 1 && define(wordList[0]));
      const sentence = sentenceAround(range);
      let body = hit
        ? `<p><strong>${esc(hit.word)}</strong> means ${esc(hit.meaning)}.</p>`
        : `<p class="muted">This word isn't in CalmWeb's built-in glossary yet. Here's the sentence it's in, in plainer words:</p>`;
      if (sentence && sentence.length > picked.length + 10) {
        body += `<p class="muted">In this sentence:</p><p>${esc(simplifyText(sentence))}</p>`;
      }
      showCard(rect, picked, body, sentence || picked);
      return;
    }

    const plain = simplifyText(picked);
    const terms = [];
    const seen = new Set();
    for (const w of wordList) {
      const hit = define(w);
      if (hit && !seen.has(hit.word)) {
        seen.add(hit.word);
        terms.push(`<li><strong>${esc(hit.word)}</strong>: ${esc(hit.meaning)}</li>`);
      }
      if (terms.length >= 4) break;
    }
    const body =
      `<p>${esc(plain)}</p>` + (terms.length ? `<p class="muted">Key words:</p><ul class="terms">${terms.join("")}</ul>` : "");
    showCard(rect, "In plain language", body, picked.length > 280 ? picked.slice(0, 280) + "…" : picked);
  };

  CW.startSimplifier = () => {
    document.addEventListener("mouseup", (e) => {
      if (!e.isTrusted || (e.target instanceof Element && e.target.closest("[data-calmweb-ui]"))) return;
      setTimeout(explainSelection, 10);
    });
    document.addEventListener("mousedown", (e) => {
      if (host && !(e.target instanceof Element && e.target.closest("[data-calmweb-ui]"))) closeCard();
    });
    document.addEventListener("keydown", (e) => e.key === "Escape" && closeCard());
    addEventListener("scroll", () => host && closeCard(), { passive: true });
  };

  CW.simplifyText = simplifyText;
})();
