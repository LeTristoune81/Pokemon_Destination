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
function getParam(name, def=''){
  const u = new URL(location.href);
  return u.searchParams.get(name) ?? def;
}
function slugRegion(s){ return norm(s).replace(/\s+/g,'_'); }

// --- GitHub Pages base-path helper ---
const REPO_BASE = (() => {
  const parts = location.pathname.split('/').filter(Boolean);
  return location.hostname.endsWith('github.io') && parts.length ? `/${parts[0]}` : '';
})();
const withBase = (p) => {
  if (!p) return p;
  if (/^https?:\/\//i.test(p)) return p;      // URL absolue http(s)
  if (p.startsWith(REPO_BASE + '/')) return p; // déjà préfixé
  if (p.startsWith('/')) return REPO_BASE + p; // /data/... -> /Pokemon_Destination/data/...
  return REPO_BASE + '/' + p.replace(/^.\//,'');
};

// ==============================
// Correction des accents cassés
// ==============================
function fixBrokenAccentsInDom(root = document.body) {
  const map = [
    ['Pokmon','Pokémon'], ['Pokdex','Pokédex'], ['Capacits','Capacités']
  ];
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
// Pokédex (liste)
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

    // Pokédex de la région
    const data = await loadJSON(withBase(`/data/pokedex_${rk}.json`));
    const p = data.find(x => x.name.toLowerCase() === name);
    if(!p){
      $('.container')?.insertAdjacentHTML('beforeend', `<div class="card">Pokémon introuvable dans ${region}.</div>`);
      return;
    }

    // En-tête
    $('#title')?.textContent = p.name;
    $('#pokename')?.textContent = p.name;
    $('#types')?.innerHTML = (p.types||[]).map(t=>`<span class="badge">${t}</span>`).join(' ');
    $('#evo')?.textContent  = p.evolution || '?';

    // Liens vers la page des attaques (éviter le slash initial)
    const linkMove = (m)=> `<a href="${withBase('moves.html')}#${encodeURIComponent(m)}">${m}</a>`;

    // Talents
    $('#habil')?.insertAdjacentHTML('afterbegin',
      (p.abilities||[]).map(a=>linkMove(a)).join(', ') || '?'
    );
    $('#habhid')?.insertAdjacentHTML('afterbegin',
      p.hidden_ability ? linkMove(p.hidden_ability) : '?'
    );

    // Pokédex (description)
    $('#pokedex')?.insertAdjacentText('afterbegin', p.pokedex || '?');

    // --- Capacités par niveau : groupées par tranches de 10
    const lvlEl = $('#lvl');
    const lvl = p.level_up || [];
    if (lvlEl){
      if (lvl.length){
        const buckets = new Map();
        for(const m of lvl){
          const g = Math.floor((m.level - 1) / 10);
          const start = g*10 + 1;
          const end   = (g+1)*10;
          const key   = `${start}-${end}`;
          if(!buckets.has(key)) buckets.set(key, {start, end, items: []});
          buckets.get(key).items.push(m);
        }
        const groups = [...buckets.values()].sort((a,b)=>a.start-b.start);
        const html = groups.map(g=>{
          const items = g.items.sort((a,b)=>a.level-b.level)
            .map(m=>`<li>${m.level} ${linkMove(m.move)}</li>`).join('');
          return `<li class="lvl-group"><div class="lvl-title">${g.start}-${g.end}</div><ul>${items}</ul></li>`;
        }).join('');
        lvlEl.innerHTML = html;
      } else {
        lvlEl.innerHTML = '<li>?</li>';
      }
    }

    // --- Listes repro / CS / CT / DT
    const renderList = (arr)=> arr && arr.length
      ? `<li class="lvl-group"><ul class="cols">${arr.map(m => `<li>${linkMove(m)}</li>`).join('')}</ul></li>`
      : '<li>?</li>';

    $('#eggs')?.insertAdjacentHTML('beforeend', renderList(p.egg_moves || []));
    $('#cs')?.insertAdjacentHTML('beforeend',   renderList(p.cs || []));
    $('#ct')?.insertAdjacentHTML('beforeend',   renderList(p.ct || []));
    $('#dt')?.insertAdjacentHTML('beforeend',   renderList(p.dt || []));

    // --- Objet tenu & Ressource (facultatif si le JSON n’existe pas)
    try{
      const drops = await loadJSON(withBase(`/data/pokemon_drops_${rk}.json`));
      const d = drops.find(x => x.name.toLowerCase() === p.name.toLowerCase()) || null;

      const heldName = (d && d.held_item && d.held_item.name) ? d.held_item.name : 'Non répertorié';
      const resName  = (d && d.ressource && d.ressource.name && d.ressource.name !== 'Non RÉPERTORIÉ')
                        ? d.ressource.name : 'Non répertorié';
      const resDesc  = (d && d.ressource && d.ressource.description)
                        ? d.ressource.description
                        : 'Un échantillon laissé par un Pokémon. Il peut être utilisé pour fabriquer des objets.';

      const objres = $('#objres');
      if (objres){
        objres.innerHTML = `
          <ul id="objresGrid">
            <li class="lvl-group"><div class="lvl-title">Objet tenu</div><ul><li>${heldName}</li></ul></li>
            <li class="lvl-group"><div class="lvl-title">Ressource</div><ul><li><b>${resName}</b></li><li style="margin-top:4px;opacity:0.8;">${resDesc}</li></ul></li>
          </ul>`;
      }
    } catch(e){
      console.warn('Drops/ressource indisponibles :', e.message);
    }

    // --- Sprite (version simple : assets/pkm uniquement)
    const img = $('#sprite');
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
    const c = $('.container');
    if (c) c.innerHTML = `<div class="card">Erreur de chargement de la fiche.<br><span class="small">${err.message}</span></div>`;
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

    const titleEl = $('#title'); if (titleEl) titleEl.textContent = p.name;
    const pn = $('#pokename'); if (pn) pn.textContent = p.name;

    const typesEl = $('#types'); if (typesEl) typesEl.innerHTML = (p.types||[]).map(t=>`<span class="badge">${t}</span>`).join(' ');
    const evoEl   = $('#evo');   if (evoEl)   evoEl.textContent  = p.evolution || '?';

    const habilEl = $('#habil');
    if (habilEl) habilEl.innerHTML = (p.abilities||[]).map(a=>`<a href="/moves.html#${encodeURIComponent(a)}">${a}</a>`).join(', ') || '?';

    const habhidEl = $('#habhid');
    if (habhidEl) habhidEl.innerHTML = p.hidden_ability ? `<a href="/moves.html#${encodeURIComponent(p.hidden_ability)}">${p.hidden_ability}</a>` : '?';

    const pokedEl = $('#pokedex'); if (pokedEl) pokedEl.textContent = p.pokedex || '?';

    const img = $('#sprite');
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

