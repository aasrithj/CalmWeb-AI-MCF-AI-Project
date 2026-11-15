// CalmWeb AI - popup logic
const DEFAULTS = {
  enabled: true,
  hideAds: true,
  blockPopups: true,
  protectLearning: true,
  font: "default",
  textScale: 100,
  lineHeight: 0,
  readingMask: false,
  palette: "none",
  simplifyOnSelect: true,
  summaryDetail: 1
};
const LINE_HEIGHTS = [0, 1.6, 1.9, 2.2];
const LINE_LABELS = ["Website's", "Relaxed", "Roomy", "Extra roomy"];
const DETAIL_LABELS = ["Brief", "Balanced", "Detailed"];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let settings = { ...DEFAULTS };
let tab = null;
let pageReady = false;
let paused = false;
let lastSummary = null;

// ---------- Helpers ----------
const save = (patch) => {
  settings = { ...settings, ...patch };
  return chrome.storage.sync.set(patch);
};

const sendToPage = (message) =>
  new Promise((resolve) => {
    if (!tab || tab.id == null) return resolve(null);
    chrome.tabs.sendMessage(tab.id, message, (response) => {
      if (chrome.runtime.lastError) return resolve(null);
      resolve(response);
    });
  });

const setFill = (range) => {
  const min = Number(range.min);
  const max = Number(range.max);
  const pct = ((Number(range.value) - min) / (max - min)) * 100;
  range.style.setProperty("--fill", `${pct}%`);
};

const showNotice = (text) => {
  const el = $("#notice");
  el.textContent = text || "";
  el.hidden = !text;
};

const bump = (el, value) => {
  if (el.textContent !== String(value)) {
    el.textContent = value;
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }
};

// ---------- Tabs ----------
const selectTab = (name) => {
  const tabs = $$(".tab");
  tabs.forEach((t, i) => {
    const on = t.dataset.tab === name;
    t.classList.toggle("is-active", on);
    t.setAttribute("aria-selected", String(on));
    if (on) $(".tab-ink").style.transform = `translateX(${i * 100}%)`;
  });
  $$(".panel").forEach((p) => p.classList.toggle("is-active", p.dataset.panel === name));
  chrome.storage.local.set({ lastTab: name });
};
$$(".tab").forEach((t) => t.addEventListener("click", () => selectTab(t.dataset.tab)));

// ---------- Render settings ----------
const render = () => {
  $("#enabled").checked = settings.enabled;
  document.body.classList.toggle("is-off", !settings.enabled);

  $$("[data-setting]").forEach((input) => {
    const key = input.dataset.setting;
    if (input.type === "checkbox") input.checked = !!settings[key];
    else input.value = settings[key];
    if (input.type === "range") setFill(input);
  });

  $("#textScaleOut").textContent = `${settings.textScale}%`;
  const lhIndex = Math.max(0, LINE_HEIGHTS.indexOf(Number(settings.lineHeight)));
  $("#lineHeight").value = lhIndex;
  setFill($("#lineHeight"));
  $("#lineHeightOut").textContent = LINE_LABELS[lhIndex];
  $("#summaryDetailOut").textContent = DETAIL_LABELS[settings.summaryDetail] || "Balanced";
  $$(".swatch").forEach((s) => s.classList.toggle("is-active", s.dataset.palette === settings.palette));

  const calm = settings.enabled && !paused && settings.hideAds && settings.blockPopups;
  $("#calmBtn").classList.toggle("is-done", calm);
  $("#calmLabel").textContent = calm ? "This page is calm" : "Calm this page";
  $("#originalLabel").textContent = paused ? "Back to calm view" : "View original page";
};

// ---------- Settings inputs ----------
$("#enabled").addEventListener("change", async (e) => {
  await save({ enabled: e.target.checked });
  render();
  showNotice(e.target.checked ? "" : "CalmWeb is off on every site. Turn it back on with the switch above.");
});

$$("[data-setting]").forEach((input) => {
  const key = input.dataset.setting;
  const handler = () => {
    let value = input.type === "checkbox" ? input.checked : input.value;
    if (input.type === "range") value = Number(value);
    save({ [key]: value });
    render();
  };
  input.addEventListener(input.type === "range" ? "input" : "change", handler);
});

$("#lineHeight").addEventListener("input", (e) => {
  save({ lineHeight: LINE_HEIGHTS[Number(e.target.value)] });
  render();
});

$$(".swatch").forEach((s) =>
  s.addEventListener("click", () => {
    save({ palette: s.dataset.palette });
    render();
  })
);

// ---------- Calm tab ----------
$("#calmBtn").addEventListener("click", async () => {
  await save({ enabled: true, hideAds: true, blockPopups: true, protectLearning: true });
  if (pageReady) {
    const res = await sendToPage({ type: "calmweb:pause", paused: false });
    paused = res ? res.paused : false;
  }
  render();
  setTimeout(refreshStats, 400);
});

$("#originalBtn").addEventListener("click", async () => {
  if (!pageReady) return;
  const res = await sendToPage({ type: "calmweb:pause", paused: !paused });
  if (res) paused = res.paused;
  render();
});

const refreshStats = async () => {
  if (!pageReady) return;
  const state = await sendToPage({ type: "calmweb:state" });
  if (!state) return;
  paused = state.paused;
  bump($("#statPopups"), state.stats.popups + state.stats.overlays);
  bump($("#statAds"), state.stats.ads);
  $("#aiCount").textContent = `${state.stats.aiCaught || 0} by AI`;
  if (state.model) {
    $("#modelLine").textContent =
      `Trained on 9,574 examples (SMS Spam Collection + BBC News) · ${state.model.dims} SVD dimensions · ${Math.round(state.model.accuracy * 100)}% accurate on test data`;
  }
  render();
};

// ---------- Summary tab ----------
const summaryKey = () => (tab ? `summary:${tab.id}:${tab.url}` : "summary");

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const showSummary = (data) => {
  $("#result").hidden = false;
  $("#skeleton").hidden = true;
  if (!data || !data.ok) {
    $("#summary").hidden = true;
    $("#summaryError").hidden = false;
    $("#summaryError").textContent = (data && data.error) || "CalmWeb couldn't read this page. Try refreshing it.";
    return;
  }
  lastSummary = data;
  $("#summaryError").hidden = true;
  $("#summary").hidden = false;
  $("#summaryMeta").textContent = `${data.level} · about ${data.minutes} min of reading → under 1 min`;
  $("#overview").innerHTML = `<p>${escapeHtml(data.overview.join(" "))}</p>`;
  $("#points").innerHTML = data.points
    .map(
      (p) =>
        `<li>${escapeHtml(p.text)} <button class="jump" data-paragraph="${p.paragraph}" title="Scroll to this part of the page">Show in page</button></li>`
    )
    .join("");
  $(".points").hidden = data.points.length === 0;
  $("#summaryNote").hidden = !data.note;
  $("#summaryNote").textContent = data.note || "";
};

const summarize = async () => {
  if (!pageReady) return;
  const btn = $("#summarizeBtn");
  btn.disabled = true;
  $("#result").hidden = false;
  $("#skeleton").hidden = false;
  $("#summary").hidden = true;
  $("#summaryError").hidden = true;
  const started = performance.now();
  const data = await sendToPage({ type: "calmweb:summarize", detail: settings.summaryDetail });
  const wait = Math.max(0, 450 - (performance.now() - started)); // let the loading state be seen
  setTimeout(() => {
    showSummary(data);
    btn.disabled = false;
    if (data && data.ok) chrome.storage.session.set({ [summaryKey()]: { ...data, detail: settings.summaryDetail } });
  }, wait);
};

$("#summarizeBtn").addEventListener("click", summarize);
$("#summaryDetail").addEventListener("change", () => {
  if (lastSummary) summarize();
});

$("#points").addEventListener("click", (e) => {
  const btn = e.target.closest(".jump");
  if (btn) sendToPage({ type: "calmweb:jump", paragraph: Number(btn.dataset.paragraph) });
});

$("#sourceBtn").addEventListener("click", () => sendToPage({ type: "calmweb:jump", paragraph: 0 }));

$("#copyBtn").addEventListener("click", async () => {
  if (!lastSummary) return;
  const text =
    `${lastSummary.title}\n\n${lastSummary.overview.join(" ")}\n\nKey points:\n` +
    lastSummary.points.map((p, i) => `${i + 1}. ${p.text}`).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    $("#copyBtn").textContent = "Copied ✓";
  } catch (_) {
    $("#copyBtn").textContent = "Couldn't copy";
  }
  setTimeout(() => ($("#copyBtn").textContent = "Copy"), 1600);
});

// ---------- Start ----------
(async () => {
  settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  const { lastTab } = await chrome.storage.local.get({ lastTab: "calm" });
  selectTab(lastTab);
  render();

  // ?tabId= lets the popup be opened as a normal page for testing.
  const testTab = Number(new URLSearchParams(location.search).get("tabId"));
  [tab] = testTab ? [await chrome.tabs.get(testTab)] : await chrome.tabs.query({ active: true, currentWindow: true });
  const url = (tab && tab.url) || "";
  if (!/^https?:/i.test(url)) {
    showNotice("CalmWeb works on regular websites. It can't run on Chrome's own pages like this one.");
    $("#summarizeBtn").disabled = true;
    return;
  }

  const state = await sendToPage({ type: "calmweb:state" });
  if (!state) {
    showNotice("Refresh this page once so CalmWeb can start working on it.");
    $("#summarizeBtn").disabled = true;
    return;
  }
  pageReady = true;
  paused = state.paused;
  render();
  refreshStats();
  setInterval(refreshStats, 1500);

  const stored = await chrome.storage.session.get(summaryKey());
  const saved = stored[summaryKey()];
  if (saved) showSummary(saved);
  if (!settings.enabled) showNotice("CalmWeb is off on every site. Turn it back on with the switch above.");
})();
