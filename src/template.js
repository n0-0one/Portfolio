/**
 * Build-time HTML generator. Runs inside vite.config.js, so the final
 * index.html ships with real, crawlable markup (no client-side templating).
 */

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// *word* → <em>, [[preset]] → inline live screen
const rich = (s, { thumbs = false } = {}) => {
  let out = esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/\[\[(\w+)\]\]/g, (_, p) =>
    thumbs ? `<span class="thumb" data-gl="${p}" data-thumb aria-hidden="true"></span>` : ''
  );
  return out;
};

// Split text into word spans for scroll reveals, keeping markup intact.
const words = (html) =>
  html.replace(/(<span class="thumb"[^>]*><\/span>)|(<em>.*?<\/em>)|([^\s<]+)/g, (m, thumb, em, word) => {
    if (thumb) return `<span class="w w--thumb">${thumb}</span>`;
    if (em) {
      const inner = em.slice(4, -5);
      return inner
        .split(/\s+/)
        .map((x) => `<span class="w"><em>${x}</em></span>`)
        .join(' ');
    }
    return `<span class="w">${word}</span>`;
  });

// Deterministic fake barcode from a string. Tiny detail, big "made by a person" energy.
const barcode = (str) => {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  let x = 0;
  let bars = '';
  for (let i = 0; i < 38; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    const w = 1 + (h % 3);
    if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="28"/>`;
    x += w;
  }
  return `<svg class="barcode" viewBox="0 0 ${x} 28" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
};

const secHead = (c) =>
  `<div class="sec-head" aria-hidden="true"><span class="sec-head__ch">CH ${c.ch}</span><span class="sec-head__rule"></span><span class="sec-head__name">${esc(
    c.name
  )}</span><span class="sec-head__freq">${c.freq.toFixed(1)}</span></div>`;

// Vertical tuning ruler (87.5 → 108.5 MHz).
const PX_PER_MHZ = 64;
const dialSvg = (channels) => {
  const top = 87.5;
  const bottom = 108.5;
  const h = (bottom - top) * PX_PER_MHZ;
  let ticks = '';
  for (let i = 0; i <= (bottom - top) * 10; i++) {
    const f = top + i / 10;
    const y = (f - top) * PX_PER_MHZ;
    const major = i % 10 === 5; // whole MHz (88, 89 …)
    const mid = i % 5 === 0 && !major;
    const len = major ? 22 : mid ? 13 : 7;
    ticks += `<line x1="${60 - len}" x2="60" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" class="${major ? 'mj' : ''}"/>`;
    if (major) ticks += `<text x="22" y="${(y + 3.5).toFixed(1)}">${Math.round(f)}</text>`;
  }
  const stations = channels
    .map((c) => {
      const y = ((c.freq - top) * PX_PER_MHZ).toFixed(1);
      return `<circle cx="68" cy="${y}" r="2.5" class="st"/>`;
    })
    .join('');
  return `<svg class="dial__svg" width="80" height="${h}" viewBox="0 0 80 ${h}" data-px="${PX_PER_MHZ}" data-top="${top}">${ticks}${stations}</svg>`;
};

export function renderHead(c) {
  const title = esc(c.seo.title);
  const desc = esc(c.seo.description);
  return `<title>${title}</title>
<meta name="description" content="${desc}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:url" content="${esc(c.seo.url)}" />
<meta property="og:image" content="${esc(c.seo.url)}og.jpg" />
<meta name="twitter:card" content="summary_large_image" />`;
}

export function renderApp(c) {
  const ch = Object.fromEntries(c.channels.map((x) => [x.id, x]));
  const links = c.links.filter((l) => l.url);
  const ctaHref = c.contact.email ? `mailto:${c.contact.email}` : links[0]?.url || '#';
  const ext = (url) => (url.startsWith('http') ? ' target="_blank" rel="noopener"' : '');

  const stations = c.channels
    .map((x) => `data-${x.id}="${x.freq}"`)
    .join(' ');

  return `
<a class="skip" href="#static">Skip to content</a>
<div class="grain" aria-hidden="true"></div>
<canvas class="gl" aria-hidden="true"></canvas>

<div class="loader" aria-hidden="true">
  <div class="loader__corner loader__corner--tl">${esc(c.handle)}</div>
  <div class="loader__corner loader__corner--tr">FM / Stereo</div>
  <div class="loader__inner">
    <p class="loader__label"><span class="loader__status">Searching for signal</span><span class="blink">_</span></p>
    <div class="loader__freq"><span class="loader__num">000.0</span><span class="loader__unit">MHz</span></div>
    <svg class="loader__wave" viewBox="0 0 600 60" preserveAspectRatio="none"><path d="M0 30 L600 30"/></svg>
  </div>
  <div class="loader__corner loader__corner--bl">Tuning</div>
  <div class="loader__corner loader__corner--br"><span class="loader__pct">00</span>%</div>
</div>

<header class="hud">
  <a class="hud__logo" href="#signal" data-cursor="Rewind">${esc(c.handle)}<span class="onair"><i></i>On air</span></a>
  <p class="hud__channel" aria-live="polite"><span class="hud__ch">CH 01</span><span class="hud__sep">/</span><span class="hud__name">Signal</span></p>
  <div class="hud__right">
    <button class="hud__btn sound-toggle" type="button" aria-pressed="false" data-cursor="Listen">Sound<span class="sound-toggle__state">Off</span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></button>
    <button class="hud__btn menu-toggle" type="button" aria-expanded="false" aria-controls="menu" data-cursor="Open">Menu</button>
  </div>
</header>

<div class="dial" aria-hidden="true" ${stations}>
  <div class="dial__window"><div class="dial__track">${dialSvg(c.channels)}</div></div>
  <div class="dial__needle"></div>
</div>

<div class="hud-bottom" aria-hidden="true">
  <span class="hud-bottom__clock"><span class="clock">--:--:--</span></span>
  <span class="hud-bottom__freq"><span class="freq">88.1</span><small>MHz</small></span>
</div>

<nav class="menu" id="menu" aria-hidden="true" aria-label="Channels">
  <div class="menu__inner">
    <p class="menu__label">Channels</p>
    <ul class="menu__list">
      ${c.channels
        .map(
          (x, i) =>
            `<li style="--i:${i}"><a href="#${x.id}" class="menu__link" data-target="${x.id}" tabindex="-1"><span class="menu__ch">${x.ch}</span><span class="menu__name" data-scramble>${esc(
              x.name
            )}</span><span class="menu__freq">${x.freq.toFixed(1)}</span></a></li>`
        )
        .join('')}
    </ul>
    <div class="menu__foot">
      ${links.map((l) => `<a href="${esc(l.url)}"${ext(l.url)} tabindex="-1">${esc(l.label)}</a>`).join('')}
      ${c.contact.email ? `<a href="mailto:${esc(c.contact.email)}" tabindex="-1">Email</a>` : ''}
    </div>
  </div>
</nav>

<div class="cursor" aria-hidden="true"><div class="cursor__ring"><span class="cursor__label"></span></div><div class="cursor__dot"></div></div>

<main id="top">
  <!-- CH 01 / SIGNAL -->
  <section class="hero" id="signal" data-channel="01" data-name="Signal" data-freq="${ch.signal.freq}">
    <div class="hero__gl" data-gl="hero" data-cursor="Tune"></div>
    <div class="hero__fallback" aria-hidden="true">${c.wordmark.wide.map(esc).join('<br>')}</div>
    <h1 class="sr-only">${esc(c.handle)}, ${esc(c.role)}</h1>
    <div class="hero__ui">
      <p class="hero__role reveal">${esc(c.role).replace(' &amp; ', '<br>&amp; ')}</p>
      <p class="hero__status reveal"><i></i>${esc(c.available)}</p>
      <p class="hero__statement reveal">${rich(c.hero.statement)}</p>
      <p class="hero__hint reveal">${esc(c.hero.hint)}<span class="hero__arrow">↓</span></p>
      <span class="crop crop--tl"></span><span class="crop crop--tr"></span><span class="crop crop--bl"></span><span class="crop crop--br"></span>
    </div>
  </section>

  <!-- CH 02 / STATIC -->
  <section class="manifesto paper" id="static" data-channel="02" data-name="Static" data-freq="${ch.static.freq}">
    ${secHead(ch.static)}
    <p class="manifesto__text">${words(rich(c.manifesto, { thumbs: true }))}</p>
    <dl class="facts">
      ${c.facts.map((f) => `<div class="facts__item"><dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd></div>`).join('')}
    </dl>
  </section>

  <!-- CH 03 / TRANSMISSIONS -->
  <section class="work" id="transmissions" data-channel="03" data-name="Transmissions" data-freq="${ch.transmissions.freq}">
    <div class="work__pin">
      ${secHead(ch.transmissions)}
      <div class="work__track">
        <div class="work__intro">
          <h2 class="work__title">Selected<br><em>transmissions</em></h2>
          <p class="work__count"><span>(${String(c.projects.length).padStart(2, '0')})</span> studies on air</p>
          <p class="work__hint">Keep scrolling<span>→</span></p>
        </div>
        ${c.projects
          .map((p, i) => {
            const n = String(i + 1).padStart(2, '0');
            const media =
              p.media?.type === 'image'
                ? `data-gl="image" data-src="${esc(p.media.src)}"`
                : `data-gl="${esc(p.media?.preset || 'contour')}"`;
            const tag = p.url ? 'a' : 'article';
            const href = p.url ? ` href="${esc(p.url)}"${ext(p.url)}` : '';
            return `<${tag} class="card"${href} data-cursor="${p.url ? 'Open' : 'Poke'}">
          <div class="card__screen" ${media} data-crt role="img" aria-label="${esc(p.title)}, ${esc(p.kind)}"></div>
          <div class="card__meta">
            <span class="card__num">#${n}</span>
            <h3 class="card__title">${esc(p.title)}</h3>
            <p class="card__desc">${esc(p.desc)}</p>
            <ul class="card__tags">${p.stack.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
            <div class="card__foot"><span class="card__state"><i></i>Live / ${esc(p.kind)} / ${esc(p.year)}</span>${barcode(p.title + p.year)}</div>
          </div>
        </${tag}>`;
          })
          .join('\n')}
        <div class="work__outro">
          <p>That is the whole broadcast.<br><em>For now.</em></p>
          ${links[0] ? `<a class="link-arrow" href="${esc(links[0].url)}"${ext(links[0].url)} data-cursor="Open">More on ${esc(links[0].label)} <span>↗</span></a>` : ''}
        </div>
      </div>
      <div class="work__progress" aria-hidden="true"><span></span></div>
    </div>
  </section>

  <!-- CH 04 / NOISE -->
  <section class="noise" id="noise" data-channel="04" data-name="Noise" data-freq="${ch.noise.freq}">
    ${secHead(ch.noise)}
    <div class="noise__stage" data-cursor="Drag">
      <canvas class="noise__canvas" data-lines="${esc(c.noise.lines.join('|'))}"></canvas>
      <p class="sr-only">${esc(c.noise.lines.join(' '))}</p>
      <p class="noise__hint">${esc(c.noise.hint)}</p>
    </div>
    <div class="services">
      <h2 class="services__title">What I <em>do</em></h2>
      <div class="services__list">
        ${c.services
          .map(
            (s, i) => `<details class="svc"${i === 0 ? ' open' : ''}>
          <summary data-cursor="Toggle"><span class="svc__n">0${i + 1}</span><span class="svc__t">${esc(s.title)}</span><span class="svc__x" aria-hidden="true"></span></summary>
          <p>${esc(s.text)}</p>
        </details>`
          )
          .join('\n')}
      </div>
    </div>
  </section>

  <!-- CH 05 / FREQUENCY -->
  <section class="process paper" id="frequency" data-channel="05" data-name="Frequency" data-freq="${ch.frequency.freq}">
    ${secHead(ch.frequency)}
    <div class="marquee" aria-hidden="true"><div class="marquee__inner">${Array(2)
      .fill(c.marquee.map((m) => `<span>${esc(m)}</span><b>/</b>`).join(''))
      .join('')}</div></div>
    <h2 class="process__title">How a signal <em>gets clear</em></h2>
    <ol class="steps">
      ${c.process
        .map(
          (s, i) =>
            `<li class="step"><span class="step__n">0${i + 1}</span><h3 class="step__t">${esc(s.title)}</h3><p>${esc(
              s.text
            )}</p><span class="step__bar"><i style="--l:${(i + 1) * 25}%"></i></span></li>`
        )
        .join('')}
    </ol>
  </section>

  <!-- CH 06 / TRANSMIT -->
  <section class="transmit" id="transmit" data-channel="06" data-name="Transmit" data-freq="${ch.transmit.freq}">
    <div class="transmit__gl" data-gl="rings"></div>
    <div class="transmit__ui">
      ${secHead(ch.transmit)}
      <p class="transmit__kicker">${esc(c.contact.kicker)}</p>
      <h2 class="transmit__title" aria-label="${esc(c.contact.title.join(' '))}">${c.contact.title
        .map((t) => `<span class="stretch" aria-hidden="true">${[...t].map((ch) => `<span>${esc(ch)}</span>`).join('')}</span>`)
        .join('')}</h2>
      <p class="transmit__text">${rich(c.contact.text)}</p>
      <a class="btn-signal" href="${esc(ctaHref)}"${ext(ctaHref)} data-cursor="Send"><span class="btn-signal__in">${esc(
        c.contact.cta
      )}<span class="btn-signal__arrow">→</span></span></a>
      <ul class="links">
        ${links.map((l) => `<li><a href="${esc(l.url)}"${ext(l.url)} data-scramble data-cursor="Open">${esc(l.label)}</a></li>`).join('')}
        ${c.contact.email ? `<li><a href="mailto:${esc(c.contact.email)}" data-scramble data-cursor="Write">${esc(c.contact.email)}</a></li>` : ''}
      </ul>
    </div>
    <footer class="footer">
      <span>© <span class="year">2026</span> ${esc(c.handle)}</span>
      <span class="footer__note">${esc(c.footer.note)}</span>
      <a href="#signal" class="rewind" data-cursor="Rewind">Rewind ↑</a>
    </footer>
  </section>
</main>
<noscript><style>.loader{display:none}</style></noscript>`;
}
