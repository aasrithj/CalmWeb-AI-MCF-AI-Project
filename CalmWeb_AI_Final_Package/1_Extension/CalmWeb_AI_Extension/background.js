// CalmWeb AI - background service worker
// Keeps the ad-network blocking rules in sync with the user's settings
// and shows how many distractions were blocked on the current tab.

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

async function syncAdRules() {
  const s = await chrome.storage.sync.get(DEFAULTS);
  const on = s.enabled && s.hideAds;
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets(
      on ? { enableRulesetIds: ["ad_blocking"] } : { disableRulesetIds: ["ad_blocking"] }
    );
  } catch (err) {
    console.warn("CalmWeb: could not update ad rules", err);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(null);
  await chrome.storage.sync.set({ ...DEFAULTS, ...current });
  chrome.action.setBadgeBackgroundColor({ color: "#2e7d52" });
  syncAdRules();
});

chrome.runtime.onStartup.addListener(syncAdRules);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes.enabled || changes.hideAds)) syncAdRules();
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "calmweb:count" && sender.tab && sender.tab.id != null) {
    const total = msg.total || 0;
    chrome.action.setBadgeBackgroundColor({ color: "#2e7d52", tabId: sender.tab.id });
    chrome.action.setBadgeText({ text: total ? String(Math.min(total, 999)) : "", tabId: sender.tab.id });
  }
});
