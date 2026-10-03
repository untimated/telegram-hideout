import { NEWSPAPER } from '../news.js';
import { drawNewspaper, drawNewsstandSign } from './newspaper-art.js';
import { getNewsPicture } from '../news-photo.js';

// A freestanding café rack, in metres. The paper front faces +z.
export function createNewsstandModel(t) {
  const { THREE, group, box, cylinder } = t;
  const model = group('Newsstand');
  const wood = new THREE.MeshStandardMaterial({ color: 0x593e2b, roughness: .74 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x8b6542, roughness: .65 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb39259, metalness: .65, roughness: .42 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xe5d7bc, roughness: .95 });
  const textureMaterial = canvas => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return new THREE.MeshStandardMaterial({ map: texture, roughness: .94 });
  };

  // Broad feet and turned wooden uprights keep the silhouette like a small café fixture.
  for (const x of [-.77, .77]) {
    box(model, wood, .14, .085, .68, x, .0425, 0);
    cylinder(model, wood, .045, .055, 1.66, x, .88, -.16, 10);
    cylinder(model, brass, .053, .053, .055, x, .135, -.16, 10);
    cylinder(model, edge, .075, .075, .05, x, 1.69, -.16, 12);
  }
  box(model, wood, 1.5, .08, .075, 0, .26, -.16);
  box(model, wood, 1.61, .56, .055, 0, 1.04, -.19).rotation.x = -.14;
  box(model, edge, 1.65, .065, .37, 0, .73, .015);
  box(model, wood, 1.64, .14, .05, 0, .77, .2);
  for (const x of [-.81, .81]) box(model, edge, .055, .19, .35, x, .795, .025);
  box(model, wood, 1.64, .255, .065, 0, 1.52, -.16);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.52, .22), textureMaterial(drawNewsstandSign()));
  sign.position.set(0, 1.52, -.122);
  model.add(sign);

  const papers = NEWSPAPER.articles.map((article, index) => {
    const newspaper = group(`Newspaper:${article.id}`);
    newspaper.userData.articleID = article.id;
    // A visible folded edge and several sheets give each edition some physical thickness.
    for (let sheet = 0; sheet < 3; sheet++) {
      box(newspaper, paper, .462, .636, .004, (sheet - 1) * .002, 0, -sheet * .006);
    }
    const picture = getNewsPicture(article);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(.46, .632), textureMaterial(drawNewspaper(article, index, picture.canvas)));
    picture.ready.then(success => {
      if (!success) return;
      front.material.map.image = drawNewspaper(article, index, picture.canvas);
      front.material.map.needsUpdate = true;
    });
    front.position.z = .003;
    newspaper.add(front);
    const fold = box(newspaper, paper, .464, .012, .024, 0, -.316, -.006);
    fold.rotation.z = .005;
    newspaper.position.set((index - 1) * .51, 1.085, -.093);
    newspaper.rotation.set(-.14, 0, (index - 1) * -.014);
    model.add(newspaper);
    return newspaper;
  });
  model.userData.papers = papers;
  return model;
}
