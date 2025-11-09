// =========================
// Helpers & utils
// =========================
function $(q, el = document) { return el.querySelector(q); }
function norm(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
async function loadJSON(url) {
  const res = await fetch(withBase(url), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}
function getParam(name, def=''){ const u = new URL(location.href); return u.searchParams.get(name) ?? def; }
function slugRegion(s){ return norm(s).replace(/\s+/g,'_'); }

// --- GitHub Pages base-path helper ---
const REPO_BASE = (() => {
  const parts = location.pathname.split('/').filter(Boolean);
  return location.hostname.endsWith('github.io') && parts.length ? `/${parts[0]}` : '';
})();
const withBase = (p) => {
  if (!p) return p;
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith(REPO_BASE + '/')) return p;
  if (p.startsWith('/')) return REPO_BASE + p;
  return REPO_BASE + '/' + p.replace(/^.\//,'');
};

// --- Image loader: cherche dans assets/pkm et assets/pkm2 ---
function setSprite(imgEl, name, rk) {
  const variants = [
    name,
    name.toUpperCase(),
    name.replace(/\s+/g, '_'),
    name.toUpperCase().replace(/\s+/g, '_')
  ];
  const candidates = [];
  for (const v of variants) {
    candidates.push(withBase(`/assets/pkm/${v}.png`));
    candidates.push(withBase(`/assets/pkm2/${v}.png`));
    if (rk) {
      const r = rk.toLowerCase();
      candidates.push(withBase(`/assets/pkm/${r}/${v}.png`));
      candidates.push(withBase(`/assets/pkm2/${r}/${v}.png`));
    }
  }
  let i = 0;
  const tryNext = () => {
    if (i >= candidates.length) return;
    imgEl.onerror = () => { i++; tryNext(); };
    imgEl.src = candidates[i];
  };
  tryNext();
}

// ==============================
// Correction des accents cassés
// ==============================
function fixBrokenAccentsInDom(root = document.body) {
  const map = [['Pokmon','Pokémon'], ['Pokdex','Pokédex'], ['Capacits','Capacités']];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let n; const toFix = [];
  while ((n = walker.nextNode())) { if (/Pok/.test(n.nodeValue||'')) toFix.push(n); }
  for (const node of toFix) {
    let t = node.nodeValue;
    for (const [bad, good] of map) t = t.split(bad).join(good);
    if (t !== node.nodeValue) node.nodeValue = t;
  }
}

// ==================
// Détection région depuis l'URL
// ==================
function detectRegionFromPath() {
  const decoded = decodeURIComponent(location.pathname);
  const m = decoded.match(/\/region\/([^/]+)/i);
  return m ? m[1] : 'Johto';
}

// ==================
// Pokédex (liste) avec fallback d'images
// ==================
async function initIndex(){
  try{
    const list = $('.grid');
    const q = $('#q');
    let status = document.getElementById('status');
    if (!status) {
      status = document.createElement('div');
      status.id = 'status';
      status.className = 'small';
      if (q && q.parentElement) q.insertAdjacentElement('afterend', status);
      else if (list && list.parentElement) list.parentElement.insertBefore(status, list);
    }

    const region = detectRegionFromPath();
    const rk = slugRegion(region);
    const data = await loadJSON(withBase(`/data/pokedex_${rk}.json`));

    const render = (items)=>{
      list.innerHTML = items.map(p=>{
        const name = p.name.toLowerCase();
        const href = withBase(`/pokemon.html?r=${encodeURIComponent(region)}&n=${encodeURIComponent(name)}`);
        return `
          <div class="card">
            <div class="cardRow">
              <img id="img-${name}" class="thumb"
                   alt="${p.name}"
                   loading="lazy"
                   style="width:64px;height:64px;image-rendering:pixelated;object-fit:contain;">
              <div class="cardBody">
                <div class="h2">${p.name}</div>
                <div>${(p.types||[]).map(t=>`<span class="badge">${t}</span>`).join(' ')}</div>
                <div class="small" style="margin-top:4px">${p.evolution ? p.evolution : ''}</div>
                <div style="margin-top:8px"><a href="${href}">Ouvrir la fiche</a></div>
              </div>
            </div>
          </div>`;
      }).join('');
      status.textContent = `${items.length} Pokémon affiché${items.length>1?'s':''}`;
      list.querySelectorAll('img[id^="img-"]').forEach(img=>{
        const nm = img.id.replace('img-','');
        setSprite(img, nm, rk);
      });
    };

    render(data);

    if(q){
      q.addEventListener('input', e=>{
        const v = norm(e.target.value);
        const f = data.filter(p =>
          norm(p.name).includes(v) ||
          norm((p.types||[]).join(' ')).includes(v)
        );
        render(f);
      });
    }
  }catch(err){
    console.error(err);
    const c = $('.container');
    if (c) c.innerHTML = `<div class="card">Erreur de chargement du Pokédex.<br><span class="small">${err.message}</span></div>`;
  }
}

// ==================
// Fiche Pokémon
// ==================
async function initPokemon(){
  try{
    const region = getParam('r','Johto');
    const rk = slugRegion(region);
    const name  = decodeURIComponent(getParam('n',''));
    if (!name){
      $('.container')?.insertAdjacentHTML('beforeend', `<div class="card">Aucun Pokémon précisé.</div>`);
      return;
    }

    const data = await loadJSON(withBase(`/data/pokedex_${rk}.json`));
    const p = data.find(x => x.name.toLowerCase() === name);
    if(!p){
      $('.container')?.insertAdjacentHTML('beforeend', `<div class="card">Pokémon introuvable dans ${region}.</div>`);
      return;
    }

    $('#title')?.textContent = p.name;
    $('#pokename')?.textContent = p.name;
    $('#types')?.innerHTML = (p.types||[]).map(t=>`<span class="badge">${t}</span>`).join(' ');
    $('#evo')?.textContent = p.evolution || '?';

    const habilEl = $('#habil');
    if (habilEl) habilEl.innerHTML = (p.abilities||[]).map(a=>`<a href="moves.html#${encodeURIComponent(a)}">${a}</a>`).join(', ') || '?';
    const habhidEl = $('#habhid');
    if (habhidEl) habhidEl.innerHTML = p.hidden_ability ? `<a href="moves.html#${encodeURIComponent(p.hidden_ability)}">${p.hidden_ability}</a>` : '?';

    $('#pokedex')?.textContent = p.pokedex || '?';
    const img = $('#sprite');
    if (img) setSprite(img, name, rk);

    fixBrokenAccentsInDom();
  }catch(err){
    console.error(err);
    const c = $('.container');
    if (c) c.innerHTML = `<div class="card">Erreur de chargement de la fiche.<br><span class="small">${err.message}</span></div>`;
  }
}

// ==================
// Auto-init
// ==================
document.addEventListener('DOMContentLoaded', () => {
  const file = location.pathname.split('/').pop().toLowerCase();
  if (file.startsWith('pokedex')) initIndex();
  else if (file === 'pokemon.html') initPokemon();
});
