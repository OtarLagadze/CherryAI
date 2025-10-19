// content-script.js — Shadow-DOM aware, debug-friendly version

(() => {
  console.log("[BetterComments] Content script loaded on", location.href);

  const {
    findAllEditors,
    getSurfaceType,
    getRepoSlug,
    insertAfter,
    markInjected
  } = window.GHBetterDOM;

  const { sendMessageWithTimeout } = window.GHBetterMsg;

  // ---------------- Observer ----------------
  const observer = new MutationObserver(() => {
    setTimeout(tryInjectAll, 300); // debounce injection
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  // ---------------- Injector ----------------
  function tryInjectAll() {
    const editors = findAllEditors(document);
    if (!editors.length) return;
    for (const ta of editors) injectUnderEditor(ta);
  }

  function injectUnderEditor(textarea) {
    if (!markInjected(textarea)) return;

    // Build wrapper
    const wrap = document.createElement("div");
    wrap.className = "gh-better-wrap u-col u-gap-8";

    // Header
    const header = document.createElement("div");
    header.className = "gh-better-header u-text-sm";
    header.textContent = "Comment assistant";

    // Textarea
    const betterTA = document.createElement("textarea");
    betterTA.className = "gh-better-textarea u-text-sm";
    betterTA.placeholder = "AI-improved version will appear here…";
    betterTA.setAttribute("aria-label", "Comment assistant");

    // Status
    const status = document.createElement("div");
    status.className = "gh-better-status u-text-sm u-muted";
    status.setAttribute("aria-live", "polite");

    // Buttons
    const row = document.createElement("div");
    row.className = "u-flex u-row u-gap-8";

    const btnImprove = document.createElement("button");
    btnImprove.className = "u-btn u-btn-primary";
    btnImprove.textContent = "Improve";

    const btnCopy = document.createElement("button");
    btnCopy.className = "u-btn";
    btnCopy.textContent = "Add Comment";

    row.appendChild(btnImprove);
    row.appendChild(btnCopy);

    wrap.append(header, betterTA, row, status);

    // ---------- Insert just below the visual editor ----------
    const container =
      textarea.closest('div[class^="MarkdownEditor-module__container"]') ||
      textarea.parentElement;
    if (container && container.parentNode) {
      container.parentNode.insertBefore(wrap, container.nextSibling);
    } else {
      insertAfter(wrap, textarea);
    }

    console.log("[BetterComments] Injected below:", textarea);

    // ---------- Improve button ----------
    btnImprove.addEventListener("click", async () => {
      const original = textarea.value || "";
      if (!original.trim()) {
        status.textContent = "Type something first.";
        return;
      }
      setBusy(true, "Improving…");
      try {
        const surface = getSurfaceType(textarea);
        const repo = getRepoSlug();
        const resp = await sendMessageWithTimeout(
          { type: "IMPROVE_COMMENT", payload: { text: original, context: { surface, repo } } },
          15000
        );
        const improved = (resp && resp.improvedText) || "";
        betterTA.value = improved;
        status.textContent = improved ? "Improved text ready." : "No improvement returned.";
        if (improved) betterTA.focus();
      } catch (e) {
        status.textContent = `Error: ${e.message}`;
      } finally {
        setBusy(false);
      }
    });

    // ---------- Copy button ----------
    btnCopy.addEventListener("click", () => {
      const improved = betterTA.value || "";
      textarea.value = improved;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      status.textContent = "Replaced original with improved text.";
      textarea.focus();
    });

    function setBusy(state, msg = "") {
      btnImprove.disabled = state;
      btnCopy.disabled = state;
      status.textContent = msg;
    }
  }

  // ---------------- Init ----------------
  tryInjectAll();
})();
