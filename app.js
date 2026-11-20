(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const WD_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const EMOJI = ["🥗", "🍲", "🥘", "🍛", "🥙", "🍝", "🫘", "🥕"];

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  let weeks = [];          // index entries
  let week = null;         // current week data
  let weekIdx = 0;
  let dayIdx = 0;
  let tab = store.get("tab", "plan");
  let hideDone = store.get("hideDone", false);
  let shopState = { checked: {}, custom: [] };
  let unsubShop = null;

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const todayStr = () => { const t = new Date(); return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); };
  const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2200);
  }

  function photo(dish, cls) {
    const emo = EMOJI[hash(dish && dish.name) % EMOJI.length];
    const src = dish && (dish.img || dish.imgUrl);
    if (src) {
      return `<img class="ph ${cls}" src="${esc(src)}" alt="${esc(dish.name)}" loading="lazy" onerror="this.outerHTML='<div class=&quot;ph ph-fallback ${cls}&quot;>${emo}</div>'">`;
    }
    return `<div class="ph ph-fallback ${cls}" aria-hidden="true">${emo}</div>`;
  }

  /* ---------- Loading ---------- */
  async function getJSON(url) {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(url + " " + r.status);
    return r.json();
  }

  function pickDefaultWeek() {
    const t = parseDate(todayStr()).getTime();
    let best = 0, bestDiff = Infinity;
    weeks.forEach((w, i) => {
      const start = parseDate(w.id).getTime(), end = start + 6 * 864e5;
      const diff = t < start ? start - t : t > end ? t - end : 0;
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    });
    return best;
  }

  async function loadWeek(i) {
    weekIdx = Math.max(0, Math.min(weeks.length - 1, i));
    const meta = weeks[weekIdx];
    $("#weekLabel").textContent = meta.label;
    $("#weekSelect").value = meta.id;
    $("#prevWeek").disabled = weekIdx === 0;
    $("#nextWeek").disabled = weekIdx === weeks.length - 1;
    try {
      week = await getJSON("weeks/" + meta.id + ".json");
    } catch (e) {
      week = null;
      $("#dayContent").innerHTML = `<p class="empty">Diese Woche konnte nicht geladen werden.<br>Bist du offline?</p>`;
      return;
    }
    const tIdx = (week.days || []).findIndex((d) => d.date === todayStr());
    dayIdx = tIdx >= 0 ? tIdx : 0;
    renderPlan();
    if (tIdx > 0 && tab === "plan") requestAnimationFrame(() => scrollToDay(tIdx, false));
    if (unsubShop) unsubShop();
    unsubShop = Sync.subscribe(meta.id, (s) => { shopState = s; renderShop(); });
  }

  /* ---------- Plan ---------- */
  function renderPlan() {
    if (!week) return;
    $("#weekIntro").textContent = week.intro || "";
    $("#weekPrep").textContent = week.prepNote || "";
    $("#weekPrep").hidden = !week.prepNote;
    const today = todayStr();
    $("#dayChips").innerHTML = week.days.map((d, i) => {
      const dt = parseDate(d.date);
      return `<button class="day-chip${i === dayIdx ? " active" : ""}${d.date === today ? " today" : ""}" data-i="${i}">${WD[dt.getDay()]}<b>${dt.getDate()}</b></button>`;
    }).join("");
    const MON = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
    let html = "";
    week.days.forEach((d, i) => {
      const dt = parseDate(d.date);
      html += `<section class="day${d.date === today ? " is-today" : ""}" id="day-${i}">`;
      html += `<header class="day-head"><p class="day-kicker">${WD_LONG[dt.getDay()]}${d.date === today ? `<span class="sep">·</span>heute` : ""}</p><h2 class="day-title">${dt.getDate()}. ${MON[dt.getMonth()]}</h2></header>`;
      html += mealRow("Mittag", d.lunch) + mealRow("Abend", d.dinner);
      if (d.dinner && d.dinner.cookDay && d.dinner.cookDay.length) {
        html += `<div class="cook-day"><p class="meal-label">Kochtag<span class="sep">·</span>für die kommende Woche</p>` +
          d.dinner.cookDay.map((id) => smallCard(id)).join("") + `</div>`;
      }
      html += `</section>`;
    });
    $("#dayContent").innerHTML = html;
  }

  function scrollToDay(i, smooth) {
    const el = document.getElementById("day-" + i);
    if (!el) return;
    const head = document.querySelector(".top"); const top = el.getBoundingClientRect().top + window.scrollY - (head ? head.offsetHeight : 0) - 4;
    window.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
  }
  function mealRow(label, meal) {
    if (!meal) return "";
    const dish = week.dishes[meal.dish] || { name: meal.dish };
    return cardHTML(meal.dish, meal.type, dish, label);
  }

  function typeText(type) {
    if (type === "prep") return "Meal Prep · vom Sonntag";
    if (type === "next") return "Meal Prep · für die Folgewoche";
    return "Frisch gekocht";
  }
  function mealLabel(name, meal) {
    if (!meal) return "";
    return `<p class="meal-label">${name}<span class="sep">·</span>${meal.type === "prep" ? "Meal Prep" : "frisch"}</p>`;
  }

  function mealCard(meal) {
    if (!meal) return "";
    const dish = week.dishes[meal.dish] || { name: meal.dish };
    return cardHTML(meal.dish, meal.type, dish);
  }
  function smallCard(id) {
    const dish = week.dishes[id] || { name: id };
    return cardHTML(id, "next", dish);
  }
  function cardHTML(id, type, dish, label) {
    const kind = type === "prep" ? "Meal Prep" : type === "next" ? "Vorkochen" : "frisch";
    const tag = `<span class="tag">${label ? esc(label) + `<span class="sep">·</span>` : ""}${kind}</span>`;
    return `<button class="card" data-dish="${esc(id)}" data-type="${esc(type)}">${photo(dish, "thumb")}<div class="body">${tag}<h3>${esc(dish.name)}</h3></div><span class="arr" aria-hidden="true">→</span></button>`;
  }

  /* ---------- Recipe sheet ---------- */
  function openRecipe(id, type) {
    const dish = week && week.dishes[id];
    if (!dish) return;
    const doneKey = "ing:" + week.id + ":" + id;
    const done = store.get(doneKey, []);
    const sheet = $("#sheet");
    sheet.innerHTML = `<button class="close" aria-label="Schließen">×</button><div class="hero-wrap">${photo(dish, "hero")}</div>
      <div class="inner"><p class="kicker">${typeText(type)}</p><h2>${esc(dish.name)}</h2>
      <p class="servings">${esc(dish.servings || "")}</p>
      <h4>Zutaten</h4><ul class="ing">${(dish.ingredients || []).map((x, i) => `<li data-i="${i}" class="${done.includes(i) ? "done" : ""}">${esc(x)}</li>`).join("")}</ul>
      <h4>Zubereitung</h4><p class="steps">${esc(dish.steps || "")}</p>
      ${dish.credit ? `<p class="credit">Foto: ${esc(dish.credit)}</p>` : ""}</div>`;
    sheet.querySelector(".hero").removeAttribute("loading");
    sheet.querySelector(".close").onclick = closeSheet;
    sheet.querySelectorAll(".ing li").forEach((li) => li.onclick = () => {
      li.classList.toggle("done");
      const list = [...sheet.querySelectorAll(".ing li.done")].map((x) => +x.dataset.i);
      store.set(doneKey, list);
    });
    sheet.hidden = false; $("#sheetBackdrop").hidden = false;
    sheet.scrollTop = 0;
    document.body.style.overflow = "hidden";
    history.pushState({ sheet: 1 }, "");
  }
  function closeSheet(fromPop) {
    if ($("#sheet").hidden) return;
    $("#sheet").hidden = true; $("#sheetBackdrop").hidden = true;
    document.body.style.overflow = "";
    if (fromPop !== true && history.state && history.state.sheet) history.back();
  }

  /* ---------- Shopping ---------- */
  function shopItems() {
    const cats = (week && week.shopping ? week.shopping : []).map((c) => ({
      cat: c.cat,
      items: (c.items || []).map((it) => ({ key: Sync.slug(c.cat + "-" + it.name), name: it.name, qty: it.qty || "" }))
    }));
    if (shopState.custom && shopState.custom.length) {
      cats.push({ cat: "Eigene Artikel", custom: true, items: shopState.custom.map((c) => ({ key: c.key, name: c.name, qty: "", custom: true })) });
    }
    return cats;
  }

  function renderShop() {
    if (!week) return;
    const cats = shopItems();
    const checked = shopState.checked || {};
    let total = 0, done = 0;
    cats.forEach((c) => c.items.forEach((it) => { total++; if (checked[it.key]) done++; }));
    $("#progText").textContent = `${done}/${total}`;
    $("#progBar").style.width = total ? (done / total * 100) + "%" : "0";
    $("#toggleDone").classList.toggle("on", hideDone);
    $("#toggleDone").textContent = hideDone ? "Erledigte anzeigen" : "Erledigte ausblenden";
    if (!total) {
      $("#shopList").innerHTML = `<p class="empty">Für diese Woche gibt es noch keine Einkaufsliste.</p>`;
      return;
    }
    $("#shopList").innerHTML = cats.map((c) => {
      const items = c.items.slice().sort((a, b) => (checked[a.key] ? 1 : 0) - (checked[b.key] ? 1 : 0))
        .filter((it) => !(hideDone && checked[it.key]));
      const open = c.items.filter((it) => !checked[it.key]).length;
      if (!items.length) return "";
      return `<section class="cat"><h3><span>${esc(c.cat)}</span><small>${open} offen</small></h3>` +
        items.map((it) => `<label class="item${checked[it.key] ? " done" : ""}">
          <input type="checkbox" data-key="${esc(it.key)}" ${checked[it.key] ? "checked" : ""}>
          <span class="name">${esc(it.name)}</span>${it.qty ? `<span class="qty">${esc(it.qty)}</span>` : ""}
          ${it.custom ? `<button class="del" data-del="${esc(it.key)}" aria-label="Entfernen">✕</button>` : ""}</label>`).join("") +
        `</section>`;
    }).join("") || `<p class="empty">Alles erledigt.</p>`;
  }

  /* ---------- Tabs & events ---------- */
  function setTab(t) {
    tab = t; store.set("tab", t);
    $("#view-plan").hidden = t !== "plan";
    $("#view-shop").hidden = t !== "shop";
    document.querySelectorAll(".tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
    window.scrollTo(0, 0);
  }

  function bind() {
    document.querySelectorAll(".tabbar button").forEach((b) => b.onclick = () => setTab(b.dataset.tab));
    $("#prevWeek").onclick = () => loadWeek(weekIdx - 1);
    $("#nextWeek").onclick = () => loadWeek(weekIdx + 1);
    $("#weekSelect").onchange = (e) => loadWeek(weeks.findIndex((w) => w.id === e.target.value));
    $("#dayChips").onclick = (e) => {
      const b = e.target.closest(".day-chip"); if (!b) return;
      dayIdx = +b.dataset.i;
      document.querySelectorAll(".day-chip").forEach((c) => c.classList.toggle("active", c === b));
      scrollToDay(dayIdx, true);
    };
    $("#dayContent").onclick = (e) => {
      const c = e.target.closest(".card"); if (c) openRecipe(c.dataset.dish, c.dataset.type);
    };
    $("#sheetBackdrop").onclick = closeSheet;
    window.addEventListener("popstate", () => closeSheet(true));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

    $("#shopList").addEventListener("change", (e) => {
      const k = e.target.dataset && e.target.dataset.key;
      if (k) Sync.setChecked(week.id, k, e.target.checked);
    });
    $("#shopList").addEventListener("click", (e) => {
      const d = e.target.closest("[data-del]");
      if (d) { e.preventDefault(); Sync.removeItem(week.id, d.dataset.del); }
    });
    $("#toggleDone").onclick = () => { hideDone = !hideDone; store.set("hideDone", hideDone); renderShop(); };
    $("#resetAll").onclick = () => {
      if (confirm("Alle Häkchen dieser Woche zurücksetzen?")) Sync.reset(week.id);
    };
    $("#copyBring").onclick = async () => {
      const checked = shopState.checked || {};
      const names = [];
      shopItems().forEach((c) => c.items.forEach((it) => { if (!checked[it.key]) names.push(it.name); }));
      const text = names.join("\n");
      try { await navigator.clipboard.writeText(text); toast(`${names.length} Artikel kopiert`); }
      catch (e) {
        const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); toast(`${names.length} Artikel kopiert`); } catch (_) { toast("Kopieren nicht möglich"); }
        ta.remove();
      }
    };
    $("#addForm").onsubmit = (e) => {
      e.preventDefault();
      const v = $("#addInput").value.trim(); if (!v) return;
      Sync.addItem(week.id, v); $("#addInput").value = "";
    };
  }

  async function start() {
    bind();
    setTab(tab);
    const mode = await Sync.init();
    $("#syncBanner").hidden = mode !== "local";
    try {
      const idx = await getJSON("weeks/index.json");
      weeks = idx.weeks || [];
    } catch (e) { weeks = []; }
    if (!weeks.length) {
      $("#weekLabel").textContent = "Keine Wochen";
      $("#dayContent").innerHTML = `<p class="empty">Noch keine Wochenpläne vorhanden.</p>`;
      return;
    }
    $("#weekSelect").innerHTML = weeks.map((w) => `<option value="${esc(w.id)}">${esc(w.label)}</option>`).join("");
    await loadWeek(pickDefaultWeek());
  }

  if ("serviceWorker" in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
  start();
})();
