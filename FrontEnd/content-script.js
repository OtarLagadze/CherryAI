(() => {
  console.log("[BetterComments] Content script loaded on", location.href);

  const {
    findAllEditors,
    getSurfaceType,
    getRepoSlug,
    insertAfter,
    markInjected
  } = window.GHBetterDOM;

  function normalizeAnalyzeResponse(data) {
    if (data && typeof data.rewritten === "string") {
      return { rewritten: data.rewritten, suggestions: data.suggestions || [] };
    }
    if (data && typeof data.improvedText === "string") {
      return { rewritten: data.improvedText, suggestions: data.suggestions || [] };
    }
    const text = data?.result?.content?.[0]?.text;
    if (typeof text === "string") {
      try {
        const inner = JSON.parse(text);
        if (typeof inner?.rewritten === "string") {
          return { rewritten: inner.rewritten, suggestions: inner.suggestions || [] };
        }
      } catch {}
    }
    return { rewritten: "", suggestions: [] };
  }

  const observer = new MutationObserver(() => setTimeout(tryInjectAll, 300));
  observer.observe(document.documentElement, { childList: true, subtree: true });

  function tryInjectAll() {
    const editors = findAllEditors(document);
    for (const ta of editors) injectUnderEditor(ta);
  }

  async function injectUnderEditor(textarea) {
    if (!markInjected(textarea)) return;

    const wrap = document.createElement("div");
    wrap.className = "gh-better-wrap u-col u-gap-8";

    const header = document.createElement("div");
    header.className = "gh-better-header u-text-sm";
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "6px";

    const logo = document.createElement("img");
    logo.src = chrome.runtime.getURL("icons/CherryLogo.png");
    logo.alt = "Cherry Logo";
    logo.className = "avatar avatar-user";
    logo.style.width = "20px";
    logo.style.height = "20px";

    const title = document.createElement("span");
    title.textContent = "Cherry";

    header.appendChild(logo);
    header.appendChild(title);

    const betterTA = document.createElement("textarea");
    betterTA.className = "gh-better-textarea u-text-sm";
    betterTA.style.width = "100%";
    betterTA.style.minHeight = "80px";
    betterTA.style.paddingInline = "6px";
    betterTA.style.borderRadius = "6px";
    betterTA.style.border = "1px solid #d0d7de";
    betterTA.style.fontFamily = "inherit";
    betterTA.style.fontSize = "inherit";
    betterTA.style.transition = "all 0.2s";
    betterTA.style.backgroundColor = "#f6f8fa";
    betterTA.style.color = "#24292f";
    betterTA.placeholder = "Improved text will appear here…";

    const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
    const applyDark = (isDark) => {
      if (isDark) {
        betterTA.style.backgroundColor = "#0d1117";
        betterTA.style.color = "#c9d1d9";
        betterTA.style.border = "1px solid #30363d";
      } else {
        betterTA.style.backgroundColor = "#f6f8fa";
        betterTA.style.color = "#24292f";
        betterTA.style.border = "1px solid #d0d7de";
      }
    };
    applyDark(darkMedia.matches);
    darkMedia.addEventListener("change", e => applyDark(e.matches));

    const suggestionsDiv = document.createElement("div");
    suggestionsDiv.className = "gh-better-suggestions";
    suggestionsDiv.style.marginTop = "6px";
    suggestionsDiv.style.fontStyle = "italic";
    suggestionsDiv.style.color = "#c9d1d9";
    suggestionsDiv.style.display = "none";
    suggestionsDiv.textContent = "Suggestions will appear here…";

    const status = document.createElement("div");
    status.className = "gh-better-status u-text-sm u-muted";
    status.setAttribute("aria-live", "polite");
    status.style.color = "#6e7781";

    const row = document.createElement("div");
    row.className = "u-flex u-row u-gap-8";
    row.style.marginTop = "6px";

    const btnImprove = document.createElement("button");
    btnImprove.className = "btn btn-primary";
    btnImprove.textContent = "Improve";

    const btnCopy = document.createElement("button");
    btnCopy.className = "btn";
    btnCopy.textContent = "Add Comment";

    row.append(btnImprove, btnCopy);
    wrap.append(header, betterTA, suggestionsDiv, row, status);

    const container =
      textarea.closest('div[class^="MarkdownEditor-module__container"]') ||
      textarea.parentElement;
    if (container && container.parentNode) {
      container.parentNode.insertBefore(wrap, container.nextSibling);
    } else {
      insertAfter(wrap, textarea);
    }

    console.log("[BetterComments] Injected below:", textarea);

    btnImprove.addEventListener("click", async () => {
      const original = textarea.value.trim();
      if (!original) {
        status.textContent = "Type something first.";
        return;
      }

      setBusy(true, "Collecting context…");
      const contextData = collectContextData(textarea, original);

      setBusy(true, "Improving…");
      try {
        const response = await fetch("http://localhost:2300/analyze_review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contextData),
        });

        let data;
        try { data = await response.json(); } catch { data = null; }

        if (!response.ok) {
          const errMsg = (data && (data.error || data.message)) || `HTTP ${response.status}`;
          throw new Error(errMsg);
        }

        const { rewritten, suggestions } = normalizeAnalyzeResponse(data);

        if (rewritten) {
          betterTA.value = rewritten;
          status.textContent = "Improved text ready.";
        } else {
          betterTA.value = "";
          status.textContent = "No improvement returned.";
        }

        if (Array.isArray(suggestions) && suggestions.length) {
          suggestionsDiv.style.display = "block";
          suggestionsDiv.innerHTML = suggestions
            .map(s => `• ${typeof s === "string" ? s : s.text || s.message || JSON.stringify(s)}`)
            .join("<br>");
        } else {
          suggestionsDiv.style.display = "none";
        }
      } catch (e) {
        betterTA.value = "";
        suggestionsDiv.textContent = "";
        status.textContent = `Error: ${e.message}`;
      } finally {
        setBusy(false);
      }
    });

    btnCopy.addEventListener("click", () => {
      const improved = betterTA.value.trim();
      if (!improved) {
        status.textContent = "Nothing to copy.";
        return;
      }
      setEditorContent(textarea, improved);
      status.textContent = "Replaced original with improved text.";
      textarea.focus();
    });

    function setBusy(state, msg = "") {
      btnImprove.disabled = state;
      btnCopy.disabled = state;
      status.textContent = msg;
    }
  }

  function setEditorContent(editor, text) {
    if (editor.tagName === "TEXTAREA") {
      editor.value = text;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (editor.isContentEditable) {
      editor.innerText = text;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      console.warn("Unknown editor type, cannot update:", editor);
    }
  }

  function collectContextData(textarea, originalText) {
    let filePath = "unknown";
    let code = "";
    let comment = originalText;
    const repo = getRepoSlug();
    const surface = getSurfaceType(textarea);

    const fileContainer = textarea.closest('[data-path], .file') || document.querySelector('[data-path]');
    if (fileContainer) {
      filePath = fileContainer.getAttribute("data-path") || extractFilePath(fileContainer);
      const codeBlock = fileContainer.querySelector("pre, .blob-code-inner");
      if (codeBlock) code = getCodeFromContainer(fileContainer);
    }

    const codeMatches = comment.match(/```[\s\S]*?```/g) || [];
    if (codeMatches.length) {
      code += "\n" + codeMatches.join("\n");
      comment = comment.replace(/```[\s\S]*?```/g, "").trim();
    }

    comment = comment || "no comment";
    code = code || "no code";

    const language = detectLanguage(filePath);

    return { repo, surface, filePath, code, comment, language, stylePreset: "friendly" };
  }

  function extractFilePath(el) {
    const header = el.querySelector('.file-info, [data-path]');
    if (header) {
      const txt = header.textContent.trim();
      return txt.split('\n')[0] || "unknown";
    }
    return "unknown";
  }

  function getCodeFromContainer(container) {
    const lines = Array.from(container.querySelectorAll(".blob-code-inner, pre"));
    return lines.map(l => l.textContent).join("\n").trim();
  }

  function detectLanguage(path) {
    if (!path || !path.includes(".")) return "txt";
    const ext = path.split(".").pop().toLowerCase();
    const map = {
      js: "javascript", ts: "typescript", py: "python", java: "java", cpp: "cpp",
      cs: "csharp", rb: "ruby", php: "php", html: "html", css: "css",
      json: "json", md: "markdown", yml: "yaml", yaml: "yaml", go: "go", rs: "rust"
    };
    return map[ext] || ext;
  }

  tryInjectAll();
})();
