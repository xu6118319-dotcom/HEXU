/* HEXU multilingual engine — client-side i18n.
 * Keys are the exact English source strings found in the pages.
 * Untranslated strings fall back to English automatically.
 * Customer languages: en, zh, de, nl, fr, it
 * Generated: 2026-08-02
 */
(function () {
  "use strict";

  window.HEXU_LANGS = [
      {
          "code": "zh",
          "label": "中文"
      },
      {
          "code": "en",
          "label": "English"
      },
      {
          "code": "de",
          "label": "Deutsch"
      },
      {
          "code": "nl",
          "label": "Nederlands"
      },
      {
          "code": "fr",
          "label": "Français"
      },
      {
          "code": "it",
          "label": "Italiano"
      }
  ];

  // Translations keyed by exact English source string.
  window.HEXU_I18N = {
    en: {}
  };
  var DICTS = window.HEXU_I18N || {};
  var currentLang = "en";
  var switchers = [];

  var FONT_STACK = {
    zh: '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif',
    de: '"Helvetica Neue",Arial,"Noto Sans",sans-serif',
    nl: '"Helvetica Neue",Arial,"Noto Sans",sans-serif',
    fr: '"Helvetica Neue",Arial,"Noto Sans",sans-serif',
    it: '"Helvetica Neue",Arial,"Noto Sans",sans-serif'
  };

  /* ---------- styles ---------- */
  function injectStyles() {
    if (document.getElementById("hexu-i18n-styles")) return;
    var css = [
      '.hexu-lang{position:relative;display:inline-block;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;}',
      '.hexu-lang--float{position:fixed;right:20px;bottom:20px;z-index:9998;}',
      '.hexu-lang-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:999px;',
      'border:1px solid rgba(255,255,255,.18);background:rgba(16,18,21,.86);color:#f2f3f5;',
      'font-size:13px;font-weight:500;letter-spacing:.01em;line-height:1;cursor:pointer;',
      '-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);',
      'box-shadow:0 6px 22px rgba(0,0,0,.28);transition:transform .18s ease,background .18s ease;}',
      '.hexu-lang-btn:hover{background:rgba(28,31,36,.94);transform:translateY(-1px);}',
      '.hexu-lang-btn svg{width:15px;height:15px;flex:0 0 auto;opacity:.85;}',
      '.hexu-lang-btn .hexu-caret{width:9px;height:9px;opacity:.6;transition:transform .18s ease;}',
      '.hexu-lang.is-open .hexu-caret{transform:rotate(180deg);}',
      '.hexu-lang-menu{position:absolute;right:0;bottom:calc(100% + 8px);min-width:172px;padding:6px;',
      'border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(16,18,21,.96);',
      '-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);',
      'box-shadow:0 18px 44px rgba(0,0,0,.4);opacity:0;visibility:hidden;transform:translateY(6px);',
      'transition:opacity .16s ease,transform .16s ease,visibility .16s;max-height:70vh;overflow:auto;}',
      '.hexu-lang.is-open .hexu-lang-menu{opacity:1;visibility:visible;transform:translateY(0);}',
      '.hexu-lang--inline .hexu-lang-menu{top:calc(100% + 8px);bottom:auto;transform:translateY(-6px);}',
      '.hexu-lang--inline.is-open .hexu-lang-menu{transform:translateY(0);}',
      '.hexu-lang-item{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;',
      'padding:9px 12px;border:0;border-radius:9px;background:transparent;color:#d9dbdf;',
      'font-size:13.5px;text-align:left;cursor:pointer;font-family:inherit;}',
      '.hexu-lang-item:hover{background:rgba(255,255,255,.08);color:#fff;}',
      '.hexu-lang-item.is-active{color:#fff;background:rgba(255,255,255,.06);}',
      '.hexu-lang-item.is-active::after{content:"";width:6px;height:6px;border-radius:50%;background:#7dd3a0;flex:0 0 auto;}',
      '@media (max-width:640px){.hexu-lang--float{right:14px;bottom:14px;}.hexu-lang-btn{padding:8px 12px;font-size:12.5px;}}',
      '@media print{.hexu-lang--float{display:none;}}'
    ].join("");
    var s = document.createElement("style");
    s.id = "hexu-i18n-styles";
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---------- default language ---------- */
  function detectDefaultLang() {
    var saved;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { saved = null; }
    if (saved && hasLang(saved)) return saved;

    var nav = (navigator.language || navigator.userLanguage || "en").toLowerCase();
    var map = {
      zh: "zh", de: "de", nl: "nl", fr: "fr",
      it: "it", en: "en"
    };
    var base = nav.split("-")[0];
    if (map[base] && hasLang(map[base])) return map[base];
    return "en";
  }

  function hasLang(code) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return true;
    return false;
  }

  function labelFor(code) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return LANGS[i].label;
    return code;
  }

  /* ---------- translation ---------- */
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };

  function skipNode(node) {
    var p = node.parentNode;
    while (p && p.nodeType === 1) {
      if (SKIP_TAGS[p.tagName]) return true;
      if (p.hasAttribute && p.hasAttribute("data-no-i18n")) return true;
      if (p.hasAttribute && p.hasAttribute("data-hexu-block")) return true;
      p = p.parentNode;
    }
    return false;
  }

  /* ---------- block-level whole-sentence translation ----------
     Some headlines are split mid-sentence by <em>/<br>, e.g.
       <h1>A five-step methodology, from <em>requirement</em> to <em>recommendation.</em></h1>
     Translating each fragment separately would scramble word order in
     non-English languages, so those elements are translated as one unit.
     Only a narrow, link-free selector is scanned so no markup is destroyed.
     A "\n" inside a translation is rendered as a line break.            */
  var BLOCK_SEL = "h1, p.manifesto";

  function translateBlocks(dict) {
    var els = document.querySelectorAll(BLOCK_SEL);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.closest && el.closest("[data-no-i18n]")) continue;

      if (typeof el.__hexuHTML === "undefined") {
        // Only worth handling when the sentence is actually fragmented.
        if (!el.children.length) continue;
        if (el.querySelector("a, button, input, select")) continue;
        el.__hexuHTML = el.innerHTML;
        el.__hexuText = (el.textContent || "").replace(/\s+/g, " ").trim();
      }
      if (!el.__hexuText) continue;

      var t = dict[el.__hexuText];
      if (t) {
        var parts = String(t).split("\n");
        el.innerHTML = "";
        for (var j = 0; j < parts.length; j++) {
          if (j) el.appendChild(document.createElement("br"));
          el.appendChild(document.createTextNode(parts[j]));
        }
        el.setAttribute("data-hexu-block", "");
      } else if (el.hasAttribute("data-hexu-block")) {
        el.innerHTML = el.__hexuHTML;
        el.removeAttribute("data-hexu-block");
      }
    }
  }

  function translateTextNodes(dict) {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    var node;
    var batch = [];
    while ((node = walker.nextNode())) batch.push(node);

    for (var i = 0; i < batch.length; i++) {
      var n = batch[i];
      if (typeof n.__hexuEn === "undefined") {
        var raw = n.nodeValue;
        if (!raw || !raw.trim()) continue;
        if (skipNode(n)) { n.__hexuEn = null; continue; }
        n.__hexuEn = raw.trim();
        n.__hexuPre = raw.match(/^\s*/)[0];
        n.__hexuPost = raw.match(/\s*$/)[0];
      }
      if (!n.__hexuEn) continue;
      var t = dict[n.__hexuEn];
      n.nodeValue = n.__hexuPre + (t || n.__hexuEn) + n.__hexuPost;
    }
  }

  var ATTRS = ["placeholder", "title", "aria-label", "alt", "value"];

  function translateAttributes(dict) {
    var els = document.body.querySelectorAll("[placeholder],[title],[aria-label],[alt],input[type=submit][value],input[type=button][value]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.closest && el.closest("[data-no-i18n]")) continue;
      for (var j = 0; j < ATTRS.length; j++) {
        var a = ATTRS[j];
        if (!el.hasAttribute(a)) continue;
        if (a === "value" && el.tagName === "INPUT" &&
            el.type !== "submit" && el.type !== "button") continue;
        var store = "__hexuAttr_" + a;
        if (typeof el[store] === "undefined") {
          var v = el.getAttribute(a);
          el[store] = v && v.trim() ? v.trim() : null;
        }
        if (!el[store]) continue;
        el.setAttribute(a, dict[el[store]] || el[store]);
      }
    }
  }

  function translateHead(dict) {
    if (typeof document.__hexuTitle === "undefined") {
      document.__hexuTitle = (document.title || "").trim();
    }
    if (document.__hexuTitle) {
      document.title = dict[document.__hexuTitle] || document.__hexuTitle;
    }
    var md = document.querySelector('meta[name="description"]');
    if (md) {
      if (typeof md.__hexuC === "undefined") {
        md.__hexuC = (md.getAttribute("content") || "").trim();
      }
      if (md.__hexuC) md.setAttribute("content", dict[md.__hexuC] || md.__hexuC);
    }
  }


  function loadLangPack(lang, cb) {
    if (!lang || lang === "en") { if (cb) cb(); return; }
    if (DICTS[lang] && Object.keys(DICTS[lang]).length) { if (cb) cb(); return; }
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/i18n/" + encodeURIComponent(lang) + ".json", true);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { DICTS[lang] = JSON.parse(xhr.responseText); }
        catch (e) { DICTS[lang] = {}; }
      } else { DICTS[lang] = {}; }
      if (cb) cb();
    };
    xhr.onerror = function () { DICTS[lang] = {}; if (cb) cb(); };
    xhr.send();
  }

  function applyLang(lang) {
    if (!hasLang(lang)) lang = "en";
    if (lang !== "en" && (!DICTS[lang] || !Object.keys(DICTS[lang]).length)) {
      loadLangPack(lang, function () { applyLang(lang); });
      return;
    }
    currentLang = lang;
    var dict = DICTS[lang] || {};

    translateBlocks(dict);
    translateTextNodes(dict);
    translateAttributes(dict);
    translateHead(dict);

    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("data-hexu-lang", lang);
    if (FONT_STACK[lang]) {
      document.body.style.fontFamily = FONT_STACK[lang];
    } else {
      document.body.style.fontFamily = "";
    }

    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    updateSwitcherUI(lang);

    try {
      document.dispatchEvent(new CustomEvent("hexu:langchange", { detail: { lang: lang } }));
    } catch (e) {}
  }

  /* ---------- switcher ---------- */
  var GLOBE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/></svg>';
  var CARET_SVG = '<svg class="hexu-caret" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5 6 7.5 9 4.5"/></svg>';

  function buildSwitcher(host, floating) {
    var wrap = document.createElement("div");
    wrap.className = "hexu-lang" + (floating ? " hexu-lang--float" : " hexu-lang--inline");
    wrap.setAttribute("data-no-i18n", "");

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hexu-lang-btn";
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = GLOBE_SVG + '<span class="hexu-lang-label">English</span>' + CARET_SVG;

    var menu = document.createElement("div");
    menu.className = "hexu-lang-menu";
    menu.setAttribute("role", "menu");

    LANGS.forEach(function (l) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "hexu-lang-item";
      item.setAttribute("role", "menuitem");
      item.setAttribute("data-lang", l.code);
      item.textContent = l.label;
      item.addEventListener("click", function () {
        applyLang(l.code);
        closeAll();
      });
      menu.appendChild(item);
    });

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = wrap.classList.contains("is-open");
      closeAll();
      if (!open) {
        wrap.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
      }
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    host.appendChild(wrap);
    switchers.push({ wrap: wrap, btn: btn, menu: menu });
    return wrap;
  }

  function closeAll() {
    switchers.forEach(function (s) {
      s.wrap.classList.remove("is-open");
      s.btn.setAttribute("aria-expanded", "false");
    });
  }

  function updateSwitcherUI(lang) {
    switchers.forEach(function (s) {
      var lbl = s.btn.querySelector(".hexu-lang-label");
      if (lbl) lbl.textContent = labelFor(lang);
      var items = s.menu.querySelectorAll(".hexu-lang-item");
      for (var i = 0; i < items.length; i++) {
        items[i].classList.toggle("is-active", items[i].getAttribute("data-lang") === lang);
      }
    });
  }

  /* ---------- init ---------- */
  function init() {
    injectStyles();

    var hosts = document.querySelectorAll("[data-lang-switcher]");
    if (hosts.length) {
      for (var i = 0; i < hosts.length; i++) buildSwitcher(hosts[i], false);
    }
    if (!document.querySelector("[data-lang-switcher][data-no-float]")) {
      buildSwitcher(document.body, true);
    }

    document.addEventListener("click", closeAll);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAll();
    });

    applyLang(detectDefaultLang());

    // Re-apply after late-loading content (fonts / reveal scripts / async blocks)
    window.addEventListener("load", function () {
      setTimeout(function () { applyLang(currentLang); }, 60);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Public API
  window.HEXU_setLang = applyLang;
  window.HEXU_getLang = function () { return currentLang; };
})();
