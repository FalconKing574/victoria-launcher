#!/usr/bin/env node
/** Publica el instalador que consulta la última versión al ejecutarse. El .exe
 * de actualización completo y latest.yml siguen siendo los de electron-updater. */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,mkdtempSync,writeFileSync,rmSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const REPO='FalconKing574/victoria-launcher',NOMBRE='Victoria-Kingdom-Setup.exe';
const tag=process.argv[2]??`v${JSON.parse(readFileSync('package.json','utf8')).version}`;
if(!/^v\d+\.\d+\.\d+$/.test(tag))throw Error('Indica un tag estable v<versión>.');
function gh(...args){return execFileSync('gh',[...args,'--repo',REPO],{encoding:'utf8',stdio:['ignore','pipe','inherit']});}
const release=JSON.parse(gh('release','view',tag,'--json','assets,isDraft,isPrerelease,body'));
const completo=release.assets.find(x=>x.name===`Victoria-Kingdom-actualizacion-${tag.slice(1)}.exe`);
if(release.isDraft||release.isPrerelease||!/^sha256:[a-f0-9]{64}$/i.test(completo?.digest??''))throw Error('Primero publica el instalador completo de una versión estable con SHA256.');
let archivo=process.env.BOOTSTRAP_FILE;
if(!archivo){execFileSync(process.execPath,['scripts/compilar-instalador.mjs'],{stdio:'inherit'});archivo='release/bootstrap/'+NOMBRE;}
const binario=readFileSync(resolve(archivo));
if(binario.length<10000||binario.length>1000000||binario[0]!==0x4d||binario[1]!==0x5a)throw Error('El instalador permanente no es un ejecutable válido.');
const esperado='sha256:'+createHash('sha256').update(binario).digest('hex');
const tmp=mkdtempSync(join(tmpdir(),'victoria-bootstrap-'));
try{
 const copia=join(tmp,NOMBRE);copyFileSync(resolve(archivo),copia);
 gh('release','upload',tag,copia,'--clobber');gh('release','upload','instalador',copia,'--clobber');
 const marca='<!-- instalador-dinamico -->';
 const cuerpo=release.body.replace(/<!-- instalador-jugadores -->[\s\S]*?(?=\n(?:## |Launcher de Victoria))/,'').replace(/El otro `\.exe` de esta lista[^\n]*\n?/g,'').trim();
 const aviso=`${marca}\n## Para instalar, descarga **${NOMBRE}**\n\nEste pequeño instalador consulta y descarga la última versión estable al ejecutarse, y comprueba su SHA256. Necesita Internet. El archivo \`Victoria-Kingdom-actualizacion-*.exe\` es el instalador completo usado por las actualizaciones automáticas.\n`;
 if(!cuerpo.includes(marca)){const notas=join(tmp,'notas.md');writeFileSync(notas,aviso+'\n'+cuerpo+'\n');gh('release','edit',tag,'--notes-file',notas);}
 const notas=join(tmp,'permanente.md');writeFileSync(notas,`Instalador permanente de Victoria Kingdom.\n\nAl pulsar Instalar, consulta la última versión estable publicada, descarga el instalador oficial y verifica tamaño y SHA256. Una copia descargada hoy también buscará las versiones futuras. Requiere Internet; no incluye una versión antigua de respaldo.\n\nEnlace permanente: https://github.com/${REPO}/releases/download/instalador/${NOMBRE}\n`);gh('release','edit','instalador','--notes-file',notas);
 for(const destino of [tag,'instalador']){const assets=JSON.parse(gh('release','view',destino,'--json','assets')).assets;const publicado=assets.find(x=>x.name===NOMBRE);if(publicado?.digest!==esperado||publicado?.size!==binario.length)throw Error('No coincide el instalador publicado en '+destino);}
 console.log(`Instalador permanente publicado y verificado en ${tag} e instalador: ${binario.length} bytes, ${esperado}.`);
}finally{const real=resolve(tmp);if(!real.startsWith(resolve(tmpdir())+'\\'))throw Error('Ruta temporal fuera del directorio esperado.');rmSync(real,{recursive:true,force:true});}
