"""
CalmWeb AI - train the "pop-up / promotional text" detector.

Data
  * SMS Spam Collection (UCI; also on Kaggle as uciml/sms-spam-collection-dataset
    and Hugging Face as ucirvine/sms_spam): 5,574 messages labeled spam / ham.
    spam = promotional text (label 1), ham = normal text (label 0).
  * BBC News dataset (Greene & Cunningham 2006; the 2,225 articles that Kaggle's
    pariza/bbc-news-summary is built from): article sentences = learning content (label 0).

Model
  TF-IDF word and word-pair counts (3,000 features)
  -> Truncated SVD (dimensionality reduction to a few dozen "topics")
  -> logistic regression (promotional vs content)

Outputs
  models/popup_model.json   - weights the Chrome extension runs on-device
  results/popup_metrics.json - held-out test results
  charts/*.png              - charts for the slides
"""
import json
import random
import re
from pathlib import Path

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import make_pipeline

ROOT = Path(__file__).parent
DATA = Path("/home/claude/data")
OUT_MODELS = ROOT / "models"
OUT_RESULTS = ROOT / "results"
OUT_MODELS.mkdir(exist_ok=True)
OUT_RESULTS.mkdir(exist_ok=True)
SEED = 42
random.seed(SEED)
np.random.seed(SEED)

# ---------- 1. Load data ----------
sms_text, sms_label = [], []
for line in (DATA / "sms.tsv").read_text(encoding="utf-8", errors="ignore").splitlines():
    if "\t" not in line:
        continue
    lab, msg = line.split("\t", 1)
    sms_text.append(msg.strip())
    sms_label.append(1 if lab == "spam" else 0)

def bbc_sentences(path):
    text = path.read_text(encoding="latin-1")
    body = " ".join(text.splitlines()[1:])  # first line is the headline
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z\"'])", body)
    return [p.strip() for p in parts if 8 <= len(p.split()) <= 60]

articles = sorted((DATA / "bbc").glob("*/*.txt"))
random.shuffle(articles)
n_test_articles = len(articles) // 5
bbc_test_articles, bbc_train_articles = articles[:n_test_articles], articles[n_test_articles:]

def sample_sentences(paths, n):
    pool = [s for p in paths for s in bbc_sentences(p)]
    random.shuffle(pool)
    return pool[:n]

bbc_train = sample_sentences(bbc_train_articles, 3200)
bbc_test = sample_sentences(bbc_test_articles, 800)

# SMS split (stratified); BBC split by article so no article is in both train and test.
X_sms_tr, X_sms_te, y_sms_tr, y_sms_te = train_test_split(
    sms_text, sms_label, test_size=0.2, stratify=sms_label, random_state=SEED
)
X_train = X_sms_tr + bbc_train
y_train = np.array(y_sms_tr + [0] * len(bbc_train))
X_test = X_sms_te + bbc_test
y_test = np.array(y_sms_te + [0] * len(bbc_test))
source_test = ["sms"] * len(X_sms_te) + ["bbc"] * len(bbc_test)

print(f"SMS messages: {len(sms_text)} (spam {sum(sms_label)}, ham {len(sms_label) - sum(sms_label)})")
print(f"BBC articles: {len(articles)} -> train sentences {len(bbc_train)}, test sentences {len(bbc_test)}")
print(f"Train {len(X_train)} examples ({int(y_train.sum())} promotional) | Test {len(X_test)} ({int(y_test.sum())} promotional)")

# ---------- 2. Pick the number of SVD dimensions with cross-validation (train data only) ----------
def build(k):
    steps = [TfidfVectorizer(lowercase=True, ngram_range=(1, 2), min_df=2, max_features=3000, sublinear_tf=True)]
    if k:
        steps.append(TruncatedSVD(n_components=k, random_state=SEED))
    steps.append(LogisticRegression(class_weight="balanced", max_iter=3000, C=4.0))
    return make_pipeline(*steps)

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
dims = [2, 5, 10, 20, 30, 50, 100, 200]
cv_scores = {}
for k in dims:
    scores = cross_val_score(build(k), X_train, y_train, cv=cv, scoring="f1")
    cv_scores[k] = float(scores.mean())
    print(f"  SVD {k:>3} dims: cross-validated F1 = {scores.mean():.3f}")
full_cv = float(cross_val_score(build(0), X_train, y_train, cv=cv, scoring="f1").mean())
print(f"  no reduction (3000 features): cross-validated F1 = {full_cv:.3f}")

# Smallest number of dimensions within 1 point of the best score: small model, same quality.
best = max(cv_scores.values())
K = min(k for k, s in cv_scores.items() if s >= best - 0.01)
print(f"Chosen: {K} SVD dimensions")

# ---------- 3. Train final model and test on held-out data ----------
model = build(K).fit(X_train, y_train)
tfidf, svd, clf = model.named_steps["tfidfvectorizer"], model.named_steps["truncatedsvd"], model.named_steps["logisticregression"]
pred = model.predict(X_test)
proba = model.predict_proba(X_test)[:, 1]

def scores_for(mask):
    yt, yp = y_test[mask], pred[mask]
    return {
        "examples": int(mask.sum()),
        "accuracy": round(float(accuracy_score(yt, yp)), 4),
    }

metrics = {
    "svd_dimensions": K,
    "features_before_reduction": len(tfidf.vocabulary_),
    "variance_kept_by_svd": round(float(svd.explained_variance_ratio_.sum()), 4),
    "test_examples": len(X_test),
    "accuracy": round(float(accuracy_score(y_test, pred)), 4),
    "precision": round(float(precision_score(y_test, pred)), 4),
    "recall": round(float(recall_score(y_test, pred)), 4),
    "f1": round(float(f1_score(y_test, pred)), 4),
    "confusion_matrix": confusion_matrix(y_test, pred).tolist(),
    "by_source": {
        "sms_messages": scores_for(np.array([s == "sms" for s in source_test])),
        "bbc_sentences": scores_for(np.array([s == "bbc" for s in source_test])),
    },
    "cv_f1_by_dimensions": cv_scores,
    "cv_f1_without_reduction": full_cv,
}

# Baseline: no dimensionality reduction, for comparison
full_model = build(0).fit(X_train, y_train)
full_pred = full_model.predict(X_test)
metrics["no_reduction_test"] = {
    "accuracy": round(float(accuracy_score(y_test, full_pred)), 4),
    "f1": round(float(f1_score(y_test, full_pred)), 4),
    "numbers_in_model": int(full_model.named_steps["logisticregression"].coef_.size),
}
metrics["numbers_in_final_classifier"] = int(clf.coef_.size)

# ---------- 4. Extra check on pop-up style text (written by the CalmWeb team, NOT from a dataset) ----------
popup_examples = [
    "Subscribe to our newsletter and get 20% off your first order!",
    "Don't miss out! Sign up now for exclusive deals.",
    "Summer Sale: up to 50% off sneakers. Shop now!",
    "Congratulations! You've won a free gift card. Click here to claim.",
    "Get the app for a better experience. Download now, it's free!",
    "Limited time offer: try Premium free for 30 days.",
    "Turn on notifications so you never miss a story.",
    "Wait! Before you go, get 10% off with code SAVE10.",
    "Join thousands of readers. Enter your email to get free tips every week.",
    "Win a brand new iPhone! Enter the contest today.",
]
content_examples = [
    "Photosynthesis is the process by which plants convert light energy into chemical energy.",
    "The Industrial Revolution began in Great Britain in the late 18th century.",
    "Chlorophyll absorbs light energy, which is used to split water molecules.",
    "Steam engines were used to pump water from mines and power factory machines.",
    "The Treaty of Versailles was signed in 1919 at the end of the First World War.",
    "A quadratic equation has the form ax squared plus bx plus c equals zero.",
    "Cells are the basic units of life, and all living things are made of cells.",
    "The French Revolution led to major changes in government and society.",
    "Water evaporates, condenses into clouds, and falls back to Earth as precipitation.",
    "Plato describes prisoners in a cave who mistake shadows for reality.",
]
check_p = model.predict(popup_examples + content_examples)
metrics["team_written_check"] = {
    "note": "20 sentences written by the team to sanity-check pop-up style text; not a dataset, not used for training",
    "popup_caught": int(check_p[:10].sum()),
    "popup_total": 10,
    "content_kept": int((check_p[10:] == 0).sum()),
    "content_total": 10,
    "missed_popups": [t for t, p in zip(popup_examples, check_p[:10]) if p == 0],
    "wrongly_flagged_content": [t for t, p in zip(content_examples, check_p[10:]) if p == 1],
}

print(json.dumps({k: v for k, v in metrics.items() if k not in ("cv_f1_by_dimensions",)}, indent=1))
(OUT_RESULTS / "popup_metrics.json").write_text(json.dumps(metrics, indent=1))

# ---------- 5. Export for the extension ----------
vocab = tfidf.vocabulary_
terms = [None] * len(vocab)
for term, idx in vocab.items():
    terms[idx] = term
export = {
    "name": "CalmWeb pop-up text detector",
    "version": "1.0",
    "trained_on": ["SMS Spam Collection (UCI / Kaggle / Hugging Face)", "BBC News dataset (Greene & Cunningham 2006)"],
    "pipeline": "tfidf(1-2 grams, sublinear tf, l2) -> truncated SVD -> logistic regression",
    "terms": terms,
    "idf": [round(float(x), 4) for x in tfidf.idf_],
    "svd": [[round(float(x), 5) for x in row] for row in svd.components_],
    "coef": [round(float(x), 5) for x in clf.coef_[0]],
    "intercept": round(float(clf.intercept_[0]), 5),
    "test_accuracy": metrics["accuracy"],
    "test_f1": metrics["f1"],
}
(OUT_MODELS / "popup_model.json").write_text(json.dumps(export, separators=(",", ":")))

# Parity samples so the JavaScript version can be checked against Python
parity_text = X_test[:40] + popup_examples + content_examples
(OUT_RESULTS / "parity.json").write_text(
    json.dumps({"text": parity_text, "proba": [round(float(p), 5) for p in model.predict_proba(parity_text)[:, 1]]})
)

# 2-D picture of the reduced space for the slides
Z = svd.transform(tfidf.transform(X_test))[:, :2]
np.save(OUT_RESULTS / "svd_2d.npy", Z)
np.save(OUT_RESULTS / "svd_2d_labels.npy", y_test)
print("model size:", round((OUT_MODELS / "popup_model.json").stat().st_size / 1024), "KB")
