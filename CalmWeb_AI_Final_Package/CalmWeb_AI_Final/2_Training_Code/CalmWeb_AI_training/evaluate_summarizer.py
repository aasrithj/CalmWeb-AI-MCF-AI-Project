"""
CalmWeb AI - tune and measure the summarizer on the BBC News dataset.

Test used (a standard trick from the XSum dataset): a BBC article's opening sentence is
written by the journalist as a one-line summary. We hide it, let each method pick 3 sentences
from the rest of the article, and measure how many of the opening sentence's words the
picked sentences recover (ROUGE-1 and ROUGE-2 recall, the standard summary scores).

Methods compared
  random            3 random sentences
  first3            the next 3 sentences (a strong baseline for news)
  calmweb_v3        word frequency + position + title words (CalmWeb 3.0)
  lsa               Latent Semantic Analysis: SVD of the sentence-word matrix (dimensionality reduction)
  calmweb_ai        CalmWeb 3.0 + LSA + word weights learned from BBC training articles

Weights for calmweb_ai are chosen on 80% of the articles and reported on the other 20%.
Outputs results/summary_metrics.json and models/news_idf.json for the extension.
"""
import itertools
import json
import math
import random
import re
from collections import Counter
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent
DATA = Path("/home/claude/data/bbc")
SEED = 7
random.seed(SEED)

STOP = set("""a about above after again against all also am an and any are as at be because been before being below between both but by can cannot could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself let me more most my myself no nor not of off on once only or other ought our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why with would you your yours yourself yourselves one two first second new many much may might however although though since among including include includes included called known well like often used use using became become later early another within around per even still must made make makes upon thus whether either several various said says""".split())

WORD = re.compile(r"[a-z][a-z'-]{2,}")


def tokens(s):
    return [w for w in WORD.findall(s.lower()) if w not in STOP]


def split_sentences(text):
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z\"'])", text)
    return [p.strip() for p in parts if p.strip()]


def load(path):
    lines = path.read_text(encoding="latin-1").splitlines()
    title = lines[0].strip()
    paragraphs = [p.strip() for p in "\n".join(lines[1:]).split("\n\n") if p.strip()]
    sents = []
    for pi, para in enumerate(paragraphs):
        for si, s in enumerate(split_sentences(" ".join(para.split()))):
            sents.append({"text": s, "pi": pi, "si": si})
    return title, sents


# ---------- ROUGE ----------
def ngrams(words, n):
    return Counter(tuple(words[i : i + n]) for i in range(len(words) - n + 1))


def rouge_recall(candidate, reference, n):
    c = ngrams(re.findall(r"[a-z0-9]+", candidate.lower()), n)
    r = ngrams(re.findall(r"[a-z0-9]+", reference.lower()), n)
    if not r:
        return 0.0
    return sum(min(c[g], r[g]) for g in r) / sum(r.values())


# ---------- scoring methods ----------
def calmweb_v3_scores(title, sents, idf=None):
    freq = Counter()
    toks = [tokens(s["text"]) for s in sents]
    for t in toks:
        freq.update(set(t))
    title_words = set(tokens(title))
    last = max(1, max(s["pi"] for s in sents))
    raw = []
    for t in toks:
        u = set(t)
        if idf:
            r = sum(math.log(1 + freq[w]) * idf.get(w, idf["__max__"]) for w in u if freq[w] > 1)
        else:
            r = sum(math.log(1 + freq[w]) for w in u if freq[w] > 1)
        raw.append(r / math.sqrt(len(u) + 4))
    mx = max(raw) or 1
    out = []
    for s, t, r in zip(sents, toks, raw):
        score = r / mx
        score += 0.6 if s["pi"] == 0 else 0.25 if s["pi"] < 3 else 0.2 * (1 - s["pi"] / last)
        if s["si"] == 0:
            score += 0.15
        score += min(0.3, 0.1 * sum(1 for w in t if w in title_words))
        out.append(score)
    return np.array(out), toks


def lsa_scores(sents, toks, idf=None, k=3):
    vocab = sorted({w for t in toks for w in t})
    if len(vocab) < 2 or len(sents) < 2:
        return np.zeros(len(sents))
    index = {w: i for i, w in enumerate(vocab)}
    A = np.zeros((len(sents), len(vocab)))
    for i, t in enumerate(toks):
        for w, c in Counter(t).items():
            A[i, index[w]] = (1 + math.log(c)) * (idf.get(w, idf["__max__"]) if idf else 1.0)
    norms = np.linalg.norm(A, axis=1, keepdims=True)
    A = A / np.where(norms == 0, 1, norms)
    U, S, _ = np.linalg.svd(A, full_matrices=False)
    k = min(k, len(S))
    score = np.sqrt(((U[:, :k] * S[:k]) ** 2).sum(axis=1))
    return score / (score.max() or 1)


def pick(scores, toks, n=3):
    chosen = []
    for i in np.argsort(-scores):
        if len(toks[i]) < 4:
            continue
        a = set(toks[i])
        if any(len(a & set(toks[j])) / max(1, min(len(a), len(set(toks[j])))) > 0.5 for j in chosen):
            continue
        chosen.append(i)
        if len(chosen) == n:
            break
    return sorted(chosen)


def run(method, title, sents, idf=None, w_lsa=0.0, k=3):
    toks = [tokens(s["text"]) for s in sents]
    if method == "random":
        idx = [i for i in range(len(sents)) if len(toks[i]) >= 4]
        return sorted(random.sample(idx, min(3, len(idx))))
    if method == "first3":
        return [i for i in range(len(sents)) if len(toks[i]) >= 4][:3]
    if method == "lsa":
        return pick(lsa_scores(sents, toks, None, k), toks)
    base, toks = calmweb_v3_scores(title, sents, idf if method == "calmweb_ai" else None)
    if method == "calmweb_ai":
        base = base + w_lsa * lsa_scores(sents, toks, idf, k)
    return pick(base, toks)


# ---------- data ----------
articles = []
for path in sorted(DATA.glob("*/*.txt")):
    title, sents = load(path)
    if len(sents) < 6:
        continue
    reference = sents[0]["text"]  # the journalist's opening summary sentence
    body = [dict(s) for s in sents[1:]]
    # re-number paragraphs so the body starts at paragraph 0
    first_pi = body[0]["pi"]
    for s in body:
        s["pi"] -= first_pi
    articles.append({"title": title, "ref": reference, "body": body, "topic": path.parent.name})
random.shuffle(articles)
cut = int(len(articles) * 0.8)
train, test = articles[:cut], articles[cut:]
print(f"{len(articles)} BBC articles usable -> {len(train)} for tuning, {len(test)} for testing")

# News word weights (IDF) learned from training articles only
df = Counter()
for a in train:
    df.update(set(w for s in a["body"] for w in tokens(s["text"])))
N = len(train)
idf = {w: round(math.log((1 + N) / (1 + c)) + 1, 3) for w, c in df.items() if c >= 2}
idf["__max__"] = round(math.log((1 + N) / 1) + 1, 3)


def evaluate(method, data, **kw):
    r1 = r2 = 0.0
    for a in data:
        idx = run(method, a["title"], a["body"], idf, **kw)
        summary = " ".join(a["body"][i]["text"] for i in idx)
        r1 += rouge_recall(summary, a["ref"], 1)
        r2 += rouge_recall(summary, a["ref"], 2)
    return round(r1 / len(data), 4), round(r2 / len(data), 4)


# Tune on training articles
grid = list(itertools.product([0.0, 0.25, 0.5, 0.75, 1.0, 1.5], [2, 3, 5]))
best = None
for w, k in grid:
    r1, r2 = evaluate("calmweb_ai", train, w_lsa=w, k=k)
    if best is None or r1 + r2 > best[0]:
        best = (r1 + r2, w, k)
    print(f"  tune: LSA weight {w:<4} k={k}: ROUGE-1 {r1:.3f} ROUGE-2 {r2:.3f}")
_, W, K = best
print(f"Chosen on training articles: LSA weight {W}, {K} SVD topics")

results = {}
for m in ["random", "first3", "calmweb_v3", "lsa", "calmweb_ai"]:
    random.seed(SEED)
    r1, r2 = evaluate(m, test, w_lsa=W, k=K)
    results[m] = {"rouge1_recall": r1, "rouge2_recall": r2}
    print(f"{m:<12} ROUGE-1 {r1:.3f}  ROUGE-2 {r2:.3f}")

out = {
    "dataset": "BBC News (2,225 articles, Greene & Cunningham 2006)",
    "test": "hide the opening summary sentence, pick 3 sentences from the rest, ROUGE recall vs the hidden sentence",
    "tuning_articles": len(train),
    "test_articles": len(test),
    "chosen": {"lsa_weight": W, "svd_topics": K},
    "results": results,
}
Path(ROOT / "results").mkdir(exist_ok=True)
(ROOT / "results" / "summary_metrics.json").write_text(json.dumps(out, indent=1))

# Export news word weights for the extension (most informative-to-common range, capped size)
common = sorted(((w, v) for w, v in idf.items() if w != "__max__"), key=lambda x: x[1])[:9000]
(ROOT / "models" / "news_idf.json").write_text(
    json.dumps({"max": idf["__max__"], "lsa_weight": W, "svd_topics": K, "idf": {w: v for w, v in common}}, separators=(",", ":"))
)
print("news_idf.json words:", len(common))
