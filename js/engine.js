// Recommendation engine. Pure functions, no DOM: runs in the browser and in Node (scripts/simulate.mjs).
//
// How it works
// 1. Every place is described by features: cuisine, cuisine family, tags, occasion, category, neighbourhood.
// 2. The onboarding answers set starting weights for those features (prior).
// 3. Every swipe nudges the weights of the swiped place's features: like +, nope -, super like ++.
// 4. Score of a place = sum of its feature weights + small quality bonus + distance penalty.
// 5. The next card is the best score with some noise (exploration), never the same cuisine 3x in a row,
//    and every 6th card or so a random "wildcard" so the profile does not collapse onto one cuisine.

export const FAMILIES = {
  asian: ['Japanese', 'Chinese', 'Korean', 'Asian fusion', 'Vietnamese', 'Thai', 'Taiwanese', 'Indian'],
  european: ['Modern European', 'Italian', 'French', 'Spanish', 'Mediterranean', 'Greek', 'Scandinavian', 'Belgian', 'British', 'German'],
  czech: ['Czech', 'Slovak', 'Beer pub'],
  east: ['Balkan', 'Ukrainian', 'Georgian', 'Turkish', 'Middle Eastern', 'Ethiopian'],
  americas: ['American', 'Mexican', 'Argentinian', 'Brazilian', 'Cuban', 'Venezuelan'],
  drinks: ['Cocktail bar', 'Wine bar', 'Bar', 'Beer pub'],
};
const FAMILY_OF = {};
for (const [f, list] of Object.entries(FAMILIES)) for (const c of list) (FAMILY_OF[c] ||= []).push(f);

// Onboarding choices. Each maps to the features it boosts.
export const CUISINE_CHOICES = [
  { id: 'czech', label: 'Česká', cuisines: ['Czech', 'Slovak'] },
  { id: 'italian', label: 'Italská', cuisines: ['Italian'] },
  { id: 'japanese', label: 'Japonská', cuisines: ['Japanese'] },
  { id: 'chinese', label: 'Čínská', cuisines: ['Chinese', 'Taiwanese'] },
  { id: 'korean', label: 'Korejská', cuisines: ['Korean'] },
  { id: 'sea', label: 'Vietnamská a thajská', cuisines: ['Vietnamese', 'Thai'] },
  { id: 'fusion', label: 'Asijská fúze', cuisines: ['Asian fusion'] },
  { id: 'indian', label: 'Indická', cuisines: ['Indian'] },
  { id: 'modern', label: 'Moderní evropská', cuisines: ['Modern European', 'Scandinavian'] },
  { id: 'frspa', label: 'Francouzská a španělská', cuisines: ['French', 'Spanish', 'Belgian'] },
  { id: 'med', label: 'Středomoří a Blízký východ', cuisines: ['Mediterranean', 'Greek', 'Middle Eastern', 'Turkish'] },
  { id: 'american', label: 'Americká', cuisines: ['American', 'British'] },
  { id: 'latin', label: 'Mexická a latinská', cuisines: ['Mexican', 'Argentinian', 'Brazilian', 'Cuban', 'Venezuelan'] },
  { id: 'eastern', label: 'Balkán a východ', cuisines: ['Balkan', 'Ukrainian', 'Georgian', 'German', 'Ethiopian'] },
];

export const DISH_CHOICES = [
  { id: 'noodles', label: 'Nudle a ramen', tags: ['noodles', 'ramen'] },
  { id: 'sushi', label: 'Sushi', tags: ['sushi'] },
  { id: 'pizza', label: 'Pizza', tags: ['pizza'] },
  { id: 'pasta', label: 'Těstoviny', tags: ['pasta'] },
  { id: 'burgers', label: 'Burgery', tags: ['burgers'] },
  { id: 'steak', label: 'Steaky a gril', tags: ['steak', 'grill & bbq', 'korean bbq', 'cevapi'] },
  { id: 'dumplings', label: 'Knedlíčky a dim sum', tags: ['dumplings'] },
  { id: 'seafood', label: 'Ryby a mořské plody', tags: ['seafood', 'sushi'] },
  { id: 'smallplates', label: 'Malé talíře a tapas', tags: ['small plates'] },
  { id: 'classic', label: 'Klasika k pivu', tags: ['classic czech', 'beer', 'pilsner'] },
  { id: 'brunch', label: 'Snídaně a brunch', tags: ['breakfast', 'brunch'] },
  { id: 'sweet', label: 'Sladké a pečivo', tags: ['cakes & desserts', 'bread & pastries'] },
  { id: 'coffee', label: 'Káva', tags: ['coffee shop', 'specialty coffee', 'matcha'] },
  { id: 'tasting', label: 'Degustační menu', tags: ['tasting menu', "chef's table"] },
  { id: 'street', label: 'Street food', tags: ['street food', 'tacos', 'sandwiches', 'chicken'] },
  { id: 'veggie', label: 'Zeleninové a zdravé', tags: ['vegetarian', 'healthy', 'hummus', 'falafel'] },
];

export const CATEGORY_CHOICES = [
  { id: 'restaurant', label: 'Restaurace' },
  { id: 'brunch', label: 'Brunch' },
  { id: 'cafe', label: 'Kavárna' },
  { id: 'bakery', label: 'Pekárna a sladké' },
  { id: 'bar', label: 'Bar a hospoda' },
];

export const OCCASION_CHOICES = [
  { id: 'quick', label: 'Rychlé jídlo', hint: 'Do 30 minut, bez rezervace' },
  { id: 'everyday', label: 'Běžný den', hint: 'Oběd nebo večeře v klidu' },
  { id: 'nice', label: 'Hezký večer', hint: 'Rande, oslava, víc času' },
  { id: 'special', label: 'Výjimečná příležitost', hint: 'Degustace, rezervace předem' },
];

// Quiz: "this or that" photo duels. The picked side boosts its tags and cuisines, the other side drops a little.
export const DUELS = [
  {
    id: 'noodle-pizza', q: 'Večer po práci. Co si dáš?',
    a: { label: 'Misku ramenu', photo: 'ramen', tags: ['ramen', 'noodles'], cuisines: ['Japanese', 'Chinese', 'Vietnamese'] },
    b: { label: 'Neapolskou pizzu', photo: 'pizza', tags: ['pizza', 'pasta'], cuisines: ['Italian'] },
  },
  {
    id: 'czech-tacos', meatOnly: true, q: 'Neděle v poledne. Kam to táhne?',
    a: { label: 'Svíčková a pivo', photo: 'czech', tags: ['classic czech', 'beer', 'pilsner'], cuisines: ['Czech', 'Beer pub'] },
    b: { label: 'Tacos a street food', photo: 'tacos', tags: ['tacos', 'street food', 'sandwiches'], cuisines: ['Mexican', 'Korean'] },
  },
  {
    id: 'sushi-burger', meatOnly: true, q: 'Rychlý oběd. Co vyhraje?',
    a: { label: 'Sushi', photo: 'sushi', tags: ['sushi', 'seafood'], cuisines: ['Japanese'] },
    b: { label: 'Burger nebo steak', photo: 'burger', tags: ['burgers', 'steak', 'grill & bbq'], cuisines: ['American'] },
  },
  {
    id: 'brunch-tasting', q: 'Máš volné dopoledne, nebo celý večer?',
    a: { label: 'Dlouhý brunch', photo: 'brunch', tags: ['breakfast', 'brunch', 'coffee shop', 'bread & pastries'], cuisines: [] },
    b: { label: 'Degustační menu', photo: 'fine', tags: ['tasting menu', "chef's table", 'small plates'], cuisines: ['Modern European'] },
  },
];

export const ADVENTURE_CHOICES = [
  { id: 'safe', label: 'Držím se jistot', hint: 'Ověřená místa, kam se vracím', emoji: '🛋️', wildcard: 0.05 },
  { id: 'some', label: 'Občas něco nového', hint: 'Mix oblíbeného a překvapení', emoji: '🧭', wildcard: 0.15 },
  { id: 'wild', label: 'Zkusím cokoliv', hint: 'Čím neznámější, tím líp', emoji: '🌶️', wildcard: 0.3 },
];

// Diet. The list has few explicit veggie tags (5 "vegetarian"), so this is a soft re-ranking:
// veggie-friendly tags and cuisines up, meat-centred ones down. Google's servesVegetarianFood adds a badge live.
export const DIET_CHOICES = [
  { id: 'all', label: 'Jím všechno', hint: 'Maso, ryby, cokoliv', emoji: '🍖' },
  { id: 'vegetarian', label: 'Vegetarián', hint: 'Bez masa a ryb', emoji: '🥗' },
  { id: 'vegan', label: 'Vegan', hint: 'Nic živočišného', emoji: '🌱' },
];
const VEG_UP_TAGS = ['vegetarian', 'healthy', 'hummus', 'falafel', 'dosa', 'curry'];
const VEG_UP_CUISINES = ['Indian', 'Middle Eastern', 'Ethiopian', 'Vietnamese', 'Thai'];
const MEAT_TAGS = ['steak', 'burgers', 'grill & bbq', 'korean bbq', 'cevapi', 'sausages', 'chicken', 'classic czech', 'hot pot', 'ramen', 'modern czech', 'tasting menu'];
const SOFT_MEAT_TAGS = ['dumplings', 'noodles', 'street food', 'sandwiches', 'sandwich', 'pilsner', 'beer'];
const FISH_TAGS = ['seafood', 'sushi'];
const DAIRY_TAGS = ['cakes & desserts', 'bread & pastries', 'breakfast'];

export const NOVELTY_CHOICES = [
  { id: 'any', label: 'Obojí' },
  { id: 'been', label: 'Ověřená', hint: 'Autoři seznamu tam byli' },
  { id: 'want', label: 'Nová', hint: 'Na seznamu „chceme zkusit“' },
];

// Weights of each feature type when a swipe teaches the profile.
const LEARN = { c: 1.0, f: 0.35, t: 0.55, o: 0.3, cat: 0.25, h: 0.15 };
const RATE = 0.6;
const SIGNAL = { like: 1, nope: -1, super: 2 };

export function features(p) {
  const out = [`c:${p.cuisine}`];
  for (const f of FAMILY_OF[p.cuisine] || []) out.push(`f:${f}`);
  for (const t of p.tags || []) out.push(`t:${t}`);
  if (p.occasion) out.push(`o:${p.occasion}`);
  for (const c of p.categories || []) out.push(`cat:${c}`);
  if (p.neighborhood) out.push(`h:${p.neighborhood}`);
  return out;
}
const typeOf = (f) => f.slice(0, f.indexOf(':'));

export function emptyProfile() {
  return {
    categories: [], cuisines: [], dishes: [], avoid: [], occasions: [], novelty: 'any',
    hoods: [], nearMe: false, pos: null, radius: null, adventure: 'some', duels: {}, diet: 'all',
  };
}

// Prior weights from the onboarding answers.
export function priorWeights(profile) {
  const w = {};
  const add = (k, v) => (w[k] = (w[k] || 0) + v);
  for (const id of profile.cuisines) {
    const ch = CUISINE_CHOICES.find((x) => x.id === id);
    for (const c of ch?.cuisines || []) {
      add(`c:${c}`, 1.6);
      for (const f of FAMILY_OF[c] || []) add(`f:${f}`, 0.25);
    }
  }
  for (const id of profile.dishes) for (const t of DISH_CHOICES.find((x) => x.id === id)?.tags || []) add(`t:${t}`, 1.2);
  for (const o of profile.occasions) add(`o:${o}`, 1.0);
  for (const h of profile.hoods) add(`h:${h}`, 1.2);
  // Duels: the picked side up, the other side slightly down; both = both up a little; none = both down.
  const side = (s, v) => {
    for (const t of s.tags) add(`t:${t}`, v);
    for (const c of s.cuisines) add(`c:${c}`, v * 1.1);
  };
  for (const d of DUELS) {
    const ans = profile.duels?.[d.id];
    if (ans === 'a') (side(d.a, 1.2), side(d.b, -0.45));
    else if (ans === 'b') (side(d.b, 1.2), side(d.a, -0.45));
    else if (ans === 'both') (side(d.a, 0.6), side(d.b, 0.6));
    else if (ans === 'none') (side(d.a, -0.5), side(d.b, -0.5));
  }
  const diet = profile.diet || 'all';
  if (diet !== 'all') {
    for (const t of VEG_UP_TAGS) add(`t:${t}`, 1.6);
    for (const c of VEG_UP_CUISINES) add(`c:${c}`, 0.8);
    for (const t of MEAT_TAGS) add(`t:${t}`, -2.2);
    for (const t of FISH_TAGS) add(`t:${t}`, -1.6);
    for (const t of SOFT_MEAT_TAGS) add(`t:${t}`, -0.9);
    add('c:Czech', -1.2); add('c:American', -1.2); add('c:Korean', -0.8);
    add('c:Argentinian', -2); add('c:Brazilian', -1.5);
    if (diet === 'vegan') for (const t of DAIRY_TAGS) add(`t:${t}`, -0.8);
  }
  return w;
}

export function avoidedCuisines(profile) {
  return new Set(profile.avoid.flatMap((id) => CUISINE_CHOICES.find((x) => x.id === id)?.cuisines || []));
}

// Places the profile allows at all (hard filters): category, avoided cuisines, already swiped.
export function eligible(places, profile, seen) {
  const avoid = avoidedCuisines(profile);
  const cats = new Set(profile.categories);
  // km, null = whole city. Only with a live position (nearMe): a stale pos after a denied request must not filter.
  const radius = profile.nearMe && profile.pos && profile.radius ? profile.radius : null;
  return places.filter(
    (p) =>
      !seen.has(p.id) &&
      (!radius || km(profile.pos, p) <= radius) &&
      !avoid.has(p.cuisine) &&
      (cats.size === 0 || (p.categories || []).some((c) => cats.has(c))) &&
      (profile.novelty === 'any' || p.status === profile.novelty),
  );
}

export function km(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Score parts, kept apart so the card can say why it was picked.
export function score(p, weights, profile) {
  const parts = [];
  let total = 0;
  for (const f of features(p)) {
    const v = weights[f] || 0;
    if (v) parts.push([f, v]);
    total += v;
  }
  const adv = profile.adventure || 'some';
  if (p.rating) total += (adv === 'safe' ? 0.45 : 0.25) * p.rating; // the list authors' own spires (1-3)
  if (p.hotSince) total += adv === 'wild' ? 0.4 : 0.15;
  if (adv === 'safe' && p.status === 'been') total += 0.4;
  if (adv === 'wild' && p.status === 'want') total += 0.4;
  let dist = null;
  if (profile.nearMe && profile.pos) {
    dist = km(profile.pos, p);
    total -= Math.max(0, dist - 1.5) * 0.35; // first 1.5 km free, then a penalty per km
  }
  return { total, parts, dist };
}

// Deterministic-when-seeded random, so the simulation is repeatable.
export function rng(seed = Date.now()) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Pick the next card.
export function next(places, state, random = Math.random) {
  const pool = eligible(places, state.profile, new Set(state.seen));
  if (!pool.length) return null;
  const recent = state.recentCuisines.slice(-2);
  const blocked = recent.length === 2 && recent[0] === recent[1] ? recent[0] : null;
  const scored = pool
    .map((p) => ({ p, ...score(p, state.weights, state.profile) }))
    .map((x) => ({ ...x, rank: x.total + (random() - 0.5) * 0.8 - (x.p.cuisine === blocked ? 99 : 0) }))
    .sort((a, b) => b.rank - a.rank);
  // Wildcard: every so often show something outside the profile, to keep learning.
  const rate = ADVENTURE_CHOICES.find((a) => a.id === (state.profile.adventure || 'some'))?.wildcard ?? 0.15;
  const wildcard = state.count > 2 && random() < rate;
  const pick = wildcard ? scored[Math.floor(random() * Math.min(scored.length, 60))] : scored[0];
  return { place: pick.p, total: pick.total, parts: pick.parts, dist: pick.dist, wildcard };
}

// Learn from a swipe. Returns the deltas, so undo can revert them exactly.
export function learn(state, place, action) {
  const sig = SIGNAL[action];
  const deltas = {};
  for (const f of features(place)) {
    const d = RATE * sig * (LEARN[typeOf(f)] || 0.2);
    deltas[f] = d;
    state.weights[f] = (state.weights[f] || 0) + d;
  }
  return deltas;
}

export function unlearn(state, deltas) {
  for (const [f, d] of Object.entries(deltas)) state.weights[f] = (state.weights[f] || 0) - d;
}

export function newState(profile) {
  return { profile, weights: priorWeights(profile), seen: [], recentCuisines: [], count: 0, liked: [], history: [] };
}

// Apply a swipe to the state (engine side of a swipe).
export function swipe(state, place, action) {
  const deltas = learn(state, place, action);
  state.seen.push(place.id);
  state.recentCuisines.push(place.cuisine);
  state.count++;
  if (action !== 'nope') state.liked.unshift({ id: place.id, super: action === 'super', at: Date.now() });
  state.history.push({ id: place.id, action, deltas });
  if (state.history.length > 30) state.history.shift();
}

export function undo(state) {
  const last = state.history.pop();
  if (!last) return null;
  unlearn(state, last.deltas);
  state.seen = state.seen.filter((id) => id !== last.id);
  state.recentCuisines.pop();
  state.count = Math.max(0, state.count - 1);
  state.liked = state.liked.filter((l) => l.id !== last.id);
  return last.id;
}

// Human labels for features (for the "why" line and the taste panel).
const OCC = Object.fromEntries(OCCASION_CHOICES.map((o) => [o.id, o.label.toLowerCase()]));
const CAT = Object.fromEntries(CATEGORY_CHOICES.map((o) => [o.id, o.label.toLowerCase()]));
export const CUISINE_CZ = {
  'Modern European': 'moderní evropská', Czech: 'česká', Japanese: 'japonská', Italian: 'italská', Chinese: 'čínská',
  Korean: 'korejská', 'Cocktail bar': 'koktejlový bar', 'Asian fusion': 'asijská fúze', American: 'americká',
  Vietnamese: 'vietnamská', 'Wine bar': 'vinný bar', 'Beer pub': 'pivnice', Mexican: 'mexická', French: 'francouzská',
  Spanish: 'španělská', Mediterranean: 'středomořská', Indian: 'indická', Balkan: 'balkánská',
  'Middle Eastern': 'blízkovýchodní', Scandinavian: 'skandinávská', Ukrainian: 'ukrajinská', Greek: 'řecká', Bar: 'bar',
  Belgian: 'belgická', Cuban: 'kubánská', Ethiopian: 'etiopská', British: 'britská', Argentinian: 'argentinská',
  Thai: 'thajská', Brazilian: 'brazilská', Georgian: 'gruzínská', Venezuelan: 'venezuelská', Taiwanese: 'tchajwanská',
  Turkish: 'turecká', Slovak: 'slovenská', German: 'německá',
};
export const TAG_CZ = {
  noodles: 'nudle', beer: 'pivo', cocktails: 'koktejly', 'small plates': 'malé talíře', 'classic czech': 'česká klasika',
  wine: 'víno', breakfast: 'snídaně', steak: 'steak', 'coffee shop': 'kavárna', brunch: 'brunch', seafood: 'mořské plody',
  pizza: 'pizza', 'tasting menu': 'degustační menu', sushi: 'sushi', dumplings: 'knedlíčky', 'grill & bbq': 'gril',
  pasta: 'těstoviny', chicken: 'kuře', 'street food': 'street food', 'modern czech': 'moderní česká',
  'cakes & desserts': 'dezerty', ramen: 'ramen', pilsner: 'plzeň', 'bread & pastries': 'pečivo', tacos: 'tacos',
  vegetarian: 'vegetariánské', "chef's table": "chef's table", lunch: 'oběd', burgers: 'burgery', view: 'výhled',
  bistro: 'bistro', takeout: 's sebou', sandwiches: 'sendviče', sandwich: 'sendviče', 'hot pot': 'hot pot',
  'craft beer': 'craft pivo', healthy: 'zdravé', 'games & sports': 'hry a sport', 'outdoor seating': 'venku',
  'live music': 'živá hudba', 'grand cafe': 'grand café', 'fermented food': 'fermentované', 'korean bbq': 'korejský gril',
  champagne: 'šampaňské', sichuan: 's’-čchuan', cevapi: 'čevapčiči', brewery: 'pivovar', dosa: 'dosa',
  'specialty coffee': 'výběrová káva', matcha: 'matcha', scandinavian: 'skandinávské', 'air conditioned': 'klimatizace',
  falafel: 'falafel', hummus: 'hummus', curry: 'kari', sausages: 'klobásy',
};
const FAM = { asian: 'asijská kuchyně', european: 'evropská kuchyně', czech: 'česká kuchyně', east: 'východní kuchyně', americas: 'amerika', drinks: 'drinky' };

const OCC_EN = { quick: 'quick bite', everyday: 'everyday', nice: 'nice night out', special: 'special occasion' };
const CAT_EN = { restaurant: 'restaurant', brunch: 'brunch', cafe: 'café', bakery: 'bakery', bar: 'bar' };
const FAM_EN = { asian: 'Asian food', european: 'European food', czech: 'Czech food', east: 'Eastern food', americas: 'the Americas', drinks: 'drinks' };

export function featureLabel(f, lang = 'cs') {
  const t = typeOf(f), v = f.slice(t.length + 1);
  if (lang === 'en') {
    if (t === 'o') return OCC_EN[v] || v;
    if (t === 'cat') return CAT_EN[v] || v;
    if (t === 'f') return FAM_EN[v] || v;
    return v; // cuisine, tag and neighbourhood values are English in the data
  }
  if (t === 'c') return CUISINE_CZ[v] || v;
  if (t === 't') return TAG_CZ[v] || v;
  if (t === 'o') return OCC[v] || v;
  if (t === 'cat') return CAT[v] || v;
  if (t === 'f') return FAM[v] || v;
  return v; // neighbourhood
}

// "Why" line: the two strongest positive reasons.
export function reasons(pick, lang = 'cs') {
  if (pick.wildcard) return [];
  const pos = pick.parts.filter(([, v]) => v > 0.3).sort((a, b) => b[1] - a[1]);
  const out = [];
  for (const [f] of pos) {
    const l = featureLabel(f, lang);
    if (!out.includes(l)) out.push(l);
    if (out.length === 2) break;
  }
  return out;
}

// Taste summary: strongest likes and dislikes for the panel.
export function tasteSummary(weights, n = 6, lang = 'cs') {
  const items = Object.entries(weights).filter(([f]) => !f.startsWith('h:') && !f.startsWith('cat:'));
  const merged = new Map();
  for (const [f, v] of items) {
    const l = featureLabel(f, lang);
    const prev = merged.get(l);
    if (prev === undefined || Math.abs(v) > Math.abs(prev)) merged.set(l, v);
  }
  const arr = [...merged.entries()];
  return {
    likes: arr.filter(([, v]) => v > 0.2).sort((a, b) => b[1] - a[1]).slice(0, n),
    dislikes: arr.filter(([, v]) => v < -0.2).sort((a, b) => a[1] - b[1]).slice(0, n),
  };
}
