const search = document.querySelector('#search');
const subject = document.querySelector('#subject');
const list = document.querySelector('#list');
function el(tag, text) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}
function link(text, href) {
  const node = el('a', text);
  node.href = href;
  return node;
}
function matches(value, query) {
  return JSON.stringify(value).toLowerCase().includes(query);
}
function draw(courses) {
  const query = search.value.trim().toLowerCase();
  list.replaceChildren();
  for (const course of courses) {
    if (subject.value && !course.subjects.includes(subject.value)) continue;
    if (!matches(course, query)) continue;
    const root = 'courses/' + course.id + '/';
    const card = el('article'), body = el('section'), cover = el('img');
    cover.src = root + course.cover;
    cover.alt = '';
    const actions = el('p');
    actions.append(link('Start course', root + course.entry), '  ·  ', link('Download offline HTML', course.release));
    const chapters = el('details'), items = el('ol');
    const hits = course.chapters.filter(ch => matches(ch, query));
    chapters.open = Boolean(query);
    for (const chapter of (hits.length ? hits : course.chapters)) {
      const li = el('li');
      li.append(link(chapter.question.en, root + course.entry + '?chapter=' + encodeURIComponent(chapter.id)));
      items.append(li);
    }
    chapters.append(el('summary', 'Explore chapter questions'), items);
    body.append(el('h2',course.title.en), el('p',course.description.en), actions, chapters);
    card.append(cover, body);
    list.append(card);
  }
  if (!list.children.length) list.textContent = 'No matching courses. Try another question or subject.';
}
try {
  const res = await fetch('site/catalog.json');
  if (!res.ok) throw new Error('Could not load catalog');
  const courses = await res.json();
  for (const name of [...new Set(courses.flatMap(c => c.subjects))].sort()) subject.add(new Option(name, name));
  for (const control of [search, subject]) control.addEventListener('input', () => draw(courses));
  draw(courses);
} catch {
  list.textContent = 'The course catalog could not load. Please reload the page.';
}
