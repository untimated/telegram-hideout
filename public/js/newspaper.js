import { NEWSPAPER, newsArticle } from './news.js';
import { getNewsPicture } from './news-photo.js';

// Render into the existing gameplay panel so close, Escape and walking away keep working.
export function buildNewspaper(body, foot, articleID, { element, button, select }) {
  const article = newsArticle(articleID);
  const index = NEWSPAPER.articles.indexOf(article);
  const meta = element('div', 'newspaper-meta');
  meta.append(element('span', '', NEWSPAPER.edition), element('span', '', 'Three curious reads'), element('span', '', NEWSPAPER.date));
  const section = element('div', 'newspaper-section', 'Strange but true');
  const heading = element('h3', 'newspaper-headline', article.title);
  const deck = element('p', 'newspaper-deck', article.deck);
  const credits = element('p', 'newspaper-credits', [article.category, NEWSPAPER.source, article.byline].filter(Boolean).join(' · '));
  const columns = element('div', 'newspaper-columns');
  const lead = element('div', 'newspaper-lead');
  lead.append(element('p', 'newspaper-paragraph newspaper-dropcap', article.paragraphs[0]), element('blockquote', 'newspaper-takeaway', article.takeaway));
  const rest = element('div', 'newspaper-story');
  const figure = element('figure', 'newspaper-figure');
  const image = element('img');
  const picture = getNewsPicture(article);
  Object.assign(image, { src: picture.url(), alt: article.caption, width: 640, height: 400 });
  const caption = element('figcaption', '', article.caption);
  figure.append(image, caption);
  picture.ready.then(success => {
    if (!success || !image.isConnected) return;
    image.src = picture.url();
    image.alt = article.photo.caption;
    caption.replaceChildren(element('span', '', `${article.photo.caption} Photo: ${article.photo.author} · `));
    for (const [label, url] of [['Source', article.photo.pageURL], [article.photo.license, article.photo.licenseURL]]) {
      const credit = element('a', '', label);
      Object.assign(credit, { href: url, target: '_blank', rel: 'noopener noreferrer' });
      caption.append(credit, document.createTextNode(' · '));
    }
    caption.append(document.createTextNode('Cropped and treated for newspaper print.'));
  });
  rest.append(figure, ...article.paragraphs.slice(1).map(text => element('p', 'newspaper-paragraph', text)));
  columns.append(lead, rest);
  const source = element('div', 'newspaper-source');
  source.append(element('p', '', 'A short Hideout summary. Read the complete story at Reader’s Digest.'));
  if (article.sourceDate) source.append(element('p', '', article.sourceDate));
  const link = element('a', 'newspaper-source-link', 'Read original story ↗');
  Object.assign(link, { href: article.url, title: article.sourceTitle, target: '_blank', rel: 'noopener noreferrer' });
  source.append(link);
  body.append(meta, section, heading, deck, credits, columns, source);
  body.scrollTop = 0;

  const navigation = element('nav', 'newspaper-navigation');
  navigation.setAttribute('aria-label', 'Choose a newspaper story');
  NEWSPAPER.articles.forEach((story, storyIndex) => {
    const choice = button('newspaper-choice', '', () => select(story.id));
    choice.append(element('span', 'newspaper-choice-number', String(storyIndex + 1).padStart(2, '0')), element('span', '', story.title));
    if (storyIndex === index) choice.setAttribute('aria-current', 'page');
    navigation.append(choice);
  });
  foot.append(navigation, element('p', 'newspaper-page-number', `${index + 1} / ${NEWSPAPER.articles.length} · The café edition`));
}
