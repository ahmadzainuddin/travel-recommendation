// Travel Recommendation App — Search, Fetch, Render

(function () {
  const state = {
    data: null,
  };

  const els = {
    form: null,
    input: null,
    reset: null,
    resultsWrap: null,
    resultsGrid: null,
  };

  function $(sel) { return document.querySelector(sel); }

  function initDomRefs() {
    els.form = $('#nav-search-form');
    els.input = $('#searchInput');
    els.reset = $('#resetBtn');
    els.resultsWrap = $('#results-right');
    els.resultsGrid = $('#resultsList');
  }

  function setBusy(isBusy) {
    if (!els.resultsGrid) return;
    els.resultsGrid.setAttribute('aria-busy', String(!!isBusy));
  }

  async function loadData() {
    try {
      const res = await fetch('travel_recommendation_api.json');
      const json = await res.json();
      console.log('Loaded travel data:', json);
      state.data = json;
    } catch (err) {
      console.error('Failed to load travel_recommendation_api.json', err);
      // Provide a minimal fallback to keep UI functional
      state.data = { beaches: [], temples: [], countries: [] };
    }
  }

  function normalize(s) {
    return (s || '').toString().trim().toLowerCase();
  }

  function parseCountryFromName(name) {
    if (!name) return '';
    const parts = String(name).split(',');
    const last = parts[parts.length - 1];
    return (last || '').trim();
  }

  function matchKeyword(q, words) {
    return words.some(w => q === w || q.includes(w));
  }

  function flattenCountryCities(countries) {
    const items = [];
    (countries || []).forEach(c => {
      (c.cities || []).forEach(city => items.push({
        name: city.name,
        imageUrl: city.imageUrl,
        description: city.description,
        meta: c.name,
      }));
    });
    return items;
  }

  function findCountryByName(data, q) {
    q = normalize(q);
    return (data.countries || []).find(c => normalize(c.name) === q || normalize(c.name).includes(q));
  }

  function findCitiesByName(data, q) {
    q = normalize(q);
    const matches = [];
    (data.countries || []).forEach(c => {
      (c.cities || []).forEach(city => {
        const name = normalize(city.name);
        if (name === q || name.includes(q)) matches.push({
          name: city.name,
          imageUrl: city.imageUrl,
          description: city.description,
          meta: c.name,
        });
      });
    });
    return matches;
  }

  function searchData(query) {
    const q = normalize(query);
    const data = state.data || {};

    if (matchKeyword(q, ['beach', 'beaches'])) {
      return (data.beaches || []).map(b => ({ name: b.name, imageUrl: b.imageUrl, description: b.description, meta: parseCountryFromName(b.name) }));
    }
    if (matchKeyword(q, ['temple', 'temples'])) {
      return (data.temples || []).map(t => ({ name: t.name, imageUrl: t.imageUrl, description: t.description, meta: parseCountryFromName(t.name) }));
    }
    if (matchKeyword(q, ['country', 'countries'])) {
      return flattenCountryCities(data.countries || []);
    }

    // Try matching a specific country or city name
    const country = findCountryByName(data, q);
    if (country) {
      return (country.cities || []).map(city => ({ name: city.name, imageUrl: city.imageUrl, description: city.description, meta: country.name }));
    }

    const cities = findCitiesByName(data, q);
    if (cities.length) return cities;

    // Fallback: if nothing matched, check for loose inclusion in beaches/temples names
    const loose = [];
    (data.beaches || []).forEach(b => { if (normalize(b.name).includes(q)) loose.push({ name: b.name, imageUrl: b.imageUrl, description: b.description, meta: parseCountryFromName(b.name) }); });
    (data.temples || []).forEach(t => { if (normalize(t.name).includes(q)) loose.push({ name: t.name, imageUrl: t.imageUrl, description: t.description, meta: parseCountryFromName(t.name) }); });
    return loose;
  }

  // Country → IANA timezone mapping (extend as needed)
  const TZ_MAP = Object.freeze({
    'australia': 'Australia/Sydney',
    'japan': 'Asia/Tokyo',
    'brazil': 'America/Sao_Paulo',
    'french polynesia': 'Pacific/Tahiti',
    'cambodia': 'Asia/Phnom_Penh',
    'india': 'Asia/Kolkata'
  });

  function countryToTimeZone(country) {
    const key = normalize(country);
    return TZ_MAP[key] || null;
  }

  function formatTime(tz) {
    try {
      const opts = { timeZone: tz, hour12: true, hour: 'numeric', minute: 'numeric', second: 'numeric' };
      return new Date().toLocaleTimeString('en-US', opts);
    } catch (e) {
      return '';
    }
  }

  let tickerId = null;
  function stopTimeTicker() { if (tickerId) { clearInterval(tickerId); tickerId = null; } }
  function startTimeTicker() {
    stopTimeTicker();
    tickerId = setInterval(() => {
      if (!els.resultsWrap) return;
      els.resultsWrap.querySelectorAll('.time[data-tz]')
        .forEach(el => {
          const tz = el.getAttribute('data-tz');
          if (!tz) return;
          const label = el.getAttribute('data-label') || '';
          el.textContent = `${label}${formatTime(tz)}`;
        });
    }, 1000);
  }

  function clearResults() {
    if (!els.resultsGrid || !els.resultsWrap) return;
    els.resultsGrid.innerHTML = '';
    els.resultsWrap.hidden = true;
    stopTimeTicker();
  }

  function renderResults(items) {
    if (!els.resultsGrid || !els.resultsWrap) return;
    els.resultsGrid.innerHTML = '';

    if (!items || !items.length) {
      els.resultsWrap.hidden = false;
      els.resultsGrid.innerHTML = '<div class="place"><div class="info"><h3 class="title">No results</h3><p class="desc">Try keywords like “beaches”, “temples”, or a country name (e.g., Japan).</p></div></div>';
      return;
    }

    const frag = document.createDocumentFragment();
    items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'place';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = item.imageUrl || '';
      img.alt = item.name || 'Destination image';
      const info = document.createElement('div');
      info.className = 'info';
      const title = document.createElement('h3');
      title.className = 'title';
      title.textContent = item.name || '';
      const desc = document.createElement('p');
      desc.className = 'desc';
      desc.textContent = item.description || '';
      info.appendChild(title);
      info.appendChild(desc);

      // Optional: show local time for the country
      const country = item.meta || parseCountryFromName(item.name);
      const tz = countryToTimeZone(country);
      if (tz) {
        const timeEl = document.createElement('p');
        timeEl.className = 'time';
        timeEl.setAttribute('data-tz', tz);
        timeEl.setAttribute('data-label', `Local time in ${country}: `);
        timeEl.textContent = `Local time in ${country}: ${formatTime(tz)}`;
        info.appendChild(timeEl);
      }
      card.appendChild(img);
      card.appendChild(info);
      frag.appendChild(card);
    });
    els.resultsGrid.appendChild(frag);
    els.resultsWrap.hidden = false;
    startTimeTicker();
  }

  function onSearchSubmit(e) {
    e.preventDefault();
    const q = (els.input && els.input.value) || '';
    setBusy(true);
    const items = searchData(q);
    renderResults(items);
    setBusy(false);
  }

  function hookEvents() {
    if (els.form) els.form.addEventListener('submit', onSearchSubmit);
    if (els.reset) els.reset.addEventListener('click', () => {
      if (els.input) els.input.value = '';
      clearResults();
      els.input?.focus();
    });
  }

  window.addEventListener('DOMContentLoaded', async () => {
    initDomRefs();
    await loadData();
    hookEvents();
  });
})();
