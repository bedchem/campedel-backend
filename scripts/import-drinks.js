// One-time script to import drinks from TypeScript data
const http = require('http');

const drinksData = {
  sections: [
    {
      id: 'hotDrinks', categoryKey: 'hotDrinks',
      items: [
        { id: 'espresso', name: { de: 'Espresso', it: 'Espresso', en: 'Espresso' }, prices: [{ amount: '', price: 1.80 }] },
        { id: 'macchiato', name: { de: 'Macchiato', it: 'Macchiato', en: 'Macchiato' }, prices: [{ amount: '', price: 1.80 }] },
        { id: 'doppelespresso', name: { de: 'Doppelter Espresso', it: 'Espresso Doppio', en: 'Double Espresso' }, prices: [{ amount: '', price: 3.60 }] },
        { id: 'cappuccino', name: { de: 'Cappuccino', it: 'Cappuccino', en: 'Cappuccino' }, prices: [{ amount: '', price: 3.00 }] },
        { id: 'latte', name: { de: 'Latte Macchiato', it: 'Latte Macchiato', en: 'Latte Macchiato' }, prices: [{ amount: '', price: 3.00 }] },
        { id: 'hotchocolate', name: { de: 'Heisse Schokolade', it: 'Cioccolata calda', en: 'Hot chocolate' }, prices: [{ amount: '', price: 4.00 }] },
        { id: 'tee', name: { de: 'Tee', it: 'Te', en: 'Tea' }, prices: [{ amount: '', price: 3.00 }] },
      ],
    },
    {
      id: 'coldDrinks', categoryKey: 'coldDrinks',
      items: [
        { id: 'mineralwasser', name: { de: 'Mineralwasser', it: 'Acqua minerale', en: 'Mineral water' }, prices: [{ amount: '0,3 l', price: 2.00 }, { amount: '0,5 l', price: 2.50 }, { amount: '1 l', price: 5.00 }] },
        { id: 'stilles-wasser', name: { de: 'Stilles Wasser', it: 'Acqua naturale', en: 'Still water' }, prices: [{ amount: '0,3 l', price: 2.00 }, { amount: '0,5 l', price: 2.50 }, { amount: '1 l', price: 5.00 }] },
        { id: 'apfelsaft', name: { de: 'Apfelsaft', it: 'Succo di mela', en: 'Apple juice' }, prices: [{ amount: '0,3 l', price: 3.00 }, { amount: '0,5 l', price: 5.00 }, { amount: '1 l', price: 9.00 }] },
        { id: 'skiwasser', name: { de: 'Skiwasser', it: 'Skiwasser', en: 'Ski water' }, prices: [{ amount: '0,3 l', price: 3.50 }, { amount: '0,5 l', price: 6.00 }, { amount: '1 l', price: 12.00 }] },
      ],
    },
    {
      id: 'juices', categoryKey: 'juices',
      items: [
        { id: 'himbeersaft', name: { de: 'Himbeersaft', it: 'Succo di lampone', en: 'Raspberry juice' }, prices: [{ amount: '0,3 l', price: 3.00 }, { amount: '0,5 l', price: 5.00 }, { amount: '1 l', price: 10.00 }] },
        { id: 'holundersaft', name: { de: 'Holundersaft', it: 'Succo di sambuco', en: 'Elderberry juice' }, prices: [{ amount: '0,3 l', price: 3.00 }, { amount: '0,5 l', price: 5.00 }, { amount: '1 l', price: 10.00 }] },
        { id: 'melissensaft', name: { de: 'Melissensaft', it: 'Succo di melissa', en: 'Lemon balm juice' }, prices: [{ amount: '0,3 l', price: 3.00 }, { amount: '0,5 l', price: 5.00 }, { amount: '1 l', price: 10.00 }] },
        { id: 'colasaft', name: { de: 'Colasaft', it: 'Succo di cola', en: 'Cola juice' }, prices: [{ amount: '0,3 l', price: 3.00 }, { amount: '0,5 l', price: 5.00 }, { amount: '1 l', price: 10.00 }] },
      ],
    },
    {
      id: 'beer', categoryKey: 'beer',
      items: [
        { id: 'kronen-forst', name: { de: 'Kronen Forst Bier', it: 'Birra Kronen Forst', en: 'Kronen Forst Beer' }, prices: [{ amount: '0,3 l', price: 3.80 }, { amount: '0,5 l', price: 6.00 }] },
        { id: 'radler', name: { de: 'Radler', it: 'Radler', en: 'Radler' }, prices: [{ amount: '0,3 l', price: 3.80 }, { amount: '0,5 l', price: 6.00 }] },
        { id: 'hefeweizen', name: { de: 'Hefeweizen', it: 'Birra di frumento', en: 'Wheat beer' }, prices: [{ amount: '0,3 l', price: 3.80 }, { amount: '0,5 l', price: 6.00 }] },
        { id: 'alkoholfrei', name: { de: 'Alkoholfreies Bier', it: 'Birra analcolica', en: 'Non-alcoholic beer' }, prices: [{ amount: '0,3 l', price: 3.50 }, { amount: '0,5 l', price: 6.00 }] },
      ],
    },
    {
      id: 'aperitif', categoryKey: 'aperitif',
      items: [
        { id: 'campedeller', name: { de: 'Aperitif Campedeller', it: 'Aperitivo Campedeller', en: 'Campedeller aperitif' }, prices: [{ amount: '', price: 5.00 }] },
        { id: 'hugo', name: { de: 'Hugo (Holunderspritz)', it: 'Spritz al sambuco', en: 'Hugo (Elderflower spritz)' }, prices: [{ amount: '', price: 5.00 }] },
        { id: 'veneziano', name: { de: 'Veneziano (Aperolspritz)', it: 'Spritz all\'Aperol', en: 'Veneziano (Aperol Spritz)' }, prices: [{ amount: '', price: 5.00 }] },
        { id: 'prosecco', name: { de: 'Prosecco', it: 'Prosecco', en: 'Prosecco' }, prices: [{ amount: '', price: 4.00 }] },
        { id: 'sanbitter', name: { de: 'Sanbitter Weiss', it: 'Sanbitter bianco', en: 'Sanbitter white' }, prices: [{ amount: '', price: 4.00 }] },
        { id: 'gin-hendrick', name: { de: "Gin Tonic Hendrick's", it: "Gin Tonic Hendrick's", en: "Gin Tonic Hendrick's" }, prices: [{ amount: '', price: 10.00 }] },
        { id: 'gin-illusionist', name: { de: 'Gin Tonic Illusionist', it: 'Gin tonic Illusionist', en: 'Illusionist gin and tonic' }, prices: [{ amount: '', price: 14.00 }] },
      ],
    },
    {
      id: 'digestif', categoryKey: 'digestif',
      items: [
        { id: 'hausschnaps', name: { de: 'Hausschnaps', it: 'Grappa della casa', en: 'House schnapps' }, prices: [{ amount: '', price: 3.50 }] },
        { id: 'latschen', name: { de: 'Latschen', it: 'Grappa al pino mugo', en: 'Mountain pine schnapps' }, prices: [{ amount: '', price: 3.50 }] },
        { id: 'nusseler', name: { de: 'Nusseler', it: 'Liquore alle noci', en: 'Nut liqueur' }, prices: [{ amount: '', price: 3.50 }] },
        { id: 'zirmschnaps', name: { de: 'Zirmschnaps', it: 'Grappa al pino cembro', en: 'Swiss stone pine schnapps' }, prices: [{ amount: '', price: 3.50 }] },
        { id: 'limoncello', name: { de: 'Limoncello', it: 'Limoncello', en: 'Limoncello' }, prices: [{ amount: '', price: 3.50 }] },
        { id: 'williams', name: { de: 'Williams', it: 'Williams', en: 'Williams pear brandy' }, prices: [{ amount: '', price: 3.50 }] },
        { id: 'enzian', name: { de: 'Enzian', it: 'Genziana', en: 'Gentian schnapps' }, prices: [{ amount: '', price: 3.50 }] },
        { id: 'treber', name: { de: 'Treber', it: 'Vinaccia', en: 'Pomace brandy' }, prices: [{ amount: '', price: 3.50 }] },
        { id: 'heuschnaps', name: { de: 'Heuschnaps', it: 'Grappa al fieno', en: 'Hay schnapps' }, prices: [{ amount: '', price: 3.50 }] },
        { id: 'branca-menta', name: { de: 'Branca Menta', it: 'Branca Menta', en: 'Branca Menta' }, prices: [{ amount: '', price: 4.00 }] },
        { id: 'fernet', name: { de: 'Fernet Branca', it: 'Fernet Branca', en: 'Fernet Branca' }, prices: [{ amount: '', price: 4.00 }] },
        { id: 'cynar', name: { de: 'Cynar', it: 'Cynar', en: 'Cynar' }, prices: [{ amount: '', price: 4.00 }] },
        { id: 'montenegro', name: { de: 'Montenegro', it: 'Montenegro', en: 'Montenegro' }, prices: [{ amount: '', price: 4.00 }] },
      ],
    },
  ],
};

const data = JSON.stringify(drinksData);
const options = {
  hostname: 'localhost', port: 3002,
  path: '/api/import/drinks', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
};
const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const r = JSON.parse(body);
    if (r.ok) console.log(`Drinks: ${r.sectionCount} Kategorien, ${r.itemCount} Einträge importiert`);
    else console.error(r);
  });
});
req.on('error', e => console.error(e.message));
req.write(data);
req.end();
