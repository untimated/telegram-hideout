import { drawBulletinBoard, drawLeaderboardSign } from './leaderboard-art.js';

// The Gossip Jackpot Leaderboard bulletin board.
// Stately teal frame, brass corner plates, glowing pink neon tube borders,
// an arched crown sign with a golden star, and pinned spender and visitor rankings.
export function createLeaderboardModel(t) {
  const { THREE, materials: m, group, box, sphere, rod } = t;
  const model = group('Leaderboard');

  // Materials matching the reference bulletin board
  const teal = new THREE.MeshStandardMaterial({
    color: 0x1a4540,
    metalness: 0.32,
    roughness: 0.45,
  });
  const tealDark = new THREE.MeshStandardMaterial({
    color: 0x122e2b,
    metalness: 0.28,
    roughness: 0.55,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xc89b58,
    metalness: 0.72,
    roughness: 0.35,
  });
  const goldStar = new THREE.MeshStandardMaterial({
    color: 0xfed049,
    emissive: 0x9a6f12,
    emissiveIntensity: 0.35,
    metalness: 0.8,
    roughness: 0.22,
  });
  const neonPink = m.neonMagenta.clone();
  neonPink.emissiveIntensity = 2.4;

  const texture = surface => {
    const map = new THREE.CanvasTexture(surface);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  };

  // --- 1. Base Pedestal Feet (Left & Right) --------------------------------
  const postSpacingX = 0.76;

  for (const side of [-1, 1]) {
    const px = side * postSpacingX;

    // Heavy rectangular base plinth
    box(model, teal, 0.24, 0.14, 0.38, px, 0.07, 0);
    // Upper beveled pedestal layer
    box(model, tealDark, 0.19, 0.04, 0.29, px, 0.16, 0);
    // Brass transition collar
    box(model, brass, 0.14, 0.035, 0.14, px, 0.1975, 0);

    // Brass corner wraps & rivet studs on pedestal plinth
    for (const cz of [-0.17, 0.17]) {
      for (const cx of [-0.105, 0.105]) {
        box(model, brass, 0.035, 0.12, 0.035, px + cx, 0.07, cz);
        sphere(model, brass, 0.009, px + cx, 0.07, cz + (cz > 0 ? 0.019 : -0.019), 1);
      }
    }

    // --- 2. Upright Sturdy Posts -------------------------------------------
    // Main vertical post
    box(model, teal, 0.11, 1.72, 0.11, px, 1.075, 0);

    // Brass decorative collar below top cap
    box(model, brass, 0.13, 0.035, 0.13, px, 1.91, 0);

    // A short block cap keeps the silhouette like a cafe fixture.
    box(model, tealDark, 0.15, 0.055, 0.15, px, 1.955, 0);
  }

  // --- 3. Main Frame & Cork Board Enclosure ----------------------------------
  const frameWidth = 1.42;
  const frameHeight = 1.04;
  const frameCenterY = 1.25;

  // Bottom and Top sturdy crossbars
  box(model, teal, frameWidth + 0.10, 0.085, 0.08, 0, 0.73, 0);
  box(model, teal, frameWidth + 0.10, 0.085, 0.08, 0, 1.77, 0);

  // Side frame uprights attached directly to posts
  for (const side of [-1, 1]) {
    box(model, tealDark, 0.065, frameHeight, 0.075, side * (frameWidth / 2 - 0.015), frameCenterY, 0);
  }

  // Backing board panel
  box(model, tealDark, frameWidth - 0.04, frameHeight - 0.04, 0.03, 0, frameCenterY, -0.015);

  // Front Cork Board Plane with 2D Canvas Artwork
  const boardCanvas = drawBulletinBoard();
  const boardMap = texture(boardCanvas);
  const boardMaterial = new THREE.MeshStandardMaterial({
    map: boardMap,
    roughness: 0.85,
    metalness: 0.08,
  });
  const boardMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.36, 0.98),
    boardMaterial,
  );
  boardMesh.position.set(0, frameCenterY, 0.016);
  boardMesh.castShadow = false;
  boardMesh.receiveShadow = true;
  model.add(boardMesh);

  // --- 4. Glowing Neon Inner Perimeter Tube ---------------------------------
  const neonX = 0.67;
  const neonYBottom = 0.775;
  const neonYTop = 1.725;
  const neonZ = 0.024;
  const neonRadius = 0.009;

  // Bottom and Top horizontal neon tubes
  rod(model, neonPink, [-neonX, neonYBottom, neonZ], [neonX, neonYBottom, neonZ], neonRadius, 8);
  rod(model, neonPink, [-neonX, neonYTop, neonZ], [neonX, neonYTop, neonZ], neonRadius, 8);

  // Left and Right vertical neon tubes
  rod(model, neonPink, [-neonX, neonYBottom, neonZ], [-neonX, neonYTop, neonZ], neonRadius, 8);
  rod(model, neonPink, [neonX, neonYBottom, neonZ], [neonX, neonYTop, neonZ], neonRadius, 8);

  // Corner neon connector elbows
  for (const cx of [-neonX, neonX]) {
    for (const cy of [neonYBottom, neonYTop]) {
      sphere(model, neonPink, neonRadius * 1.15, cx, cy, neonZ, 1);
    }
  }

  // --- 5. Brass Corner L-Brackets & Rivets ----------------------------------
  for (const sideX of [-1, 1]) {
    for (const sideY of [-1, 1]) {
      const bx = sideX * (frameWidth / 2 - 0.04);
      const by = frameCenterY + sideY * (frameHeight / 2 - 0.04);
      const arm = 0.08;
      const thick = 0.024;
      const bz = 0.038;

      // Horizontal bracket arm
      box(model, brass, arm, thick, 0.012, bx - sideX * (arm / 2 - thick / 2), by, bz);
      // Vertical bracket arm
      box(model, brass, thick, arm, 0.012, bx, by - sideY * (arm / 2 - thick / 2), bz);

      // Rivet studs
      sphere(model, brass, 0.007, bx, by, bz + 0.007, 1);
      sphere(model, brass, 0.006, bx - sideX * (arm * 0.6), by, bz + 0.007, 1);
      sphere(model, brass, 0.006, bx, by - sideY * (arm * 0.6), bz + 0.007, 1);
    }
  }

  // --- 6. Top Arched Crown Sign ("GOSSIP JACKPOT LEADERBOARD") --------------
  const crownGroup = group('CrownSign');
  crownGroup.position.set(0, 1.81, 0);

  // Crown base mounting bar
  box(crownGroup, tealDark, 1.10, 0.04, 0.08, 0, 0.02, 0);

  // Arched Crown Shape
  const crownShape = new THREE.Shape();
  const crownHalfW = 0.52;
  const crownPeakY = 0.36;

  crownShape.moveTo(-crownHalfW, 0.02);
  crownShape.lineTo(-crownHalfW, 0.08);
  crownShape.lineTo(-crownHalfW + 0.04, 0.13);

  // Curved top arch contour
  const archSteps = 16;
  const archPoints = [];
  archPoints.push([-crownHalfW + 0.04, 0.13]);

  for (let i = 1; i < archSteps; i++) {
    const tVal = i / archSteps; // 0 to 1
    const xVal = (-crownHalfW + 0.04) + tVal * ((crownHalfW - 0.04) * 2);
    // Smooth cosine or parabolic arc reaching crownPeakY
    const yVal = 0.13 + Math.sin(tVal * Math.PI) * (crownPeakY - 0.13);
    crownShape.lineTo(xVal, yVal);
    archPoints.push([xVal, yVal]);
  }

  archPoints.push([crownHalfW - 0.04, 0.13]);
  crownShape.lineTo(crownHalfW - 0.04, 0.13);
  crownShape.lineTo(crownHalfW, 0.08);
  crownShape.lineTo(crownHalfW, 0.02);
  crownShape.closePath();

  // Extruded Crown Body
  const crownGeom = new THREE.ExtrudeGeometry(crownShape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    bevelSegments: 1,
  });
  const crownMesh = new THREE.Mesh(crownGeom, teal);
  crownMesh.position.set(0, 0, -0.025);
  crownMesh.castShadow = true;
  crownMesh.receiveShadow = true;
  crownGroup.add(crownMesh);

  // Arched Front Sign Canvas Texture Face (matches arch shape exactly)
  const signCanvas = drawLeaderboardSign();
  const signMap = texture(signCanvas);
  const signMaterial = new THREE.MeshStandardMaterial({
    map: signMap,
    emissiveMap: signMap,
    emissive: 0xffffff,
    emissiveIntensity: 0.35,
    roughness: 0.45,
    metalness: 0.15,
  });
  const signGeom = new THREE.ShapeGeometry(crownShape);
  const pos = signGeom.attributes.position;
  const uvs = signGeom.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) + crownHalfW) / (crownHalfW * 2);
    const v = pos.getY(i) / crownPeakY;
    uvs.setXY(i, u, v);
  }
  const signFace = new THREE.Mesh(signGeom, signMaterial);
  signFace.name = 'LeaderboardSignFace';
  signFace.position.set(0, 0, 0.038);
  crownGroup.add(signFace);

  // Glowing Neon Pink Tube tracing the upper arch contour
  const archTubePoints = [
    [-crownHalfW, 0.08, 0.042],
    [-crownHalfW + 0.04, 0.13, 0.042],
    ...archPoints.map(([ax, ay]) => [ax, ay, 0.042]),
    [crownHalfW - 0.04, 0.13, 0.042],
    [crownHalfW, 0.08, 0.042],
  ];

  for (let i = 0; i < archTubePoints.length - 1; i++) {
    rod(crownGroup, neonPink, archTubePoints[i], archTubePoints[i + 1], 0.009, 8);
  }

  // --- 7. Golden 4-pointed Star at Apex -----------------------------------
  const starShape = new THREE.Shape();
  for (let idx = 0; idx < 8; idx++) {
    const angle = Math.PI / 2 + (idx * Math.PI) / 4;
    const radius = idx % 2 === 0 ? 0.075 : 0.026;
    const sx = Math.cos(angle) * radius;
    const sy = Math.sin(angle) * radius;
    if (idx === 0) starShape.moveTo(sx, sy);
    else starShape.lineTo(sx, sy);
  }
  starShape.closePath();

  const starGeom = new THREE.ExtrudeGeometry(starShape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelSize: 0.008,
    bevelThickness: 0.008,
    bevelSegments: 1,
  });
  starGeom.center();
  const starMesh = new THREE.Mesh(starGeom, goldStar);
  starMesh.position.set(0, crownPeakY + 0.05, 0.02);
  crownGroup.add(starMesh);

  model.add(crownGroup);

  return model;
}
