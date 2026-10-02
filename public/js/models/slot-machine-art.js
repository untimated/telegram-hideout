// Small canvas illustrations: predictable symbols on every browser, without emoji fonts.
import { SLOT_SYMBOLS, SLOTS } from '../game/slots.js';
export { SLOT_SYMBOLS } from '../game/slots.js';

function canvas(width, height) {
  const surface = document.createElement('canvas');
  surface.width = width;
  surface.height = height;
  return surface;
}

function round(context, x, y, width, height, radius, fill) {
  context.fillStyle = fill;
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
  context.stroke();
}

function symbol(context, id) {
  context.lineWidth = 7;
  context.strokeStyle = '#503126';
  context.lineJoin = 'round';
  if (id === 'beer') {
    round(context, 171, 103, 37, 74, 13, '#efb552');
    round(context, 63, 91, 110, 116, 15, '#efa52c');
    context.strokeStyle = '#ffd475';
    context.lineWidth = 9;
    for (const x of [86, 116, 146]) {
      context.beginPath(); context.moveTo(x, 124); context.lineTo(x, 186); context.stroke();
    }
    context.strokeStyle = '#503126';
    context.lineWidth = 6;
    round(context, 54, 62, 125, 48, 20, '#fff4d6');
    for (const [x, y, r] of [[76, 68, 20], [109, 59, 23], [147, 68, 22]]) {
      context.beginPath(); context.arc(x, y, r, 0, Math.PI * 2); context.fill(); context.stroke();
    }
  } else if (id === 'robot') {
    round(context, 39, 117, 22, 43, 8, '#97ac50');
    round(context, 195, 117, 22, 43, 8, '#97ac50');
    context.beginPath(); context.moveTo(128, 65); context.lineTo(128, 38); context.stroke();
    context.fillStyle = '#f1cc67';
    context.beginPath(); context.arc(128, 33, 13, 0, Math.PI * 2); context.fill(); context.stroke();
    round(context, 58, 71, 140, 124, 26, '#829d49');
    round(context, 76, 91, 104, 81, 20, '#253b3a');
    context.fillStyle = '#7cf3ed';
    for (const x of [102, 154]) { context.beginPath(); context.arc(x, 119, 11, 0, Math.PI * 2); context.fill(); }
    context.strokeStyle = '#7cf3ed';
    context.beginPath(); context.arc(128, 136, 23, .2, Math.PI - .2); context.stroke();
  } else if (id === 'jukebox') {
    round(context, 57, 41, 142, 176, 66, '#a94367');
    round(context, 74, 59, 108, 144, 50, '#f4c366');
    round(context, 91, 75, 74, 58, 34, '#33454c');
    round(context, 83, 145, 90, 49, 8, '#593340');
    context.strokeStyle = '#dfa34c'; context.lineWidth = 5;
    for (const x of [101, 119, 137, 155]) { context.beginPath(); context.moveTo(x, 151); context.lineTo(x, 188); context.stroke(); }
    context.strokeStyle = '#503126';
    round(context, 46, 127, 164, 15, 5, '#eec36b');
  } else if (id === 'fountain') {
    context.fillStyle = '#49b9d3';
    context.beginPath(); context.ellipse(128, 183, 88, 26, 0, 0, Math.PI * 2); context.fill(); context.stroke();
    round(context, 112, 74, 32, 110, 8, '#aebfc0');
    for (const [y, width] of [[91, 47], [136, 66]]) {
      context.fillStyle = '#b8c9c3';
      context.beginPath(); context.ellipse(128, y, width, 15, 0, 0, Math.PI * 2); context.fill(); context.stroke();
    }
    context.strokeStyle = '#5fc5dc'; context.lineWidth = 7;
    for (const x of [90, 166]) { context.beginPath(); context.moveTo(128, 71); context.quadraticCurveTo(x, 20, x, 94); context.stroke(); }
  } else if (id === 'coin') {
    context.fillStyle = '#edb342';
    context.beginPath(); context.arc(128, 128, 78, 0, Math.PI * 2); context.fill(); context.stroke();
    context.strokeStyle = '#fff0a6'; context.lineWidth = 8;
    context.beginPath(); context.arc(128, 128, 59, 0, Math.PI * 2); context.stroke();
    context.fillStyle = '#774125'; context.font = 'bold 85px Georgia, serif';
    context.textAlign = 'center'; context.fillText('7', 128, 158);
  } else {
    round(context, 31, 68, 194, 118, 20, '#234542');
    context.fillStyle = '#ffc97c'; context.textAlign = 'center';
    context.font = 'bold 35px Georgia, serif'; context.fillText('GOSSIP', 128, 116);
    context.fillStyle = '#ff8caf'; context.font = 'bold 37px Georgia, serif'; context.fillText('BAR', 128, 159);
  }
}

export function drawReelStrip() {
  const surface = canvas(256, 256 * SLOT_SYMBOLS.length);
  const context = surface.getContext('2d');
  const paper = context.createLinearGradient(0, 0, 256, 0);
  paper.addColorStop(0, '#c69351'); paper.addColorStop(.12, '#ffe4a4');
  paper.addColorStop(.5, '#fff1c7'); paper.addColorStop(.88, '#ffe4a4'); paper.addColorStop(1, '#c69351');
  context.fillStyle = paper; context.fillRect(0, 0, surface.width, surface.height);
  SLOT_SYMBOLS.forEach((id, index) => {
    context.save(); context.translate(0, index * 256); symbol(context, id); context.restore();
  });
  return surface;
}

export function drawMarquee() {
  const surface = canvas(1024, 384);
  const context = surface.getContext('2d');
  context.fillStyle = '#183d3b'; context.fillRect(0, 0, 1024, 384);
  context.textAlign = 'center'; context.textBaseline = 'middle';
  context.font = 'bold 140px Georgia, serif';
  context.lineWidth = 8; context.strokeStyle = '#dd3c78';
  context.shadowColor = '#ff4e98'; context.shadowBlur = 20;
  for (const [text, y] of [['GOSSIP', 105], ['JACKPOT', 273]]) {
    context.strokeText(text, 512, y); context.fillStyle = '#ffdda0'; context.fillText(text, 512, y);
  }
  return surface;
}

export function drawButton() {
  const surface = canvas(256, 256);
  const context = surface.getContext('2d');
  context.fillStyle = '#f7be53'; context.fillRect(0, 0, 256, 256);
  context.fillStyle = '#643323'; context.textAlign = 'center';
  context.font = 'bold italic 66px Arial, sans-serif'; context.fillText('SPIN', 128, 127);
  context.font = 'bold 35px Arial, sans-serif'; context.fillText(`${SLOTS.minBet}+ COINS`, 128, 175);
  return surface;
}

export function drawDisplay(text = 'GOSSIP BAR', surface = canvas(512, 96)) {
  const context = surface.getContext('2d');
  context.fillStyle = '#111f22'; context.fillRect(0, 0, 512, 96);
  context.fillStyle = '#ffcb70'; context.textAlign = 'center';
  context.font = 'bold 43px Arial, sans-serif'; context.fillText(text, 256, 63, 490);
  return surface;
}
