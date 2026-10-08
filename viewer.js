// MCT-Lernpfad Viewer
// Markdown wird zentral mit markdown-it gerendert. Browser und Linux-Viewer
// benutzen dadurch exakt dieselbe Rendering-Logik.
// Raw HTML ist absichtlich erlaubt, damit <object> interaktive SVGs laden kann.

const content = document.querySelector("#content");
const statusEl = document.querySelector("#status");
const reloadButton = document.querySelector("#reload");
const previousUEButton = document.querySelector("#previous-ue");
const nextUEButton = document.querySelector("#next-ue");
const ueLabel = document.querySelector("#ue-label");
const zoomInButton = document.querySelector("#zoom-in");
const zoomOutButton = document.querySelector("#zoom-out");
const zoomResetButton = document.querySelector("#zoom-reset");

const zoomLevels = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
let documentZoom = 1;

function setDocumentZoom(level) {
  documentZoom = level;
  content.style.setProperty("--document-zoom", String(level));
  zoomResetButton.textContent = `${Math.round(level * 100)} %`;
  zoomOutButton.disabled = level === zoomLevels[0];
  zoomInButton.disabled = level === zoomLevels.at(-1);
  scheduleUEGutter(content);
}

function changeDocumentZoom(direction) {
  const index = zoomLevels.indexOf(documentZoom);
  setDocumentZoom(zoomLevels[Math.max(0, Math.min(zoomLevels.length - 1, index + direction))]);
}


const host = window.viewerHost;
if (!host) {
  throw new Error("Kein Viewer-Host verfügbar.");
}

if (typeof window.markdownit !== "function") {
  throw new Error(
    "markdown-it fehlt. Bitte `nix run .#update-viewer-deps` ausführen."
  );
}

const cppLanguages = new Set(["cpp", "c++", "cxx", "cc", "h", "hpp", "arduino"]);
const documentPath = host.documentPath || "mct-lernpfad.md";

let sourceMarkdown = "";
let selectedUE = readUEFromUrl();
let maxUE = 0;

function escapeHtml(s) {
  return s.replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;");
}

class UEStructureError extends Error {
  constructor(message, line, relatedLine = null, hint = "") {
    super(message);
    this.name = "UEStructureError";
    this.line = line;
    this.relatedLine = relatedLine;
    this.hint = hint;
  }
}

// Unterstützt sowohl die bereits verwendete Schreibweise
//   <!-- begin UE:3 add -->
// als auch die kompaktere geplante Form
//   <!--@UE:3 begin add-->
// Replace-Blöcke beginnen entsprechend mit "del" und wechseln mit <!--add-->.
function parseUETag(line) {
  let candidate = line;

  // Tags dürfen innerhalb eines Blockquotes stehen. Die Markdown-Präfixe
  // gehören nicht zur Tag-Syntax und werden nur für die Erkennung entfernt.
  while (/^\s*>/.test(candidate)) {
    candidate = candidate.replace(/^\s*>\s?/, "");
  }
  candidate = candidate.trim();

  let match = candidate.match(
    /^<!--\s*begin\s+UE\s*:\s*(\d+)\s+(add|del)\s*-->$/i
  );
  if (!match) {
    match = candidate.match(
      /^<!--\s*@?UE\s*:\s*(\d+)\s+begin\s+(add|del)\s*-->$/i
    );
  }

  if (match) {
    return {
      type: "begin",
      ue: Number.parseInt(match[1], 10),
      kind: match[2].toLowerCase() === "del" ? "replace" : "add",
    };
  }

  if (/^<!--\s*add\s*-->$/i.test(candidate)) {
    return { type: "replace-add" };
  }

  if (/^<!--\s*end\s*-->$/i.test(candidate)) {
    return { type: "end" };
  }

  // Sieht die Zeile nach einem UE-Steuertag aus, ist aber syntaktisch kaputt,
  // melden wir den Fehler sofort statt den Kommentar still zu ignorieren.
  const looksLikeUETag =
    /<!--[^>]*(?:UE\s*:|@UE\s*:|\bbegin\b[^>]*\b(?:add|del)\b|^\s*(?:add|end)\b)/i
      .test(candidate);

  if (looksLikeUETag) {
    return { type: "malformed", text: candidate };
  }

  return null;
}

function currentExistenceInterval(stack) {
  let start = 0;
  let end = Number.POSITIVE_INFINITY;

  for (const frame of stack) {
    if (frame.kind === "add") {
      start = Math.max(start, frame.ue);
    } else if (frame.phase === "del") {
      end = Math.min(end, frame.ue);
    } else {
      start = Math.max(start, frame.ue);
    }
  }

  return { start, end };
}

function intervalDescription(interval) {
  if (Number.isFinite(interval.end)) {
    return `UE ${interval.start} bis UE ${interval.end - 1}`;
  }
  return interval.start === 0 ? "Basis und alle UEs" : `ab UE ${interval.start}`;
}

function frameVisible(frame, ue) {
  if (frame.kind === "add") return ue >= frame.ue;
  return frame.phase === "del" ? ue < frame.ue : ue >= frame.ue;
}

function currentChangeKind(stack, ue) {
  let kind = null;

  for (const frame of stack) {
    if (frame.kind === "add" && frame.ue === ue) {
      kind = "add";
    } else if (
      frame.kind === "replace" &&
      frame.phase === "add" &&
      frame.ue === ue
    ) {
      // Intern unterscheiden wir Replace bereits von Add. Momentan verwenden
      // beide absichtlich denselben grünen Gutter; später kann Replace leicht
      // eine eigene Farbe bekommen.
      kind = "replace";
    }
  }

  return kind;
}

function preprocessForUE(source, ue) {
  const sourceLines = source.split(/\r?\n/);
  const renderedLines = [];
  const renderedSourceLines = [];
  const lineChangeKinds = [];
  const stack = [];
  let discoveredMaxUE = 0;

  for (let index = 0; index < sourceLines.length; ++index) {
    const lineNumber = index + 1;
    const line = sourceLines[index];
    const tag = parseUETag(line);

    if (tag?.type === "malformed") {
      throw new UEStructureError(
        "Dieser Kommentar sieht wie ein UE-Tag aus, entspricht aber nicht der erwarteten Syntax.",
        lineNumber,
        null,
        "Tags müssen allein in einer Zeile stehen, z. B. `<!-- begin UE:3 add -->`, `<!--@UE:3 begin del-->`, `<!--add-->` oder `<!--end-->`."
      );
    }

    if (tag?.type === "begin") {
      if (!Number.isInteger(tag.ue) || tag.ue < 1) {
        throw new UEStructureError(
          "Eine Unterrichtseinheit muss eine positive Nummer haben.",
          lineNumber,
          null,
          "Die Basisversion hat implizit die Nummer 0; Tags beginnen deshalb mit UE 1."
        );
      }

      const interval = currentExistenceInterval(stack);
      if (tag.ue < interval.start || tag.ue >= interval.end) {
        const enclosing = stack.at(-1);
        throw new UEStructureError(
          `UE ${tag.ue} liegt zeitlich außerhalb des umgebenden Inhalts (${intervalDescription(interval)}).`,
          lineNumber,
          enclosing?.beginLine ?? null,
          "Eine verschachtelte Änderung darf erst stattfinden, wenn ihr umgebender Inhalt existiert, und nicht erst nachdem dieser bereits ersetzt wurde."
        );
      }

      discoveredMaxUE = Math.max(discoveredMaxUE, tag.ue);
      stack.push({
        kind: tag.kind,
        ue: tag.ue,
        phase: tag.kind === "replace" ? "del" : "add",
        beginLine: lineNumber,
        separatorLine: null,
      });
      continue;
    }

    if (tag?.type === "replace-add") {
      if (stack.length === 0) {
        throw new UEStructureError(
          "`<!--add-->` steht außerhalb eines Replace-Blocks.",
          lineNumber,
          null,
          "Ein Replace-Block beginnt mit `<!--@UE:n begin del-->`, enthält genau ein `<!--add-->` und endet mit `<!--end-->`."
        );
      }

      const frame = stack.at(-1);
      if (frame.kind !== "replace") {
        throw new UEStructureError(
          "`<!--add-->` ist nur innerhalb eines Replace-Blocks erlaubt.",
          lineNumber,
          frame.beginLine,
          `Der aktuell offene Block aus Zeile ${frame.beginLine} ist ein Add-Block.`
        );
      }

      if (frame.phase === "add") {
        throw new UEStructureError(
          "Dieser Replace-Block enthält ein zweites `<!--add-->`.",
          lineNumber,
          frame.separatorLine,
          "Ein Replace-Block darf nur einmal vom alten zum neuen Inhalt wechseln."
        );
      }

      frame.phase = "add";
      frame.separatorLine = lineNumber;
      continue;
    }

    if (tag?.type === "end") {
      if (stack.length === 0) {
        throw new UEStructureError(
          "`<!--end-->` hat keinen passenden geöffneten UE-Block.",
          lineNumber,
          null,
          "Entferne das überzählige End-Tag oder ergänze den fehlenden Begin-Tag."
        );
      }

      const frame = stack.pop();
      if (frame.kind === "replace" && frame.phase === "del") {
        throw new UEStructureError(
          `Der Replace-Block für UE ${frame.ue} endet, bevor sein neuer Inhalt mit \`<!--add-->\` beginnt.`,
          lineNumber,
          frame.beginLine,
          "Füge zwischen altem und neuem Inhalt ein `<!--add-->` ein."
        );
      }
      continue;
    }

    const visible = stack.every(frame => frameVisible(frame, ue));
    if (!visible) continue;

    renderedLines.push(line);
    renderedSourceLines.push(lineNumber);
    lineChangeKinds.push(currentChangeKind(stack, ue));
  }

  if (stack.length > 0) {
    const frame = stack.at(-1);
    const replaceHint =
      frame.kind === "replace" && frame.phase === "del"
        ? " Außerdem fehlt in diesem Replace-Block noch `<!--add-->`."
        : "";
    throw new UEStructureError(
      `Der in Zeile ${frame.beginLine} begonnene UE-${frame.ue}-${frame.kind === "add" ? "Add" : "Replace"}-Block wurde nicht beendet.`,
      frame.beginLine,
      null,
      `Ergänze das passende \`<!--end-->\`.${replaceHint}`
    );
  }

  return {
    markdown: renderedLines.join("\n"),
    sourceLines,
    renderedLines,
    renderedSourceLines,
    lineChangeKinds,
    maxUE: discoveredMaxUE,
  };
}

function readUEFromUrl() {
  try {
    const raw = new URLSearchParams(window.location.search).get("ue");
    if (raw === null || raw === "") return 0;
    const value = Number.parseInt(raw, 10);
    return Number.isInteger(value) && value >= 0 ? value : 0;
  } catch (_) {
    return 0;
  }
}

function writeUEToUrl(ue) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("ue", String(ue));
    window.history.replaceState(null, "", url);
  } catch (_) {
    // Der native Viewer kann eine URL verwenden, die History-Updates nicht
    // unterstützt. Die Navigation selbst funktioniert trotzdem.
  }
}

const cppKeywords = new Set([
  "alignas", "alignof", "asm", "auto", "break", "case", "catch", "class",
  "const", "consteval", "constexpr", "constinit", "const_cast", "continue",
  "co_await", "co_return", "co_yield", "decltype", "default", "delete",
  "do", "dynamic_cast", "else", "enum", "explicit", "export", "extern",
  "for", "friend", "goto", "if", "inline", "mutable", "namespace", "new",
  "noexcept", "operator", "private", "protected", "public", "register",
  "reinterpret_cast", "requires", "return", "sizeof", "static",
  "static_assert", "static_cast", "struct", "switch", "template", "this",
  "thread_local", "throw", "try", "typedef", "typeid", "typename", "union",
  "using", "virtual", "volatile", "while"
]);

const cppTypes = new Set([
  "bool", "char", "char8_t", "char16_t", "char32_t", "double", "float",
  "int", "long", "short", "signed", "unsigned", "void", "wchar_t",
  "int8_t", "int16_t", "int32_t", "int64_t",
  "uint8_t", "uint16_t", "uint32_t", "uint64_t",
  "size_t", "ptrdiff_t", "byte", "word", "String"
]);

const cppLiterals = new Set([
  "true", "false", "nullptr", "NULL",
  "HIGH", "LOW", "INPUT", "OUTPUT", "INPUT_PULLUP",
  "DEC", "HEX", "OCT", "BIN"
]);

function syntaxSpan(className, text) {
  return `<span class="${className}">${escapeHtml(text)}</span>`;
}

// Kleiner lexerbasierter Highlighter für die C++-/Arduino-Beispiele im Lernpfad.
// Der Zustand von /* ... */ wird über Zeilengrenzen hinweg beibehalten, damit
// wir jede Codezeile separat in einen UE-Gutter einhüllen können.
function highlightCppLine(source, state) {
  let out = "";
  let i = 0;

  while (i < source.length) {
    if (state.blockComment) {
      const end = source.indexOf("*/", i);
      if (end === -1) {
        out += syntaxSpan("syntax-comment", source.slice(i));
        return out;
      }
      out += syntaxSpan("syntax-comment", source.slice(i, end + 2));
      i = end + 2;
      state.blockComment = false;
      continue;
    }

    const rest = source.slice(i);

    if (rest.startsWith("//")) {
      out += syntaxSpan("syntax-comment", source.slice(i));
      return out;
    }

    if (rest.startsWith("/*")) {
      const end = source.indexOf("*/", i + 2);
      if (end === -1) {
        out += syntaxSpan("syntax-comment", source.slice(i));
        state.blockComment = true;
        return out;
      }
      out += syntaxSpan("syntax-comment", source.slice(i, end + 2));
      i = end + 2;
      continue;
    }

    const quote = source[i];
    if (quote === '"' || quote === "'") {
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === "\\") {
          j += 2;
          continue;
        }
        if (source[j] === quote) {
          ++j;
          break;
        }
        ++j;
      }
      out += syntaxSpan("syntax-string", source.slice(i, j));
      i = j;
      continue;
    }

    const number = rest.match(/^(?:0[xX][0-9A-Fa-f']+|0[bB][01']+|(?:\d[\d']*)(?:\.[\d']*)?(?:[eE][+-]?\d[\d']*)?)(?:[uUlLfF]{0,3})/);
    if (number) {
      out += syntaxSpan("syntax-number", number[0]);
      i += number[0].length;
      continue;
    }

    const identifier = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifier) {
      const word = identifier[0];
      let className = "";

      if (cppKeywords.has(word)) className = "syntax-keyword";
      else if (cppTypes.has(word)) className = "syntax-type";
      else if (cppLiterals.has(word)) className = "syntax-literal";
      else {
        const tail = source.slice(i + word.length);
        if (/^\s*\(/.test(tail)) className = "syntax-function";
      }

      out += className ? syntaxSpan(className, word) : escapeHtml(word);
      i += word.length;
      continue;
    }

    if (source[i] === "#") {
      const directive = rest.match(/^#[ \t]*[A-Za-z_][A-Za-z0-9_]*/);
      if (directive) {
        out += syntaxSpan("syntax-preprocessor", directive[0]);
        i += directive[0].length;
        continue;
      }
    }

    out += escapeHtml(source[i]);
    ++i;
  }

  return out;
}

function highlightCpp(source) {
  const state = { blockComment: false };
  return source.split("\n").map(line => highlightCppLine(line, state)).join("\n");
}

function changeKindForRenderedRange(renderInfo, start, end) {
  if (!renderInfo) return null;

  let sawContent = false;
  let kind = null;

  for (let line = start; line < end; ++line) {
    const text = renderInfo.renderedLines[line] ?? "";
    if (!text.trim()) continue;

    sawContent = true;
    const lineKind = renderInfo.lineChangeKinds[line];
    if (!lineKind) return null;
    if (lineKind === "replace") kind = "replace";
    else if (!kind) kind = "add";
  }

  return sawContent ? kind : null;
}

function addChangeAttributes(token, kind) {
  token.attrJoin("class", "ue-current");
  token.attrSet("data-ue-change", kind);
}

const markdown = window.markdownit({
  html: true,
  linkify: false,
  typographer: false,
  breaks: false,
});

// Markiert vollständig neue Markdown-Blöcke. Bei gemischten Strukturen
// (z. B. eine bestehende Tabelle mit einer neuen Zeile) bleibt der äußere
// Block unmarkiert; die kleineren, vollständig neuen Kind-Tokens werden markiert.
markdown.core.ruler.push("ue-current-blocks", state => {
  const renderInfo = state.env?.ueRenderInfo;
  if (!renderInfo) return;

  for (const token of state.tokens) {
    if (!token.map || token.type === "fence" || token.type === "code_block") {
      continue;
    }

    const kind = changeKindForRenderedRange(
      renderInfo,
      token.map[0],
      token.map[1]
    );
    if (!kind) continue;

    token.meta = { ...(token.meta || {}), ueChangeKind: kind };

    if (token.nesting === 1 && token.tag) {
      addChangeAttributes(token, kind);
    } else if (token.type === "hr") {
      addChangeAttributes(token, kind);
    }
  }
});

function codeSourceLineForToken(token, renderedLineOffset) {
  if (!token.map) return null;
  // Fenced code: map[0] ist die Zeile mit ```; der Inhalt beginnt danach.
  // Indented code: map[0] zeigt bereits auf die erste Inhaltszeile.
  return token.type === "fence"
    ? token.map[0] + 1 + renderedLineOffset
    : token.map[0] + renderedLineOffset;
}

function renderCodeToken(tokens, idx, options, env) {
  const token = tokens[idx];
  const renderInfo = env?.ueRenderInfo;
  const language = token.type === "fence"
    ? (token.info || "").trim().split(/\s+/)[0].toLowerCase()
    : "";
  const isCpp = cppLanguages.has(language);
  const cppState = { blockComment: false };

  // token.content endet bei Markdown-Codeblöcken normalerweise mit \n. Das
  // abschließende leere Split-Element ist keine zusätzliche sichtbare Zeile.
  let lines = token.content.split("\n");
  if (lines.at(-1) === "") lines = lines.slice(0, -1);

  const rendered = lines.map((line, offset) => {
    const renderedLine = codeSourceLineForToken(token, offset);
    const kind = renderedLine === null
      ? null
      : renderInfo?.lineChangeKinds[renderedLine] ?? null;
    const sourceLine = renderedLine === null
      ? null
      : renderInfo?.renderedSourceLines[renderedLine] ?? null;
    const classes = ["code-line"];
    if (kind) classes.push("ue-current-line");
    const attrs = [
      `class="${classes.join(" ")}"`,
      kind ? `data-ue-change="${kind}"` : "",
      sourceLine ? `data-source-line="${sourceLine}"` : "",
    ].filter(Boolean).join(" ");

    const highlighted = isCpp
      ? highlightCppLine(line, cppState)
      : escapeHtml(line);
    return `<span ${attrs}>${highlighted || "&#8203;"}</span>`;
  }).join("\n");

  const languageClass = language
    ? ` class="language-${escapeHtml(language)}"`
    : "";
  return `<pre><code${languageClass}>${rendered}</code></pre>\n`;
}

markdown.renderer.rules.fence = renderCodeToken;
markdown.renderer.rules.code_block = renderCodeToken;

const defaultHtmlBlockRenderer = markdown.renderer.rules.html_block ||
  ((tokens, idx) => tokens[idx].content);
markdown.renderer.rules.html_block = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const rendered = defaultHtmlBlockRenderer(tokens, idx, options, env, self);
  const kind = token.meta?.ueChangeKind;
  if (!kind) return rendered;
  return `<div class="ue-current ue-current-html" data-ue-change="${kind}">${rendered}</div>`;
};

function enhanceAlerts(root) {
  const alertKinds = {
    IMPORTANT: { className: "alert-important", title: "Wichtig" },
    WARNING: { className: "alert-important", title: "Achtung" },
    MERKSATZ: { className: "alert-merksatz", title: "Merksatz" },
    NOTE: { className: "", title: "Hinweis" },
  };

  for (const quote of root.querySelectorAll("blockquote")) {
    const first = quote.firstElementChild;
    if (!first || first.tagName !== "P") continue;

    const marker = first.textContent.match(
      /^\[!(IMPORTANT|MERKSATZ|WARNING|NOTE)\](?:\s|$)/i
    );
    if (!marker) continue;

    const kind = marker[1].toUpperCase();
    const config = alertKinds[kind];

    // markdown-it lässt den Zeilenumbruch innerhalb eines Absatzes als
    // Whitespace stehen. Der Marker ist deshalb auch im innerHTML am Anfang
    // unverändert vorhanden; Inline-Markup im restlichen Absatz bleibt erhalten.
    first.innerHTML = first.innerHTML
      .replace(/^\[!(IMPORTANT|MERKSATZ|WARNING|NOTE)\](?:[ \t]*(?:\r?\n|<br\s*\/?>))?/i, "")
      .replace(/^\s+/, "");

    if (!first.textContent.trim() && !first.querySelector("*")) {
      first.remove();
    }

    quote.classList.add("alert");
    if (config.className) quote.classList.add(config.className);

    const title = document.createElement("span");
    title.className = "alert-title";
    title.textContent = config.title;
    quote.prepend(title);
  }
}

let ueGutterFrame = 0;

function updateUEGutter(root) {
  for (const marker of root.querySelectorAll(":scope > .ue-gutter-segment")) {
    marker.remove();
  }

  const rootRect = root.getBoundingClientRect();
  const ranges = [];

  for (const element of root.querySelectorAll(".ue-current, .ue-current-line")) {
    // Ein vollständig neuer äußerer Block reicht als Markierung. Darin liegende
    // Kind-Elemente würden sonst denselben Bereich mehrfach eintragen.
    if (element.classList.contains("ue-current")) {
      if (element.parentElement?.closest(".ue-current")) continue;
    } else if (element.closest(".ue-current")) {
      continue;
    }

    const rect = element.getBoundingClientRect();
    if (rect.height <= 0 || rect.width <= 0) continue;

    ranges.push({
      // getBoundingClientRect liefert gezoomte Bildschirmkoordinaten;
      // CSS top/height des Markers erwarten ungezoomte Layoutkoordinaten.
      top: (rect.top - rootRect.top) / documentZoom,
      bottom: (rect.bottom - rootRect.top) / documentZoom,
    });
  }

  ranges.sort((a, b) => a.top - b.top || a.bottom - b.bottom);

  // Direkt aneinanderstoßende Codezeilen sollen wie ein durchgehender grüner
  // Streifen aussehen. Kleine Rundungsdifferenzen des Browsers werden toleriert.
  const merged = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.top <= previous.bottom + 1) {
      previous.bottom = Math.max(previous.bottom, range.bottom);
    } else {
      merged.push({ ...range });
    }
  }

  for (const range of merged) {
    const marker = document.createElement("span");
    marker.className = "ue-gutter-segment";
    marker.style.top = `${range.top}px`;
    marker.style.height = `${Math.max(1, range.bottom - range.top)}px`;
    marker.setAttribute("aria-hidden", "true");
    root.append(marker);
  }
}

function scheduleUEGutter(root = content) {
  cancelAnimationFrame(ueGutterFrame);
  ueGutterFrame = requestAnimationFrame(() => updateUEGutter(root));
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

function updateNavigation() {
  ueLabel.textContent = selectedUE === 0 ? "Basis" : `UE ${selectedUE}`;
  previousUEButton.disabled = selectedUE <= 0;
  nextUEButton.disabled = selectedUE >= maxUE;
  previousUEButton.title = selectedUE <= 0
    ? "Bereits in der Basisversion"
    : selectedUE === 1 ? "Zur Basisversion" : `Zu UE ${selectedUE - 1}`;
  nextUEButton.title = selectedUE >= maxUE
    ? "Bereits bei der letzten Unterrichtseinheit"
    : `Zu UE ${selectedUE + 1}`;
}

function renderStructureError(error) {
  const lines = sourceMarkdown.split(/\r?\n/);
  const interesting = new Set([error.line, error.relatedLine].filter(Boolean));
  const contextLineNumbers = new Set();

  for (const line of interesting) {
    for (let n = Math.max(1, line - 2); n <= Math.min(lines.length, line + 2); ++n) {
      contextLineNumbers.add(n);
    }
  }

  const ordered = [...contextLineNumbers].sort((a, b) => a - b);
  let previous = null;
  const context = [];
  for (const lineNumber of ordered) {
    if (previous !== null && lineNumber > previous + 1) {
      context.push("      …");
    }
    const marker = interesting.has(lineNumber) ? ">" : " ";
    context.push(
      `${marker} ${String(lineNumber).padStart(4, " ")} | ${lines[lineNumber - 1] ?? ""}`
    );
    previous = lineNumber;
  }

  const related = error.relatedLine
    ? `<p class="error-related">Zugehöriger geöffneter Block: Zeile ${error.relatedLine}.</p>`
    : "";
  const hint = error.hint
    ? `<p><strong>Hinweis:</strong> ${escapeHtml(error.hint)}</p>`
    : "";

  content.innerHTML = `
    <div class="error structure-error">
      <strong>Fehler in der UE-Struktur – Zeile ${error.line}</strong>
      <p>${escapeHtml(error.message)}</p>
      ${related}
      ${hint}
      <pre class="error-context"><code>${escapeHtml(context.join("\n"))}</code></pre>
    </div>`;
  statusEl.textContent = "UE-Struktur fehlerhaft";
}

function renderSelectedUE() {
  if (!sourceMarkdown) return;

  try {
    // Zuerst mit der gewünschten UE parsen. Dadurch kennen wir zugleich die
    // höchste im Dokument vorkommende UE und validieren die gesamte Struktur.
    let renderInfo = preprocessForUE(sourceMarkdown, selectedUE);
    maxUE = renderInfo.maxUE;

    const clampedUE = Math.max(0, Math.min(selectedUE, maxUE));
    if (clampedUE !== selectedUE) {
      selectedUE = clampedUE;
      renderInfo = preprocessForUE(sourceMarkdown, selectedUE);
    }

    content.innerHTML = markdown.render(renderInfo.markdown, { ueRenderInfo: renderInfo });
    enhanceAlerts(content);
    resolveEmbeddedResources(content);
    scheduleUEGutter(content);
    updateNavigation();
    writeUEToUrl(selectedUE);
    document.title = `MCT-Lernpfad – ${selectedUE === 0 ? "Basis" : `UE ${selectedUE}`}`;
    statusEl.textContent = documentPath;
  } catch (err) {
    updateNavigation();
    if (err instanceof UEStructureError) {
      renderStructureError(err);
      return;
    }

    content.innerHTML =
      `<div class="error"><strong>Dokument konnte nicht gerendert werden.</strong><br>${escapeHtml(String(err))}</div>`;
    statusEl.textContent = "Fehler";
  }
}

async function loadDocument() {
  statusEl.textContent = "Lade …";
  try {
    sourceMarkdown = await host.loadText(documentPath);
    renderSelectedUE();
  } catch (err) {
    content.innerHTML =
      `<div class="error"><strong>Dokument konnte nicht geladen werden.</strong><br>${escapeHtml(String(err))}</div>`;
    statusEl.textContent = "Fehler";
  }
}

function selectUE(ue) {
  const target = Math.max(0, Math.min(ue, maxUE));
  if (target === selectedUE) return;
  selectedUE = target;
  renderSelectedUE();
}

if ("ResizeObserver" in window) {
  const ueGutterResizeObserver = new ResizeObserver(() => scheduleUEGutter(content));
  ueGutterResizeObserver.observe(content);
}
window.addEventListener("resize", () => scheduleUEGutter(content));
content.addEventListener("load", () => scheduleUEGutter(content), true);

previousUEButton.addEventListener("click", () => selectUE(selectedUE - 1));
nextUEButton.addEventListener("click", () => selectUE(selectedUE + 1));
reloadButton.addEventListener("click", loadDocument);
zoomInButton.addEventListener("click", () => changeDocumentZoom(1));
zoomOutButton.addEventListener("click", () => changeDocumentZoom(-1));
zoomResetButton.addEventListener("click", () => setDocumentZoom(1));

// Die native WebKitGTK-App bietet normalerweise keinen Browser-Zoom-Shortcut.
// Im Browser werden dieselben Tastenkombinationen abgefangen, damit nur das
// Dokument und nicht auch die Navigationsleiste vergrößert wird.
document.addEventListener("keydown", event => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey && event.key !== "+") return;
  if (event.key === "+" || event.key === "=" || event.code === "NumpadAdd") {
    event.preventDefault();
    changeDocumentZoom(1);
  } else if (event.key === "-" || event.code === "NumpadSubtract") {
    event.preventDefault();
    changeDocumentZoom(-1);
  } else if (event.key === "0") {
    event.preventDefault();
    setDocumentZoom(1);
  }
});

document.addEventListener("keydown", event => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return;
  }

  const target = event.target;
  if (target instanceof HTMLElement &&
      (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
    return;
  }

  if (event.key === "ArrowLeft" && selectedUE > 0) {
    event.preventDefault();
    selectUE(selectedUE - 1);
  } else if (event.key === "ArrowRight" && selectedUE < maxUE) {
    event.preventDefault();
    selectUE(selectedUE + 1);
  }
});

updateNavigation();
loadDocument();
