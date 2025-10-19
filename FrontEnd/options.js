// options.js
const baseEl = document.getElementById("base");
const keyEl = document.getElementById("key");
const saveBtn = document.getElementById("save");
const resetBtn = document.getElementById("reset");
const statusEl = document.getElementById("status");

function load() {
  chrome.storage.sync.get(["BASE_URL", "API_KEY"], (res) => {
    baseEl.value = res.BASE_URL || "";
    keyEl.value = res.API_KEY || "";
  });
}
load();

saveBtn.addEventListener("click", () => {
  const BASE_URL = baseEl.value.trim();
  const API_KEY = keyEl.value.trim();
  chrome.storage.sync.set({ BASE_URL, API_KEY }, () => {
    statusEl.textContent = "Saved.";
    setTimeout(() => (statusEl.textContent = ""), 1200);
  });
});

resetBtn.addEventListener("click", () => {
  chrome.storage.sync.remove(["BASE_URL", "API_KEY"], () => {
    baseEl.value = "";
    keyEl.value = "";
    statusEl.textContent = "Reset to defaults (stubbed backend).";
    setTimeout(() => (statusEl.textContent = ""), 1500);
  });
});
