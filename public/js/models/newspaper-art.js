import { NEWSPAPER } from '../news.js';

function surface(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function paper(context, width, height) {
  context.fillStyle = '#e9ddc4';
  context.fillRect(0, 0, width, height);
  // Deterministic paper grain, shared by the reading UI and the 3D front pages.
  let seed = 91;
  for (let index = 0; index < width * height / 75; index++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed % width;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const y = seed % height;
    context.fillStyle = index % 2 ? '#74634e12' : '#fff9e333';
    context.fillRect(x, y, 1 + index % 3, 1);
  }
}

function rule(context, y, width, double = false) {
  context.fillStyle = '#362d28';
  context.fillRect(28, y, width - 56, double ? 4 : 2);
  if (double) context.fillRect(28, y + 9, width - 56, 2);
}

function textLines(context, text, x, y, width, lineHeight) {
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > width) {
      context.fillText(line, x, y);
      y += lineHeight;
      line = word;
    } else line = next;
  }
  if (line) context.fillText(line, x, y);
  return y + lineHeight;
}

// Original monochrome illustrations remain available while photos load or fail.
export function drawNewsIllustration(kind) {
  const canvas = surface(640, 400);
  const context = canvas.getContext('2d');
  paper(context, 640, 400);
  context.strokeStyle = '#504539';
  context.fillStyle = '#84745e';
  context.lineWidth = 3;
  const line = (points, fill = false) => {
    context.beginPath();
    points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
    if (fill) { context.closePath(); context.fill(); }
    context.stroke();
  };
  // Engraving-like horizon and sky strokes.
  for (let y = 32; y < 210; y += 13) {
    context.globalAlpha = .12;
    line([[20 + y % 37, y], [600 - y % 53, y]]);
  }
  context.globalAlpha = 1;
  if (kind === 'castle') {
    line([[0, 366], [100, 328], [242, 310], [460, 318], [640, 368]]);
    context.fillStyle = '#b0a087';
    context.fillRect(150, 182, 340, 145);
    for (const x of [136, 422]) {
      context.fillRect(x, 104, 84, 224);
      context.strokeRect(x, 104, 84, 224);
      for (let column = 0; column < 3; column++) context.fillRect(x + column * 32, 83, 20, 25);
      context.fillStyle = '#504539';
      context.fillRect(x + 31, 148, 19, 42);
      context.fillStyle = '#b0a087';
    }
    line([[150, 184], [490, 184]]);
    context.fillStyle = '#504539';
    context.beginPath(); context.arc(320, 266, 31, Math.PI, 0); context.lineTo(351, 328); context.lineTo(289, 328); context.fill();
    for (let y = 214; y < 315; y += 18) {
      context.globalAlpha = .4;
      line([[158, y], [270, y]]); line([[370, y], [480, y]]);
    }
  } else if (kind === 'coast') {
    context.fillStyle = '#8b7c63';
    line([[0, 220], [110, 125], [168, 184], [290, 81], [410, 208], [487, 153], [640, 234]], true);
    context.fillStyle = '#d8cab0';
    line([[231, 144], [290, 81], [347, 148], [290, 129]], true);
    line([[0, 281], [138, 226], [227, 285], [392, 242], [475, 309], [640, 285]]);
    for (let y = 306; y < 390; y += 12) {
      context.globalAlpha = .5;
      for (let x = 12; x < 620; x += 115) line([[x, y], [x + 65 + y % 31, y]]);
    }
  } else {
    context.fillStyle = '#9b886d';
    context.beginPath(); context.ellipse(277, 207, 82, 43, -.2, 0, Math.PI * 2); context.fill(); context.stroke();
    context.lineWidth = 16;
    context.beginPath(); context.moveTo(331, 198); context.bezierCurveTo(440, 109, 333, 57, 375, 62); context.stroke();
    context.lineWidth = 3;
    context.beginPath(); context.ellipse(380, 65, 24, 17, .2, 0, Math.PI * 2); context.fill(); context.stroke();
    context.fillStyle = '#504539';
    line([[397, 69], [430, 84], [409, 105]], true);
    line([[273, 241], [273, 354], [309, 354]]);
    line([[304, 240], [336, 286], [289, 286]]);
    context.lineWidth = 2;
    for (let index = 0; index < 7; index++) line([[229 + index * 9, 201], [267 + index * 7, 224]]);
    for (let y = 336; y < 390; y += 12) line([[40, y], [220, y]]);
    for (let y = 346; y < 390; y += 12) line([[357, y], [600, y]]);
  }
  context.globalAlpha = 1;
  return canvas;
}

export function drawNewspaper(article, index, picture = drawNewsIllustration(article.illustration)) {
  const canvas = surface(512, 704);
  const context = canvas.getContext('2d');
  paper(context, 512, 704);
  rule(context, 24, 512, true);
  context.fillStyle = '#362d28';
  context.textAlign = 'center';
  context.font = '900 57px Georgia, serif';
  context.fillText('THE HIDEOUT', 256, 96, 456);
  context.font = '900 72px Georgia, serif';
  context.fillText('POST', 256, 162);
  rule(context, 181, 512, true);
  context.font = 'bold 13px sans-serif';
  context.fillText(`${NEWSPAPER.edition.toUpperCase()}  ·  ${NEWSPAPER.date.toUpperCase()}  ·  ${index + 1} / 3`, 256, 215);
  rule(context, 231, 512);
  context.font = 'bold 15px sans-serif';
  context.fillText(article.category.toUpperCase(), 256, 262);
  context.textAlign = 'left';
  context.font = 'bold 39px Georgia, serif';
  const bottom = textLines(context, article.title, 28, 311, 456, 43);
  const imageTop = bottom + 6;
  context.drawImage(picture, 28, imageTop, 456, 190);
  context.strokeRect(28, imageTop, 456, 190);
  context.font = '18px Georgia, serif';
  const deckBottom = textLines(context, article.deck, 28, imageTop + 217, 456, 23);
  context.font = 'bold 12px sans-serif';
  context.fillText(NEWSPAPER.source.toUpperCase(), 28, Math.min(deckBottom + 18, 670));
  rule(context, 683, 512, true);
  return canvas;
}

export function drawNewsstandSign() {
  const canvas = surface(768, 160);
  const context = canvas.getContext('2d');
  context.fillStyle = '#2e2824'; context.fillRect(0, 0, 768, 160);
  context.strokeStyle = '#c5a66e'; context.lineWidth = 3; context.strokeRect(12, 12, 744, 136);
  context.textAlign = 'center'; context.fillStyle = '#e9ddc4';
  context.font = 'bold 58px Georgia, serif'; context.fillText('THE HIDEOUT POST', 384, 78, 718);
  context.font = '19px sans-serif'; context.fillText('TAKE A MOMENT. READ SOMETHING CURIOUS.', 384, 119);
  return canvas;
}
