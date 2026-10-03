// First prototype edition: handpicked Reader's Digest stories while its RSS feed returns 403.
// The rack textures and reading panel both use this file, so their headlines always agree.
export const NEWSPAPER = Object.freeze({
  name: 'The Hideout Post',
  edition: 'No. 001',
  date: '3 October 2026',
  source: "Reader’s Digest Canada",
  articles: Object.freeze([
    Object.freeze({
      id: 'castle-palace', category: 'History & curiosities', illustration: 'castle',
      title: 'A castle or a palace?',
      deck: 'Grand homes can look alike. Their original purpose tells a different story.',
      sourceTitle: 'What’s the Difference Between a Castle and a Palace?',
      url: 'https://www.readersdigest.ca/culture/castle-palace-difference/',
      byline: 'Elizabeth Manneh', sourceDate: 'Updated 10 June 2019',
      takeaway: 'Look for the defences, not just the grandeur.',
      caption: 'A fortified home, drawn for this edition.',
      photo: Object.freeze({
        src: '/news-photos/castle-palace.jpg',
        caption: 'Ross Castle, Killarney National Park, Ireland.',
        author: 'Raul Corral', license: 'CC BY 3.0',
        licenseURL: 'https://creativecommons.org/licenses/by/3.0/',
        pageURL: 'https://commons.wikimedia.org/wiki/File:Ross_Castle_Killarney_National_Park.jpg',
        sourceURL: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Ross_Castle_Killarney_National_Park.jpg',
      }),
      paragraphs: Object.freeze([
        'A castle combines a home with a stronghold. Thick walls, guarded entrances and a position that is difficult to attack all help protect the people living inside.',
        'A palace puts comfort, ceremony and display first. Its rooms and grounds express the wealth and status of its occupants, without needing the defensive features of a castle.',
        'The names carry that history too: castle traces back to a word for a fort, while palace comes from Rome’s Palatine Hill. A royal address alone does not tell you which kind of building you are looking at.',
      ]),
    }),
    Object.freeze({
      id: 'canadian-geography', category: 'Odd geography', illustration: 'coast',
      title: 'A coastline that keeps going',
      deck: 'Canada’s map holds a few surprises, even if you already know how large the country is.',
      sourceTitle: '13 Mind-Blowing Facts About Canada’s Geography',
      url: 'https://www.readersdigest.ca/travel/canada/canadian-geography-facts/',
      byline: 'Robert Liwanag', sourceDate: '',
      takeaway: 'Three oceans. One exceptionally long shoreline.',
      caption: 'An imagined coastal landscape, drawn for this edition.',
      photo: Object.freeze({
        src: '/news-photos/canadian-geography.jpg',
        caption: 'The old lighthouse at Cape Spear, Newfoundland, Canada.',
        author: 'Robthepiper', license: 'CC BY-SA 3.0',
        licenseURL: 'https://creativecommons.org/licenses/by-sa/3.0/',
        pageURL: 'https://commons.wikimedia.org/wiki/File:Cape_Spear_(old_lighthouse_1).JPG',
        sourceURL: 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Cape_Spear_%28old_lighthouse_1%29.JPG',
      }),
      paragraphs: Object.freeze([
        'Canada meets the Pacific, Atlantic and Arctic oceans. All those bays, islands and inlets give the country the world’s longest coastline, even though it ranks second by total area.',
        'Reader’s Digest’s geography roundup also visits ancient rock formations and the fossil-rich Joggins cliffs. The cliffs earned a mention in Charles Darwin’s On the Origin of Species.',
        'It is a reminder that a familiar outline on a map hides very different landscapes. Open the original roundup for the rest of its thirteen geographical curiosities.',
      ]),
    }),
    Object.freeze({
      id: 'bonaire-flamingos', category: 'Natural world', illustration: 'flamingo',
      title: 'The island with a pink welcome',
      deck: 'On Bonaire, even the airport’s name celebrates the island’s flamingos.',
      sourceTitle: 'Why Bonaire is the Caribbean’s Best-Kept Secret',
      url: 'https://www.readersdigest.ca/travel/world/things-to-do-in-bonaire/',
      byline: '', sourceDate: '',
      takeaway: 'A flamingo’s colour begins with what it eats.',
      caption: 'A flamingo beside the water, drawn for this edition.',
      photo: Object.freeze({
        src: '/news-photos/bonaire-flamingos.jpg',
        zoom: 1.6, focusY: .7,
        caption: 'Flamingos on Bonaire.',
        author: 'Balou46', license: 'CC BY-SA 4.0',
        licenseURL: 'https://creativecommons.org/licenses/by-sa/4.0/',
        pageURL: 'https://commons.wikimedia.org/wiki/File:Bonaire-flamingo.jpg',
        sourceURL: 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Bonaire-flamingo.jpg',
      }),
      paragraphs: Object.freeze([
        'Bonaire’s flamingos get their vivid colour from pigments in the algae and brine shrimp they eat. The island is so fond of the birds that its airport is named after them.',
        'Reader’s Digest points visitors toward Goto Lake and the area near the salt flats at Pink Beach for a chance to see them. Binoculars help when the birds are far from the road.',
        'The nesting grounds are protected and closed to visitors. The article recommends watching from your vehicle, giving the birds space while you enjoy their remarkable pink plumage.',
      ]),
    }),
  ]),
});

export function newsArticle(id) {
  return NEWSPAPER.articles.find(article => article.id === id) ?? NEWSPAPER.articles[0];
}
