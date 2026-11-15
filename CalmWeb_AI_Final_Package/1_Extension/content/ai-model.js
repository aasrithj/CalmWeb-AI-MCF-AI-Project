// CalmWeb AI - pop-up text detector (machine-learning model).
// Trained in Python on the SMS Spam Collection (UCI / Kaggle / Hugging Face) and
// BBC News article sentences, using TF-IDF -> truncated SVD (dimensionality
// reduction to 200 dimensions) -> logistic regression. See training/README.md.
// Runs entirely on this device.
(() => {
  const CW = globalThis.CalmWeb;
  let model = null;
  let index = null;
  let loading = null;

  const TOKEN = /[\p{L}\p{N}_]{2,}/gu; // same rule as scikit-learn's default tokenizer

  CW.loadModel = () => {
    if (!loading) {
      loading = fetch(chrome.runtime.getURL("models/popup_model.json"))
        .then((r) => r.json())
        .then((m) => {
          model = m;
          index = new Map(m.terms.map((t, i) => [t, i]));
          CW.modelInfo = { name: m.name, accuracy: m.test_accuracy, dims: m.svd_dimensions };
          return m;
        })
        .catch(() => null);
    }
    return loading;
  };

  // Probability (0-1) that a piece of text is promotional / pop-up style.
  CW.promoScore = (text) => {
    if (!model || !text) return 0;
    const words = text.toLowerCase().slice(0, 1500).match(TOKEN) || [];
    const counts = new Map();
    const add = (term) => {
      const i = index.get(term);
      if (i !== undefined) counts.set(i, (counts.get(i) || 0) + 1);
    };
    for (let i = 0; i < words.length; i++) {
      add(words[i]);
      if (i + 1 < words.length) add(`${words[i]} ${words[i + 1]}`);
    }
    if (!counts.size) return 0;
    let norm = 0;
    const values = [];
    for (const [i, c] of counts) {
      const v = (1 + Math.log(c)) * model.idf[i];
      values.push([i, v]);
      norm += v * v;
    }
    norm = Math.sqrt(norm) || 1;
    let z = model.intercept;
    for (const [i, v] of values) z += (v / norm) * model.weights[i];
    return 1 / (1 + Math.exp(-z));
  };
})();
