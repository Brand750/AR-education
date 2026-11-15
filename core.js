// core.js — the shared logic for both modes (cards and finger).
// It only ever sees the car's position measured from the sensor:
// how far forward and how far sideways, in shown "cm".
// It never knows whether that position came from a tracked card or a finger.

const Core = (() => {
  const CONFIG = {
    // --- set after the tracking test ---
    MARKER_CM: 6,        // printed width of the black marker square
    CARD_CM: 7.2,        // card width: marker plus the white margin on both sides
    SCALE: 1,            // shown cm per real cm on the desk
    SMOOTH_FRAMES: 8,    // readings averaged for a steady number
    HOLD_MS: 600,        // keep the last value this long after a card is lost

    // --- the lesson ---
    RANGE_CM: 30,        // furthest distance the sensor reads
    SOUND_CM_PER_MS: 34.3,
    SLOWDOWN: 2000,      // the pulse on screen is this many times slower than real sound
    INTRO_SLOWDOWN: 3,   // the first "there and back" pulse is slower still
    MIN_CYCLE_MS: 700,   // shortest pulse loop, so it never flickers
  };

  // Centre-to-centre position of the two cards -> gap between their edges.
  // Both inputs use this, so "0 cm" always means the cards touch.
  function gapFromCentres(forward, sideways, cardWidth) {
    const d = Math.hypot(forward, sideways);
    if (d <= cardWidth || d === 0) return { forward: 0, sideways: 0 };
    const k = (d - cardWidth) / d;
    return { forward: forward * k, sideways: sideways * k };
  }

  // Tracked marker units (1 unit = one marker width) -> shown cm.
  function fromTracked(forwardUnits, sidewaysUnits) {
    const gap = gapFromCentres(
      forwardUnits * CONFIG.MARKER_CM,
      sidewaysUnits * CONFIG.MARKER_CM,
      CONFIG.CARD_CM
    );
    return { forward: gap.forward * CONFIG.SCALE, sideways: gap.sideways * CONFIG.SCALE };
  }

  function echoMs(cm) {
    return (2 * cm) / CONFIG.SOUND_CM_PER_MS; // there and back
  }

  // Position in, the two numbers out.
  function measure(forward, sideways) {
    const cm = Math.hypot(forward, sideways);
    return {
      cm,
      echoMs: echoMs(cm),
      inRange: cm <= CONFIG.RANGE_CM,
      angleDeg: (Math.atan2(sideways, forward) * 180) / Math.PI, // 0 = straight ahead
    };
  }

  // The slow-motion pulse. phase runs 0..1 through one loop:
  // 0–0.45 going out, 0.45–0.9 coming back, 0.9–1 a short rest.
  const OUT_END = 0.45, BACK_END = 0.9;

  function cycleMs(cm, intro) {
    const travel = echoMs(cm) * CONFIG.SLOWDOWN * (intro ? CONFIG.INTRO_SLOWDOWN : 1);
    return Math.max(CONFIG.MIN_CYCLE_MS * (intro ? CONFIG.INTRO_SLOWDOWN : 1), travel / BACK_END);
  }

  // Returns the new phase; it can pass 1, the caller wraps it and counts the loop.
  function advancePulse(phase, dtMs, cm, intro) {
    return phase + dtMs / cycleMs(cm, intro);
  }

  // along: 0 at the sensor, 1 at the car.
  function pulseAt(phase) {
    const p = phase - Math.floor(phase);
    if (p < OUT_END) return { leg: 'out', along: p / OUT_END };
    if (p < BACK_END) return { leg: 'back', along: 1 - (p - OUT_END) / (BACK_END - OUT_END) };
    return { leg: 'rest', along: 0 };
  }

  // Average the last n positions.
  function makeSmoother(n = CONFIG.SMOOTH_FRAMES) {
    let buf = [];
    return {
      push(forward, sideways) {
        buf.push([forward, sideways]);
        if (buf.length > n) buf.shift();
        let f = 0, s = 0;
        for (const [a, b] of buf) { f += a; s += b; }
        return { forward: f / buf.length, sideways: s / buf.length };
      },
      reset() { buf = []; },
    };
  }

  // When a card is lost, hold the last value briefly, then report "lost".
  function makeHold(holdMs = CONFIG.HOLD_MS) {
    let last = null, lostAt = null;
    return {
      update(seen, value, now) {
        if (seen) { last = value; lostAt = null; return { state: 'live', value }; }
        if (last === null) return { state: 'lost', value: null };
        if (lostAt === null) lostAt = now;
        if (now - lostAt <= holdMs) return { state: 'held', value: last };
        return { state: 'lost', value: null };
      },
    };
  }

  return {
    CONFIG, gapFromCentres, fromTracked, echoMs, measure,
    cycleMs, advancePulse, pulseAt, makeSmoother, makeHold,
  };
})();
