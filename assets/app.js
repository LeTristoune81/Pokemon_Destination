/***** app.js — version stable avec fallback pkm2 + liens d’évolution *****/

// --------- utils ----------
function $(q, el=document){ return el.querySelector(q); }
function norm(s){ return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function slugRegion(s){ return norm(s).replace(/\s+/g,'_'); }

const REPO = '/Pokemon_Destination';
function withBase(p){
  if (!p) return p;
  if (/^https?:\/\//i.test(p)) return p;        // URL absolue
  if (p.startsWith(REPO + '/')) return p;       // déjà préfixé
  if (p.startsWith('/')) return REPO + p;       // /data/... -> /Pokemon_Destination/data/...
  return REPO + '/' + p.replace(/^.\//,'');     // relatif -> /Pokemon_Destination/...
}

async function loadJSON(url){
  const u = withBase(url);
  const r = await fetch(u, {cache:'no-cache'});
  if(!r.ok) throw new Error(`HTTP ${r.status} on ${u}`);
  return r.json();
}

// --------- corrections texte ----------
function fixBrokenAccentsInDom(root=document.body){
  const pairs = [
    ['Pokmon','Pokémon'], ['Pokdex','Pokédex'], ['Capacits','Capacités'],
    ['Non Rpertori','Non Répertorié'], ['chantillon laiss','échantillon laissé'],
    ['tre utilis','être utilisé']
  ];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let n; const arr=[];
  while(n=w.nextNode()) if(n.nodeValue) arr.push(n);
  for(const node of arr){
    let t=node.nodeValue;
    for(const [a,b] of pairs) t=t.split(a).join(b);
    if(t!==node.nodeValue) node.nodeValue=t;
  }
}

// --------- helpers sprites ----------
function nameVariants(n){
  const raw = (n||'').toString();
  const lower = raw.toLowerCase();
  const upper = raw.toUpperCase();
  const unders = lower.replace(/\s+/g,'_');
  const undersU = upper.replace(/\s+/g,'_');
  return [lower, unders, upper, undersU];
}

// génère l’ordre d’essai des sprites (pkm → pkm2, avec/sans sous-dossier de région)
function makeSpriteCandidates(name, rk){
  const vars = nameVariants(name);
  const out = [];
  for (const v of vars){
    // pkm/
    out.push(withBase(`/assets/pkm/${v}.png`));
    if (rk) out.push(withBase(`/assets/pkm/${rk}/${v}.png`));
    // pkm2/
    out.push(withBase(`/assets/pkm2/${v}.png`));
    if (rk) out.push(withBase(`/assets/pkm2/${rk}/${v}.png`));
  }
  return out;
}

// --------- helper: liens sur les évolutions ----------
function linkifyEvo(evoText, region='Johto'){
  if (!evoText) return evoText;

  // Remplace "Évolue en <Nom> ..." en gardant le suffixe ("au niveau 18", "avec ...", etc.)
  return evoText.replace(
    /Évolue en\s+([^,.;/]+)/g,                     // on prend tout jusqu'à une ponctuation (ou fin de ligne)
    (full, rest) => {
      // découpe le "rest" au premier séparateur logique
      const parts = rest.split(/\s+(?:au|avec|en|si|lorsqu|quand|dans)(?:\s|$)/);
      const name  = (parts[0] || '').trim();       // => juste le nom du Pokémon
      if (!name) return full;                      // sécurité : ne rien changer si vide

      const suffixStart = rest.indexOf(name) + name.length;
      const suffix = rest.slice(suffixStart);      // => " au niveau 18", " avec ...", etc.

      const href = `${REPO}/pokemon.html?r=${encodeURIComponent(region)}&n=${encodeURIComponent(name.toLowerCase())}`;
      return `Évolue en <a href="${href}" class="evo-link">${name}</a>${suffix}`;
    }
  );
}

// --------- LISTE POKÉDEX JOHTO ----------
async function initIndex(){
  try{
    const grid = $('.grid');
    if(!grid){
      (document.body).insertAdjacentHTML('beforeend','<div class="card" style="color:#ff8080">Erreur : .grid manquant.</div>');
      return;
    }
    const q = $('#q');
    let status = $('#status');
    if(!status){
      status = document.createElement('div');
      status.id='status'; status.className='small';
      (q || grid).insertAdjacentElement('afterend', status);
    }

    // on force Johto ici
    const region = 'Johto';
    const rk = 'johto';

    // IMPORTANT : on passe toujours par withBase()
    const data = await loadJSON('/data/pokedex_johto.json');

    const render = (items)=>{
      grid.innerHTML = items.map(p=>{
        const name = (p.name||'').toLowerCase();

        // sprites : image explicite -> puis pkm / pkm2 avec variantes
        const imgCandidates = [
          p.image ? withBase('/'+String(p.image).replace(/^\/+/,'')) : ''
        ].concat(makeSpriteCandidates(p.name, rk)).filter(Boolean);

        const first = imgCandidates[0] || '';
        const dataSrcs = encodeURIComponent(JSON.stringify(imgCandidates));
        const href = `${REPO}/pokemon.html?r=${encodeURIComponent(region)}&n=${encodeURIComponent(name)}`;

        return `
          <div class="card">
            <div class="cardRow">
              <img class="thumb pokeimg"
                   src="${first}"
                   alt="${p.name||''}"
                   data-srcs="${dataSrcs}"
                   data-idx="0"
                   loading="lazy"
                   style="width:64px;height:64px;image-rendering:pixelated;object-fit:contain;">
              <div class="cardBody">
                <div class="h2">${p.name||''}</div>
                <div>${(p.types||[]).map(t=>`<span class="badge">${t}</span>`).join(' ')}</div>
                <div class="small" style="margin-top:4px">${linkifyEvo(p.evolution||'', region)}</div>
                <div style="margin-top:8px"><a href="${href}">Ouvrir la fiche</a></div>
              </div>
            </div>
          </div>`;
      }).join('');

      status.textContent = `${items.length} Pokémon affiché${items.length>1?'s':''}`;

      // fallback images
      grid.querySelectorAll('img.pokeimg').forEach(img=>{
        img.onerror = ()=>{
          try{
            const srcs = JSON.parse(decodeURIComponent(img.getAttribute('data-srcs')));
            let idx = parseInt(img.getAttribute('data-idx')||'0',10);
            idx++;
            if(idx < srcs.length){
              img.setAttribute('data-idx', String(idx));
              img.src = srcs[idx];
            }else{
              img.style.display='none';
            }
          }catch{ img.style.display='none'; }
        };
      });
    };

    render(data);

    if(q){
      q.addEventListener('input', e=>{
        const v = norm(e.target.value);
        const f = data.filter(p =>
          norm(p.name||'').includes(v) ||
          norm((p.types||[]).join(' ')).includes(v)
        );
        render(f);
      });
    }
  }catch(err){
    console.error(err);
    const c = $('.container') || document.body;
    c.insertAdjacentHTML('beforeend', `<div class="card" style="color:#ff8080">Erreur de chargement du Pokédex.<br><span class="small">${err.message}</span></div>`);
  }
}

// --------- FICHE POKÉMON (page unique pokemon.html) ----------
async function initPokemon(){
  try{
    const region = 'Johto';                 // on cible Johto ici
    const rk = slugRegion(region);
    const name = (new URL(location.href)).searchParams.get('n')?.toLowerCase() || '';

    if(!name){
      $('.container')?.insertAdjacentHTML('beforeend', `<div class="card">Aucun Pokémon précisé.</div>`);
      return;
    }

    const data = await loadJSON(`/data/pokedex_${rk}.json`);
    const p = data.find(x => (x.name||'').toLowerCase() === name);
    if(!p){
      $('.container')?.insertAdjacentHTML('beforeend', `<div class="card">Pokémon introuvable dans ${region}.</div>`);
      return;
    }

    // entête
    $('#pokename') && ($('#pokename').textContent = p.name);
    const typesEl = $('#types'); if(typesEl) typesEl.innerHTML = (p.types||[]).map(t=>`<span class="badge">${t}</span>`).join(' ');
    const evoEl = $('#evo'); if(evoEl) evoEl.innerHTML = linkifyEvo(p.evolution || '', region) || '?';

    const linkMove = (m)=> `<a href="${withBase('/moves.html')}#${encodeURIComponent(m)}">${m}</a>`;
    const habilEl = $('#habil'); if(habilEl){
      const abilities = p.abilities || [];
      habilEl.innerHTML = abilities.length ? abilities.map(a=>linkMove(a)).join(', ') : '?';
    }
    const habhidEl = $('#habhid'); if(habhidEl){
      habhidEl.innerHTML = p.hidden_ability ? linkMove(p.hidden_ability) : '?';
    }

    // image avec fallback pkm2
    const img = $('#sprite');
    if(img){
      const candidates = [
        p.image ? withBase('/'+String(p.image).replace(/^\/+/,'')) : ''
      ].concat(makeSpriteCandidates(p.name, rk)).filter(Boolean);

      let i=0;
      img.onerror = ()=>{ i++; if(i<candidates.length) img.src=candidates[i]; else img.style.display='none'; };
      img.src = candidates[0] || '';
    }

    // capacités par niveau
    (function(){
      const lvlEl = $('#lvl'); if(!lvlEl) return;
      const arr = (p.level_up||[]).slice().sort((a,b)=>a.level-b.level);
      lvlEl.innerHTML = arr.length
        ? arr.map(m=>`<li>${String(m.level).padStart(2,'0')} <a href="${withBase('/moves.html')}#${encodeURIComponent(m.move)}">${m.move}</a></li>`).join('')
        : '<li>?</li>';
    })();

    // eggs / cs / ct / dt
    const renderList = (arr)=> arr && arr.length
      ? `<li class="lvl-group"><ul class="cols">${arr.map(m=>`<li><a href="${withBase('/moves.html')}#${encodeURIComponent(m)}">${m}</a></li>`).join('')}</ul></li>`
      : '<li>?</li>';
    $('#eggs') && ($('#eggs').innerHTML = renderList(p.egg_moves || []));
    $('#cs')   && ($('#cs').innerHTML   = renderList(p.cs || []));
    $('#ct')   && ($('#ct').innerHTML   = renderList(p.ct || []));
    $('#dt')   && ($('#dt').innerHTML   = renderList(p.dt || []));

    // objet & ressource
    (async ()=>{
      let heldName='Non Répertorié', resName='Non Répertorié', resDesc='Un échantillon laissé par un Pokémon. Il peut être utilisé pour fabriquer des objets.';
      try{
        const drops = await loadJSON(`/data/pokemon_drops_${rk}.json`);
        const d = drops.find(x => (x.name||'').toLowerCase() === (p.name||'').toLowerCase());
        if(d){
          const hasWild = d.WildItemCommon !== null && d.WildItemCommon !== undefined;
          if(hasWild && d.held_item && d.held_item.name) heldName = d.held_item.name;
          if(d.ressource){
            if(d.ressource.name) resName = d.ressource.name;
            if(d.ressource.description) resDesc = d.ressource.description;
          }
        }
      }catch(e){ /* ignore si pas de fichier */ }
      const objres = $('#objres');
      if(objres){
        objres.innerHTML = `
          <li class="lvl-group">
            <div class="lvl-title">Objet tenu</div>
            <ul><li>${heldName}</li></ul>
          </li>
          <li class="lvl-group">
            <div class="lvl-title">Ressource</div>
            <ul>
              <li><b>${resName}</b></li>
              <li class="small" style="margin-top:4px;opacity:0.8;">${resDesc}</li>
            </ul>
          </li>`;
      }
    })();

    // pokédex (texte)
    $('#pokedex') && ($('#pokedex').textContent = p.pokedex || '?');

    fixBrokenAccentsInDom();
  }catch(err){
    console.error(err);
    const c = $('.container') || document.body;
    c.insertAdjacentHTML('beforeend', `<div class="card" style="color:#ff8080">Erreur de chargement de la fiche.<br><span class="small">${err.message}</span></div>`);
  }
}

// --------- auto init ----------
document.addEventListener('DOMContentLoaded', ()=>{
  const path = location.pathname.toLowerCase();
  const file = path.split('/').pop();
  if (file === 'pokemon.html')            initPokemon();
  else if (path.includes('pokedex_johto')) initIndex();     // region/Johto/Pokedex_Johto.html
  else if (file.startsWith('pokedex'))     initIndex();     // fallback si autre nom
});
