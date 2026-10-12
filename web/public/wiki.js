(() => {
 'use strict';
 const input=document.getElementById('buscar'),results=document.getElementById('resultados'),list=document.getElementById('lista-resultados'),count=document.getElementById('cuenta-resultados');
 const normal=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 let data=null,pedido=null;
 const load=()=>pedido??=fetch('/datos/wiki.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>data=d).catch(()=>{pedido=null;return null});
 async function buscar(){const term=input.value.trim();if(!term){results.hidden=true;return;}results.hidden=false;count.textContent='Buscando…';const d=await load();if(input.value.trim()!==term)return;list.replaceChildren();if(!d){count.textContent='No se pudo cargar la búsqueda. Puedes navegar por las categorías o volver a intentarlo.';return;}
 const palabras=normal(term).split(/\s+/);const hits=d.map(a=>({...a,puntos:palabras.reduce((n,p)=>n+(normal(a.titulo).includes(p)?5:normal(a.resumen).includes(p)?3:1),0)})).filter(a=>palabras.every(p=>normal(a.titulo+' '+a.resumen+' '+a.texto).includes(p))).sort((a,b)=>b.puntos-a.puntos);
 count.textContent=hits.length?`${hits.length} ${hits.length===1?'guía encontrada':'guías encontradas'}`:'Sin resultados. Prueba con «banco», «terreno», «teléfono» o «conexión».';
 for(const a of hits.slice(0,10)){const link=document.createElement('a');link.className='search-result';link.href='/wiki/'+a.id;const tag=document.createElement('small'),title=document.createElement('strong'),summary=document.createElement('span');tag.textContent=a.categoria;title.textContent=a.titulo;summary.textContent=a.resumen;link.append(tag,title,summary);list.append(link);}}
 input?.addEventListener('input',buscar);input?.addEventListener('focus',()=>{load();if(input.value)buscar();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){results.hidden=true;input.blur();}if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)&&!document.activeElement?.isContentEditable){e.preventDefault();input.focus();}});
 document.addEventListener('click',e=>{if(!e.target.closest('.search')&&!e.target.closest('.results'))results.hidden=true;});
 document.getElementById('copiar-ip')?.addEventListener('click',async()=>{const status=document.getElementById('copia-estado');try{await navigator.clipboard.writeText('mc.victoriakingdom.com');status.textContent='Dirección copiada.';}catch{status.textContent='Selecciona y copia la dirección que aparece arriba.';}});
})();
