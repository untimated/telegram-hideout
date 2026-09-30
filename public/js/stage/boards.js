import { ITEMS } from '../game/catalog.js';
import { hideoutTime } from '../game/clock.js';

const BOARDS = [
  { id: 'bar-specials', menu: 'bar', title: "Wolfred's Specials", x: -.45, z: -2.35, yaw: .55 },
  { id: 'food-specials', menu: 'food', title: "Pierre's Challenges", x: 1.25, z: -5.75, yaw: .5 },
];

// Chalkboard easels announcing each menu's weekday specials. Tapping one opens the specials
// modal (see panels.js); the board itself highlights today's special.
export function buildBoards({ THREE, level, interactable, animators, now }) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4428, roughness: .7 });
  for (const board of BOARDS) {
    const specials = ITEMS.filter(item => item.menu === board.menu && item.special);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 680;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    let drawnFor = '';
    const draw = weekday => {
      if (drawnFor === weekday) return;
      drawnFor = weekday;
      drawBoard(canvas.getContext('2d'), board.title, specials, weekday);
      texture.needsUpdate = true;
    };
    draw(hideoutTime(now()).weekday);

    const easel = new THREE.Group();
    easel.name = `Easel:${board.id}`;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(.72, .96),
      new THREE.MeshStandardMaterial({ map: texture, roughness: .9, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: .25 }),
    );
    face.position.set(0, 1.02, .035);
    face.rotation.x = -.12;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(.8, 1.04, .04), wood);
    frame.position.set(0, 1.02, 0);
    frame.rotation.x = -.12;
    easel.add(frame, face);
    for (const x of [-.34, .34]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(.045, 1.55, .045), wood);
      leg.position.set(x, .75, .02);
      leg.rotation.x = -.12;
      easel.add(leg);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(.045, 1.5, .045), wood);
    back.position.set(0, .72, -.2);
    back.rotation.x = .2;
    easel.add(back);
    easel.traverse(part => { part.castShadow = true; });
    easel.position.set(board.x, 0, board.z);
    easel.rotation.y = board.yaw;
    level.add(easel);
    interactable(board.id, easel, { label: board.title, action: { type: 'specials', menu: board.menu } });

    let nextCheck = 0;
    animators.push(time => {
      if (time < nextCheck) return;
      nextCheck = time + 30;
      draw(hideoutTime(now()).weekday);
    });
  }
}

function drawBoard(context, title, specials, weekday) {
  const { width, height } = context.canvas;
  context.fillStyle = '#1f2a26';
  context.fillRect(0, 0, width, height);
  // Chalk dust smudges.
  for (let index = 0; index < 90; index++) {
    context.fillStyle = `rgba(255,255,255,${.015 + (index % 5) * .006})`;
    context.beginPath();
    context.arc((index * 197) % width, (index * 331) % height, 20 + (index * 13) % 60, 0, Math.PI * 2);
    context.fill();
  }
  context.textAlign = 'center';
  context.fillStyle = '#ffe3a3';
  context.font = '700 44px "Segoe Script", "Comic Sans MS", cursive';
  context.fillText(title, width / 2, 78, width - 40);
  context.strokeStyle = 'rgba(255,255,255,.55)';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(70, 104);
  context.lineTo(width - 70, 104);
  context.stroke();

  let y = 180;
  for (const item of specials) {
    const today = item.days.includes(weekday);
    context.fillStyle = today ? '#9dffb0' : '#f4f1ea';
    context.font = '600 30px "Segoe Script", "Comic Sans MS", cursive';
    context.fillText(`${item.days.map(day => day[0].toUpperCase() + day.slice(1)).join(', ')}${today ? ' (today!)' : ''}`, width / 2, y);
    context.font = '700 38px "Segoe Script", "Comic Sans MS", cursive';
    context.fillText(`${item.icon} ${item.name.replace(/^.*'s /, '')}`, width / 2, y + 52, width - 40);
    context.font = '500 26px system-ui, sans-serif';
    context.fillStyle = 'rgba(244,241,234,.8)';
    context.fillText(`${item.price} coins · ${item.drunk > 0 ? 'knockout' : 'sober up, fill up'}`, width / 2, y + 94);
    y += 190;
  }
  context.fillStyle = 'rgba(255,227,163,.8)';
  context.font = '600 26px system-ui, sans-serif';
  context.fillText('Tap for details', width / 2, height - 40);
}
