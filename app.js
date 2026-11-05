/* Varad Ghore portfolio: renders everything from window.PORTFOLIO (content.js).
   Front page = projects flagged `showcase` (one `latest`); the Vault holds every visible project.
   Edit mode saves content.js back: on the published artifact through the `artifact`
   capability, locally by downloading a new content.js. */
(function () {
  "use strict";
  var state = JSON.parse(JSON.stringify(window.PORTFOLIO || { profile: {}, categories: [], projects: [], brands: {} }));
  state.brands = state.brands || {};
  var vfilter = { bin: "all", q: "" };
  var dirty = false, editing = false, art = null, assets = null, isArtifact = !!window.claude;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var mmss = function (s) { s = Math.round(s || 0); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  var visible = function () { return state.projects.filter(function (p) { return !p.hidden; }); };
  var catLabel = function (id) { var c = state.categories.find(function (c) { return c.id === id; }); return c ? c.label : id; };
  var isWide = function (p) { return p.ratio === "16:9"; };
  var brandKey = function (c) { return String(c || "").split(/[·×]/)[0].trim(); };
  var brand = function (c) {
    if (state.brands[c]) return state.brands[c];
    var k = Object.keys(state.brands).find(function (n) { return brandKey(n) === brandKey(c); });
    return k ? state.brands[k] : null;
  };
  var latest = function () { return visible().find(function (p) { return p.latest; }); };
  // slight, stable rotation per string so stickers look hand-placed but never jump between renders
  var tilt = function (s, max) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return ((h % 1000) / 1000) * max; };

  function logoChip(p) {
    var b = brand(p.client); if (!b) return "";
    return '<span class="logo' + (b.fill ? " fill" : "") + (b.dark ? " dark" : "") + '"><img src="' + esc(b.logo) + '" alt="' + esc(p.client) + '"></span>';
  }

  /* ---------- render ---------- */
  function renderProfile() {
    var pr = state.profile;
    var initials = (pr.name || "").split(/\s+/).map(function (w) { return w[0] || ""; }).join("").slice(0, 2).toUpperCase();
    document.querySelectorAll("[data-bind]").forEach(function (el) {
      var k = el.getAttribute("data-bind");
      el.textContent = k === "initials" ? initials : k === "first" ? (pr.name || "").split(" ")[0] : (pr[k] || "");
    });
    $("#aboutText").innerHTML = (pr.about || []).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
    $("#skills").innerHTML = (pr.skills || []).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
    var li = function (s) { return "<li>" + esc(s) + "</li>"; };
    $("#shootList").innerHTML = (pr.shoot || []).map(li).join("");
    ["#igShoot", "#igNav"].forEach(function (s) { var a = $(s); a.hidden = !pr.instagram; if (pr.instagram) a.href = pr.instagram; });
    $("#cutList").innerHTML = (pr.cut || []).map(li).join("");
    $("#avail").hidden = !pr.availableText;
    var lines = [];
    if (pr.phone) lines.push('<button class="btn primary" data-copy="' + esc(pr.phone) + '">' + esc(pr.phone) + ' <span class="mono">Copy</span></button>');
    if (pr.whatsapp) lines.push('<a class="btn" href="' + esc(pr.whatsapp) + '" target="_blank" rel="noopener">WhatsApp me</a>');
    if (pr.instagram) lines.push('<a class="btn" href="' + esc(pr.instagram) + '" target="_blank" rel="noopener">Instagram @' + esc(pr.handle) + "</a>");
    if (pr.email) lines.push('<button class="btn" data-copy="' + esc(pr.email) + '">' + esc(pr.email) + ' <span class="mono">Copy</span></button>');
    if (pr.linkedin) lines.push('<a class="btn" href="' + esc(pr.linkedin) + '" target="_blank" rel="noopener">LinkedIn ↗</a>');
    $("#contactLines").innerHTML = lines.join("");
    document.title = (pr.name || "Portfolio") + " Films";
  }

  function brandsOf(list) { return Array.from(new Set(list.map(function (p) { return brandKey(p.client); }))); }

  function renderStats() {
    var v = visible(), secs = v.reduce(function (a, p) { return a + (p.dur || 0); }, 0);
    // written like a clapperboard: label above, chalk number below
    $("#stats").innerHTML =
      '<div><span>Films</span><strong>' + v.length + '</strong></div>' +
      '<div><span>Brands</span><strong>' + brandsOf(v).length + '</strong></div>' +
      '<div><span>Minutes cut</span><strong>' + Math.round(secs / 60) + '</strong></div>' +
      '<div><span>Years</span><strong>' + esc(state.profile.years || "2") + '</strong></div>';
  }

  function renderTimeline() {
    var v = visible();
    var clips = v.map(function (p) {
      var w = Math.max(isWide(p) ? 100 : 32, Math.min(220, (p.dur || 20) * (isWide(p) ? 1.4 : 2.2)));
      return '<div class="clip" style="width:' + Math.round(w) + 'px"><img src="' + esc(p.poster) + '" alt="" loading="lazy"><span>' + esc(brandKey(p.client)) + "</span></div>";
    }).join("");
    var waves = v.map(function (p) { return '<div class="wave" style="width:' + Math.round(Math.max(32, Math.min(220, (p.dur || 20) * 2))) + 'px"></div>'; }).join("");
    $("#reelV").innerHTML = clips + clips;
    $("#reelA").innerHTML = waves + waves;
  }

  function card(p) {
    return '<button class="card' + (isWide(p) ? " w" : "") + (p.hidden ? " is-hidden" : "") + '" data-open="' + esc(p.id) + '" data-pcur aria-label="Play ' + esc(p.title) + ", " + esc(p.client) + '">' +
      '<div class="frame"><img src="' + esc(p.poster) + '" alt="" loading="lazy" decoding="async"></div><span class="shade"></span>' +
      '<span class="genre"><span>' + esc(catLabel(p.cat)) + "</span><span>" + esc(p.ratio) + " · " + mmss(p.dur) + "</span></span>" +
      '<span class="meta">' + (brand(p.client) ? logoChip(p).replace('class="logo', 'style="position:static;justify-self:start" class="logo') : "<small>" + esc(p.client) + "</small>") +
      "<strong>" + esc(p.title) + "</strong></span></button>";
  }

  function renderFront() {
    var L = latest();
    $("#latest").hidden = !L;
    if (L) {
      $("#latest").innerHTML = '<span class="sticky">fresh off my<br>timeline!</span>' + card(L).replace('class="card w', 'class="card') +
        '<div class="latest-txt"><span class="badge mono"><i></i>Latest cut</span>' +
        (brand(L.client) ? '<div style="height:34px">' + logoChip(L).replace('class="logo', 'style="position:static;height:38px;max-width:240px;display:inline-flex" class="logo') + "</div>" : "") +
        "<h3>" + esc(L.title) + "</h3><p>" + esc(L.desc) + '</p><p class="mono">' + esc(catLabel(L.cat)) + " · " + esc(L.ratio) + " · " + mmss(L.dur) + "</p>" +
        '<button class="btn primary" data-open="' + esc(L.id) + '" style="justify-self:start">▶ Play with sound</button></div>';
    }
    var list = (editing ? state.projects : visible()).filter(function (p) { return p.showcase && p !== L; });
    var v = visible(), papers = v.filter(function (p) { return !isWide(p); }).slice(0, 5);
    var bins = state.categories.map(function (c) { var n = v.filter(function (p) { return p.cat === c.id; }).length; return n ? "<span>" + esc(c.label) + " " + n + "</span>" : ""; }).join("");
    var folder = '<button class="folder-tile" data-vault aria-label="Open the Vault with all ' + v.length + ' films">' +
      '<span class="back"></span><span class="tablbl">VARAD_ALL_WORK/</span>' +
      '<span class="papers">' + papers.map(function (p) { return '<span class="paper"><img src="' + esc(p.poster) + '" alt="" loading="lazy"></span>'; }).join("") + "</span>" +
      '<span class="sticky">all ' + v.length + " films,<br>sorted for you</span>" +
      '<span class="front"><span class="open">OPEN ↗</span><strong>The Vault</strong><span class="bins">' + bins + "</span></span></button>";
    $("#bento").innerHTML = list.map(card).join("") + folder;
  }

  function renderClients() {
    var map = {};
    visible().forEach(function (p) { var k = brandKey(p.client); (map[k] = map[k] || []).push(p); });
    var rows = Object.keys(map).sort(function (a, b) { return map[b].length - map[a].length || a.localeCompare(b); });
    $("#brandNote").textContent = rows.length + " and counting";
    // each brand is one frame of 35mm film: a still from its best film, the logo taped on, edge print below
    var frame = function (c, i, dupe) {
      var b = brand(c) || {}, list = map[c], n = list.length;
      var still = (list.find(function (p) { return p.showcase; }) || list[0]).poster;
      var darkLbl = b.dark || (b.fill && /marigold|goldmedal|n3e|malpani|chaikapi|bumzee/.test(b.logo || ""));
      return '<button class="fr" data-client="' + esc(c) + '"' + (dupe ? ' tabindex="-1" aria-hidden="true"' : ' aria-label="Open ' + esc(c) + ' in the Vault"') + ">" +
        '<span class="ph"><img src="' + esc(still) + '" alt="" loading="lazy"></span>' +
        '<span class="lbl' + (darkLbl ? " dark" : "") + '" style="--r:' + (tilt(c, 6) - 3).toFixed(1) + 'deg">' +
        (b.logo ? '<img src="' + esc(b.logo) + '" alt="' + esc(c) + '" loading="lazy">' : '<strong style="color:#111">' + esc(c) + "</strong>") + "</span>" +
        '<span class="num">' + p2(i + 1) + "A ▸</span>" +
        '<span class="edge"><span>' + esc(c) + "</span><span>" + n + (n > 1 ? " FILMS" : " FILM") + " ▸ " + p2(i + 1) + "</span></span>" +
        '<span class="play">open ↗</span></button>';
    };
    var lane = function (names, offset) {
      var one = names.map(function (c, k) { return frame(c, offset + k, false); }).join("");
      var two = names.map(function (c, k) { return frame(c, offset + k, true); }).join("");
      return '<div class="film-lane"><div class="strip">' + one + two + "</div></div>";
    };
    var half = Math.ceil(rows.length / 2);
    $("#clientList").innerHTML = lane(rows.slice(0, half), 0) + lane(rows.slice(half), half);
  }

  /* ---------- the Vault ---------- */
  var vault = $("#vault");
  function vaultList() {
    var list = editing ? state.projects : visible(), b = vfilter.bin, q = vfilter.q.toLowerCase();
    if (b.indexOf("c:") === 0) list = list.filter(function (p) { return brandKey(p.client) === b.slice(2); });
    else if (b !== "all") list = list.filter(function (p) { return p.cat === b; });
    if (q) list = list.filter(function (p) { return (p.title + " " + p.client + " " + catLabel(p.cat)).toLowerCase().indexOf(q) > -1; });
    return list;
  }
  function renderVault() {
    var v = visible(), b = vfilter.bin;
    var bin = function (id, label, n) { return '<button class="bin" data-bin="' + esc(id) + '" aria-pressed="' + (b === id) + '">' + esc(label) + "<em>" + n + "</em></button>"; };
    $("#bins").innerHTML = bin("all", "All work", v.length) + "<h4>Genres</h4>" +
      state.categories.map(function (c) { var n = v.filter(function (p) { return p.cat === c.id; }).length; return n ? bin(c.id, c.label, n) : ""; }).join("") +
      "<h4>Brands</h4>" + brandsOf(v).sort().map(function (c) { return bin("c:" + c, c, v.filter(function (p) { return brandKey(p.client) === c; }).length); }).join("");
    $("#crumb").textContent = "/ " + (b === "all" ? "All work" : b.indexOf("c:") === 0 ? b.slice(2) : catLabel(b));
    var list = vaultList();
    $("#items").innerHTML = list.length ? list.map(function (p) {
      return '<button class="item" data-open="' + esc(p.id) + '"><span class="th"><img src="' + esc(p.poster) + '" alt="" loading="lazy">' +
        (p.showcase ? '<span class="star">ON FRONT</span>' : "") + "<small>" + mmss(p.dur) + "</small></span><b>" + esc(p.title) + "</b><span>" + esc(p.client) + " · " + esc(p.ratio) + "</span></button>";
    }).join("") : '<p class="vempty">No films match that search.</p>';
  }
  function openVault(bin) {
    vfilter = { bin: bin || "all", q: "" }; $("#vSearch").value = "";
    renderVault(); if (!vault.open) vault.showModal(); $("#items").scrollTop = 0;
  }
  $("#vaultClose").onclick = function () { vault.close(); };
  $("#vSearch").addEventListener("input", function (e) { vfilter.q = e.target.value; renderVault(); });

  function renderAll() { renderProfile(); renderStats(); renderTimeline(); renderFront(); renderClients(); if (vault.open) renderVault(); if (editing) renderDrawer(); }

  /* ---------- hover preview (front cards and Vault items) ---------- */
  document.addEventListener("pointerover", function (e) {
    if (!canHover || reduceMotion) return;
    var host = e.target.closest(".card,.item"); if (!host || host.querySelector("video")) return;
    var p = state.projects.find(function (x) { return x.id === host.dataset.open; }); if (!p) return;
    var v = document.createElement("video");
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto"; v.src = p.loop || p.video;
    // laid over the poster: swapping the poster out mid-click would swallow the click
    v.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:" + (host.classList.contains("item") ? "contain;background:#07080b" : "cover");
    (host.querySelector(".frame") || host.querySelector(".th")).appendChild(v); v.play().catch(function () {});
    host.addEventListener("pointerleave", function out() {
      host.removeEventListener("pointerleave", out);
      v.pause(); v.removeAttribute("src"); v.load(); v.remove();
    });
  });

  /* play cursor */
  var pc = $("#pcur");
  if (canHover && !reduceMotion) {
    document.addEventListener("pointermove", function (e) {
      pc.style.left = e.clientX + "px"; pc.style.top = e.clientY + "px";
      pc.classList.toggle("on", !!e.target.closest("[data-pcur]") && !document.querySelector("dialog[open]"));
    });
  }

  /* ---------- clicks ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-open],[data-vault],[data-bin],[data-client],[data-copy]");
    if (!t) return;
    if (t.dataset.open) return openViewer(t.dataset.open);
    if (t.hasAttribute("data-vault")) return openVault("all");
    if (t.dataset.bin) { vfilter.bin = t.dataset.bin; renderVault(); $("#items").scrollTop = 0; return; }
    if (t.dataset.client) return openVault("c:" + t.dataset.client);
    if (t.dataset.copy) {
      var val = t.dataset.copy;
      try { navigator.clipboard.writeText(val).then(function () { toast("Copied " + val); }, function () { toast(val); }); } catch (_) { toast(val); }
    }
  });

  /* ---------- viewer ---------- */
  var dlg = $("#viewer"), vv = $("#vVideo"), cur = 0, seq = [];
  function openViewer(id) {
    seq = vault.open ? vaultList() : (editing ? state.projects : visible()).filter(function (p) { return p.showcase; });
    cur = seq.findIndex(function (p) { return p.id === id; });
    if (cur < 0) { seq = state.projects; cur = seq.findIndex(function (p) { return p.id === id; }); }
    show(seq[cur]);
    if (!dlg.open) dlg.showModal();
    vv.play().catch(function () {});
  }
  function show(p) {
    vv.src = p.video; vv.poster = p.poster;
    var b = brand(p.client);
    $("#vClient").innerHTML = b ? '<span class="logo' + (b.fill ? " fill" : "") + (b.dark ? " dark" : "") + '" style="position:static;display:inline-flex;height:34px"><img src="' + esc(b.logo) + '" alt="' + esc(p.client) + '"></span>' : esc(p.client);
    $("#vTitle").textContent = p.title; $("#vDesc").textContent = p.desc || "";
    $("#vMeta").innerHTML = "<dt>Client</dt><dd>" + esc(p.client) + "</dd><dt>Genre</dt><dd>" + esc(catLabel(p.cat)) + "</dd><dt>Format</dt><dd>" + esc(p.ratio) + (p.fps ? " · " + esc(p.fps) + " fps" : "") +
      "</dd><dt>Runtime</dt><dd>" + mmss(p.dur) + (p.excerpt ? " (1-min excerpt here)" : "") + "</dd>";
  }
  function step(d) { if (!seq.length) return; cur = (cur + d + seq.length) % seq.length; show(seq[cur]); vv.play().catch(function () {}); }
  $("#vPrev").onclick = function () { step(-1); };
  $("#vNext").onclick = function () { step(1); };
  $("#vClose").onclick = function () { dlg.close(); };
  dlg.addEventListener("close", function () { vv.pause(); vv.removeAttribute("src"); vv.load(); });
  dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.classList.contains("v-stage")) dlg.close(); });
  document.addEventListener("keydown", function (e) {
    if (!dlg.open) return;
    if (e.key === "ArrowRight") step(1); else if (e.key === "ArrowLeft") step(-1);
  });

  /* ---------- viewfinder: SHOOT shows the camera, CUT shows the edit ---------- */
  // the showreel is 11 shots of 1.6 s each (built in that order from these brands)
  var SHOT = 1.6, SHOTS = ["Forbes Marshall", "Bauli · Gold Medal · Sleepsure", "Crest Test Systems", "Rovema India", "Malpani · Chai Kapi · Sleepsure",
    "Mindgate Solutions", "Marigold · Bumzee", "n3e", "Gold Medal · Sleepsure · Chai Kapi", "Crest Test Systems", "Crest Test Systems"];
  var p2 = function (n) { return String(n).padStart(2, "0"); };
  var tcOf = function (f, fps) { return p2(Math.floor(f / (fps * 3600)) % 24) + ":" + p2(Math.floor(f / (fps * 60)) % 60) + ":" + p2(Math.floor(f / fps) % 60) + ":" + p2(f % fps); };
  var t0 = performance.now(), rv = $("#reelVid"), vf = $("#vf"), lastShot = -1, pinned = false, mL = $("#mL"), mR = $("#mR");
  $("#cutSegs").innerHTML = SHOTS.map(function () { return "<span></span>"; }).join("");
  function setMode(m) {
    vf.dataset.mode = m;
    vf.querySelectorAll(".mode button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.mode === m)); });
  }
  vf.querySelector(".mode").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-mode]"); if (!b) return;
    pinned = true; setMode(b.dataset.mode);
  });
  function onShot(i) {
    $("#shotLbl").textContent = "SHOT " + p2(i + 1) + "/" + p2(SHOTS.length) + " · " + SHOTS[i];
    $("#cutSegs").querySelectorAll("span").forEach(function (s, k) { s.classList.toggle("on", k <= i); });
    var r = $("#razor"); r.classList.remove("hit"); void r.offsetWidth; r.classList.add("hit");
    var f = $("#focus"); f.style.left = (30 + tilt("f" + i, 40)) + "%"; f.style.top = (22 + tilt("t" + i, 26)) + "%";
    // the camera menu and the edit list step through their items like a live menu
    [$("#shootList"), $("#cutList")].forEach(function (ul) {
      var items = ul.children; for (var k = 0; k < items.length; k++) items[k].classList.toggle("sel", k === i % items.length);
    });
    if (!pinned && i % 4 === 0 && i > 0) setMode(vf.dataset.mode === "shoot" ? "cut" : "shoot");
  }
  function tick() {
    $("#tc").textContent = tcOf(Math.floor((performance.now() - t0) / 40), 25);
    if (rv.duration) {
      var t = rv.currentTime, i = Math.min(SHOTS.length - 1, Math.floor(t / SHOT));
      $("#vfTc").textContent = tcOf(Math.floor(t * 25), 25);
      $("#cutHead").style.left = (t / rv.duration * 100) + "%";
      if (i !== lastShot) { lastShot = i; onShot(i); }
      var w = performance.now() / 120;
      mL.style.height = (45 + 30 * Math.abs(Math.sin(w)) + 15 * Math.sin(w * 2.7)) + "%";
      mR.style.height = (42 + 30 * Math.abs(Math.sin(w * 1.13 + 1)) + 15 * Math.sin(w * 3.1)) + "%";
    }
    if (!reduceMotion) requestAnimationFrame(tick);
  }
  if (reduceMotion) { rv.removeAttribute("autoplay"); rv.pause(); }
  tick();

  function toast(msg, ms) {
    var el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); el.textContent = msg;
    document.body.appendChild(el); setTimeout(function () { el.remove(); }, ms || 2600);
  }

  /* ================= EDIT MODE ================= */
  var drawer = null, tab = "projects", bar = null;
  function markDirty() { dirty = true; if (bar) $(".msg", bar).textContent = "Unsaved changes"; }
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  function enterEdit() {
    editing = true; document.body.classList.add("editing");
    bar = document.createElement("div"); bar.className = "editbar";
    bar.innerHTML = '<div class="wrap"><span class="msg">Edit mode. Changes show live; nothing is saved until you press Save.</span>' +
      '<button class="btn small" data-act="panel">Panel</button><button class="btn small" data-act="cancel">Discard</button><button class="btn small primary" data-act="save">Save site</button></div>';
    document.body.appendChild(bar);
    bar.addEventListener("click", function (e) {
      var a = e.target.closest("[data-act]"); if (!a) return;
      if (a.dataset.act === "save") save();
      if (a.dataset.act === "cancel") { if (!dirty || a.dataset.sure) { dirty = false; location.reload(); } else { a.dataset.sure = "1"; a.textContent = "Discard all changes?"; } }
      if (a.dataset.act === "panel") { if (drawer) closeDrawer(); else renderDrawer(); }
    });
    renderDrawer(); renderFront();
  }

  function closeDrawer() { if (drawer) drawer.remove(); drawer = null; }

  function renderDrawer() {
    var keepScroll = drawer ? $(".body", drawer).scrollTop : 0;
    if (!drawer) { drawer = document.createElement("aside"); drawer.className = "drawer"; drawer.setAttribute("aria-label", "Site editor"); document.body.appendChild(drawer); bindDrawer(); }
    var pr = state.profile, html = '<header><button class="chip" data-tab="projects" aria-pressed="' + (tab === "projects") + '">Projects</button>' +
      '<button class="chip" data-tab="profile" aria-pressed="' + (tab === "profile") + '">Profile &amp; text</button><button class="btn small" style="margin-left:auto" data-close>Hide</button></header><div class="body">';
    if (tab === "profile") {
      var f = function (k, label, ta) { return '<div class="field"><label for="pf-' + k + '">' + label + "</label>" + (ta ? '<textarea id="pf-' + k + '" data-pf="' + k + '">' + esc(pr[k]) + "</textarea>" : '<input id="pf-' + k + '" data-pf="' + k + '" value="' + esc(pr[k]) + '">') + "</div>"; };
      html += f("name", "Name") + f("role", "Role line") + f("location", "Location") + f("tagline", "Headline", 1) + f("intro", "Intro", 1) + f("years", "Years of experience") +
        '<div class="field"><label for="pf-about">About (blank line between paragraphs)</label><textarea id="pf-about" data-pf="about" style="min-height:200px">' + esc((pr.about || []).join("\n\n")) + "</textarea></div>" +
        '<div class="field"><label for="pf-skills">Skills (comma separated)</label><textarea id="pf-skills" data-pf="skills">' + esc((pr.skills || []).join(", ")) + "</textarea></div>" +
        '<div class="field"><label for="pf-shoot">Behind the camera list (comma separated)</label><textarea id="pf-shoot" data-pf="shoot">' + esc((pr.shoot || []).join(", ")) + "</textarea></div>" +
        '<div class="field"><label for="pf-cut">Behind the timeline list (comma separated)</label><textarea id="pf-cut" data-pf="cut">' + esc((pr.cut || []).join(", ")) + "</textarea></div>" +
        f("phone", "Phone") + f("whatsapp", "WhatsApp link (https://wa.me/91…)") + f("email", "Email") + f("handle", "Instagram handle") + f("instagram", "Instagram link") + f("availableText", "Availability line");
    } else {
      html += '<details class="prow" style="display:block"><summary style="cursor:pointer;font-weight:600">＋ Add a new project</summary><div class="fields" style="margin-top:12px">' +
        (assets ? '<div class="field"><label for="np-file">Video file (MP4, under 20 MB)</label><input id="np-file" type="file" accept="video/mp4,video/webm,video/quicktime"></div>'
                : '<div class="field"><label for="np-path">Video path in the portfolio folder</label><input id="np-path" placeholder="media/video/my-film.mp4"></div><div class="field"><label for="np-poster">Poster image path</label><input id="np-poster" placeholder="media/poster/my-film.jpg"></div>') +
        '<div class="field"><label for="np-title">Title</label><input id="np-title"></div><div class="field"><label for="np-client">Client</label><input id="np-client" list="clientNames"></div>' +
        '<div class="field"><label for="np-cat">Genre</label><select id="np-cat">' + state.categories.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label for="np-desc">One-line description</label><textarea id="np-desc"></textarea></div><button class="btn small primary" data-add>Add project</button><p class="note" id="np-status"></p></div></details>' +
        '<datalist id="clientNames">' + Array.from(new Set(state.projects.map(function (p) { return p.client; }))).map(function (c) { return '<option value="' + esc(c) + '">'; }).join("") + "</datalist>" +
        '<p class="note">Tick <b>Front page</b> to show a film in "Best of each genre"; everything else stays in the Vault. One film can be <b>Latest</b>. Order here is the order on the site.</p>';
      html += state.projects.map(function (p, i) {
        return '<div class="prow" data-i="' + i + '"><img src="' + esc(p.poster) + '" alt=""><div class="fields">' +
          '<input aria-label="Title" data-pp="title" value="' + esc(p.title) + '"><div class="row2"><input aria-label="Client" data-pp="client" list="clientNames" value="' + esc(p.client) + '">' +
          '<select aria-label="Genre" data-pp="cat">' + state.categories.map(function (c) { return '<option value="' + c.id + '"' + (c.id === p.cat ? " selected" : "") + ">" + esc(c.label) + "</option>"; }).join("") + "</select></div>" +
          '<textarea aria-label="Description" data-pp="desc">' + esc(p.desc) + "</textarea>" +
          '<div class="tools"><label><input type="checkbox" data-pp="showcase"' + (p.showcase ? " checked" : "") + '> Front page</label><label><input type="checkbox" data-pp="latest"' + (p.latest ? " checked" : "") + '> Latest</label>' +
          '<label><input type="checkbox" data-pp="hidden"' + (p.hidden ? " checked" : "") + "> Hidden</label>" +
          '<button class="btn small" data-mv="-1" aria-label="Move up">↑</button><button class="btn small" data-mv="1" aria-label="Move down">↓</button><button class="btn small" data-del>' + (p._sure ? "Really remove?" : "Remove") + "</button></div></div></div>";
      }).join("");
    }
    drawer.innerHTML = html + "</div>";
    $(".body", drawer).scrollTop = keepScroll;
  }

  function bindDrawer() {
    drawer.addEventListener("input", function (e) {
      var t = e.target, k;
      if ((k = t.dataset.pf)) {
        state.profile[k] = k === "about" ? t.value.split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean)
          : (k === "skills" || k === "shoot" || k === "cut") ? t.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : t.value;
        markDirty(); renderProfile(); renderStats();
      } else if ((k = t.dataset.pp)) {
        var p = state.projects[+t.closest("[data-i]").dataset.i];
        p[k] = t.type === "checkbox" ? t.checked : t.value;
        if (k === "latest" && p.latest) { state.projects.forEach(function (x) { if (x !== p) x.latest = false; }); p.showcase = true; renderDrawer(); }
        markDirty(); renderStats(); renderTimeline(); renderFront(); renderClients();
      }
    });
    drawer.addEventListener("click", function (e) {
      var t = e.target;
      if (t.dataset.tab) { tab = t.dataset.tab; renderDrawer(); return; }
      if (t.hasAttribute("data-close")) { closeDrawer(); return; }
      if (t.hasAttribute("data-add")) { addProject(); return; }
      var row = t.closest("[data-i]"); if (!row) return;
      var i = +row.dataset.i;
      if (t.dataset.mv) {
        var j = i + +t.dataset.mv; if (j < 0 || j >= state.projects.length) return;
        var x = state.projects.splice(i, 1)[0]; state.projects.splice(j, 0, x); markDirty(); renderAll();
      } else if (t.hasAttribute("data-del")) {
        var p = state.projects[i];
        if (!p._sure) { p._sure = true; renderDrawer(); return; }
        state.projects.splice(i, 1); markDirty(); renderAll();
      }
    });
  }

  function slug(s) { return (s || "film").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + "-" + Date.now().toString(36); }

  function videoInfo(src) {
    return new Promise(function (res) {
      var v = document.createElement("video"); v.muted = true; v.preload = "auto"; v.src = src; v.crossOrigin = "anonymous";
      v.onloadedmetadata = function () { v.currentTime = Math.min(1.5, (v.duration || 2) * 0.3); };
      v.onseeked = function () {
        var w = v.videoWidth, h = v.videoHeight, c = document.createElement("canvas"), sc = Math.min(1, 540 / Math.min(w, h));
        c.width = Math.round(w * sc); c.height = Math.round(h * sc); c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
        c.toBlob(function (b) { res({ w: w, h: h, dur: v.duration, poster: b }); }, "image/jpeg", 0.82);
      };
      v.onerror = function () { res(null); };
    });
  }
  function ratioOf(w, h) {
    var r = w / h, opts = [["9:16", 9 / 16], ["16:9", 16 / 9], ["1:1", 1], ["4:5", .8], ["3:4", .75]];
    for (var k = 0; k < opts.length; k++) if (Math.abs(r - opts[k][1]) < .04) return opts[k][0];
    return w + ":" + h;
  }

  async function addProject() {
    var st = $("#np-status"), title = $("#np-title").value.trim(), client = $("#np-client").value.trim();
    if (!title || !client) { st.textContent = "Add a title and a client first."; return; }
    var p = { id: slug(title), title: title, client: client, cat: $("#np-cat").value, featured: false, showcase: false, latest: false, hidden: false, video: "", poster: "", loop: "", ratio: "9:16", dur: 0, fps: "", excerpt: false, desc: $("#np-desc").value.trim() };
    if (assets) {
      var file = $("#np-file").files[0];
      if (!file) { st.textContent = "Choose a video file."; return; }
      if (file.size > 20 * 1024 * 1024) { st.textContent = "That file is " + (file.size / 1048576).toFixed(1) + " MB. Export it under 20 MB (720p, H.264) and try again."; return; }
      try {
        st.textContent = "Reading the video…";
        var info = await videoInfo(URL.createObjectURL(file));
        st.textContent = "Uploading video…";
        var up = await assets.upload(file); p.video = up.url;
        if (info) { p.ratio = ratioOf(info.w, info.h); p.dur = Math.round(info.dur); if (info.poster) { st.textContent = "Uploading poster…"; p.poster = (await assets.upload(info.poster)).url; } }
      } catch (err) { st.textContent = "Upload failed (" + (err && err.code || "error") + "). " + (err && err.message || ""); return; }
    } else {
      p.video = $("#np-path").value.trim(); p.poster = $("#np-poster").value.trim();
      if (!p.video) { st.textContent = "Type the video's path, e.g. media/video/my-film.mp4"; return; }
      var inf = await videoInfo(p.video); if (inf) { p.ratio = ratioOf(inf.w, inf.h); p.dur = Math.round(inf.dur); }
    }
    state.projects.unshift(p); markDirty(); renderAll(); toast("Added to the Vault. Tick Front page to feature it, then Save site.");
  }

  function contentText() {
    var clean = JSON.parse(JSON.stringify(state)); clean.projects.forEach(function (p) { delete p._sure; });
    return "window.PORTFOLIO = " + JSON.stringify(clean, null, 1) + ";\n";
  }

  async function save() {
    var text = contentText(), msg = $(".msg", bar);
    if (!art) { // running from the local folder: hand back a new content.js
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/javascript" })); a.download = "content.js";
      document.body.appendChild(a); a.click(); a.remove();
      dirty = false; msg.textContent = "Downloaded content.js. Replace the one in your portfolio folder with it."; return;
    }
    msg.textContent = "Saving…";
    try {
      await art.publish({ "content.js": { content: text, contentType: "text/javascript" } });
      dirty = false; msg.textContent = "Saved. Everyone with the link sees the new version."; toast("Saved");
    } catch (err) {
      var code = err && err.code;
      if (code === "conflict") { msg.textContent = "Someone saved a newer version. Reloading to it…"; return; }
      if (code === "rate_limited") { msg.textContent = "Saving too fast. Wait a moment and press Save again."; return; }
      msg.textContent = "Saving isn't available in this view (" + (code || "error") + "). Copy the content below and send it to Claude to publish.";
      tab = "profile"; renderDrawer();
      var box = document.createElement("textarea"); box.className = "copybox"; box.readOnly = true; box.value = text; box.setAttribute("aria-label", "Site content");
      $(".body", drawer).prepend(box); box.select();
    }
  }

  $("#editBtn").addEventListener("click", function () { if (!editing) enterEdit(); else if (!drawer) renderDrawer(); });

  async function initEditing() {
    if (!isArtifact) { // opened from the local folder
      if (location.protocol === "file:" || location.hostname === "localhost" || location.hostname === "127.0.0.1") $("#editBtn").hidden = false;
      return;
    }
    try {
      var res = await Promise.all([window.claude.use("artifact"), window.claude.use("user"), window.claude.use("assets")]);
      art = res[0]; var user = res[1]; assets = res[2];
      var can = user && typeof user.canEdit === "function" ? await user.canEdit() : false;
      if (art && can) $("#editBtn").hidden = false;
    } catch (_) { /* read-only view */ }
  }

  $("#yr").textContent = new Date().getFullYear();
  renderAll();
  initEditing();
})();
