// =========================
// Helpers & utils
// =========================
function $(q, el = document) { return el.querySelector(q); }
function norm(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
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

// fetch + JSON toujours préfixés correctement
async function loadJSON(url) {
  const res = await fetch(withBase(url), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}

// ==============================
// Accents cassés (léger)
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
  // Ex: /Pokemon_Destination/region/Johto/Pokedex_Johto.html -> "Johto"
  const decoded = decodeURIComponent(location.pathname);
  const m = decoded.match(/\/region\/([^/]+)/i);
  return m ? m[1] : 'Johto';
}

// ==================
// Pokédex (liste)
// ==================
async function initIndex(){
  try{
    const list = document.querySelector('.grid');
    const q = document.getElementById('q');

    // petit compteur visible
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

    // ⚠️ IMPORTANT: chemin via withBase
    const data = await loadJSON(`/data/pokedex_${rk}.json`);

    const render = (items)=>{
      if (!list) return;
      list.innerHTML = items.map(p=>{
        const name = (p.name||'').toLowerCase();
        const href = withBase(`/pokemon.html?r=${encodeURIComponent(region)}&n=${encodeURIComponent(name)}`);

        // candidats d’image (cascade en onerror)
        const candidates = [
          p.image || '',
          withBase(`/assets/pkm/${name}.png`),
          withBase(`/assets/pkm/${rk}/${name}.png`),
          withBase(`/assets/pkm/${name}_TCG.png`),
          withBase(`/assets/pkm/${(p.name||'').toUpperCase()}.png`)
        ].filter(Boolean);
        const dataSrcs = encodeURIComponent(JSON.stringify(candidates));

        return `
          <div class="card">
            <div class="cardRow">
              <img class="thumb pokeimg"
                   src="${candidates[0]}"
                   alt="${p.name}"
                   data-srcs="${dataSrcs}"
                   data-idx="0"
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

      // Fallback image en cascade
      list.querySelectorAll('img.pokeimg').forEach(img=>{
        img.onerror = () => {
          try {
            const srcs = JSON.parse(decodeURIComponent(img.getAttribute('data-srcs')));
            let idx = parseInt(img.getAttribute('data-idx') || '0', 10);
            idx++;
            if (idx < srcs.length) {
              img.setAttribute('data-idx', String(idx));
              img.src = srcs[idx];
            } else {
              img.style.display = 'none';
            }
          } catch {
            img.style.display = 'none';
          }
        };
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
    const c = document.querySelector('.container') || document.body;
    c.insertAdjacentHTML('afterbegin',
      `<div class="card">Erreur de chargement du Pokédex.<br><span class="small">${err.message}</span></div>`);
  }
}

// ==================
// Fiche Pokémon (simple, fonctionne)
// ==================
async function initPokemon(){
  try{
    const region = getParam('r','Johto');
    const rk = slugRegion(region);
    const name  = decodeURIComponent(getParam('n',''));
    if (!name){
      document.querySelector('.container')?.insertAdjacentHTML('beforeend', `<div class="card">Aucun Pokémon précisé.</div>`);
      return;
    }

    const data = await loadJSON(`/data/pokedex_${rk}.json`);
    const p = data.find(x => (x.name||'').toLowerCase() === name);
    if(!p){
      document.querySelector('.container')?.insertAdjacentHTML('beforeend', `<div class="card">Pokémon introuvable dans ${region}.</div>`);
      return;
    }

    document.getElementById('title')?.textContent = p.name;
    document.getElementById('pokename')?.textContent = p.name;
    document.getElementById('types')?.innerHTML = (p.types||[]).map(t=>`<span class="badge">${t}</span>`).join(' ');
    document.getElementById('evo')?.textContent  = p.evolution || '?';
    document.getElementById('pokedex')?.textContent = p.pokedex || '?';

    // Sprite (dossier assets/pkm)
    const img = document.getElementById('sprite');
    if (img){
      const tryList = [
        withBase(`/assets/pkm/${name}.png`),
        withBase(`/assets/pkm/${rk}/${name}.png`)
      ];
      let i = 0;
      img.onerror = ()=>{ i++; if (i < tryList.length) img.src = tryList[i]; else img.style.display='none'; };
      img.src = tryList[0];
    }

    fixBrokenAccentsInDom();
  }catch(err){
    console.error(err);
    const c = document.querySelector('.container') || document.body;
    c.insertAdjacentHTML('afterbegin',
      `<div class="card">Erreur de chargement de la fiche.<br><span class="small">${err.message}</span></div>`);
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
