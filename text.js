// text.js — every word the student sees, in one place.
// Bahasa Indonesia is the default; add ?lang=en to the address for English.

const Text = (() => {
  const STRINGS = {
    id: {
      echoTime: 'Waktu gema',
      distance: 'Jarak',
      ms: 'ms',
      cm: 'cm',
      predictQuestion: 'Kalau mobil dijauhkan dari sensor, gema akan kembali…',
      predictOptions: { sooner: 'lebih cepat', later: 'lebih lama', same: 'sama saja' },
      introOut: 'Suara pergi ke mobil…',
      introBack: '…lalu pulang ke sensor.',
      explore: 'Geser mobil mendekat dan menjauh.',
      tooFar: 'Mobil terlalu jauh. Dekatkan ke sensor.',
      lostSensor: 'Kartu Sensor tidak terlihat. Arahkan kamera ke kedua kartu.',
      lostCar: 'Kartu Mobil tidak terlihat. Arahkan kamera ke kedua kartu.',
      lostBoth: 'Arahkan kamera ke kartu Sensor dan kartu Mobil.',
      done: 'Selesai',
      finished: 'Langkah Gema selesai.',
      sensor: 'Sensor',
      car: 'Mobil',
      buzzer: 'Buzzer',
    },
    en: {
      echoTime: 'Echo time',
      distance: 'Distance',
      ms: 'ms',
      cm: 'cm',
      predictQuestion: 'If the car moves further from the sensor, the echo comes back…',
      predictOptions: { sooner: 'sooner', later: 'later', same: 'at the same time' },
      introOut: 'The sound goes to the car…',
      introBack: '…then comes back to the sensor.',
      explore: 'Slide the car closer and further away.',
      tooFar: 'The car is too far. Bring it closer to the sensor.',
      lostSensor: 'The Sensor card is out of view. Point the camera at both cards.',
      lostCar: 'The Car card is out of view. Point the camera at both cards.',
      lostBoth: 'Point the camera at the Sensor card and the Car card.',
      done: 'Done',
      finished: 'Echo step finished.',
      sensor: 'Sensor',
      car: 'Car',
      buzzer: 'Buzzer',
    },
  };

  const lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'id';
  document.documentElement.lang = lang;
  return { lang, t: STRINGS[lang] };
})();
