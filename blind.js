// blind.js — the Blind spot step. Both pages (ar.html and 2d.html) run this same code.
// It is built like echo.js. Each page gives it the same two functions:
//   read()      -> { sensorSeen, carSeen, forward, sideways, centreForward, centreSideways }
//   draw(view)  -> draws the cone and the pulse for that page
// The lesson: the sensor only hears inside a cone. A car outside the cone sends
// no echo back, so the distance goes blank even though the car is close.

const BlindStep = (() => {
  function start({ mode, read, draw }) {
    const t = Text.t, b = Text.t.blind;
    const C = Core.CONFIG;
    const CORRECT = 'nothing';
    document.title = b.title;

    const ui = document.createElement('div');
    ui.className = 'ui';
    ui.innerHTML = `
      <div class="numbers">
        <div class="num"><span class="label">${b.angle}</span><span class="value"><b id="n-deg">–</b>${b.deg}</span></div>
        <div class="num"><span class="label">${t.distance}</span><span class="value"><b id="n-cm">–</b> ${t.cm}</span></div>
      </div>
      <div class="panel">
        <p id="instruction"></p>
        <button id="done" hidden>${t.done}</button>
      </div>
      <div class="scrim" id="predict">
        <div class="card">
          <p class="question">${b.predictQuestion}</p>
          ${Object.entries(b.predictOptions)
            .map(([key, label]) => `<button class="option" data-answer="${key}">${label}</button>`)
            .join('')}
        </div>
      </div>
      <div class="scrim" id="finish" hidden>
        <div class="card"><p class="question">${b.finished}</p></div>
      </div>`;
    document.body.appendChild(ui);

    const $ = (id) => ui.querySelector('#' + id);
    const elDeg = $('n-deg'), elCm = $('n-cm'), elText = $('instruction'), elDone = $('done');

    let state = 'predict'; // predict -> intro -> explore -> done
    const startedAt = performance.now();
    let prediction = null, predictionSeconds = null;

    const gapSmoother = Core.makeSmoother();     // gap between the card edges: the distance
    const centreSmoother = Core.makeSmoother();  // centre to centre: the direction
    const hold = Core.makeHold();
    let phase = 0;
    let frames = 0, activeMs = 0;
    const lost = { sensor: 0, car: 0 };
    let wasSeen = { sensor: false, car: false };
    let wasInside = null;                        // null = no reading yet
    let coneExits = 0, outsideMs = 0;
    let lastTick = null, lastNumbers = 0, lastText = '';

    ui.querySelectorAll('.option').forEach((btn) => {
      btn.addEventListener('click', () => {
        prediction = btn.dataset.answer;
        predictionSeconds = (performance.now() - startedAt) / 1000;
        $('predict').hidden = true;
        state = 'intro';
      });
    });

    elDone.addEventListener('click', () => {
      state = 'done';
      Log.save({
        savedAt: new Date().toISOString(),
        step: 'blind',
        mode,
        lang: Text.lang,
        prediction,
        predictionCorrect: prediction === CORRECT,
        predictionSeconds: round(predictionSeconds, 1),
        stepSeconds: round((performance.now() - startedAt) / 1000, 1),
        fps: activeMs > 0 ? round((frames * 1000) / activeMs, 1) : null,
        sensorLost: lost.sensor,
        carLost: lost.car,
        device: navigator.userAgent,
        coneExits,                                   // times the car left the cone
        outsideSeconds: round(outsideMs / 1000, 1),  // time spent outside it
      });
      elDone.hidden = true;
      $('finish').hidden = false;
    });

    function round(v, digits) {
      const k = 10 ** digits;
      return Math.round(v * k) / k;
    }

    function setText(s) {
      if (s !== lastText) { elText.textContent = s; lastText = s; }
    }

    function tick(now) {
      requestAnimationFrame(tick);
      const dt = lastTick === null ? 0 : Math.min(now - lastTick, 100);
      lastTick = now;
      // No cone before the prediction: it would give the answer away.
      if (state === 'predict' || state === 'done') { draw({ pulse: null }); return; }

      const raw = read();
      frames++; activeMs += dt;
      if (wasSeen.sensor && !raw.sensorSeen) lost.sensor++;
      if (wasSeen.car && !raw.carSeen) lost.car++;
      wasSeen = { sensor: raw.sensorSeen, car: raw.carSeen };

      const both = raw.sensorSeen && raw.carSeen;
      const held = hold.update(both, both ? {
        gap: gapSmoother.push(raw.forward, raw.sideways),
        centre: centreSmoother.push(raw.centreForward, raw.centreSideways),
      } : null, now);
      if (held.state === 'lost') { gapSmoother.reset(); centreSmoother.reset(); }

      // Distance from the gap, angle from the centres, then: does the sensor hear the car?
      let cm = null, angle = null, h = null;
      if (held.value) {
        cm = Core.measure(held.value.gap.forward, held.value.gap.sideways).cm;
        angle = Core.bearingDeg(held.value.centre.forward, held.value.centre.sideways);
        h = Core.hears(cm, angle, wasInside);
        if (wasInside === true && !h.inCone) coneExits++;
        if (!h.inCone) outsideMs += dt;
        wasInside = h.inCone;
      } else {
        wasInside = null;
      }

      // The two numbers. The angle is always shown; the distance only when there is an echo.
      if (now - lastNumbers > 100) {
        lastNumbers = now;
        elDeg.textContent = h ? Math.round(Math.abs(angle)) : '–';
        elCm.textContent = h && h.heard ? Math.round(cm) : '–';
      }

      // The sound always leaves and fills the cone. It only comes back if it meets the car.
      let pulse = null, reach = null;
      if (h && h.inRange) {
        reach = h.heard ? cm : C.RANGE_CM;
        phase = Core.advancePulse(phase, dt, reach, state === 'intro');
        if (phase >= 1) {
          phase -= 1;
          if (state === 'intro') { state = 'explore'; elDone.hidden = false; }
        }
        pulse = Core.pulseAt(phase);
        if (!h.heard && pulse.leg === 'back') pulse = null;
      }

      // One instruction at a time.
      if (held.state === 'lost') {
        setText(!raw.sensorSeen && !raw.carSeen ? t.lostBoth : !raw.sensorSeen ? t.lostSensor : t.lostCar);
      } else if (!h.inRange) {
        setText(t.tooFar);
      } else if (state === 'intro') {
        setText(pulse && pulse.leg === 'out' ? b.introOut : b.introBack);
      } else {
        setText(h.heard ? b.exploreInside : b.exploreOutside);
      }

      draw({
        pulse,
        forward: held.value ? held.value.gap.forward : null,
        sideways: held.value ? held.value.gap.sideways : null,
        cm,
        // reachCm: how far the outgoing sound travels (to the car, or to the end of the range).
        cone: { halfDeg: C.CONE_HALF_DEG, rangeCm: C.RANGE_CM, reachCm: reach },
      });
    }
    requestAnimationFrame(tick);
  }

  return { start };
})();
