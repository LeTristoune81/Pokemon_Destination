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
async function initIndex(){
  try{
    const list = $('.grid');
    const q = $('#q');

    let status = document.getElementById('status');
    if (!status) {
      status = document.createElement('div');
      status.id = 'status';
      status.className = 'small';
      if (q && q.parentElement) {
        q.insertAdjacentElement('afterend', status);
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
    const c = $('.container');
    if (c) c.innerHTML = `<div class="card">Erreur de chargement du Pokédex.<br><span class="small">${err.message}</span></div>`;
  }
}

// ==================
// Fiche Pokémon (robuste)
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

    // --- charge le Pokédex
    const data = await loadJSON(withBase(`/data/pokedex_${rk}.json`));
    const p = data.find(x => (x.name||'').toLowerCase() === name);
    if(!p){
      $('.container')?.insertAdjacentHTML('beforeend', `<div class="card">Pokémon introuvable dans ${region}.</div>`);
      return;
    }

    // helpers
    const pickArray = (obj, keys) => {
      for (const k of keys) {
        const v = obj?.[k];
        if (Array.isArray(v)) return v;
      }
      return [];
    };
    const normLevelMoves = (arr) => arr.map(it => {
      if (Array.isArray(it)) return { level: Number(it[0]), move: String(it[1]||'').trim() };
      if (typeof it === 'string') {
        const m = it.match(/^\s*(\d+)\s*[:\-]\s*(.+)$/);
        return m ? { level: Number(m[1]), move: m[2].trim() } : { level: NaN, move: it.trim() };
      }
      return { level: Number(it.level ?? it.lvl ?? it.Level ?? it.LV ?? NaN), move: String(it.move ?? it.name ?? '').trim() };
    }).filter(x => x.move);
    const normStringList = (arr) => arr.map(x => Array.isArray(x) ? String(x[0]||x[1]||'').trim()
                                                                 : String((x && x.name) ? x.name : x).trim()
                                          ).filter(Boolean);
    const linkMove = (m)=> `<a href="${withBase('moves.html')}#${encodeURIComponent(m)}">${m}</a>`;

    // En-tête
    $('#title')?.textContent = p.name || name;
    $('#pokename')?.textContent = p.name || name;
    $('#types')?.innerHTML = (p.types||[]).map(t=>`<span class="badge">${t}</span>`).join(' ');
    $('#evo')?.textContent  = p.evolution || p.Evolution || '?';
    $('#pokedex')?.textContent = p.pokedex || p.dex || p.description || '?';

    // Talents
    const abilList = pickArray(p, ['abilities','Abilities','talents']);
    const hid = p.hidden_ability || p.hiddenAbility || p.talent_cache || p.HiddenAbility;
    $('#habil')?.insertAdjacentHTML('afterbegin', abilList.length ? abilList.map(a=>linkMove(a)).join(', ') : '?');
    $('#habhid')?.insertAdjacentHTML('afterbegin', hid ? linkMove(hid) : '?');

    // Capacités par niveau (groupées par 10)
    const lvlRaw = pickArray(p, ['level_up','LevelUp','levelUp','levelup','levels','moves_level','movesLevel','MovesLevel']);
    const lvl = normLevelMoves(lvlRaw);
    const lvlEl = $('#lvl');
    if (lvlEl){
      if (lvl.length){
        const buckets = new Map();
        for(const m of lvl){
          const L = Number(m.level);
          const g = isFinite(L) ? Math.floor((L - 1) / 10) : -1;
          const start = g >= 0 ? g*10 + 1 : 0;
          const end   = g >= 0 ? (g+1)*10 : 0;
          const key   = g >= 0 ? `${start}-${end}` : 'Autres';
          if(!buckets.has(key)) buckets.set(key, {start, end, items: []});
          buckets.get(key).items.push(m);
        }
        const groups = [...buckets.values()].sort((a,b)=>a.start-b.start);
        const html = groups.map(g=>{
          const items = g.items.sort((a,b)=> (a.level||9999) - (b.level||9999))
            .map(m=>`<li>${isFinite(m.level)? m.level : ''} ${linkMove(m.move)}</li>`).join('');
          return `<li class="lvl-group"><div class="lvl-title">${g.start?`${g.start}-${g.end}`:'Divers'}</div><ul>${items}</ul></li>`;
        }).join('');
        lvlEl.innerHTML = html;
      } else {
        lvlEl.innerHTML = '<li>?</li>';
      }
    }

    // Repro / CS / CT / DT
    const eggs = normStringList(pickArray(p, ['egg_moves','EggMoves','reproduction','breed','Egg','eggs']));
    const cs   = normStringList(pickArray(p, ['cs','CS']));
    const ct   = normStringList(pickArray(p, ['ct','CT','tms','TMs']));
    const dt   = normStringList(pickArray(p, ['dt','DT','trs','TRs']));

    const renderList = (arr)=> arr && arr.length
      ? `<li class="lvl-group"><ul class="cols">${arr.map(m => `<li>${linkMove(m)}</li>`).join('')}</ul></li>`
      : '<li>?</li>';

    $('#eggs')?.insertAdjacentHTML('beforeend', renderList(eggs));
    $('#cs')?.insertAdjacentHTML('beforeend',   renderList(cs));
    $('#ct')?.insertAdjacentHTML('beforeend',   renderList(ct));
    $('#dt')?.insertAdjacentHTML('beforeend',   renderList(dt));

    // Objet tenu & Ressource (si le JSON existe)
    try{
      const drops = await loadJSON(withBase(`/data/pokemon_drops_${rk}.json`));
      const d = drops.find(x => (x.name||'').toLowerCase() === (p.name||'').toLowerCase()) || null;

      const heldName = d?.held_item?.name || 'Non répertorié';
      const resName  = (d?.ressource?.name && d.ressource.name !== 'Non RÉPERTORIÉ') ? d.ressource.name : 'Non répertorié';
      const resDesc  = d?.ressource?.description || 'Un échantillon laissé par un Pokémon. Il peut être utilisé pour fabriquer des objets.';

      const objres = $('#objres');
      if (objres){
        objres.innerHTML = `
          <ul id="objresGrid">
            <li class="lvl-group"><div class="lvl-title">Objet tenu</div><ul><li>${heldName}</li></ul></li>
            <li class="lvl-group"><div class="lvl-title">Ressource</div><ul><li><b>${resName}</b></li><li style="margin-top:4px;opacity:0.8;">${resDesc}</li></ul></li>
          </ul>`;
      }
    }catch(e){ /* JSON drops absent: OK */ }

    // Sprite (assets/pkm uniquement)
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
