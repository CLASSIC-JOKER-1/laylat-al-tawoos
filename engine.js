/* Shared engine of both desks. A desk is plain HTML: <section class="tab"> pages holding <div class="list"> of <article class="item">.
   build.py swaps every data-answer for a hash and encrypts <template data-enc> blocks; the key of a block is what the players type. */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ROLE = document.body.dataset.role;                       // "a" or "b": keeps the two desks' progress apart on one device
const store = {
  get(k, d) { try { const v = localStorage.getItem('fx_' + ROLE + '_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('fx_' + ROLE + '_' + k, JSON.stringify(v)); } catch (e) {} },
};
const norm = (s) => String(s).trim().toLowerCase().replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[أإآ]/g, 'ا').replace(/[\s\-_.\/]/g, '');
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; };
function decrypt(b64, key) {                                   // xorshift keystream seeded by the answer; "OK!" proves the key
  let x = hash(key) || 1;
  const raw = atob(b64), out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; out[i] = raw.charCodeAt(i) ^ (x & 255); }
  const txt = new TextDecoder().decode(out);
  return txt.startsWith('OK!') ? txt.slice(3) : null;
}
const unlocked = () => store.get('locks', {}), seen = () => store.get('seen', {});
const say = (msg) => { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(say.t); say.t = setTimeout(() => t.hidden = true, 3200); };

/* ---------- tabs ---------- */
function buildNav() {
  const nav = $('#nav'); nav.innerHTML = '';
  $$('main > section.tab').forEach(sec => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.tab = sec.id;
    const fresh = $$('.item', sec).some(it => it.dataset.fresh && !seen()[it.dataset.id]);
    b.innerHTML = `<span class="ico">${sec.dataset.ico}</span><span>${sec.dataset.title}</span>${fresh ? '<i class="dot"></i>' : ''}`;
    b.onclick = () => showTab(sec.id);
    nav.appendChild(b);
  });
  showTab(store.get('tab', 'file'));
}
function showTab(id) {
  if (!document.getElementById(id)) id = 'file';
  $$('main > section.tab').forEach(s => s.hidden = s.id !== id);
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === id));
  $$('video').forEach(v => v.pause());
  store.set('tab', id); window.scrollTo(0, 0);
}

/* ---------- locks (hash only: the content is in the page, hidden until the code matches) ---------- */
function askLock(el, then) {
  const id = el.dataset.lockid;
  if (unlocked()[id]) return then();
  const box = $('#lock'); box.hidden = false;
  $('#lock h3').textContent = el.dataset.prompt; $('#lock p').textContent = el.dataset.hint || '';
  const inp = $('#lock input'); inp.value = ''; inp.focus(); $('#lock .err').textContent = '';
  $('#lock form').onsubmit = (e) => {
    e.preventDefault();
    if (hash(norm(inp.value)) === +el.dataset.h) { const u = unlocked(); u[id] = 1; store.set('locks', u); box.hidden = true; say('انفتح القفل'); render(); then(); }
    else { $('#lock .err').textContent = 'الرمز غير صحيح.'; store.set('fails', store.get('fails', 0) + 1); }
  };
  $('#lock .x').onclick = () => box.hidden = true;
}

/* ---------- lists, reader, cameras ---------- */
function lockTabs() {
  $$('section.tab[data-lockid]').forEach(sec => {             // a whole tab behind a login (the laptop)
    const open = !!unlocked()[sec.dataset.lockid];
    $$(':scope > *', sec).forEach(c => { if (!c.classList.contains('login')) c.hidden = !open; });
    let lg = $(':scope > .login', sec);
    if (!lg) { lg = document.createElement('div'); lg.className = 'login'; sec.prepend(lg); }
    lg.hidden = open;
    lg.innerHTML = `<div class="avatar">👩🏻</div><b>${sec.dataset.prompt}</b><small>${sec.dataset.hint}</small><button type="button" class="btn">إدخال كلمة السر</button>`;
    $('button', lg).onclick = () => askLock(sec, () => {});
  });
}
function render() {
  $$('.list').forEach(list => {
    let menu = list.previousElementSibling;
    if (!menu || !menu.classList.contains('menu')) { menu = document.createElement('div'); menu.className = 'menu'; list.before(menu); }
    menu.innerHTML = '';
    $$(':scope > .item', list).forEach((it, i) => {
      it.dataset.id = it.dataset.id || (list.id || list.closest('section').id) + i + it.dataset.title;
      const locked = it.dataset.lockid && !unlocked()[it.dataset.lockid];
      const b = document.createElement('button'); b.type = 'button'; b.className = 'card' + (it.dataset.img ? ' pic' : '');
      b.innerHTML = (it.dataset.img ? `<img src="${it.dataset.img}" alt="" loading="lazy">` : `<span class="kind">${locked ? '🔒' : it.dataset.kind || '📄'}</span>`) +
        `<span class="tt"><b>${it.dataset.title}</b><small>${it.dataset.sub || ''}</small></span>` +
        (it.dataset.fresh && !seen()[it.dataset.id] ? '<i class="new">جديد</i>' : '');
      b.onclick = () => { const go = () => it.classList.contains('cam') ? play(it, list) : read(it); locked ? askLock(it, go) : go(); };
      menu.appendChild(b);
    });
  });
  lockTabs();                                                  // after the menus exist, so a locked tab hides them too
}
function mark(it) { const s = seen(); if (!s[it.dataset.id]) { s[it.dataset.id] = 1; store.set('seen', s); render(); buildNavDots(); } }
function buildNavDots() { $$('#nav button').forEach(b => { const sec = document.getElementById(b.dataset.tab); const d = $('.dot', b); const fresh = $$('.item', sec).some(it => it.dataset.fresh && !seen()[it.dataset.id]); if (d && !fresh) d.remove(); }); }
function read(it) {
  const r = $('#reader');
  $('#reader .head b').textContent = it.dataset.title; $('#reader .head small').textContent = it.dataset.sub || '';
  $('#reader .body').innerHTML = (it.dataset.img ? `<img class="portrait" src="${it.dataset.img}" alt="">` : '') + it.innerHTML;
  $('#reader .body').className = 'body ' + (it.dataset.paper || 'paper');
  r.hidden = false; $('#reader .body').scrollTop = 0; document.body.classList.add('noscroll');
  history.pushState({ reader: 1 }, ''); mark(it);
  $$('#reader .list').forEach(l => l.remove());                // nested lists are not supported inside the reader
}
function closeReader() { const r = $('#reader'); if (r.hidden) return; $$('audio,video', r).forEach(m => m.pause()); r.hidden = true; document.body.classList.remove('noscroll'); }
window.addEventListener('popstate', closeReader);
function play(it, list) {
  const p = list.closest('section').querySelector('.player'), v = $('video', p);
  v.src = it.dataset.src; $('.cap', p).innerHTML = `<b>${it.dataset.title}</b> · ${it.dataset.sub || ''}<div>${it.innerHTML}</div>`;
  p.hidden = false; v.play().catch(() => {}); p.scrollIntoView({ behavior: 'smooth', block: 'start' }); mark(it);
}

/* ---------- gates (really encrypted: the answer is the key) ---------- */
function applyBlock(html) {
  const box = document.createElement('div'); box.innerHTML = html;
  [...box.children].forEach(ch => {
    if (ch.dataset.replace) $(ch.dataset.replace).innerHTML = ch.innerHTML;
    else if (ch.dataset.into) { const t = $(ch.dataset.into); [...ch.children].forEach(c => { c.dataset.fresh = 1; t.appendChild(c); }); }
    else $('main').appendChild(ch);
  });
}
function openGate(name, key, quiet) {
  const blk = $(`script[data-enc="${name}"]`); if (!blk) return false;
  const html = decrypt(blk.textContent.trim(), key); if (html === null) return false;
  blk.remove(); applyBlock(html);
  const k = store.get('keys', {}); k[name] = key; store.set('keys', k);
  $$(`form.gate[data-enc="${name}"]`).forEach(f => { f.hidden = true; const ok = document.createElement('p'); ok.className = 'done'; ok.textContent = f.dataset.done || 'تم.'; f.after(ok); });
  wire(); render(); buildNav();
  if (!quiet) { say(document.body.dataset['msg' + name] || document.body.dataset.msg || 'وصلت أدلة جديدة'); showTab(document.body.dataset['go' + name] || document.body.dataset.go || 'file'); }
  return true;
}
function wire() {
  $$('form.gate').forEach(f => {
    if (f.dataset.wired) return; f.dataset.wired = 1;
    f.onsubmit = (e) => {
      e.preventDefault();
      const fields = $$('[name]', f), vals = fields.map(x => norm(x.value));
      if (vals.some(v => !v)) return say('أكملوا كل الخانات أولاً');
      const base = f.dataset.base ? store.get('keys', {})[f.dataset.base] + '|' : '';
      if (openGate(f.dataset.enc, base + vals.join('|'))) return;
      store.set('fails', store.get('fails', 0) + 1);
      const bad = fields.filter(x => x.dataset.h && hash(norm(x.value)) !== +x.dataset.h).map(x => x.dataset.label);
      $('.fb', f).innerHTML = '<b>' + (f.dataset.fail || 'غير صحيح.') + '</b>' + (bad.length ? '<br>راجعوا: ' + bad.join('، ') : '');
    };
  });
  $$('details.hint').forEach(d => { if (d.dataset.wired) return; d.dataset.wired = 1; d.addEventListener('toggle', () => { if (d.open) { const h = store.get('hints', {}); h[d.dataset.k || d.textContent.slice(0, 20)] = 1; store.set('hints', h); } }); });
  const pin = $('#pin'); if (pin && !pin.dataset.wired) { pin.dataset.wired = 1; pin.onsubmit = (e) => { e.preventDefault(); dropPin(+$('#lat').value.replace(',', '.'), +$('#lon').value.replace(',', '.')); }; }
  const note = $('#notes'); if (note && !note.dataset.wired) { note.dataset.wired = 1; note.value = store.get('notes', ''); note.oninput = () => store.set('notes', note.value); }
  const st = $('#stars'); if (st) st.innerHTML = rating();
}
function dropPin(lat, lon) {                                   // the map is drawn with these bounds in b.html
  const m = $('#mapsvg'), B = m.dataset.bounds.split(',').map(Number);          // latTop, latBottom, lonLeft, lonRight
  if (!(lat <= B[0] && lat >= B[1] && lon >= B[2] && lon <= B[3])) return say('الإحداثيات خارج الخريطة');
  const vb = m.viewBox.baseVal, x = (lon - B[2]) / (B[3] - B[2]) * vb.width, y = (B[0] - lat) / (B[0] - B[1]) * vb.height;
  $('#pinmark', m).setAttribute('transform', `translate(${x} ${y})`); $('#pinmark', m).removeAttribute('display');
  say('انحط الدبوس على الخريطة');
}
function rating() {
  const mins = Math.round((Date.now() - store.get('t0', Date.now())) / 60000), hints = Object.keys(store.get('hints', {})).length, fails = store.get('fails', 0);
  const stars = Math.max(1, 5 - (mins > (+document.body.dataset.par || 180) ? 1 : 0) - Math.min(2, Math.floor(hints / 2)) - Math.min(2, Math.floor(fails / 3)));
  return `<div class="starrow">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</div><small>الوقت: ${Math.floor(mins / 60)} س ${mins % 60} د · تلميحات: ${hints} · محاولات خاطئة: ${fails}</small>`;
}

/* ---------- start ---------- */
if (!store.get('t0')) store.set('t0', Date.now());
setInterval(() => { const s = Math.floor((Date.now() - store.get('t0', Date.now())) / 1000); $('#clock').textContent = [s / 3600, s / 60 % 60, s % 60].map(n => String(Math.floor(n)).padStart(2, '0')).join(':'); }, 1000);
$('#reader .x').onclick = () => history.back();
const keys = store.get('keys', {});
Object.keys(keys).forEach(n => openGate(n, keys[n], true));      // reload: reopen what was already earned, in the order it was earned
wire(); render(); buildNav();
$('#reset').onclick = () => { if ($('#reset').dataset.sure) { try { Object.keys(localStorage).filter(k => k.startsWith('fx_' + ROLE + '_')).forEach(k => localStorage.removeItem(k)); } catch (e) {} location.reload(); } else { $('#reset').dataset.sure = 1; $('#reset').textContent = 'اضغط مرة ثانية للتأكيد: يمسح كل تقدّمك'; } };
