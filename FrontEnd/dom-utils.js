
function queryAllDeep(selector, root = document) {
  const results = [];
  const visit = (node) => {
    if (!node) return;
    if (node.nodeType === 1) {
      if (node.matches && node.matches(selector)) results.push(node);
      if (node.shadowRoot) visit(node.shadowRoot);
    }
    if (node.childNodes) node.childNodes.forEach(visit);
  };
  visit(root);
  return results;
}

const EDITOR_SELECTORS = [
  'div[class^="MarkdownEditor-module__inputWrapper"] textarea',
  'textarea[placeholder="Leave a comment"]',
  'form textarea.prc-Textarea-TextArea-13q4j'
];

function findAllEditors(root = document) {
  let editors = [];
  for (const sel of EDITOR_SELECTORS) {
    editors = editors.concat(queryAllDeep(sel, root));
  }
  console.log("[CommentAssistant] Found textareas:", editors.length);
  return Array.from(new Set(editors));
}

function getSurfaceType() {
  const href = location.href;
  if (/\/pull\/\d+\/files/.test(href)) return "review";
  if (/\/pull\//.test(href)) return "pr";
  if (/\/issues\//.test(href)) return "issue";
  return "unknown";
}

function getRepoSlug() {
  const parts = location.pathname.split("/").filter(Boolean);
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : "unknown/unknown";
}

function closestDiffContainer(el) {
  return (
    el.closest('[data-path]') ||
    el.closest('[data-file-path]') ||
    el.closest('.js-file, .file') ||
    el.closest('[data-details-container]') ||
    null
  );
}

function extractFilePath(container) {
  if (!container) return "";
  const attr = container.getAttribute("data-path") || container.getAttribute("data-file-path");
  if (attr) return attr;

  const headerLink =
    container.querySelector('.file-header a.Link--primary, .file-info a, [data-testid="file-header"] a');
  if (headerLink && headerLink.textContent) return headerLink.textContent.trim();

  const globalHeader = document.querySelector('.file-header a.Link--primary, .file-info a');
  return globalHeader?.textContent?.trim() || "";
}

function extractCodeSlice(container) {
  if (!container) return "";
  const nodes = container.querySelectorAll('.blob-code-inner, td.blob-code-inner, .react-code-text, pre code');
  if (!nodes.length) return "";

  const lines = [];
  for (const n of nodes) {
    const t = (n.textContent || "").replace(/\u00a0/g, " ").trimEnd();
    if (t.length) lines.push(t);
    if (lines.length >= 200) break;
  }
  let text = lines.join("\n");
  if (text.length > 8000) text = text.slice(0, 8000) + "\n...[truncated]";
  return text;
}

function guessLanguage(filePath, code) {
  const ext = (filePath.split(".").pop() || "").toLowerCase();
  const map = {
    js: "js", jsx: "js", ts: "ts", tsx: "ts",
    py: "py", rb: "rb", go: "go", rs: "rust",
    java: "java", cs: "csharp", cpp: "cpp", c: "c",
    php: "php", swift: "swift", kt: "kotlin", scala: "scala",
    sh: "bash", ps1: "powershell", html: "html", css: "css", scss: "scss",
    md: "md", json: "json", yml: "yaml", yaml: "yaml"
  };
  if (map[ext]) return map[ext];

  if (/^\s*#include\b/m.test(code)) return "c/cpp";
  if (/\bdef\s+\w+\(/.test(code)) return "py";
  if (/\bpackage\s+\w+;/.test(code) || /\bpublic\s+class\b/.test(code)) return "java";
  if (/\bconsole\.log\(/.test(code) || /\bfunction\b/.test(code)) return "js";
  return "auto";
}

function extractContextForTextarea(textarea) {
  const container = closestDiffContainer(textarea) || document;
  const filePath = extractFilePath(container);
  const code = extractCodeSlice(container);
  const language = guessLanguage(filePath, code);
  return { filePath, code, language };
}

function insertAfter(newNode, referenceNode) {
  referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}
function markInjected(textarea) {
  const form = textarea.closest("form") || textarea.parentElement;
  if (!form) return false;
  if (form.hasAttribute("data-gh-better-injected")) return false;
  form.setAttribute("data-gh-better-injected", "1");
  return true;
}

window.GHBetterDOM = {
  findAllEditors,
  getSurfaceType,
  getRepoSlug,
  insertAfter,
  markInjected,
  extractContextForTextarea
};
