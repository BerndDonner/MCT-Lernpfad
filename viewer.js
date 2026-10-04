// MCT-Lernpfad Viewer
// Absichtlich kleiner Markdown-Subset-Renderer.
// Unterstützt derzeit: Überschriften, Absätze, fenced code, Listen,
// Blockquotes/Alerts, Bilder, Links, Inline-Code und Raw-HTML-Blöcke.
// Raw HTML ist absichtlich erlaubt, damit <object> interaktive SVGs laden kann.

const content = document.querySelector("#content");
const statusEl = document.querySelector("#status");
const reloadButton = document.querySelector("#reload");

const host = window.viewerHost;
if (!host) {
  throw new Error("Kein Viewer-Host verfügbar.");
}

const documentPath = host.documentPath || "mct-lernpfad.md";

function escapeHtml(s) {
  return s.replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
}

function renderInline(s) {
  // Erst HTML escapen; Raw HTML wird nur auf Blockebene zugelassen.
  s = escapeHtml(s);

  // Bilder
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1">');

  // Links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>');

  // Inline-Code
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Kleine, bewusst begrenzte Hervorhebung.
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  return s;
}

function isRawHtmlStart(line) {
  return /^\s*<(object|iframe|div|table|details|figure|svg|section|aside|!--)\b/i.test(line)
      || /^\s*<!--/.test(line);
}

function rawHtmlClosingTag(line) {
  const m = line.match(/^\s*<(object|iframe|div|table|details|figure|svg|section|aside)\b/i);
  return m ? `</${m[1].toLowerCase()}>` : null;
}

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code: ```cpp ... ```
    const fence = line.match(/^\s*(`{3,}|~{3,})\s*([^\s]*)\s*$/);
    if (fence) {
      const marker = fence[1][0];
      const minLen = fence[1].length;
      const lang = fence[2] || "";
      const code = [];
      i++;
      while (i < lines.length) {
        const close = lines[i].match(/^\s*(`{3,}|~{3,})\s*$/);
        if (close && close[1][0] === marker && close[1].length >= minLen) break;
        code.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      out.push(`<pre><code${cls}>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    // Raw HTML block, insbesondere <object>...</object>
    if (isRawHtmlStart(line)) {
      const html = [line];
      const closing = rawHtmlClosingTag(line);
      i++;

      if (closing && !line.toLowerCase().includes(closing)) {
        while (i < lines.length) {
          html.push(lines[i]);
          if (lines[i].toLowerCase().includes(closing)) {
            i++;
            break;
          }
          i++;
        }
      } else if (/^\s*<!--/.test(line) && !line.includes("-->")) {
        while (i < lines.length) {
          html.push(lines[i]);
          if (lines[i].includes("-->")) {
            i++;
            break;
          }
          i++;
        }
      }

      out.push(html.join("\n"));
      continue;
    }

    // Überschriften
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote / Alert
    if (/^\s*>\s?/.test(line)) {
      const q = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        q.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }

      let alertClass = "";
      let title = "";
      const marker = q[0]?.match(/^\[!(IMPORTANT|MERKSATZ|WARNING|NOTE)\]\s*$/i);
      if (marker) {
        const kind = marker[1].toUpperCase();
        q.shift();
        if (kind === "IMPORTANT" || kind === "WARNING") {
          alertClass = " alert alert-important";
          title = kind === "IMPORTANT" ? "Wichtig" : "Achtung";
        } else if (kind === "MERKSATZ") {
          alertClass = " alert alert-merksatz";
          title = "Merksatz";
        } else {
          alertClass = " alert";
          title = "Hinweis";
        }
      }

      const titleHtml = title ? `<span class="alert-title">${title}</span>` : "";
      out.push(`<blockquote class="${alertClass.trim()}">${titleHtml}<p>${renderInline(q.join(" "))}</p></blockquote>`);
      continue;
    }

    // Ungeordnete/geordnete Listen
    const ul = line.match(/^\s*[-*+]\s+(.+)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ul || ol) {
      const ordered = !!ol;
      const tag = ordered ? "ol" : "ul";
      const items = [];
      while (i < lines.length) {
        const m = ordered
          ? lines[i].match(/^\s*\d+[.)]\s+(.+)$/)
          : lines[i].match(/^\s*[-*+]\s+(.+)$/);
        if (!m) break;
        items.push(`<li>${renderInline(m[1])}</li>`);
        i++;
      }
      out.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    // Absatz: bis Leerzeile oder Blockanfang.
    const para = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim()) {
      const next = lines[i];
      if (/^(#{1,6})\s+/.test(next) ||
          /^\s*(`{3,}|~{3,})/.test(next) ||
          /^\s*>\s?/.test(next) ||
          /^\s*[-*+]\s+/.test(next) ||
          /^\s*\d+[.)]\s+/.test(next) ||
          isRawHtmlStart(next)) {
        break;
      }
      para.push(next.trim());
      i++;
    }
    out.push(`<p>${renderInline(para.join(" "))}</p>`);
  }

  return out.join("\n");
}

function resolveEmbeddedResources(root) {
  const attributes = [
    ["img[src]", "src"],
    ["object[data]", "data"],
    ["iframe[src]", "src"],
    ["source[src]", "src"]
  ];

  for (const [selector, attribute] of attributes) {
    for (const element of root.querySelectorAll(selector)) {
      const value = element.getAttribute(attribute);
      if (!value || value.startsWith("#") ||
          /^(?:data|blob|javascript):/i.test(value)) {
        continue;
      }
      element.setAttribute(attribute, host.resolveUrl(value));
    }
  }
}

async function loadDocument() {
  statusEl.textContent = "Lade …";
  try {
    const md = await host.loadText(documentPath);
    content.innerHTML = renderMarkdown(md);
    resolveEmbeddedResources(content);
    document.title = `MCT-Lernpfad – ${documentPath}`;
    statusEl.textContent = documentPath;
  } catch (err) {
    content.innerHTML =
      `<div class="error"><strong>Dokument konnte nicht geladen werden.</strong><br>${escapeHtml(String(err))}</div>`;
    statusEl.textContent = "Fehler";
  }
}

reloadButton.addEventListener("click", loadDocument);
loadDocument();
