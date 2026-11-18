import {
  CATEGORY_CHOICES, CUISINE_CHOICES, OCCASION_CHOICES, NOVELTY_CHOICES, ADVENTURE_CHOICES, DIET_CHOICES, DUELS, CUISINE_CZ, TAG_CZ,
  emptyProfile, newState, next, swipe, undo, priorWeights, reasons, tasteSummary, eligible, km,
} from './engine.js';
import { PHOTOS, photoKey, photoSrc } from './photos.js';
import { t, lang, setLang, choice, duelText, placesWord, venuesWord, PHOTO_ALT_EN } from './i18n.js';

const PLACES = window.PLACES || [];
const BY_ID = new Map(PLACES.map((p) => [p.id, p]));
const KEY = 'pragueEatsSwipe.v1';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const PHOTO_ALT = {
  ramen: 'ramen', sushi: 'sushi', pizza: 'pizza', pasta: 'těstoviny', burger: 'burger', tacos: 'tacos',
  dumplings: 'knedlíčky', chicken: 'smažené kuře', steak: 'steak', czech: 'svíčková', beer: 'pivo', cocktail: 'koktejl',
  wine: 'víno', coffee: 'káva', pastry: 'croissant', cake: 'dort', brunch: 'brunch', seafood: 'ústřice', tapas: 'tapas',
  fine: 'degustační chod', hotpot: 'hot pot', curry: 'kari', pho: 'pho', hummus: 'hummus', grill: 'čevapčiči',
  sichuan: 'mapo tofu', sandwich: 'sendvič', salad: 'zeleninová miska', kbbq: 'korejský gril', noodles: 'nudle',
  dosa: 'dosa', schnitzel: 'řízek',
};
const occLabel = (id) => { const o = OCCASION_CHOICES.find((x) => x.id === id); return o ? choice('occasion', o).label : ''; };
const photoAlt = (key) => (lang === 'en' ? PHOTO_ALT_EN : PHOTO_ALT)[key] || (lang === 'en' ? 'food' : 'jídlo');
const num = (x, d = 1) => (lang === 'en' ? x.toFixed(d) : x.toFixed(d).replace('.', ','));
const tag = (x) => (lang === 'en' ? x : TAG_CZ[x] || x);
const HOODS = (() => {
  const c = {};
  PLACES.forEach((p) => p.neighborhood && (c[p.neighborhood] = (c[p.neighborhood] || 0) + 1));
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
})();
const HOOD_CZ = {
  'Nove Mesto': 'Nové Město', 'Stare Mesto': 'Staré Město', Zizkov: 'Žižkov', 'Mala Strana': 'Malá Strana', Karlin: 'Karlín',
  Holesovice: 'Holešovice', Liben: 'Libeň', Bubenec: 'Bubeneč', Smichov: 'Smíchov', Hradcany: 'Hradčany',
  Vrsovice: 'Vršovice', Vysehrad: 'Vyšehrad', Brevnov: 'Břevnov', Pisnice: 'Písnice', Kosire: 'Košíře',
  'Vysoky Ujezd': 'Vysoký Újezd', Veleslavin: 'Veleslavín', Strasnice: 'Strašnice',
};
const hood = (h) => HOOD_CZ[h] || h || '';
const cuisine = (c) => { const s = (lang === 'en' ? c : CUISINE_CZ[c] || c) || ''; return s.charAt(0).toUpperCase() + s.slice(1); };
const mapsUrl = (p) => (p.googleCid ? `https://maps.google.com/?cid=${encodeURIComponent(p.googleCid)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.address || 'Praha'}`)}`);

// ---------- state ----------
let S = null; // engine state
let queue = []; // upcoming picks, [0] is the top card
let onb = null; // onboarding draft

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) S = JSON.parse(raw);
  } catch {}
  if (S && (!S.profile || !S.weights)) S = null;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch {}
}

// ---------- deck ----------
function fillQueue() {
  const ids = queue.map((q) => q.place.id);
  while (queue.length < 3) {
    const tmp = { ...S, seen: [...S.seen, ...ids], recentCuisines: [...S.recentCuisines, ...queue.map((q) => q.place.cuisine)] };
    const pick = next(PLACES, tmp);
    if (!pick) break;
    queue.push(pick);
    ids.push(pick.place.id);
  }
}

function spires(n) {
  if (!n) return '';
  return `<span class="spires" title="${esc(t('review.spires', { n }))}" role="img" aria-label="${esc(t('review.spires', { n }))}">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
}

// The list authors' own review: rating in spires with its verdict, their note, who tipped them off.
function reviewHtml(p, compact = false) {
  const head = p.rating
    ? `${spires(p.rating)}<b class="review-verdict">${esc(t('spire.' + p.rating))}</b>`
    : p.status === 'want' && !p.note ? `<span class="review-pending">${esc(t('review.notYet'))}</span>` : '';
  if (!head && !p.note && !p.recommendedBy) return '';
  return `<figure class="review${compact ? ' compact' : ''}">
    <figcaption class="review-head"><span class="review-label">${esc(t('review.label'))}</span>${head ? `<span class="review-rating">${head}</span>` : ''}</figcaption>
    ${p.note ? `<blockquote class="note" lang="en">${esc(p.note)}</blockquote>` : ''}
    ${p.recommendedBy && !compact ? `<p class="review-tip">${esc(t('review.tip', { x: p.recommendedBy }))}</p>` : ''}
  </figure>`;
}

function cardHtml(pick, i) {
  const p = pick.place;
  const key = photoKey(p);
  const why = reasons(pick, lang);
  const dist = pick.dist != null ? `${pick.dist < 1 ? Math.round(pick.dist * 1000) + ' m' : num(pick.dist) + ' km'}` : '';
  const tags = (p.tags || []).slice(0, 3).map((x) => `<span class="chip">${esc(tag(x))}</span>`).join('');
  return `
  <article class="card ${i === 1 ? 'behind' : i === 2 ? 'behind-2' : 'is-top'}" data-id="${esc(p.id)}" ${i ? 'aria-hidden="true"' : 'tabindex="-1" aria-label="' + esc(p.name) + '"'}>
    <div class="card-photo">
      <img src="${photoSrc(key)}" alt="${esc(t('card.photoAlt', { x: photoAlt(key) }))}" draggable="false" ${i ? 'loading="lazy"' : ''}>
      <span class="photo-pill">${esc(t('card.illustrative'))}</span>
      ${p.status === 'been' ? `<span class="status-pill">${esc(t('card.been'))}</span>` : p.status === 'want' ? `<span class="status-pill want">${esc(t('card.want'))}</span>` : ''}
      <div class="photo-name"><h2>${esc(p.name)}</h2></div>
      <span class="stamp stamp-like">${esc(t('stamp.like'))}</span>
      <span class="stamp stamp-nope">${esc(t('stamp.nope'))}</span>
      <span class="stamp stamp-super">${esc(t('stamp.super'))}</span>
    </div>
    <div class="card-body">
      <p class="why ${pick.wildcard ? 'wild' : ''}">
        <svg viewBox="0 0 24 24" aria-hidden="true">${pick.wildcard ? '<path d="M4 17l6-6 4 4 6-6M14 9h6v6"/>' : '<path d="M5 12l4 4 10-10"/>'}</svg>
        <span>${pick.wildcard ? esc(t('why.wild')) : why.length ? esc(t('why.match', { x: why.join(' · ') })) : esc(t('why.popular'))}</span>
      </p>
      <p class="meta"><b>${esc(cuisine(p.cuisine))}</b><span>${esc(hood(p.neighborhood))}</span>${p.occasion ? `<span>${esc(occLabel(p.occasion))}</span>` : ''}${dist ? `<span>${dist}</span>` : ''}</p>
      ${reviewHtml(p)}
      ${tags ? `<div class="chips">${tags}</div>` : ''}
      <div class="more">
        ${p.address ? `<p class="addr">${esc(p.address.replace(/,?\s*\d{3}\s?\d{2}.*$/, ''))}</p>` : ''}
        <a class="maps" href="${mapsUrl(p)}" target="_blank" rel="noopener">${esc(t('card.openMaps'))}</a>
      </div>
    </div>
  </article>`;
}

function renderDeck(promote = false) {
  const deck = $('[data-deck]');
  fillQueue();
  if (!queue.length) {
    deck.innerHTML = `
      <div class="empty">
        <h2>${esc(t('empty.title'))}</h2>
        <p>${esc(t('empty.text'))}</p>
        ${S.profile.radius && S.profile.nearMe ? `<button class="btn btn-primary" type="button" data-radius-open>${esc(t('empty.radius'))}</button>` : ''}
        <button class="btn ${S.profile.radius && S.profile.nearMe ? 'btn-ghost' : 'btn-primary'}" type="button" data-edit-prefs>${esc(t('prefs.edit'))}</button>
        <button class="btn btn-ghost" type="button" data-recycle>${esc(t('empty.recycle'))}</button>
      </div>`;
    syncActions();
    return;
  }
  deck.innerHTML = queue.slice(0, 3).map((q, i) => cardHtml(q, i)).reverse().join('');
  const top = $('.card.is-top', deck);
  if (promote && top) {
    top.animate([{ transform: 'scale(.95) translateY(14px)' }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  bindDrag(top);
  syncActions();
}

function syncActions() {
  const has = queue.length > 0;
  $$('[data-act="nope"], [data-act="like"], [data-act="super"], [data-act="info"]').forEach((b) => (b.disabled = !has));
  $('[data-act="undo"]').disabled = !S?.history?.length;
}

// ---------- drag ----------
let drag = null;
function bindDrag(card) {
  if (!card) return;
  card.addEventListener('pointerdown', (e) => {
    // While the radius panel is open, a tap on the card only closes the panel.
    if (e.button !== 0 || e.target.closest('a, button') || !$('[data-radius-panel]').hidden) return;
    card.setPointerCapture(e.pointerId);
    drag = { card, x0: e.clientX, y0: e.clientY, t0: performance.now(), dx: 0, dy: 0, moved: false };
    card.classList.add('dragging');
    card.classList.remove('settle');
  });
  card.addEventListener('pointermove', (e) => {
    if (!drag || drag.card !== card) return;
    drag.dx = e.clientX - drag.x0;
    drag.dy = e.clientY - drag.y0;
    if (Math.hypot(drag.dx, drag.dy) > 6) drag.moved = true;
    paintDrag(card, drag.dx, drag.dy);
  });
  const end = (e) => {
    if (!drag || drag.card !== card) return;
    const { dx, dy, t0, moved } = drag;
    drag = null;
    card.classList.remove('dragging');
    const w = card.offsetWidth, h = card.offsetHeight;
    const dt = Math.max(1, performance.now() - t0);
    const vx = dx / dt, vy = dy / dt;
    if (!moved && e.type === 'pointerup') return toggleInfo();
    if (dy < -h * 0.18 && Math.abs(dy) > Math.abs(dx) * 1.2) return fly('super');
    if (dy < -60 && vy < -0.6 && Math.abs(dy) > Math.abs(dx)) return fly('super');
    if (dx > w * 0.28 || (dx > 50 && vx > 0.55)) return fly('like');
    if (dx < -w * 0.28 || (dx < -50 && vx < -0.55)) return fly('nope');
    card.classList.add('settle');
    paintDrag(card, 0, 0);
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
}

function paintDrag(card, dx, dy) {
  card.style.transform = dx || dy ? `translate(${dx}px, ${dy}px) rotate(${dx * 0.06}deg)` : '';
  const up = -dy > Math.abs(dx) ? Math.min(1, -dy / 120) : 0;
  $('.stamp-like', card).style.opacity = up ? 0 : Math.max(0, Math.min(1, dx / 110));
  $('.stamp-nope', card).style.opacity = up ? 0 : Math.max(0, Math.min(1, -dx / 110));
  $('.stamp-super', card).style.opacity = up;
}

let busy = false;
function fly(action) {
  const card = $('.card.is-top');
  if (!card || busy || !queue.length) return;
  busy = true;
  const vw = window.innerWidth, vh = window.innerHeight;
  const tx = action === 'like' ? vw * 1.1 : action === 'nope' ? -vw * 1.1 : 0;
  const ty = action === 'super' ? -vh * 1.1 : 40;
  const rot = action === 'like' ? 22 : action === 'nope' ? -22 : 0;
  paintDrag(card, action === 'like' ? 120 : action === 'nope' ? -120 : 0, action === 'super' ? -140 : 0);
  card.classList.remove('settle');
  card.classList.add('fly');
  requestAnimationFrame(() => {
    card.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
    card.style.opacity = '0';
  });
  const done = () => {
    commit(action);
    busy = false;
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(done, reduced ? 10 : 360);
}

function commit(action) {
  const pick = queue.shift();
  swipe(S, pick.place, action);
  save();
  renderDeck(true);
  renderSide();
  renderCounts();
  if (action !== 'nope') toast(t(action === 'super' ? 'toast.super' : 'toast.saved', { x: pick.place.name }));
}

function doUndo() {
  const id = undo(S);
  if (!id) return;
  save();
  queue.unshift({ place: BY_ID.get(id), parts: [], total: 0, dist: null, wildcard: false });
  // Recompute the reason line for the returned card with the reverted weights.
  const p = BY_ID.get(id);
  const tmp = next([p], { ...S, seen: [] }, () => 0.5);
  if (tmp) queue[0] = { ...tmp, wildcard: false };
  queue = queue.slice(0, 3);
  renderDeck();
  renderSide();
  renderCounts();
  toast(t('toast.undo'));
}

function toggleInfo() {
  const card = $('.card.is-top');
  if (card) card.classList.toggle('open');
}

// ---------- side panels, saved, taste ----------
function barsHtml(list, neg = false) {
  if (!list.length) return `<p class="muted">${esc(t(neg ? 'bars.emptyDislikes' : 'bars.emptyLikes'))}</p>`;
  const max = Math.max(...list.map(([, v]) => Math.abs(v)));
  return `<div class="bars ${neg ? 'neg' : ''}">${list
    .map(([l, v]) => `<div class="bar"><span>${esc(l.charAt(0).toUpperCase() + l.slice(1))}</span><span class="bar-track"><i style="width:${Math.round((Math.abs(v) / max) * 100)}%"></i></span></div>`)
    .join('')}</div>`;
}

function filterChips(pr = S.profile) {
  const out = [];
  const lab = (arr, group, id) => { const c = arr.find((x) => x.id === id); return c ? choice(group, c).label : id; };
  pr.categories.forEach((c) => out.push(lab(CATEGORY_CHOICES, 'category', c)));
  pr.occasions.forEach((o) => out.push(lab(OCCASION_CHOICES, 'occasion', o)));
  if (pr.novelty !== 'any') out.push(t('filters.places', { x: lab(NOVELTY_CHOICES, 'novelty', pr.novelty) }));
  pr.hoods.forEach((h) => out.push(hood(h)));
  if (pr.nearMe && pr.pos && pr.radius) out.push(t('filters.radius', { r: fmtKm(pr.radius) }));
  if (ADVENTURE_CHOICES.some((a) => a.id === pr.adventure)) out.unshift(lab(ADVENTURE_CHOICES, 'adventure', pr.adventure));
  if (pr.diet && pr.diet !== 'all') out.unshift(lab(DIET_CHOICES, 'diet', pr.diet));
  pr.avoid.forEach((a) => out.push(t('filters.without', { x: lab(CUISINE_CHOICES, 'cuisine', a).toLowerCase() })));
  return out.length ? out.map((x) => `<span class="chip">${esc(x)}</span>`).join('') : `<span class="muted">${esc(t('filters.none'))}</span>`;
}

function savedThumb(p) {
  return photoSrc(photoKey(p)).replace('-960.jpg', '-500.jpg');
}

function renderSide() {
  renderRadius(); // keeps the "places left" count in the radius panel current after every swipe
  const ts = tasteSummary(S.weights, 6, lang);
  $('[data-taste-mini]').innerHTML = barsHtml(ts.likes);
  $$('[data-filters]').forEach((el) => (el.innerHTML = filterChips()));
  const recent = S.liked.slice(0, 5).map((l) => BY_ID.get(l.id)).filter(Boolean);
  $('[data-saved-mini]').innerHTML = recent.length
    ? recent.map((p) => `<li><a href="${mapsUrl(p)}" target="_blank" rel="noopener"><img src="${savedThumb(p)}" alt="" loading="lazy"><span><b>${esc(p.name)}</b><small>${esc(cuisine(p.cuisine))} · ${esc(hood(p.neighborhood))}</small></span></a></li>`).join('')
    : `<li class="muted">${esc(t('side.savedEmpty'))}</li>`;
}

function renderCounts() {
  $$('[data-saved-count]').forEach((el) => {
    el.textContent = S.liked.length;
    el.toggleAttribute('data-zero', !S.liked.length);
  });
}

let savedFilter = 'all';
function renderSaved() {
  const list = S.liked.filter((l) => savedFilter === 'all' || l.super).map((l) => [l, BY_ID.get(l.id)]).filter(([, p]) => p);
  const star = `<svg viewBox="0 0 24 24" role="img" aria-label="${esc(t('star.aria'))}"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>`;
  $('[data-saved-list]').innerHTML = list.length
    ? list
        .map(([l, p]) => `
      <li class="saved-item">
        <div class="thumb"><img src="${savedThumb(p)}" alt="" loading="lazy"></div>
        <div>
          <h3>${esc(p.name)} ${l.super ? star : ''}</h3>
          <p class="meta"><b>${esc(cuisine(p.cuisine))}</b><span>${esc(hood(p.neighborhood))}</span>${p.occasion ? `<span>${esc(occLabel(p.occasion))}</span>` : ''}</p>
          ${reviewHtml(p, true)}
          <div class="row">
            <a href="${mapsUrl(p)}" target="_blank" rel="noopener" title="${esc(t('saved.mapsTitle'))}">${esc(t('saved.mapsBtn'))}</a>
            <button type="button" data-unsave="${esc(p.id)}">${esc(t('saved.remove'))}</button>
          </div>
        </div>
      </li>`)
        .join('')
    : `<li class="saved-empty">${esc(t(savedFilter === 'super' ? 'saved.emptySuper' : 'saved.empty'))}</li>`;
}

function renderTaste() {
  const ts = tasteSummary(S.weights, 8, lang);
  $('[data-taste-likes]').innerHTML = barsHtml(ts.likes);
  $('[data-taste-dislikes]').innerHTML = barsHtml(ts.dislikes, true);
  const left = eligible(PLACES, S.profile, new Set(S.seen)).length;
  $('[data-stats]').innerHTML = `
    <div><dt>${esc(t('stats.swiped'))}</dt><dd>${S.count}</dd></div>
    <div><dt>${esc(t('stats.saved'))}</dt><dd>${S.liked.length}</dd></div>
    <div><dt>${esc(t('stats.left'))}</dt><dd>${left}</dd></div>`;
  $('[data-filters-full]').innerHTML = filterChips();
}

// ---------- tabs ----------
function route() {
  const tab = (location.hash || '#swipe').slice(1);
  const name = ['swipe', 'saved', 'taste'].includes(tab) ? tab : 'swipe';
  $$('[data-view]').forEach((v) => (v.hidden = v.dataset.view !== name));
  $$('[data-tab]').forEach((a) => (a.dataset.tab === name && !a.classList.contains('brand') ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  if (!S) return;
  if (name === 'saved') renderSaved();
  if (name === 'taste') renderTaste();
  window.scrollTo(0, 0);
}

// ---------- onboarding: a short Duolingo-style quiz ----------
// One question per screen, big tappable answers, instant feedback, then the next one.
// Every answer feeds priorWeights() in engine.js, so the deck starts tuned to this person.
const ALL_STEPS = [
  { type: 'intro' },
  { type: 'adventure' },
  { type: 'diet' },
  { type: 'categories' },
  ...DUELS.map((duel) => ({ type: 'duel', duel })),
  { type: 'avoid' },
  { type: 'occasion' },
  { type: 'where' },
  { type: 'done' },
];
// Vegetarians and vegans skip the duels where both sides are meat or fish.
let STEPS = ALL_STEPS;
let QUESTIONS = 0;
function syncSteps() {
  const veg = onb && (onb.p.diet || 'all') !== 'all';
  STEPS = ALL_STEPS.filter((s) => !(veg && s.duel?.meatOnly));
  QUESTIONS = STEPS.filter((s) => s.type !== 'intro' && s.type !== 'done').length;
}
syncSteps();

function openOnb(fromEdit = false) {
  onb = { step: fromEdit ? 1 : 0, edit: fromEdit, p: { ...emptyProfile(), ...structuredClone(S?.profile || {}) }, feedback: null };
  $('[data-onb]').hidden = false;
  ['.top', 'main', '.bottom-tabs'].forEach((s) => $(s)?.setAttribute('inert', ''));
  document.body.style.overflow = 'hidden';
  renderOnb();
}
function closeOnb() {
  $('[data-onb]').hidden = true;
  ['.top', 'main', '.bottom-tabs'].forEach((s) => $(s)?.removeAttribute('inert'));
  document.body.style.overflow = '';
}

function countFor(profile) {
  return eligible(PLACES, profile, new Set()).length;
}

function opt(id, label, on, extra = '', cls = '') {
  return `<button type="button" class="opt ${cls}" data-opt="${esc(id)}" aria-pressed="${on}">${esc(label)}${extra}</button>`;
}

const EMOJI_CAT = { restaurant: '🍽️', brunch: '🥞', cafe: '☕', bakery: '🥐', bar: '🍸' };
const EMOJI_OCC = { quick: '⚡', everyday: '🍲', nice: '🕯️', special: '🥂' };

function questionNo(step) {
  return STEPS.slice(0, step + 1).filter((s) => s.type !== 'intro' && s.type !== 'done').length;
}

function renderOnb() {
  syncSteps();
  const { step, p, feedback } = onb;
  const st = STEPS[step];
  const body = $('[data-onb-body]');
  const foot = $('[data-onb-foot]');
  const qn = questionNo(step);
  $('[data-onb-progress]').style.width = `${st.type === 'done' ? 100 : (Math.max(0, qn - (feedback ? 0 : 1)) / QUESTIONS) * 100}%`;
  $('[data-onb-top]').hidden = st.type === 'intro';
  $('[data-onb-back]').style.visibility = step <= 1 && onb.edit ? 'hidden' : 'visible';
  $('[data-onb-skip]').style.visibility = st.type === 'done' ? 'hidden' : 'visible';
  const nextBtn = $('[data-onb-next]');
  const single = st.type === 'adventure' || st.type === 'duel' || st.type === 'diet';
  // Editing preferences: a question answered before can be kept with Continue.
  const kept = onb.edit && (st.type === 'adventure' ? !!p.adventure : st.type === 'diet' ? !!p.diet : st.type === 'duel' ? !!p.duels[st.duel.id] : false);
  nextBtn.textContent = t(st.type === 'intro' ? 'onb.start' : st.type === 'done' ? 'onb.finish' : feedback || kept ? 'onb.continue' : single ? 'onb.pick' : 'onb.continue');
  const n = countFor(p);
  nextBtn.disabled = (single && !feedback && !kept) || (st.type !== 'intro' && n === 0);
  foot.classList.toggle('is-feedback', !!feedback);
  $('[data-onb-msg]').innerHTML = feedback
    ? `<span class="fb-emoji" aria-hidden="true">${feedback.emoji}</span><span><b>${esc(feedback.title)}</b><span>${esc(feedback.text)}</span></span>`
    : st.type === 'intro' || st.type === 'done' || single ? '' : `<span class="onb-count">${t('onb.count', { n, total: PLACES.length })}</span>`;
  const k = st.type === 'done' || st.type === 'intro' ? '' : `<p class="onb-kicker">${esc(t('onb.q', { n: qn, total: QUESTIONS }))}</p>`;
  const countBy = (fn) => PLACES.filter(fn).length;
  let html = '';
  if (st.type === 'intro') {
    const pics = ['ramen', 'czech', 'cocktail'].map((key) => `<img src="${photoSrc(key)}" alt="${esc(t('card.photoAlt', { x: photoAlt(key) }))}">`).join('');
    html = `
      <div class="lang-seg" role="group" aria-label="${esc(t('onb.langAria'))}">
        <button type="button" data-set-lang="cs" aria-pressed="${lang === 'cs'}" lang="cs">Čeština</button>
        <button type="button" data-set-lang="en" aria-pressed="${lang === 'en'}" lang="en">English</button>
      </div>
      <div class="intro-art">${pics}</div>
      <div class="bubble"><span class="bubble-emoji" aria-hidden="true">🥟</span><p>${esc(t('onb.bubble', { n: QUESTIONS }))}</p></div>
      <h1 id="onb-title">${esc(t('onb.introTitle'))}</h1>
      <p class="lead">${t('onb.introLead', { n: PLACES.length })}</p>`;
  } else if (st.type === 'adventure') {
    html = `${k}<h1 id="onb-title">${esc(t('onb.adventure'))}</h1>
      <div class="answers" data-single-group="adventure">${ADVENTURE_CHOICES.map((a, i) => `
        <button type="button" class="answer" data-answer="${a.id}" aria-pressed="${p.adventure === a.id && (!!feedback || onb.edit)}">
          <span class="answer-emoji" aria-hidden="true">${a.emoji}</span>
          <span class="answer-text"><b>${esc(choice('adventure', a).label)}</b><em>${esc(choice('adventure', a).hint)}</em></span>
          <kbd aria-hidden="true">${i + 1}</kbd>
        </button>`).join('')}</div>`;
  } else if (st.type === 'diet') {
    html = `${k}<h1 id="onb-title">${esc(t('onb.diet'))}</h1>
      <div class="answers">${DIET_CHOICES.map((a, i) => `
        <button type="button" class="answer" data-diet="${a.id}" aria-pressed="${(p.diet || 'all') === a.id && (!!feedback || onb.edit)}">
          <span class="answer-emoji" aria-hidden="true">${a.emoji}</span>
          <span class="answer-text"><b>${esc(choice('diet', a).label)}</b><em>${esc(choice('diet', a).hint)}</em></span>
          <kbd aria-hidden="true">${i + 1}</kbd>
        </button>`).join('')}</div>`;
  } else if (st.type === 'categories') {
    html = `${k}<h1 id="onb-title">${esc(t('onb.categories'))}</h1><p class="lead">${esc(t('onb.categoriesLead'))}</p>
      <div class="tiles" data-group="categories">${CATEGORY_CHOICES.map((c) => `
        <button type="button" class="tile" data-opt="${c.id}" aria-pressed="${p.categories.includes(c.id)}">
          <span class="tile-emoji" aria-hidden="true">${EMOJI_CAT[c.id]}</span><b>${esc(choice('category', c).label)}</b><small>${esc(t('onb.venueCount', { n: countBy((x) => x.categories.includes(c.id)) }))}</small>
        </button>`).join('')}</div>`;
  } else if (st.type === 'duel') {
    const d = st.duel;
    const ans = p.duels[d.id];
    const dt = duelText(d);
    const side = (key) => {
      const s = d[key];
      return `<button type="button" class="duel-card" data-duel="${key}" aria-pressed="${ans === key || ans === 'both'}">
        <img src="${photoSrc(s.photo)}" alt="${esc(t('card.photoAlt', { x: photoAlt(s.photo) }))}">
        <b>${esc(dt[key])}</b><kbd aria-hidden="true">${key === 'a' ? 1 : 2}</kbd>
      </button>`;
    };
    html = `${k}<p class="duel-kicker">${esc(t('onb.duelKicker'))}</p><h1 id="onb-title">${esc(dt.q)}</h1>
      <div class="duel">${side('a')}<span class="duel-or" aria-hidden="true">${esc(t('onb.or'))}</span>${side('b')}</div>
      <div class="duel-more">
        <button type="button" class="opt" data-duel="both" aria-pressed="${ans === 'both'}">${esc(t('onb.both'))}</button>
        <button type="button" class="opt" data-duel="none" aria-pressed="${ans === 'none'}">${esc(t('onb.none'))}</button>
      </div>`;
  } else if (st.type === 'avoid') {
    html = `${k}<h1 id="onb-title">${esc(t('onb.avoid'))}</h1><p class="lead">${esc(t('onb.avoidLead'))}</p>
      <div class="opts" data-group="avoid">${CUISINE_CHOICES.map((c) => opt(c.id, choice('cuisine', c).label, p.avoid.includes(c.id), '', 'avoid')).join('')}</div>`;
  } else if (st.type === 'occasion') {
    html = `${k}<h1 id="onb-title">${esc(t('onb.occasion'))}</h1><p class="lead">${esc(t('onb.occasionLead'))}</p>
      <div class="tiles tiles-2" data-group="occasions">${OCCASION_CHOICES.map((o) => `
        <button type="button" class="tile" data-opt="${o.id}" aria-pressed="${p.occasions.includes(o.id)}">
          <span class="tile-emoji" aria-hidden="true">${EMOJI_OCC[o.id]}</span><b>${esc(choice('occasion', o).label)}</b><small>${esc(choice('occasion', o).hint)}</small>
        </button>`).join('')}</div>
      <h2>${esc(t('onb.novelty'))}</h2>
      <div class="opts" data-group="novelty" data-single>${NOVELTY_CHOICES.map((o) => opt(o.id, choice('novelty', o).label, p.novelty === o.id, o.hint ? `<small>${o.id === 'been' ? countBy((x) => x.status === 'been') : countBy((x) => x.status === 'want')}</small>` : '')).join('')}</div>`;
  } else if (st.type === 'where') {
    html = `${k}<h1 id="onb-title">${esc(t('onb.where'))}</h1><p class="lead">${esc(t('onb.whereLead'))}</p>
      <p class="near-note">${esc(t('onb.whereNote'))}</p>
      <h2>${esc(t('onb.hoods'))}</h2>
      <div class="opts" data-group="hoods">${HOODS.slice(0, 14).map(([h, c]) => opt(h, hood(h), p.hoods.includes(h), `<small>${c}</small>`)).join('')}</div>`;
  } else if (st.type === 'done') {
    const ts = tasteSummary(priorWeights(p), 6, lang);
    html = `
      <div class="done-badge" aria-hidden="true">🎉</div>
      <h1 id="onb-title">${esc(t('onb.doneTitle'))}</h1>
      <p class="lead">${t('onb.doneLead', { n })}</p>
      <div class="done-grid">
        <div class="panel"><h2>${esc(t('onb.doneLikes'))}</h2>${barsHtml(ts.likes)}</div>
        <div class="panel"><h2>${esc(t('onb.doneSettings'))}</h2><div class="filters">${filterChips(p)}</div></div>
      </div>`;
  }
  const enter = onb.shown !== step;
  onb.shown = step;
  body.innerHTML = `<div class="onb-step${enter ? " enter" : ""}">${html}</div>`;
  if (enter) $("[data-onb]").scrollTop = 0;
}

function answer(title, text, emoji) {
  onb.feedback = { title, text, emoji };
  renderOnb();
  $('[data-onb-next]').focus();
}

function pickAdventure(id) {
  if (!id || onb.feedback) return;
  onb.p.adventure = id;
  answer(...t('fb.adv.' + id), { safe: '🛋️', some: '🧭', wild: '🌶️' }[id]);
}

function pickDiet(id) {
  if (!id || onb.feedback) return;
  onb.p.diet = id;
  answer(...t('fb.diet.' + id), { all: '🍖', vegetarian: '🥗', vegan: '🌱' }[id]);
}

function pickDuel(pick) {
  if (onb.feedback) return;
  const d = STEPS[onb.step].duel;
  onb.p.duels = { ...onb.p.duels, [d.id]: pick };
  const praise = t('praise')[Math.floor(Math.random() * t('praise').length)];
  if (pick === 'a' || pick === 'b') answer(praise, t('fb.duel', { x: duelText(d)[pick] }), '✅');
  else if (pick === 'both') answer(t('fb.bothT'), t('fb.both'), '😋');
  else answer(t('fb.noneT'), t('fb.none'), '👌');
}

function onbClick(e) {
  const sl = e.target.closest('[data-set-lang]');
  if (sl) return switchLang(sl.dataset.setLang);
  const ans = e.target.closest('[data-answer]');
  if (ans) return pickAdventure(ans.dataset.answer);
  const di = e.target.closest('[data-diet]');
  if (di) return pickDiet(di.dataset.diet);
  const duel = e.target.closest('[data-duel]');
  if (duel) return pickDuel(duel.dataset.duel);
  const b = e.target.closest('[data-opt]');
  if (b) {
    const group = b.closest('[data-group]');
    const key = group.dataset.group;
    const id = b.dataset.opt;
    if (group.hasAttribute('data-single')) onb.p[key] = id;
    else {
      const set = new Set(onb.p[key]);
      set.has(id) ? set.delete(id) : set.add(id);
      onb.p[key] = [...set];
    }
    renderOnb();
    $(`[data-group="${key}"] [data-opt="${CSS.escape(id)}"]`)?.focus();
    return;
  }
}

function onbNext() {
  if (STEPS[onb.step].type === 'done') return finishOnb();
  onb.feedback = null;
  onb.step++;
  renderOnb();
}

function finishOnb() {
  const p = onb.p;
  if (S && onb.edit) {
    // Keep what the swipes taught, swap only the quiz prior.
    const oldPrior = priorWeights(S.profile);
    const newPrior = priorWeights(p);
    const w = { ...S.weights };
    for (const [k, v] of Object.entries(oldPrior)) w[k] = (w[k] || 0) - v;
    for (const [k, v] of Object.entries(newPrior)) w[k] = (w[k] || 0) + v;
    S.profile = p;
    S.weights = w;
  } else {
    S = newState(p);
  }
  save();
  closeOnb();
  queue = [];
  location.hash = '#swipe';
  route();
  renderAll();
  if (locState !== 'ok' && locState !== 'far') locate();
  else renderRadius();
}

function renderAll() {
  renderDeck();
  renderSide();
  renderCounts();
}


// ---------- location & radius ----------
// The app asks for the current position on start; the radius control (top right) filters the deck.
// Test/demo without GPS: ?at=50.0755,14.4378 in the URL.
const PRAGUE = { lat: 50.083, lng: 14.42 };
let locState = 'idle'; // idle | pending | ok | far | denied | unsupported
const fmtKm = (r) => (r < 1 ? `${Math.round(r * 1000)} m` : `${lang === 'en' ? r : String(r).replace('.', ',')} km`);

function locate() {
  const at = new URLSearchParams(location.search).get('at');
  if (at) {
    const [lat, lng] = at.split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return onPos(lat, lng);
  }
  if (!navigator.geolocation) {
    locState = 'unsupported';
    return renderRadius();
  }
  locState = 'pending';
  renderRadius();
  navigator.geolocation.getCurrentPosition(
    (pos) => onPos(pos.coords.latitude, pos.coords.longitude),
    () => {
      locState = 'denied';
      if (S) {
        S.profile.nearMe = false;
        save();
        queue = [];
        renderAll();
      }
      renderRadius();
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  );
}

function onPos(lat, lng) {
  if (!S) return;
  const pos = { lat, lng };
  const far = km(pos, PRAGUE) > 30;
  locState = far ? 'far' : 'ok';
  S.profile.pos = pos;
  S.profile.nearMe = !far;
  if (far) S.profile.radius = null;
  else if (!S.profile.radiusTouched) S.profile.radius = 3;
  save();
  queue = [];
  renderAll();
  renderRadius();
}

function setRadius(r) {
  if (!S) return;
  S.profile.radius = r > 0 ? r : null;
  S.profile.radiusTouched = true;
  save();
  queue = [];
  renderDeck();
  renderSide();
  renderRadius();
}

function renderRadius() {
  const pr = S?.profile;
  const hasPos = !!(pr?.pos && pr.nearMe && locState === 'ok');
  const r = hasPos ? pr.radius : null;
  $('[data-radius-label]').textContent = locState === 'pending' ? t('radius.finding') : r ? t('radius.within', { r: fmtKm(r) }) : t('radius.allPrague');
  $('[data-radius-btn]').classList.toggle('on', !!r);
  const status = t('loc.' + locState, { km: pr?.pos ? Math.round(km(pr.pos, PRAGUE)) : '?' });
  $('[data-loc-status]').textContent = status;
  $('[data-loc-retry]').hidden = !['denied', 'idle'].includes(locState);
  const input = $('[data-radius-input]');
  input.disabled = !hasPos;
  if (r) input.value = r;
  $('[data-radius-value]').textContent = fmtKm(r || +input.value);
  $$('[data-radius-preset]').forEach((b) => {
    const v = +b.dataset.radiusPreset;
    b.classList.toggle('on', v === 0 ? !r : v === r);
    b.disabled = v !== 0 && !hasPos;
  });
  if (S) {
    const n = eligible(PLACES, S.profile, new Set(S.seen)).length;
    $('[data-radius-count]').innerHTML = t('radius.count', { n, word: venuesWord(n) });
  }
}

function toggleRadius(open) {
  const panel = $('[data-radius-panel]');
  const btn = $('[data-radius-btn]');
  const show = open ?? panel.hidden;
  panel.hidden = !show;
  btn.setAttribute('aria-expanded', String(show));
  if (show) {
    renderRadius();
    if (['idle', 'denied'].includes(locState)) locate();
  }
}

// ---------- export saved places for Google My Maps (free, no API) ----------
function exportKml() {
  const list = S.liked.map((l) => [l, BY_ID.get(l.id)]).filter(([, p]) => p);
  if (!list.length) return toast(t('export.none'));
  const x = (t) => String(t ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
  const pm = list.map(([l, p]) => `  <Placemark>
    <name>${x(p.name)}${l.super ? ' ★' : ''}</name>
    <description>${x([cuisine(p.cuisine), hood(p.neighborhood), p.note, mapsUrl(p)].filter(Boolean).join(' · '))}</description>
    <Point><coordinates>${p.lng},${p.lat},0</coordinates></Point>
  </Placemark>`).join('\n');
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <name>${x(t('export.mapName'))}</name>
${pm}
</Document></kml>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' }));
  a.download = t('export.file');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  const n = list.length;
  toast(t('export.done', { n, word: placesWord(n) }));
}

// ---------- language ----------
function applyStatic() {
  document.documentElement.lang = lang;
  $$('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  $$('[data-i18n-html]').forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  $$('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  $$('[data-i18n-title]').forEach((el) => el.setAttribute('title', t(el.dataset.i18nTitle)));
  $('meta[name="description"]').setAttribute('content', t('meta.desc'));
  const lb = $('[data-lang-label]');
  if (lb) lb.textContent = lang === 'cs' ? 'EN' : 'CZ';
}

function switchLang(l) {
  if (l === lang) return;
  setLang(l);
  applyStatic();
  credits();
  if (S) {
    renderAll();
    route();
  }
  renderRadius();
  if (onb && !$('[data-onb]').hidden) renderOnb();
}

// ---------- misc ----------
let toastT;
function toast(msg) {
  const t = $('[data-toast]');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 1800);
}

async function credits() {
  try {
    const c = await (await fetch('assets/img/credits.json')).json();
    const used = new Set(Object.values(PHOTOS));
    const list = c.photos.filter((x) => used.has(x.id));
    $('[data-credits]').innerHTML = esc(t('credits.prefix')) + list.map((x) => `<a href="${esc(x.page)}" rel="noopener">${esc(x.by)}</a> (${esc(x.licence)})`).join(', ') + '.';
  } catch {}
}

// ---------- wire up ----------
document.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'undo') return doUndo();
  if (act === 'info') return toggleInfo();
  if (act) return fly(act);
  if (e.target.closest('[data-edit-prefs]')) return openOnb(true);
  if (e.target.closest('[data-radius-open]')) {
    e.stopPropagation();
    return toggleRadius(true);
  }
  if (e.target.closest('[data-recycle]')) {
    const liked = new Set(S.liked.map((l) => l.id));
    S.seen = S.seen.filter((id) => liked.has(id));
    S.recentCuisines = [];
    save();
    queue = [];
    return renderDeck();
  }
  if (e.target.closest('[data-reset]')) {
    if (!confirm(t('taste.resetConfirm'))) return;
    try { localStorage.removeItem(KEY); } catch {}
    S = null;
    queue = [];
    return openOnb(false);
  }
  const un = e.target.closest('[data-unsave]');
  if (un) {
    S.liked = S.liked.filter((l) => l.id !== un.dataset.unsave);
    save();
    renderSaved();
    renderSide();
    renderCounts();
    return;
  }
  if (e.target.closest('[data-export-kml]')) return exportKml();
  if (e.target.closest('[data-lang-toggle]')) return switchLang(lang === 'cs' ? 'en' : 'cs');
  const sf = e.target.closest('[data-saved-filter]');
  if (sf) {
    savedFilter = sf.dataset.savedFilter;
    $$('[data-saved-filter]').forEach((b) => b.classList.toggle('on', b === sf));
    return renderSaved();
  }
});

$('[data-onb]').addEventListener('click', onbClick);
$('[data-onb-next]').addEventListener('click', onbNext);
$('[data-onb-back]').addEventListener('click', () => {
  onb.feedback = null;
  if (onb.step > 0) onb.step--;
  renderOnb();
});
$('[data-onb-skip]').addEventListener('click', onbNext);
// Quiz keys: 1-3 answer, Enter continue (like Duolingo).
$('[data-onb]').addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const st = STEPS[onb.step];
  if (/^[1-4]$/.test(e.key)) {
    if (st.type === 'adventure') pickAdventure(ADVENTURE_CHOICES[+e.key - 1]?.id);
    else if (st.type === 'diet') pickDiet(DIET_CHOICES[+e.key - 1]?.id);
    else if (st.type === 'duel') pickDuel(['a', 'b', 'both', 'none'][+e.key - 1]);
  } else if (e.key === 'Enter' && e.target.closest('[data-onb-next]') == null && !$('[data-onb-next]').disabled && onb.feedback) {
    e.preventDefault();
    onbNext();
  }
});

document.addEventListener('keydown', (e) => {
  if (!$('[data-onb]').hidden || e.metaKey || e.ctrlKey || e.altKey) return;
  if (location.hash && location.hash !== '#swipe') return;
  if (e.target instanceof Element && e.target.closest('input, textarea, .radius')) return;
  const k = e.key;
  if (k === 'ArrowRight') (e.preventDefault(), fly('like'));
  else if (k === 'ArrowLeft') (e.preventDefault(), fly('nope'));
  else if (k === 'ArrowUp') (e.preventDefault(), fly('super'));
  else if (k === 'z' || k === 'Z' || k === 'Backspace') (e.preventDefault(), doUndo());
  else if (k === ' ' && !(e.target instanceof Element && e.target.closest('button, a'))) (e.preventDefault(), toggleInfo());
});


$('[data-radius-btn]').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleRadius();
});
$('[data-radius-panel]').addEventListener('click', (e) => {
  e.stopPropagation();
  const pre = e.target.closest('[data-radius-preset]');
  if (pre) setRadius(+pre.dataset.radiusPreset);
  if (e.target.closest('[data-loc-retry]')) locate();
});
$('[data-radius-input]').addEventListener('input', (e) => ($('[data-radius-value]').textContent = fmtKm(+e.target.value)));
$('[data-radius-input]').addEventListener('change', (e) => setRadius(+e.target.value));
document.addEventListener('click', (e) => {
  if (!$('[data-radius-panel]').hidden && !e.target.closest('.radius, [data-radius-open]')) toggleRadius(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('[data-radius-panel]').hidden) {
    toggleRadius(false);
    $('[data-radius-btn]').focus();
  }
});

window.addEventListener('hashchange', route);

setLang(lang);
applyStatic();
load();
credits();
route();
if (S) {
  renderAll();
  locate();
} else openOnb(false);
renderRadius();
