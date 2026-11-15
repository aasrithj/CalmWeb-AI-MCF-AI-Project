# CalmWeb AI - training and testing

Everything here runs with Python 3 + scikit-learn + numpy + matplotlib.

## Datasets
| Dataset | Where it's published | Used for |
|---|---|---|
| SMS Spam Collection (5,574 messages, 747 spam) | UCI; Kaggle `uciml/sms-spam-collection-dataset`; Hugging Face `ucirvine/sms_spam` | Promotional vs normal text (pop-up detector) |
| BBC News (2,225 articles, 5 topics) | Greene & Cunningham 2006; the articles behind Kaggle `pariza/bbc-news-summary` | Normal "learning" text for the pop-up detector, and testing the summarizer |

Put `sms.tsv` (label<TAB>message) and the `bbc/` folder (business, entertainment, politics, sport, tech)
in a data folder and set `DATA` at the top of each script.

## Scripts
1. `train_popup_model.py` - TF-IDF -> truncated SVD (dimensionality reduction) -> logistic regression.
   Picks the number of SVD dimensions by 5-fold cross-validation on training data, tests on held-out data,
   writes `models/popup_model.json` and `results/popup_metrics.json`.
2. `evaluate_summarizer.py` - compares summarizers on BBC articles (hide the journalist's opening
   summary sentence, pick 3 sentences from the rest, measure ROUGE recall). Includes an LSA (SVD) summarizer.
   Tunes on 80% of articles, reports on 20%. Writes `results/summary_metrics.json`.
3. `make_charts.py` - charts for slides in `charts/`.
4. `parity_test.mjs` - checks the extension's JavaScript model gives the same answers as Python.

## Results
Pop-up detector (1,915 held-out test examples): accuracy 98.0%, precision 82.8%, recall 94.0%, F1 0.88.
Without dimensionality reduction (all 3,000 features): accuracy 99.1%, F1 0.94, but 3,000 learned weights instead of 200.
On 20 pop-up style sentences the team wrote as a check: 10/10 normal sentences kept, only 4/10 pop-ups caught,
because text messages and website pop-ups use different words. That's why the model runs together with rules.

Summarizer (443 held-out BBC articles, ROUGE-1 recall): random 34.1%, first 3 sentences 34.6%, LSA/SVD only 34.8%,
CalmWeb + LSA + news word weights 38.2%, CalmWeb summarizer 38.5% (kept).
