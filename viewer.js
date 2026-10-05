// MCT-Lernpfad Viewer
// Markdown wird zentral mit markdown-it gerendert. Browser und Linux-Viewer
// benutzen dadurch exakt dieselbe Rendering-Logik.
// Raw HTML ist absichtlich erlaubt, damit <object> interaktive SVGs laden kann.

const content = document.querySelector("#content");
const statusEl = document.querySelector("#status");
const reloadButton = document.querySelector("#reload");

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

const markdown = window.markdownit({
  html: true,
  linkify: false,
  typographer: false,
  breaks: false,
  highlight(code, language) {
    const lang = (language || "").trim().toLowerCase();
    return cppLanguages.has(lang) ? highlightCpp(code) : escapeHtml(code);
  },
});

const documentPath = host.documentPath || "mct-lernpfad.md";

function escapeHtml(s) {
  return s.replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
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
// Er will C++ nicht parsen, sondern nur stabile lexikalische Kategorien erkennen.
function highlightCpp(source) {
  let out = "";
  let i = 0;

  while (i < source.length) {
    const rest = source.slice(i);

    // UE-Markierungen stehen teilweise absichtlich innerhalb von Codeblöcken.
    if (rest.startsWith("<!--")) {
      const end = source.indexOf("-->", i + 4);
      const stop = end === -1 ? source.length : end + 3;
      out += syntaxSpan("syntax-comment", source.slice(i, stop));
      i = stop;
      continue;
    }

    if (rest.startsWith("//")) {
      const end = source.indexOf("\n", i + 2);
      const stop = end === -1 ? source.length : end;
      out += syntaxSpan("syntax-comment", source.slice(i, stop));
      i = stop;
      continue;
    }

    if (rest.startsWith("/*")) {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      out += syntaxSpan("syntax-comment", source.slice(i, stop));
      i = stop;
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
    content.innerHTML = markdown.render(md);
    enhanceAlerts(content);
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
