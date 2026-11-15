# CalmWeb AI 3.1 (Chrome extension)

A calmer, more focused web for learning.

## Install (no Python needed)
1. Extract the ZIP (right-click > Extract All).
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. If an older CalmWeb AI is listed, click **Remove** on it first.
4. Click **Load unpacked** and pick the extracted folder (the one with `manifest.json` directly inside).
5. Pin CalmWeb AI from the puzzle-piece menu. Refresh any tabs that were already open.

## What it does
- **Block pop-ups:** stops pop-up/pop-under windows, sign-up, cookie and "special offer" overlays, sticky promo bars and "allow notifications" prompts. Gives scrolling back to the page.
- **Remove distractions:** hides ads (and blocks about 65 ad networks), sponsored boxes and "you might also like" link farms.
- **Never hide learning tools:** quizzes, lesson videos, labs, diagrams and the main article are always kept.
- **Reading comfort:** dyslexia-friendly font, text size, line spacing, reading mask, calm color palettes.
- **AI summary:** an overview and key points from the article text only (menus, sidebars, info boxes and references are skipped). Brief, Balanced or Detailed. "Show in page" jumps to where each point came from.
- **Select to simplify:** select a word or passage to see it in plain language with a built-in school glossary.
- **View original page:** turns CalmWeb off on the current tab until you press "Calm this page" again.

## The AI model
CalmWeb's pop-up detector is a machine-learning model trained on two public datasets:
- **SMS Spam Collection** (UCI; also on Kaggle as `uciml/sms-spam-collection-dataset` and Hugging Face as `ucirvine/sms_spam`): 5,574 messages labeled promotional (spam) or normal.
- **BBC News** (2,225 articles, Greene & Cunningham 2006; the articles behind Kaggle's `pariza/bbc-news-summary`): 4,000 article sentences used as examples of normal, learning-style text.

How it works: each piece of text becomes 3,000 word and word-pair features (TF-IDF), **truncated SVD
(dimensionality reduction) squeezes them into 200 dimensions**, and a logistic-regression classifier
decides whether the text is promotional. On 1,915 test examples it never saw: 98.0% accuracy,
94% of promotional texts caught (recall), 83% of its flags correct (precision).
`models/popup_model.json` holds the trained weights; the SVD and classifier are folded into one weight
per word so it runs fast in the browser (predictions verified identical to Python).
The model works together with CalmWeb's hand-written pop-up rules. Training code: the separate
CalmWeb_AI_training.zip.

## Privacy
Everything runs inside Chrome on your device. Page text is never stored or sent anywhere.

## How the summary works
CalmWeb finds the article's paragraphs, splits them into sentences, and scores each sentence by
how many of the article's most important words it contains and where it appears. It then picks
the best opening sentences for the overview and the strongest non-repeating sentences as key points.
This is an extractive summarizer: it chooses real sentences from the page rather than writing new ones.

## Files
- `manifest.json` - extension setup
- `background.js` - ad-network blocking rules and the toolbar badge
- `rules/ad_rules.json` - ad networks that are blocked
- `content/` - code that runs on web pages (pop-up guard, AI model, blocker, reading tools, summarizer, simplifier)
- `models/popup_model.json` - the trained pop-up detector
- `popup/` - the CalmWeb window (HTML, CSS, JS)
