// dom-utils.js — updated for new GitHub React editor with Shadow DOM support

// ---------- Shadow-root aware selector ----------
function queryAllDeep(selector, root = document) {
  const results = [];
  const visit = (node) => {
    if (!node) return;
    if (node.nodeType === 1) {
      if (node.matches(selector)) results.push(node);
      if (node.shadowRoot) visit(node.shadowRoot);
    }
    node.childNodes?.forEach(visit);
  };
  visit(root);
  return results;
}

// ---------- Robust selectors ----------
const EDITOR_SELECTORS = [
  // New GitHub React editor (2024+)
  'div[class^="MarkdownEditor-module__inputWrapper"] textarea',
  // Placeholder fallback
  'textarea[placeholder="Leave a comment"]',
  // Older inline review / legacy fallback
  'form textarea.prc-Textarea-TextArea-13q4j'
];

// ---------- Find all editors ----------
function findAllEditors(root = document) {
  let editors = [];
  for (const sel of EDITOR_SELECTORS) {
    editors = editors.concat(queryAllDeep(sel, root));
  }
  console.log("[BetterComments] Found textareas:", editors.length);
  return Array.from(new Set(editors));
}

// ---------- Heuristics ----------
function getSurfaceType(textarea) {
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

// ---------- Helpers ----------
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
  markInjected
};
