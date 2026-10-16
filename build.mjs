// Builds the CV pages from resume.json (Schema Resume 1.3, https://schema-resume.org/).
//
//   node build.mjs
//
// resume.json is the full CV and the only place facts live. Each cv/<area>.json is an
// overlay that turns it into a focused CV for one area:
//   title     name of the area, shown in the CV links
//   basics    fields that replace the ones in resume.json (label, summary, ...)
//   work      { "<company name>": { fields to replace, e.g. highlights } }
//   projects  which projects to show, in order: a project name from resume.json, or a
//             full project object. Conferences are always kept.
//   skills    replaces the skills list
//
// Output (commit it, GitHub Pages serves the repo as-is):
//   index.html               full CV
//   <area>/index.html        focused CV
//   <area>/resume.json       focused CV as a Schema Resume document
// Every page also embeds its document as JSON-LD.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';

const SITE = 'https://oscarolbe.github.io/';
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

const master = readJson('resume.json');
const css = readFileSync('style.css', 'utf8');
const areas = readdirSync('cv').filter(f => f.endsWith('.json')).sort()
  .map(f => ({ slug: f.replace(/\.json$/, ''), ...readJson(`cv/${f}`) }));

// ---- Overlays ----------------------------------------------------------------
function applyOverlay(base, area) {
  const doc = structuredClone(base);
  Object.assign(doc.basics, area.basics);
  for (const [name, fields] of Object.entries(area.work ?? {})) {
    const job = doc.work.find(w => w.name === name);
    if (!job) throw new Error(`cv/${area.slug}.json: no work entry named "${name}" in resume.json`);
    Object.assign(job, fields);
  }
  if (area.projects) {
    const picked = area.projects.map(p => {
      if (typeof p !== 'string') return p;
      const found = base.projects.find(x => x.name === p);
      if (!found) throw new Error(`cv/${area.slug}.json: no project named "${p}" in resume.json`);
      return found;
    });
    doc.projects = [...picked, ...base.projects.filter(p => p.type === 'conference')];
  }
  if (area.skills) doc.skills = area.skills;
  doc.meta = { ...doc.meta, canonical: `${SITE}${area.slug}/resume.json` };
  return doc;
}

// ---- HTML --------------------------------------------------------------------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const countryName = code => new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const date = d => {
  const [y, m] = d.split('-');
  return m ? `${MONTHS[m - 1]} ${y}` : y;
};
const dates = ({ startDate, endDate }) =>
  startDate ? `${date(startDate)} – ${endDate ? date(endDate) : 'Present'}` : endDate ? date(endDate) : '';
const join = (...parts) => parts.filter(Boolean).join(' · ');

// Names of projects with a link become links wherever a highlight mentions them.
function linkify(text, projects) {
  let html = esc(text);
  for (const p of projects) {
    if (!p.url) continue;
    html = html.replace(new RegExp(`\\b${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`), `<a href="${esc(p.url)}">${esc(p.name)}</a>`);
  }
  return html;
}

function linkLabel(url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return host === 'github.com' ? 'GitHub' : host;
}

function renderJob(job, allProjects) {
  return `
  <h3>${esc(job.position)}, ${esc(job.name)}</h3>
  <p class="meta">${esc(join(job.description, job.workLocation, dates(job)))}</p>${job.summary ? `
  <p>${esc(job.summary)}${job.url ? ` <a href="${esc(job.url)}">${esc(linkLabel(job.url))}</a>` : ''}</p>` : ''}${job.highlights?.length ? `
  <ul>
${job.highlights.map(h => `    <li>${linkify(h, allProjects)}</li>`).join('\n')}
  </ul>` : ''}${job.keywords?.length ? `
  <p class="tech"><strong>Technologies:</strong> ${esc(job.keywords.join(', '))}.</p>` : ''}
`;
}

function renderPage(doc, { slug = '', title = 'Full CV' } = {}) {
  const root = slug ? '../' : '';
  const b = doc.basics;
  // A job is current when it has no end date or ends after the CV was last updated.
  const updated = doc.meta?.lastModified ?? '';
  const isCurrent = w => !w.endDate || w.endDate.slice(0, 7) > updated.slice(0, 7);
  const detailed = doc.work.filter(w => w.highlights?.length || w.summary);
  const current = detailed.filter(isCurrent);
  const past = detailed.filter(w => !isCurrent(w));
  const brief = doc.work.filter(w => !detailed.includes(w));
  const apps = (doc.projects ?? []).filter(p => p.type !== 'conference');
  const conferences = (doc.projects ?? []).filter(p => p.type === 'conference');
  const nav = [{ slug: '', title: 'Full CV' }, ...areas].map(a => a.slug === slug
    ? `<a href="${root}${a.slug ? a.slug + '/' : ''}" aria-current="page">${esc(a.title)}</a>`
    : `<a href="${root}${a.slug ? a.slug + '/' : ''}">${esc(a.title)}</a>`).join(' · ');
  const pageTitle = slug ? `${b.name} - ${title} CV` : `${b.name} - Developer Profile`;
  const jsonLd = JSON.stringify(doc).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<!-- Generated by build.mjs from resume.json${slug ? ` and cv/${slug}.json` : ''}. Edit those, then run: node build.mjs -->
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(b.label)}">
<link rel="alternate" type="application/json" href="resume.json" title="Schema Resume">
<script type="application/ld+json">${jsonLd}</script>
<style>
${css.trimEnd().replace(/^(?=.)/gm, '  ')}
</style>
</head>
<body>
<main>

<header>
  <p class="cv-nav">CV: ${nav}</p>
  <h1>${esc(b.name)}</h1>
  <p class="role">${esc(b.label)}</p>${b.location?.countryCode ? `
  <p class="location">Based in ${esc([b.location.city, countryName(b.location.countryCode)].filter(Boolean).join(', '))}${b.location.relocation ? `. ${esc(b.location.relocation)}` : ''}</p>` : ''}
  <p class="links">
${(b.profiles ?? []).map(p => `    <a href="${esc(p.url)}">${esc(p.network)}</a>`).join('\n')}${b.email ? `
    <a href="mailto:${esc(b.email)}">${esc(b.email)}</a>` : ''}
  </p>
</header>

<section>
  <h2>About</h2>
  <p>${esc(b.summary)}</p>${b.coreCompetencies?.length ? `
  <p class="focus"><strong>Focus:</strong> ${esc(b.coreCompetencies.join(' · '))}</p>` : ''}
</section>
${current.length ? `
<section>
  <h2>Current Work</h2>${current.map(j => renderJob(j, doc.projects ?? [])).join('')}</section>
` : ''}
<section>
  <h2>Experience</h2>${past.map(j => renderJob(j, doc.projects ?? [])).join('')}${brief.length ? `
  <h3>Earlier Roles</h3>
  <ul>
${brief.map(w => `    <li><strong>${esc(w.position)}, ${esc(w.name)}</strong> · ${esc(dates(w))}</li>`).join('\n')}
  </ul>` : ''}
</section>
${apps.length ? `
<section>
  <h2>Projects</h2>
  <div class="skills-grid">
${apps.map((p, i) => `    <div class="card${p.highlights?.length ? ' expandable' : ''}">
      <h4>${esc(p.name)}</h4>
      <p>${esc(p.description ?? '')}${p.url ? ` <a href="${esc(p.url)}">${esc(linkLabel(p.url))}</a>` : ''}</p>${p.highlights?.length ? `
      <div class="details" id="project-${i}">
        <div>
          <ul>
${p.highlights.map(h => `            <li>${esc(h)}</li>`).join('\n')}
          </ul>${p.keywords?.length ? `
          <p class="tech"><strong>Technologies:</strong> ${esc(p.keywords.join(', '))}.</p>` : ''}
        </div>
      </div>
      <button type="button" class="expand" aria-expanded="false" aria-controls="project-${i}" hidden>Show details</button>` : ''}
    </div>`).join('\n')}
  </div>
</section>
` : ''}${doc.education?.length ? `
<section>
  <h2>Education</h2>
  <ul>
${doc.education.map(e => `    <li><strong>${esc(join(e.studyType && e.area ? `${e.studyType} in ${e.area}` : e.studyType || e.area))}</strong>, ${esc(e.institution)}, ${esc(dates(e))}</li>`).join('\n')}
  </ul>
</section>
` : ''}${doc.skills?.length ? `
<section>
  <h2>Skills</h2>
  <div class="skills-grid">
${doc.skills.map(s => `    <div class="card">
      <h4>${esc(s.name)}</h4>
      <p>${esc((s.keywords ?? []).join(', '))}</p>
    </div>`).join('\n')}
  </div>
</section>
` : ''}${conferences.length ? `
<section>
  <h2>Conferences</h2>
  <ul>
${conferences.map(c => `    <li>${esc(c.name)}, ${esc(date(c.startDate))}</li>`).join('\n')}
  </ul>
</section>
` : ''}${doc.languages?.length ? `
<section>
  <h2>Languages</h2>
  <p>${esc(doc.languages.map(l => `${l.language}: ${l.fluency}`).join(' · '))}</p>
</section>
` : ''}${doc.interests?.length ? `
<section>
  <h2>Interests</h2>
  <p>${esc(doc.interests.map(i => i.name).join(' · '))}</p>
</section>
` : ''}
<footer>
  © ${esc(updated.slice(0, 4))} ${esc(b.name)} · This CV as <a href="resume.json">JSON</a> (<a href="https://schema-resume.org/">Schema Resume</a>)
</footer>

</main>
<script>
// Project highlights start collapsed; without JavaScript they stay open.
for (const button of document.querySelectorAll('.card .expand')) {
  const card = button.closest('.card');
  card.classList.add('collapsed');
  button.hidden = false;
  button.addEventListener('click', () => {
    const open = card.classList.toggle('collapsed') === false;
    button.setAttribute('aria-expanded', open);
    button.textContent = open ? 'Show less' : 'Show details';
    if (open) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}
</script>
</body>
</html>
`;
}

// ---- Write -------------------------------------------------------------------
writeFileSync('index.html', renderPage(master));
console.log('index.html');
for (const area of areas) {
  const doc = applyOverlay(master, area);
  mkdirSync(area.slug, { recursive: true });
  writeFileSync(`${area.slug}/index.html`, renderPage(doc, area));
  writeFileSync(`${area.slug}/resume.json`, JSON.stringify(doc, null, 2) + '\n');
  console.log(`${area.slug}/index.html, ${area.slug}/resume.json`);
}
