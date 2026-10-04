// 2D Canvas illustration textures for the Gossip Jackpot Leaderboard bulletin board.
import { leaderboardRankings } from '../leaderboard.js';
function canvas(width, height) {
  const surface = document.createElement('canvas');
  surface.width = width;
  surface.height = height;
  return surface;
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke, lineWidth = 2) {
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.rect(x, y, width, height);
  }
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

function drawTack(ctx, x, y, radius = 7) {
  ctx.save();
  // Drop shadow
  ctx.beginPath();
  ctx.arc(x + 2, y + 2.5, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(25, 15, 10, 0.45)';
  ctx.fill();

  // Brass dome
  const dome = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.35, radius * 0.1, x, y, radius);
  dome.addColorStop(0, '#fff4b8');
  dome.addColorStop(0.35, '#e5b653');
  dome.addColorStop(0.8, '#b28126');
  dome.addColorStop(1, '#664510');
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = dome;
  ctx.fill();

  // Subtle dark rim
  ctx.strokeStyle = '#523408';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawCoinIcon(ctx, x, y, radius = 13) {
  ctx.save();
  // Shadow
  ctx.beginPath();
  ctx.arc(x + 1, y + 1.5, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(40, 20, 10, 0.25)';
  ctx.fill();

  // Coin body
  const grad = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
  grad.addColorStop(0, '#fef08a');
  grad.addColorStop(0.4, '#eab308');
  grad.addColorStop(1, '#a16207');
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner ring
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.72, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.75)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Crown symbol in center
  ctx.fillStyle = '#78350f';
  ctx.font = `bold ${Math.round(radius * 1.05)}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('👑', x, y + 1);
  ctx.restore();
}

function drawMedal(ctx, x, y, rank, outerColor, innerColor, ribbonColor) {
  ctx.save();
  const radius = 22;

  // Ribbon tails
  ctx.fillStyle = ribbonColor;
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;

  // Left tail
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 8);
  ctx.lineTo(x - 16, y + 36);
  ctx.lineTo(x - 9, y + 30);
  ctx.lineTo(x - 2, y + 36);
  ctx.lineTo(x - 3, y + 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right tail
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 12);
  ctx.lineTo(x + 2, y + 36);
  ctx.lineTo(x + 9, y + 30);
  ctx.lineTo(x + 16, y + 36);
  ctx.lineTo(x + 12, y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Medal drop shadow
  ctx.beginPath();
  ctx.arc(x + 1.5, y + 2, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20, 10, 5, 0.35)';
  ctx.fill();

  // Medal disc
  const grad = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
  grad.addColorStop(0, outerColor[0]);
  grad.addColorStop(0.5, outerColor[1]);
  grad.addColorStop(1, outerColor[2]);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = outerColor[3];
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner ring
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.74, 0, Math.PI * 2);
  ctx.fillStyle = innerColor;
  ctx.fill();
  ctx.strokeStyle = outerColor[3];
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Rank number
  ctx.fillStyle = outerColor[3];
  ctx.font = 'bold 22px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(rank), x, y + 1);
  ctx.restore();
}

function drawBeerCard(ctx, x, y, width, height) {
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(-0.045);
  ctx.translate(-width / 2, -height / 2);

  // Card shadow
  ctx.fillStyle = 'rgba(25, 15, 10, 0.35)';
  roundRect(ctx, 3, 5, width, height, 8, 'rgba(25, 15, 10, 0.35)');

  // Card body
  roundRect(ctx, 0, 0, width, height, 8, '#fdfbf5', '#e2d8c3', 1.5);

  // 1. Beer mug illustration (top half)
  const mugX = width / 2;
  const mugY = 85;

  // Sparkles around mug
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (const [sx, sy, ex, ey] of [
    [mugX - 48, mugY - 32, mugX - 40, mugY - 26],
    [mugX - 52, mugY - 14, mugX - 42, mugY - 14],
    [mugX + 44, mugY - 36, mugX + 36, mugY - 28],
    [mugX + 50, mugY - 18, mugX + 42, mugY - 18],
    [mugX - 6, mugY - 58, mugX - 6, mugY - 48],
  ]) {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  // Handle
  ctx.strokeStyle = '#472a1e';
  ctx.lineWidth = 6;
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(mugX + 28, mugY + 4, 18, -Math.PI * 0.45, Math.PI * 0.55);
  ctx.stroke();

  // Glass body
  roundRect(ctx, mugX - 30, mugY - 22, 54, 60, 6, '#f59e0b', '#472a1e', 3.5);

  // Vertical foam/glass rib highlights
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 4;
  for (const rx of [mugX - 16, mugX - 3, mugX + 10]) {
    ctx.beginPath();
    ctx.moveTo(rx, mugY - 10);
    ctx.lineTo(rx, mugY + 30);
    ctx.stroke();
  }

  // Frothy foam cap
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#472a1e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(mugX - 22, mugY - 22, 13, 0, Math.PI * 2);
  ctx.arc(mugX - 5, mugY - 30, 16, 0, Math.PI * 2);
  ctx.arc(mugX + 15, mugY - 25, 14, 0, Math.PI * 2);
  ctx.arc(mugX + 28, mugY - 16, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Foam drip
  ctx.beginPath();
  ctx.arc(mugX + 18, mugY - 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 2. Robot head illustration (bottom half)
  const botX = width / 2;
  const botY = 225;

  // Antenna
  ctx.strokeStyle = '#472a1e';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(botX, botY - 32);
  ctx.lineTo(botX + 8, botY - 50);
  ctx.stroke();

  // Antenna ball
  ctx.beginPath();
  ctx.arc(botX + 9, botY - 54, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fcd34d';
  ctx.fill();
  ctx.stroke();

  // Ears
  roundRect(ctx, botX - 44, botY - 8, 10, 22, 4, '#84a055', '#334825', 2.5);
  roundRect(ctx, botX + 34, botY - 8, 10, 22, 4, '#84a055', '#334825', 2.5);

  // Outer head casing
  roundRect(ctx, botX - 36, botY - 28, 72, 60, 14, '#9bb362', '#334825', 3.5);

  // Inner screen face
  roundRect(ctx, botX - 26, botY - 18, 52, 40, 10, '#162e2a', '#0f1f1d', 2);

  // Cheerful cyan glowing curved eyes
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(botX - 12, botY + 2, 7, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(botX + 12, botY + 2, 7, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();

  // 4 corner tacks
  drawTack(ctx, 14, 14, 6);
  drawTack(ctx, width - 14, 14, 6);
  drawTack(ctx, 14, height - 14, 6);
  drawTack(ctx, width - 14, height - 14, 6);

  ctx.restore();
}

function drawJukeboxCard(ctx, x, y, width, height) {
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(0.04);
  ctx.translate(-width / 2, -height / 2);

  // Card shadow
  roundRect(ctx, 3, 5, width, height, 8, 'rgba(25, 15, 10, 0.35)');

  // Card body
  roundRect(ctx, 0, 0, width, height, 8, '#fdfbf5', '#e2d8c3', 1.5);

  const jbX = width / 2;
  const jbY = 160;

  // Musical rays / sparkles
  ctx.strokeStyle = '#f472b6';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (const [sx, sy, ex, ey] of [
    [jbX - 48, jbY - 60, jbX - 58, jbY - 72],
    [jbX + 48, jbY - 60, jbX + 58, jbY - 72],
    [jbX - 56, jbY - 10, jbX - 68, jbY - 10],
    [jbX + 56, jbY - 10, jbX + 68, jbY - 10],
    [jbX, jbY - 95, jbX, jbY - 108],
  ]) {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  // Outer arched pink casing
  ctx.fillStyle = '#ec4899';
  ctx.strokeStyle = '#4c1d34';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(jbX, jbY - 20, 46, Math.PI, 0);
  ctx.lineTo(jbX + 46, jbY + 70);
  ctx.lineTo(jbX - 46, jbY + 70);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner yellow/gold arch trim
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(jbX, jbY - 18, 36, Math.PI, 0);
  ctx.lineTo(jbX + 36, jbY + 58);
  ctx.lineTo(jbX - 36, jbY + 58);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Dark speaker / record arch area
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(jbX, jbY - 16, 26, Math.PI, 0);
  ctx.lineTo(jbX + 26, jbY + 14);
  ctx.lineTo(jbX - 26, jbY + 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Speaker grille (bottom section)
  roundRect(ctx, jbX - 26, jbY + 18, 52, 38, 4, '#500724', '#fbcfe8', 2);
  ctx.strokeStyle = '#f472b6';
  ctx.lineWidth = 1.5;
  for (let gx = jbX - 20; gx <= jbX + 20; gx += 8) {
    ctx.beginPath();
    ctx.moveTo(gx, jbY + 22);
    ctx.lineTo(gx, jbY + 52);
    ctx.stroke();
  }

  // Base feet
  roundRect(ctx, jbX - 48, jbY + 70, 96, 12, 3, '#92400e', '#451a03', 2);

  // 4 corner tacks
  drawTack(ctx, 14, 14, 6);
  drawTack(ctx, width - 14, 14, 6);
  drawTack(ctx, 14, height - 14, 6);
  drawTack(ctx, width - 14, height - 14, 6);

  ctx.restore();
}

export function drawBulletinBoard(spenders = [], visitors = [], surface = canvas(1024, 768)) {
  const ctx = surface.getContext('2d');

  // 1. Natural Cork Board Texture
  ctx.fillStyle = '#a66e43';
  ctx.fillRect(0, 0, 1024, 768);

  // Noise / grain simulation for realistic cork granules
  const corkColors = ['#8c552b', '#b98154', '#74411b', '#c79262', '#613312'];
  for (let i = 0; i < 4800; i++) {
    const px = Math.random() * 1024;
    const py = Math.random() * 768;
    const size = Math.random() * 3.5 + 1;
    ctx.fillStyle = corkColors[Math.floor(Math.random() * corkColors.length)];
    ctx.fillRect(px, py, size, size);
  }

  // Edge vignette / ambient occlusion shadow from the outer frame
  const vignette = ctx.createRadialGradient(512, 384, 300, 512, 384, 580);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(18, 9, 4, 0.48)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 1024, 768);

  // Two equally prominent pinned sheets share the existing board.
  const rankings = leaderboardRankings(spenders, visitors);
  drawRankingSheet(ctx, rankings[0], 52, 64, 440, 640, '#173631');
  drawRankingSheet(ctx, rankings[1], 532, 64, 440, 640, '#73334f');
  return surface;
}

function drawRankingSheet(ctx, ranking, sheetX, sheetY, sheetW, sheetH, accent) {
  const dogEar = 36; // Curled corner size

  // Sheet drop shadow
  ctx.save();
  ctx.fillStyle = 'rgba(20, 10, 5, 0.42)';
  ctx.beginPath();
  ctx.moveTo(sheetX + 5, sheetY + 7);
  ctx.lineTo(sheetX + sheetW + 5, sheetY + 7);
  ctx.lineTo(sheetX + sheetW + 5, sheetY + sheetH - dogEar + 7);
  ctx.lineTo(sheetX + sheetW - dogEar + 5, sheetY + sheetH + 7);
  ctx.lineTo(sheetX + 5, sheetY + sheetH + 7);
  ctx.closePath();
  ctx.fill();

  // Parchment paper base with subtle vertical gradient
  const paperGrad = ctx.createLinearGradient(sheetX, sheetY, sheetX, sheetY + sheetH);
  paperGrad.addColorStop(0, '#fbf7ee');
  paperGrad.addColorStop(0.5, '#f7f0df');
  paperGrad.addColorStop(1, '#eee2cb');

  ctx.beginPath();
  ctx.moveTo(sheetX, sheetY);
  ctx.lineTo(sheetX + sheetW, sheetY);
  ctx.lineTo(sheetX + sheetW, sheetY + sheetH - dogEar);
  ctx.lineTo(sheetX + sheetW - dogEar, sheetY + sheetH);
  ctx.lineTo(sheetX, sheetY + sheetH);
  ctx.closePath();
  ctx.fillStyle = paperGrad;
  ctx.fill();
  ctx.strokeStyle = '#d9cca8';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Curled dog-ear flap (bottom-right)
  ctx.beginPath();
  ctx.moveTo(sheetX + sheetW - dogEar, sheetY + sheetH);
  ctx.lineTo(sheetX + sheetW, sheetY + sheetH - dogEar);
  ctx.lineTo(sheetX + sheetW - dogEar, sheetY + sheetH - dogEar);
  ctx.closePath();
  ctx.fillStyle = '#decbb0';
  ctx.fill();
  ctx.stroke();

  // Shadow under the curl flap
  ctx.beginPath();
  ctx.moveTo(sheetX + sheetW - dogEar, sheetY + sheetH);
  ctx.lineTo(sheetX + sheetW - dogEar, sheetY + sheetH - dogEar);
  ctx.strokeStyle = 'rgba(40, 20, 10, 0.28)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Category title and column headings.
  const fontSerif = 'Georgia, "Times New Roman", serif';
  roundRect(ctx, sheetX + 18, sheetY + 26, sheetW - 36, 52, 6, accent);
  ctx.fillStyle = '#fff4db';
  ctx.font = `bold 30px ${fontSerif}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ranking.title.toUpperCase(), sheetX + sheetW / 2, sheetY + 52, sheetW - 64);
  ctx.fillStyle = '#173631';
  ctx.font = `bold 19px ${fontSerif}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillText('RANK', sheetX + 45, sheetY + 114);
  ctx.fillText('PLAYER', sheetX + 185, sheetY + 114);
  ctx.fillText(ranking.metric.toUpperCase(), sheetX + 350, sheetY + 114);

  // Horizontal divider rule
  ctx.strokeStyle = '#1e4842';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sheetX + 24, sheetY + 130);
  ctx.lineTo(sheetX + sheetW - 24, sheetY + 130);
  ctx.stroke();

  // Leaderboard Rows
  const medals = [
    { outer: ['#fef08a', '#eab308', '#a16207', '#78350f'], inner: '#fde047', ribbon: '#dc2626' },
    { outer: ['#f8fafc', '#cbd5e1', '#64748b', '#334155'], inner: '#e2e8f0', ribbon: '#2563eb' },
    { outer: ['#ffedd5', '#f97316', '#9a3412', '#7c2d12'], inner: '#fdba74', ribbon: '#16a34a' },
  ];

  const rowStartY = sheetY + 184;
  const rowSpacing = 88;

  if (!ranking.entries.length) {
    ctx.fillStyle = '#857762';
    ctx.font = `24px ${fontSerif}`;
    ctx.textAlign = 'center';
    ctx.fillText(ranking.empty, sheetX + sheetW / 2, rowStartY);
  }

  ranking.entries.forEach((entry, idx) => {
    const rowY = rowStartY + idx * rowSpacing;
    const rank = idx + 1;
    const medal = medals[idx];

    // Rank (medal or number)
    if (medal) {
      drawMedal(ctx, sheetX + 45, rowY, rank, medal.outer, medal.inner, medal.ribbon);
    } else {
      ctx.fillStyle = '#173631';
      ctx.font = `bold 28px ${fontSerif}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(rank), sheetX + 45, rowY);
    }

    // Player Name
    ctx.fillStyle = '#173631';
    ctx.font = `bold 26px ${fontSerif}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(entry.name.toUpperCase(), sheetX + 100, rowY, 174);

    // Coins Icon + Score
    if (ranking.metric === 'Coins') drawCoinIcon(ctx, sheetX + 300, rowY, 14);
    ctx.fillStyle = '#173631';
    ctx.font = `bold 26px ${fontSerif}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(entry.value, sheetX + sheetW - 24, rowY, 88);

    // Subtle row divider line
    if (idx < ranking.entries.length - 1) {
      ctx.strokeStyle = '#e7dece';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sheetX + 24, rowY + rowSpacing / 2);
      ctx.lineTo(sheetX + sheetW - 24, rowY + rowSpacing / 2);
      ctx.stroke();
    }
  });

  ctx.fillStyle = '#857762';
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(ranking.note, sheetX + sheetW / 2, sheetY + sheetH - 36);

  // Brass tacks holding the center sheet
  drawTack(ctx, sheetX + 16, sheetY + 16, 7);
  drawTack(ctx, sheetX + sheetW - 16, sheetY + 16, 7);
  drawTack(ctx, sheetX + 16, sheetY + sheetH - 16, 7);
  drawTack(ctx, sheetX + sheetW - dogEar - 10, sheetY + sheetH - 12, 7);

  ctx.restore();
}

export function drawLeaderboardSign() {
  const surface = canvas(1024, 384);
  const ctx = surface.getContext('2d');

  // Deep Teal Background
  ctx.fillStyle = '#183f3a';
  ctx.fillRect(0, 0, 1024, 384);

  // A single wide title stays legible and fits inside the crown's sloping sides.
  ctx.save();
  const fontSerif = 'Georgia, "Times New Roman", serif';
  const text = 'LEADERBOARD';
  ctx.font = `bold 80px ${fontSerif}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#0a1d1b';
  ctx.fillText(text, 514, 190, 680);
  ctx.shadowColor = '#f472b6';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = '#dd3c78';
  ctx.lineWidth = 3;
  ctx.strokeText(text, 512, 185, 680);
  ctx.fillStyle = '#fff4db';
  ctx.fillText(text, 512, 185, 680);
  ctx.restore();

  // Subtitle: — GOSSIP BAR —
  ctx.save();
  const subY = 278;
  ctx.font = `bold 36px ${fontSerif}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '6px';

  // Subtitle decorative lines
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(230, subY);
  ctx.lineTo(320, subY);
  ctx.moveTo(704, subY);
  ctx.lineTo(794, subY);
  ctx.stroke();

  // Diamond bullets
  for (const dx of [330, 694]) {
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.moveTo(dx, subY - 6);
    ctx.lineTo(dx + 6, subY);
    ctx.lineTo(dx, subY + 6);
    ctx.lineTo(dx - 6, subY);
    ctx.closePath();
    ctx.fill();
  }

  // Text
  ctx.fillStyle = '#fef08a';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 10;
  ctx.fillText('GOSSIP BAR', 512, subY);
  ctx.restore();

  return surface;
}
