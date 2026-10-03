import { NEWSPAPER } from '../news.js';

// Keep the rack and its three paper interactions identical in both maps.
export function buildNewsstand({ models, place, interactable }, x, z, yaw = 0) {
  const rack = place(models.Newsstand(), x, 0, z, yaw);
  const approach = { x: x + Math.sin(yaw) * 1.2, z: z + Math.cos(yaw) * 1.2, yaw };
  interactable('newsstand', rack, { label: 'Read The Hideout Post', approach, action: { type: 'newspaper' } });
  rack.userData.papers.forEach((paper, index) => {
    const article = NEWSPAPER.articles[index];
    interactable(`newspaper:${article.id}`, paper, {
      label: `Read · ${article.title}`, approach,
      action: { type: 'newspaper', article: article.id },
    });
  });
  return rack;
}
