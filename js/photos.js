// Picks the drawing for a place: its most specific tag, then its cuisine, then its category.

// Drawn illustrations (scripts/draw-food.mjs). Several food types share one drawing.
const ILLU = {
  ramen: 'noodles', pho: 'noodles', noodles: 'noodles', sushi: 'sushi', pizza: 'pizza', pasta: 'pasta', burger: 'burger',
  chicken: 'burger', tacos: 'tacos', sandwich: 'sandwich', dumplings: 'dumplings', steak: 'steak', grill: 'steak', kbbq: 'steak',
  czech: 'czech', schnitzel: 'czech', beer: 'beer', cocktail: 'cocktail', wine: 'wine', coffee: 'coffee', pastry: 'pastry',
  cake: 'cake', brunch: 'brunch', seafood: 'seafood', tapas: 'tapas', fine: 'fine', hotpot: 'hotpot', sichuan: 'hotpot',
  curry: 'curry', dosa: 'curry', hummus: 'salad', salad: 'salad',
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

export const photoSrc = (key) => `assets/illustrations/${ILLU[key] || 'tapas'}.svg`;
