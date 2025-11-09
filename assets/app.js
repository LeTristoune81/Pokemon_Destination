// =========================
// Helpers & utils
// =========================
function $(q, el = document) { return el.querySelector(q); }
function norm(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
async function loadJSON(path){
  const r = await fetch(path);
  if(!r.ok) throw new Error(`HTTP ${r.status} on ${path}`);
  return r.json();
}
function getParam(name, def=''){
  const u = new URL(location.href);
  return u.searchParams.get(name) ?? def;
}
function slugRegion(s){ return norm(s).replace(/\s+/g,'_'); } // "les Sevii" -> "iles_sevii"
// Base path pour GitHub Pages (repo pages)
const REPO_BASE = (() => {
  const parts = location.pathname.split('/').filter(Boolean);
  return location.hostname.endsWith('github.io') && parts.length ? `/${parts[0]}` : '';
})();
const withBase = (p) => `${REPO_BASE}${p.startsWith('/') ? p : '/' + p}`;

// ==============================
// Correction des accents casss
// ==============================
function fixBrokenAccentsInDom(root = document.body) {
  const map = [
    ['Pokmon','Pokmon'], ['Pokdex','Pokdex'], ['Capacits','Capacits'],
    ['',''], ['',''], [' ',''], ['',''], ['',''], ['',''],
    ['',''], ['',''], ['',''], ['',''], ['',''],
    ['',''], ['',''], ['',''], ['',''], ['','']
  ];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let n; const toFix = [];
  while ((n = walker.nextNode())) { if (/[]/.test(n.nodeValue||'')) toFix.push(n); }
  for (const node of toFix) {
    let t = node.nodeValue;
    for (const [bad, good] of map) t = t.split(bad).join(good);
    if (t !== node.nodeValue) node.nodeValue = t;
  }
}

// ==================
// Dtection rgion depuis l'URL
// ==================
function detectRegionFromPath() {
  // Ex: /region/Johto/Pokedex_Johto.html -> "Johto"
  const decoded = decodeURIComponent(location.pathname);
const m = decoded.match(/\/region\/([^/]+)/i);
  return m ? m[1] : 'Johto';
}

// ==================
// Pokdex (liste) ? avec fallback d'images
// ==================
async function initIndex(){
  try{
    const list = $('.grid');
    const q = $('#q');
// récupère/crée l’élément compteur
let status = document.getElementById('status');
if (!status) {
  status = document.createElement('div');
  status.id = 'status';
  status.className = 'small';
  if (q && q.parentElement) {
    q.insertAdjacentElement('afterend', status); // juste sous l’input
  } else if (list && list.parentElement) {
    list.parentElement.insertBefore(status, list);
  }
}

    const region = detectRegionFromPath();
    const rk = slugRegion(region);
    const data = await loadJSON(withBase(`/data/pokedex_${rk}.json`));

    const render = (items)=>{
      list.innerHTML = items.map(p=>{
        const name = p.name.toLowerCase();
        const candidates = [
   p.image || '',
   withBase(`/assets/pkm/${name}.png`),
   withBase(`/assets/pkm/${rk}/${name}.png`),
   withBase(`/assets/pkm/${name}_TCG.png`),
   withBase(`/assets/pkm/${p.name.toUpperCase()}.png`)
 ].filter(Boolean);

        const dataSrcs = encodeURIComponent(JSON.stringify(candidates));
        const firstSrc = candidates[0];
        const href = withBase(`/pokemon.html?r=${encodeURIComponent(region)}&n=${encodeURIComponent(name)}`);

        return `
          <div class="card">
            <div class="cardRow">
              <img class="thumb pokeimg"
                   src="${firstSrc}"
                   alt="${p.name}"
                   data-srcs="${dataSrcs}"
                   data-idx="0"
                   loading="lazy"
                   style="width:64px;height:64px;image-rendering:pixelated;object-fit:contain;">
              <div class="cardBody">
                <div class="h2">${p.name}</div>
                <div>${(p.types||[]).map(t=>`<span class="badge">${t}</span>`).join(' ')}</div>
                <div class="small" style="margin-top:4px">${p.evolution ? p.evolution : ''}</div>
                <div style="margin-top:8px"><a href="${href}">Ouvrir la fiche </a></div>
              </div>
            </div>
          </div>`;
      }).join('');
status.textContent = `${items.length} Pokémon affiché${items.length>1?'s':''}`;


      // Gestion du fallback d'image
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
    const c = $('.container');
    if (c) c.innerHTML = `<div class="card">Erreur de chargement du Pokdex.<br><span class="small">${err.message}</span></div>`;
  }
}

// ==================
// Attaques par région (regions_moves.json) + filtres + compteur
// ==================
async function initMovesByRegion(){
  try{
    const grid = document.querySelector('.grid');
    const q    = document.getElementById('q');

    // -- compteur (créé si absent)
    let status = document.getElementById('status');
    if (!status) {
      status = document.createElement('div');
      status.id = 'status';
      status.className = 'small';
      (q || grid).insertAdjacentElement('afterend', status);
    }

    // -- barre de filtres (créée si absente)
    let bar = document.getElementById('filters');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'filters';
      bar.className = 'small';
      bar.style.margin = '8px 0';
      bar.innerHTML = `
        <label style="margin-right:12px"><input type="checkbox" id="fCT" checked> CT</label>
        <label style="margin-right:12px"><input type="checkbox" id="fCS" checked> CS</label>
        <label style="margin-right:12px"><input type="checkbox" id="fDT" checked> DT</label>
        <label><input type="checkbox" id="fCU" checked> CU</label>
      `;
      (status || q || grid).insertAdjacentElement('afterend', bar);
    }

    // -- région depuis l'URL (/region/Johto/...) ou ?r=Johto
    function norm(s){ return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
    function detectRegionFromPath(){
      const m = decodeURIComponent(location.pathname).match(/\/region\/([^/]+)/i);
      return m ? m[1] : '';
    }
    let region = new URL(location.href).searchParams.get('r') || detectRegionFromPath() || 'Johto';
    const regionKeyMatcher = norm(region); // "Johto" -> "johto"

    // -- charger la map région → {CT,CS,DT,CU}
    const map = await loadJSON('/data/regions_moves.json');

    // clé réelle dans le JSON (insensible aux accents/casse)
    const foundKey = Object.keys(map).find(k => norm(k) === regionKeyMatcher);
    const pack = foundKey ? map[foundKey] : {CT:[],CS:[],DT:[],CU:[]};

    // aplatir en [{name,type}]
    const all = []
      .concat((pack.CT||[]).map(n => ({name:n, type:'CT'})))
      .concat((pack.CS||[]).map(n => ({name:n, type:'CS'})))
      .concat((pack.DT||[]).map(n => ({name:n, type:'DT'})))
      .concat((pack.CU||[]).map(n => ({name:n, type:'CU'})));

    // rendu
    const render = (items)=>{
      grid.innerHTML = items.map(m => `
        <div class="card">
          <div class="cardRow" style="justify-content:space-between;align-items:center">
            <div>${m.name}</div>
            <span class="badge">${m.type}</span>
          </div>
        </div>`).join('');
      status.textContent = `${items.length} attaque${items.length>1?'s':''} pour ${region}`;
    };

    // filtre combiné (recherche + cases)
    function currentItems(){
      const txt = norm(q?.value || '');
      const f = {
        CT: document.getElementById('fCT')?.checked !== false,
        CS: document.getElementById('fCS')?.checked !== false,
        DT: document.getElementById('fDT')?.checked !== false,
        CU: document.getElementById('fCU')?.checked !== false,
      };
      return all.filter(m =>
        f[m.type] && (txt ? norm(m.name).includes(txt) : true)
      );
    }

    render(currentItems());

    // events
    q?.addEventListener('input', () => render(currentItems()));
    ['fCT','fCS','fDT','fCU'].forEach(id=>{
      document.getElementById(id)?.addEventListener('change', () => render(currentItems()));
    });

  }catch(err){
    console.error(err);
    const c = document.querySelector('.container');
    if (c) c.innerHTML = `<div class="card">Erreur de chargement des attaques.<br><span class="small">${err.message}</span></div>`;
  }
}

// ==================
// Fiche Pokmon gnrique (multi-rgions)
// ==================
async function initPokemon(){
  try{
    const region = getParam('r','Johto');
    const rk = slugRegion(region);
    const name  = decodeURIComponent(getParam('n',''));
    if (!name){
      $('.container')?.insertAdjacentHTML('beforeend', `<div class="card">Aucun Pokmon prcis.</div>`);
      return;
    }

    const data = await loadJSON(`/data/pokedex_${rk}.json`);
    const p = data.find(x => x.name.toLowerCase() === name);
    if(!p){
      $('.container')?.insertAdjacentHTML('beforeend', `<div class="card">Pokmon introuvable dans ${region}.</div>`);
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

    // Capacits par niveau groupes
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
            .map(m=>`<li>${m.level} <a href="/moves.html#${encodeURIComponent(m.move)}">${m.move}</a></li>`).join('');
          return `<li class="lvl-group"><div class="lvl-title">${g.start}${g.end}</div><ul>${items}</ul></li>`;
        }).join('');
        lvlEl.innerHTML = html;
      } else {
        lvlEl.innerHTML = '<li>?</li>';
      }
    }

    // Repro / CS / CT / DT
    const linkMove = (m)=> `<a href="/moves.html#${encodeURIComponent(m)}">${m}</a>`;
    const renderList = (arr)=> arr && arr.length
      ? `<li class="lvl-group"><ul class="cols">${arr.map(m => `<li>${linkMove(m)}</li>`).join('')}</ul></li>`
      : '<li>?</li>';

    $('#eggs')?.insertAdjacentHTML('beforeend', renderList(p.egg_moves || []));
    $('#cs')?.insertAdjacentHTML('beforeend',   renderList(p.cs || []));
    $('#ct')?.insertAdjacentHTML('beforeend',   renderList(p.ct || []));
    $('#dt')?.insertAdjacentHTML('beforeend',   renderList(p.dt || []));

    // Objet tenu & Ressource
    let d = null;
    try{
      const drops = await loadJSON(`/data/pokemon_drops_${rk}.json`);
      d = drops.find(x => x.name.toLowerCase() === p.name.toLowerCase()) || null;
    }catch(e){ console.warn('drops non dispo :', e); }

    const heldName = (d && d.held_item && d.held_item.name) ? d.held_item.name : 'Non Rpertori';
    const resName  = (d && d.ressource && d.ressource.name && d.ressource.name !== 'Non Rpertori') ? d.ressource.name : 'Non Rpertori';
    const resDesc  = (d && d.ressource && d.ressource.description)
      ? d.ressource.description
      : 'Un chantillon laiss par un Pokmon. Il peut tre utilis pour fabriquer des objets.';

    const objres = $('#objres');
    if (objres){
      objres.innerHTML = `
        <ul id="objresGrid">
          <li class="lvl-group"><div class="lvl-title">Objet tenu</div><ul><li>${heldName}</li></ul></li>
          <li class="lvl-group"><div class="lvl-title">Ressource</div><ul><li><b>${resName}</b></li><li style="margin-top:4px;opacity:0.8;">${resDesc}</li></ul></li>
        </ul>`;
    }

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

  if (file.startsWith('pokedex'))         initIndex();
  else if (file === 'pokemon.html')       initPokemon();
  else if (file.includes('moves'))        initMoves();          // ta page "moves" globale (si tu la gardes)
  else if (file === 'region.html' || /attaques_johto/i.test(file)) {
    initMovesByRegion();                  // ✅ page région
  }
});






