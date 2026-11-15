// CalmWeb AI - "Never hide learning tools".
// Decides whether an element holds something a student needs:
// an embedded lesson video, a quiz, a lab simulation or the main article.
(() => {
  const CW = globalThis.CalmWeb;

  const LEARNING_HOSTS =
    /(youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|khanacademy\.org|phet\.colorado\.edu|desmos\.com|geogebra\.org|docs\.google\.com|forms\.gle|classroom\.google\.com|quizlet\.com|kahoot\.it|edpuzzle\.com|instructure\.com|canvas|schoology\.com|blackboard\.com|nearpod\.com|padlet\.com|brainpop\.com|ck12\.org|pbslearningmedia\.org|wolframalpha\.com|scratch\.mit\.edu|codepen\.io|replit\.com|wikipedia\.org|wikimedia\.org)/i;
  const LEARNING_WORDS =
    /(quiz|exercise|practice|problem|question|answer|lab\b|simulat|interactive|diagram|equation|worksheet|flashcard|lesson|assessment|assignment|lecture|tutorial)/i;
  const AD_WORDS = /(advert|sponsor|promo|\bads?\b|banner|outbrain|taboola|doubleclick|googlesyndication)/i;
  const MAIN_CONTENT = 'main, article, [role="main"], #content, #mw-content-text, .mw-parser-output, [itemprop="articleBody"]';

  const label = (el) => `${el.id || ""} ${el.getAttribute("class") || ""} ${el.getAttribute("aria-label") || ""}`;

  CW.holdsMainContent = (el) => {
    if (!(el instanceof Element)) return false;
    if (el === document.body || el === document.documentElement) return true;
    return el.matches(MAIN_CONTENT) || !!el.querySelector(MAIN_CONTENT);
  };

  CW.isProtected = (el) => {
    if (!(el instanceof Element)) return false;
    if (CW.holdsMainContent(el)) return true;
    if (!CW.settings.protectLearning) return false;

    const iframes = el.matches("iframe") ? [el] : Array.from(el.querySelectorAll("iframe"));
    if (iframes.some((f) => LEARNING_HOSTS.test(f.getAttribute("src") || ""))) return true;

    const text = (el.innerText || "").slice(0, 800);
    const looksLikeAd = AD_WORDS.test(label(el));

    // Quizzes and practice questions: answer choices or input boxes plus learning words.
    const inputs = el.querySelectorAll('input[type="radio"], input[type="checkbox"], input[type="number"], textarea, [role="radio"], [role="radiogroup"]');
    if (inputs.length && (LEARNING_WORDS.test(text) || LEARNING_WORDS.test(label(el)))) return true;

    // Lesson videos, simulations and diagrams that aren't marked as ads.
    if (!looksLikeAd && el.querySelector("video, canvas, math, .MathJax, .katex")) return true;
    if (!looksLikeAd && LEARNING_WORDS.test(label(el))) return true;

    return false;
  };
})();
