// Nur für das kontrollierte <object>-Embedding im Lernpfad-Viewer.
// Externe Markdown-Bilder haben keinen DOM-Zugriff auf ihre Hintergrundfarbe;
// sie verwenden stattdessen die Fallback-Palette aus diagram-theme.css.
(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function rgb(hex) {
    const value = hex.replace('#', '');
    return [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16));
  }

  function luminance(color) {
    const linear = color.map(value => {
      const s = value / 255;
      return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
    });
    return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  }

  function contrast(a, b) {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + .05) / (dark + .05);
  }

  function hex(color) {
    return '#' + color.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  }

  function mix(a, b, amount) {
    return a.map((v, i) => v * (1 - amount) + b[i] * amount);
  }

  function pageBackground() {
    // Der Body ist die Zeichenfläche der transparenten SVGs. getComputedStyle
    // liefert auch bei einem später frei konfigurierbaren blauen Theme die
    // tatsächlich gesetzte Farbe – anders als prefers-color-scheme.
    const color = getComputedStyle(document.body).backgroundColor;
    const match = color.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    return match ? match.slice(1, 4).map(Number) : rgb('#ffffff');
  }

  function makePalette(background) {
    const darkInk = rgb('#1f2328');
    const lightInk = rgb('#f0f6fc');
    const foreground = contrast(background, darkInk) >= contrast(background, lightInk)
      ? darkInk : lightInk;
    const dark = foreground === lightInk;
    const muted = mix(foreground, background, .22);
    const border = mix(foreground, background, .35);
    const softBorder = mix(foreground, background, .58);
    const guide = mix(foreground, background, .69);

    // Semantische Akzentfarbe erhalten; für beliebige Hintergründe ihre
    // Helligkeit so lange korrigieren, bis sie als Schrift lesbar ist.
    function accent(light, darkValue) {
      let chosen = rgb(dark ? darkValue : light);
      const target = foreground;
      for (let step = 0; step < 20 && contrast(background, chosen) < 4.5; step++) {
        chosen = mix(chosen, target, .15);
      }
      return hex(chosen);
    }

    const primary = accent('#1f6feb', '#79c0ff');
    const positive = accent('#1a7f37', '#7ee787');
    const negative = accent('#cf222e', '#ff8f88');
    const shift = accent('#9a6700', '#f2cc60');
    const secondary = accent('#8250df', '#d2a8ff');
    const tokenNum = accent('#0a7f70', '#56d4c9');
    const tokenChar = accent('#953800', '#ffa657');

    // Semitransparente Flächen beziehen ihre Tönung vom echten Hintergrund.
    // Sie überdecken weder dunkles Blau noch andere individuell gewählte Farben.
    const surface = dark ? 'rgba(255,255,255,.075)' : 'rgba(0,0,0,.035)';
    const card = dark ? 'rgba(255,255,255,.045)' : 'rgba(0,0,0,.012)';
    return {
      fg: hex(foreground), muted: hex(muted), line: hex(foreground),
      border: hex(border), 'soft-border': hex(softBorder), guide: hex(guide),
      card, surface, primary, positive, negative, shift, secondary,
      'result-bg': dark ? 'rgba(56,194,103,.16)' : 'rgba(26,127,55,.09)',
      'result-border': positive,
      'hover-bit': dark ? 'rgba(121,192,255,.17)' : 'rgba(31,111,235,.12)',
      'hover-bit-border': primary,
      'hover-shift': dark ? 'rgba(242,204,96,.2)' : 'rgba(154,103,0,.12)',
      'hover-shift-border': shift,
      'mask-and': dark ? 'rgba(121,192,255,.17)' : 'rgba(31,111,235,.12)',
      'mask-or': dark ? 'rgba(255,143,136,.17)' : 'rgba(207,34,46,.12)',
      'mask-xor': dark ? 'rgba(242,204,96,.2)' : 'rgba(154,103,0,.13)',
      'wrap-bg': dark ? 'rgba(242,204,96,.18)' : 'rgba(154,103,0,.10)',
      'wrap-border': shift,
      'token-type': primary, 'token-num': tokenNum, 'token-char': tokenChar,
    };
  }

  function adaptObject(object) {
    if (object.tagName !== 'OBJECT' || object.type !== 'image/svg+xml') return;
    // Zugriff auf fremde Domains ist nicht erlaubt; das Fallback funktioniert
    // ohne DOM-Zugriff. Keine Benutzer-Markdown-Skripte nachladen.
    let svg;
    try { svg = object.contentDocument?.documentElement; }
    catch (_) { return; }
    if (!svg || svg.localName !== 'svg') return;
    let style = svg.querySelector('style[data-viewer-theme]');
    if (!style) {
      style = svg.ownerDocument.createElementNS(SVG_NS, 'style');
      style.setAttribute('data-viewer-theme', '');
      svg.append(style);
    }
    const colors = makePalette(pageBackground());
    style.textContent = ':root { ' + Object.entries(colors)
      .map(([name, value]) => `--diagram-${name}: ${value};`).join(' ') + ' }';
  }

  function refresh() {
    document.querySelectorAll('#content object[type="image/svg+xml"]').forEach(adaptObject);
  }

  window.diagramTheme = { adaptObject, refresh };
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refresh);
})();
