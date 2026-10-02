// Keeps the frame rate up on slow devices. Fed the measured fps twice a second, it lowers the
// render resolution a step at a time while the game runs under TARGET fps, down to MIN_RATIO; if
// that is still not enough it switches off the small lamp point lights (their glowing shades
// stay). It only ever steps down, so a device settles instead of flickering between sizes.
const TARGET = 45;
const MIN_RATIO = .75;
const STEP = .25;
const WARMUP_SECONDS = 3;
const SLOW_SAMPLES = 4;
const STARTUP_SECONDS = 3;

export function createQualityGovernor({ renderer, scene, addDebug }) {
  let ratio = Math.min(devicePixelRatio, 2);
  let slow = 0;
  let lampsOff = false;
  let startedAt = null;
  let settledAt = null;
  let finishStartup;
  const ready = new Promise(resolve => { finishStartup = resolve; });
  renderer.setPixelRatio(ratio);

  function lowerQuality(fps) {
    if (ratio > MIN_RATIO) {
      ratio = Math.max(MIN_RATIO, ratio - STEP);
      renderer.setPixelRatio(ratio);
      addDebug?.(`render: ${fps.toFixed(0)} fps, resolution x${ratio}`, 'muted');
    } else if (!lampsOff) {
      lampsOff = true;
      scene.traverse(object => {
        if (object.isPointLight && object.distance > 0 && object.distance <= 3.5) object.visible = false;
      });
      addDebug?.('render: small lamp lights off (slow device)', 'muted');
    }
  }

  return {
    ready,
    // Choose the initial quality behind the loading screen, using actual full-size frames.
    // Once play begins, keep the slower sampling policy so brief spikes do not lower quality.
    sample(fps, time) {
      if (document.hidden) return;
      startedAt ??= time;
      if (settledAt === null) {
        if (fps >= TARGET || lampsOff || time - startedAt >= STARTUP_SECONDS) {
          settledAt = time;
          finishStartup();
        } else {
          lowerQuality(fps);
        }
        return;
      }
      if (time - settledAt < WARMUP_SECONDS) return;
      if (fps >= TARGET) { slow = 0; return; }
      if (++slow < SLOW_SAMPLES) return;
      slow = 0;
      lowerQuality(fps);
    },
  };
}
