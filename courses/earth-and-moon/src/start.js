const response = await fetch('content/lesson.json');
if (!response.ok) throw new Error('Could not load the lesson transcript.');
const lesson = await response.json();
window.COURSE = lesson.chapters;
window.DUR = lesson.secondsPerCue;
window.IMG = {
  cover: 'cover.webp',
  earth: 'assets/earth.jpg',
  moon: 'assets/moon.jpg',
  cards: lesson.chapters.map((_, index) => 'assets/chapter-' + (index + 1) + '.webp')
};
await import('./app.js');
