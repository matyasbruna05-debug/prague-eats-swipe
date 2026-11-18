// Illustrative food photographs (Wikimedia Commons stand-ins, credits in assets/img/credits.json).
// They show the TYPE of food, never the specific restaurant. A place gets the photo of its most
// specific tag, then its cuisine, then its category.

const BIG = { f1753815: 0, f202779303: 0, f70249695: 0 }; // only a 500px file exists for these
const file = (id) => (id in BIG ? `assets/img/photo-${id}-500.jpg` : `assets/img/photo-${id}-960.jpg`);

export const PHOTOS = {
  ramen: 'f100562279', sushi: 'f1753815', pizza: 'f70249695', pasta: 'f50109961', burger: 'f2139366',
  tacos: 'f32052457', dumplings: 'f154904126', chicken: 'f145129287', steak: 'f81716182', czech: 'f24560219',
  beer: 'f158749173', cocktail: 'f82869794', wine: 'f25757130', coffee: 'f70214600', pastry: 'f124303045',
  cake: 'f97953393', brunch: 'f202779303', seafood: 'f486648', tapas: 'f120642628', fine: 'f202369590',
  hotpot: 'f117819763', curry: 'f3031790', pho: 'f131725676', hummus: 'f29254279', grill: 'f42529297',
  sichuan: 'f50866352', sandwich: 'f100885885', salad: 'f96891595', kbbq: 'f8535420', noodles: 'f10600547',
  dosa: 'f149836648', schnitzel: 'f163369357',
};

const BY_TAG = [
  ['ramen', 'ramen'], ['sushi', 'sushi'], ['hot pot', 'hotpot'], ['korean bbq', 'kbbq'], ['sichuan', 'sichuan'],
  ['dosa', 'dosa'], ['curry', 'curry'], ['falafel', 'hummus'], ['hummus', 'hummus'], ['cevapi', 'grill'],
  ['tacos', 'tacos'], ['pizza', 'pizza'], ['pasta', 'pasta'], ['burgers', 'burger'], ['dumplings', 'dumplings'],
  ['chicken', 'chicken'], ['steak', 'steak'], ['tasting menu', 'fine'], ["chef's table", 'fine'], ['seafood', 'seafood'],
  ['small plates', 'tapas'], ['classic czech', 'czech'], ['sandwiches', 'sandwich'], ['sandwich', 'sandwich'],
  ['cakes & desserts', 'cake'], ['bread & pastries', 'pastry'], ['breakfast', 'brunch'], ['brunch', 'brunch'],
  ['coffee shop', 'coffee'], ['specialty coffee', 'coffee'], ['matcha', 'coffee'], ['healthy', 'salad'],
  ['vegetarian', 'salad'], ['cocktails', 'cocktail'], ['champagne', 'wine'], ['wine', 'wine'],
  ['pilsner', 'beer'], ['craft beer', 'beer'], ['brewery', 'beer'], ['beer', 'beer'], ['grill & bbq', 'grill'],
  ['street food', 'sandwich'], ['modern czech', 'fine'],
];

const BY_CUISINE = {
  Japanese: 'sushi', Chinese: 'sichuan', Korean: 'kbbq', Vietnamese: 'pho', Thai: 'pho', Taiwanese: 'noodles',
  'Asian fusion': 'noodles', Indian: 'curry', Italian: 'pizza', Mexican: 'tacos', American: 'burger', Czech: 'czech',
  Slovak: 'schnitzel', German: 'schnitzel', Ukrainian: 'dumplings', Georgian: 'dumplings', Balkan: 'grill',
  'Beer pub': 'beer', 'Cocktail bar': 'cocktail', Bar: 'cocktail', 'Wine bar': 'wine', 'Middle Eastern': 'hummus',
  Turkish: 'hummus', Ethiopian: 'curry', Spanish: 'tapas', Mediterranean: 'seafood', Greek: 'grill', French: 'steak',
  Argentinian: 'steak', Brazilian: 'grill', Belgian: 'seafood', British: 'seafood', Scandinavian: 'brunch',
  Cuban: 'coffee', Venezuelan: 'sandwich',
};

const BY_CATEGORY = { cafe: 'coffee', bakery: 'pastry', brunch: 'brunch', bar: 'cocktail' };

export function photoKey(p) {
  const tags = p.tags || [];
  if (tags.includes('noodles')) {
    if (p.cuisine === 'Japanese') return 'ramen';
    if (p.cuisine === 'Vietnamese') return 'pho';
  }
  for (const [tag, key] of BY_TAG) if (tags.includes(tag)) return key;
  if (tags.includes('noodles')) return 'noodles';
  for (const c of p.categories || []) if (c !== 'restaurant' && BY_CATEGORY[c]) return BY_CATEGORY[c];
  return BY_CUISINE[p.cuisine] || 'tapas';
}

export const photoSrc = (key) => file(PHOTOS[key] || PHOTOS.tapas);
