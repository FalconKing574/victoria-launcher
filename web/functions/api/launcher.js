import {resumirVersion,URL_ULTIMA} from '../../lib/ultima-version.mjs';
/** No se almacena una versión fija ni se sustituye por una vieja si GitHub falla. */
export async function onRequestGet(context) {
 const clave=new Request(new URL('/api/launcher',context.request.url));
 const cache=caches.default,guardada=await cache.match(clave).catch(()=>undefined);
 if(guardada)return guardada;
 try{
  const r=await fetch(URL_ULTIMA,{headers:{Accept:'application/vnd.github+json','User-Agent':'Victoria-Kingdom-Installer'},signal:AbortSignal.timeout(8000),cf:{cacheTtl:60}});
  if(!r.ok)throw Error('GitHub no responde');
  const datos=resumirVersion(await r.json());
  const respuesta=new Response(JSON.stringify(datos),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60','Access-Control-Allow-Origin':'*'}});
  context.waitUntil(cache.put(clave,respuesta.clone()).catch(()=>undefined));return respuesta;
 }catch{return new Response(JSON.stringify({error:'No se pudo verificar la última versión. Inténtalo en unos minutos.'}),{status:503,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
}
