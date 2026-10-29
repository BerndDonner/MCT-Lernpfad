// Exportiert die aktuell ausgewählte UE als eigenständiges Markdown-ZIP für
// VS Code. Die HTML-Ansicht ist dabei nicht die Quelle: UE-Änderungen werden
// wie beim Rendering direkt aus dem ursprünglichen Markdown berechnet.
// SVG-Skripte werden niemals in das Archiv übernommen.

const exportButton = document.querySelector("#export-ue");
const textEncoder = new TextEncoder();

function utf8Bytes(text) {
  return textEncoder.encode(text);
}

// Eingebettete Assets müssen relativ zum Markdown-Dokument liegen und dürfen
// den Projektordner nicht verlassen. URLs außerhalb des Projekts können nicht
// als selbstständiges, offline nutzbares Archiv paketiert werden.
function localAssetPath(value) {
  if (!value || value.startsWith("#") || /^[a-z][a-z\d+.-]*:/i.test(value) ||
      value.startsWith("/") || value.startsWith("\\") || /[?#]/.test(value)) {
    throw new Error(`Nicht unterstützter Bildpfad: ${value}`);
  }
  const segments = value.replaceAll("\\", "/").split("/");
  const parts = [];
  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (!parts.length) throw new Error(`Bild liegt außerhalb des Dokumentordners: ${value}`);
      parts.pop();
    } else {
      parts.push(segment);
    }
  }
  if (!parts.length || parts.some(part => part === ".git")) {
    throw new Error(`Ungültiger Bildpfad: ${value}`);
  }
  return parts.join("/");
}

// Ein kleiner, dependency-freier ZIP-Writer (Methode STORE, ohne Kompression).
// Die Archive sind standardkonform; bei den vergleichsweise kleinen SVGs ist
// der geringe Mehraufwand der fehlenden Kompression akzeptabel.
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let value = n;
  for (let i = 0; i < 8; i++) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  crcTable[n] = value >>> 0;
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function buildZip(files) {
  if (files.size > 0xffff) throw new Error("Zu viele Dateien für ZIP32.");
  const chunks = [];
  const central = [];
  let offset = 0;
  const put = (chunk) => { chunks.push(chunk); offset += chunk.byteLength; };
  for (const [name, content] of files) {
    const nameBytes = utf8Bytes(name);
    const bytes = typeof content === "string" ? utf8Bytes(content) : content;
    if (bytes.length > 0xffffffff || nameBytes.length > 0xffff || offset > 0xffffffff) {
      throw new Error("Datei zu groß für ZIP32.");
    }
    const checksum = crc32(bytes);
    const local = new Uint8Array(30 + nameBytes.length);
    const h = new DataView(local.buffer);
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x0800, true); // UTF-8
    h.setUint16(8, 0, true); // STORE
    h.setUint32(14, checksum, true);
    h.setUint32(18, bytes.length, true);
    h.setUint32(22, bytes.length, true);
    h.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    const localOffset = offset;
    put(local);
    put(bytes);

    const entry = new Uint8Array(46 + nameBytes.length);
    const c = new DataView(entry.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(16, 0, true);
    c.setUint32(16, checksum, true);
    c.setUint32(20, bytes.length, true);
    c.setUint32(24, bytes.length, true);
    c.setUint16(28, nameBytes.length, true);
    c.setUint32(42, localOffset, true);
    entry.set(nameBytes, 46);
    central.push(entry);
  }
  const directoryOffset = offset;
  for (const entry of central) put(entry);
  const directorySize = offset - directoryOffset;
  if (offset > 0xffffffff) throw new Error("ZIP-Archiv zu groß für ZIP32.");
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, central.length, true);
  e.setUint16(10, central.length, true);
  e.setUint32(12, directorySize, true);
  e.setUint32(16, directoryOffset, true);
  put(end);
  return new Blob(chunks, { type: "application/zip" });
}

// Markdown-HTML-Blöcke werden über markdown-it-Tokenpositionen ersetzt.
// Dadurch bleiben Codefences mit wörtlichen <object>-Beispielen unangetastet.
function collectMarkupAndAssets(ueMarkdown) {
  const sourceLines = ueMarkdown.split("\n");
  const tokens = markdown.parse(ueMarkdown, {});
  const replacements = [];
  const references = new Set();
  const svgEmbeds = [];

  function addImage(value) {
    if (!value || /^(https?:|data:|#)/i.test(value)) return;
    references.add(localAssetPath(value));
  }

  function visitInline(tokensToVisit) {
    for (const token of tokensToVisit || []) {
      if (token.type === "image") addImage(token.attrGet("src"));
      if (token.children) visitInline(token.children);
    }
  }

  for (const token of tokens) {
    if (token.type === "inline") visitInline(token.children);
    // markdown-it klassifiziert <object> als Inline-HTML (in einem Absatz),
    // nicht als html_block. Beide Tokenarten besitzen aber Zeilenpositionen.
    if (!(token.type === "html_block" ||
          (token.type === "inline" && token.children?.some(child => child.type === "html_inline"))) ||
        !token.map) continue;
    const markup = sourceLines.slice(token.map[0], token.map[1]).join("\n").trim();
    if (!/<(?:object|img)\b/i.test(markup)) continue;
    const html = document.createElement("template");
    html.innerHTML = markup;
    // Nur ganze Bild-/Object-Blöcke konvertieren: komplexeres HTML darf nicht
    // stillschweigend verschwinden oder als kaputtes Markdown ausgegeben werden.
    const element = html.content.firstElementChild;
    if (!element || html.content.children.length !== 1 ||
        !/^(OBJECT|IMG)$/.test(element.tagName) ||
        html.content.textContent.trim() && element.tagName === "IMG") {
      throw new Error(`HTML-Bildeinbettung in Zeile ${token.map[0] + 1} ist zu komplex für den Export.`);
    }
    const value = element.tagName === "OBJECT"
      ? element.getAttribute("data") : element.getAttribute("src");
    const path = localAssetPath(value);
    if (element.tagName === "OBJECT" && !path.toLowerCase().endsWith(".svg")) {
      throw new Error(`Nur SVG-<object>-Einbettungen werden unterstützt: ${path}`);
    }
    const alt = (element.getAttribute("alt") || element.textContent ||
      path.split("/").pop().replace(/\.svg$/i, "")).trim().replaceAll("[", "\\[").replaceAll("]", "\\]");
    const embed = element.tagName === "OBJECT"
      ? { path, number: svgEmbeds.length, original: value } : null;
    if (embed) svgEmbeds.push(embed);
    else references.add(path);
    replacements.push({ start: token.map[0], end: token.map[1], path, alt, embed });
  }
  return { sourceLines, replacements, references, svgEmbeds };
}

function markdownImage(alt, path) {
  // < und > sind keine gültigen Dateinamen unter Windows; Klammern und
  // Leerzeichen dagegen funktionieren als Markdown-Link mit Winkelklammern.
  return `![${alt}](<${encodeURI(path)}>)`;
}

function replaceMarkup(sourceLines, replacements) {
  const lines = [...sourceLines];
  for (const entry of [...replacements].reverse()) {
    lines.splice(entry.start, entry.end - entry.start, markdownImage(entry.alt, entry.outputPath));
  }
  return lines.join("\n");
}

function parseSvg(source, filename) {
  const svg = new DOMParser().parseFromString(source, "image/svg+xml");
  if (svg.querySelector("parsererror") || svg.documentElement.localName !== "svg") {
    throw new Error(`SVG ist nicht gültig: ${filename}`);
  }
  return svg.documentElement;
}

// Ein Export-SVG enthält weder Skripte noch externe Stylesheets. Die im
// Lernpfad genutzte gemeinsame CSS-Datei wird direkt eingebettet.
async function snapshotSvg(path, liveObject, originalSource) {
  const dynamic = /<script(?:\s|>)/i.test(originalSource);
  const liveRoot = liveObject?.contentDocument?.documentElement;
  if (dynamic && (!liveRoot || liveRoot.localName !== "svg")) {
    throw new Error(`Interaktives SVG nicht zugänglich: ${path}. ` +
      "Der aktuelle Diagrammzustand kann hier nicht sicher exportiert werden.");
  }
  const svg = dynamic ? liveRoot.cloneNode(true) : parseSvg(originalSource, path).cloneNode(true);
  for (const node of svg.querySelectorAll("script, foreignObject, style[data-viewer-theme]")) node.remove();
  for (const node of [svg, ...svg.querySelectorAll("*")]) {
    for (const attr of [...node.attributes]) {
      if (/^on/i.test(attr.name) || /^(?:href|xlink:href)$/i.test(attr.name) &&
          /^(?:javascript:|https?:|file:)/i.test(attr.value)) {
        node.removeAttributeNode(attr);
      }
    }
  }
  const styles = [...svg.querySelectorAll("style")];
  for (const style of styles) {
    const imports = [...style.textContent.matchAll(/@import\s+url\(\s*["']?([^"')]+)["']?\s*\)\s*;/gi)];
    let css = style.textContent;
    for (const match of imports) {
      const prefix = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
      const stylesheetPath = localAssetPath(prefix + match[1]);
      let embedded = await host.loadText(stylesheetPath);
      if (/@import\b/i.test(embedded)) {
        throw new Error(`Verschachtelte CSS-Imports werden nicht unterstützt: ${stylesheetPath}`);
      }
      // Externe Fonts sind nicht Teil des ZIPs: CSS-Fallbacks bleiben erhalten.
      embedded = embedded.replace(/@font-face\s*\{[^}]*\}\s*/gi, "");
      css = css.replace(match[0], embedded);
    }
    const externalUrl = [...css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)]
      .some(match => !match[2].startsWith("#") && !match[2].startsWith("data:"));
    if (/@import\b/i.test(css) || externalUrl) {
      throw new Error(`Externe CSS-Ressource in SVG: ${path}`);
    }
    style.textContent = css;
  }
  // SVG <image>-Referenzen würden ohne mitgepackte Dateien ins Leere zeigen.
  for (const image of svg.querySelectorAll("image, use")) {
    const href = image.getAttribute("href") || image.getAttribute("xlink:href");
    if (href && !href.startsWith("#") && !href.startsWith("data:")) {
      throw new Error(`Externe SVG-Bildreferenz wird nicht unterstützt: ${path} → ${href}`);
    }
  }
  return new XMLSerializer().serializeToString(svg);
}

async function createUEArchive() {
  // Neu parsen, damit auch seit dem letzten Laden entstandene Fehler nicht
  // stillschweigend einen veralteten Export erzeugen.
  const info = preprocessForUE(sourceMarkdown, selectedUE);
  const { sourceLines, replacements, references, svgEmbeds } = collectMarkupAndAssets(info.markdown);
  const files = new Map();
  const liveObjects = [...content.querySelectorAll("object[data]")];
  if (liveObjects.length !== svgEmbeds.length) {
    throw new Error("Die SVG-Einbettungen in der Ansicht stimmen nicht mit dem Markdown überein.");
  }

  for (const entry of replacements) {
    entry.outputPath = entry.path;
    if (!entry.embed) continue;
    const { path, number } = entry.embed;
    const original = await host.loadText(path);
    const dynamic = /<script(?:\s|>)/i.test(original);
    if (dynamic) {
      entry.outputPath = path.replace(/\.svg$/i, `-snapshot-${number + 1}.svg`);
    }
    files.set(entry.outputPath, await snapshotSvg(path, liveObjects[number], original));
  }

  // Bilder in Markdown-Notation bleiben mit ihren relativen Pfaden erhalten.
  // Binäre Inhalte (PNG/JPEG/...) müssen unverändert kopiert werden.
  for (const path of references) {
    if (files.has(path)) continue;
    if (path.toLowerCase().endsWith(".svg")) {
      files.set(path, await snapshotSvg(path, null, await host.loadText(path)));
    } else {
      files.set(path, await host.loadBinary(path));
    }
  }

  const ueName = selectedUE === 0 ? "basis" : `ue${String(selectedUE).padStart(2, "0")}`;
  const stem = documentPath.replace(/\.md$/i, "").replace(/[^\w.-]/g, "-");
  const basename = `${stem}-${ueName}`;
  // Markdown-Datei zuerst, damit sie in Archivmanagern sofort auffällt.
  const archive = new Map([[`${basename}.md`, replaceMarkup(sourceLines, replacements)], ...files]);
  return { filename: `${basename}.zip`, blob: buildZip(archive) };
}

exportButton.addEventListener("click", async () => {
  if (!sourceMarkdown) return;
  exportButton.disabled = true;
  statusEl.textContent = "Exportiere …";
  try {
    const { filename, blob } = await createUEArchive();
    await host.saveArchive(filename, new Uint8Array(await blob.arrayBuffer()));
    statusEl.textContent = `${filename} erstellt`;
  } catch (error) {
    if (String(error?.message || error).includes("Speichern abgebrochen")) {
      statusEl.textContent = documentPath;
      return;
    }
    statusEl.textContent = "Export fehlgeschlagen";
    window.alert(`Markdown-Export fehlgeschlagen:\n${error.message || error}`);
    console.error(error);
  } finally {
    exportButton.disabled = false;
  }
});
