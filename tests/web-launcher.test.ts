import {describe,it,expect} from 'vitest'
// El mismo módulo se ejecuta en Pages; no depende de APIs de Node.
// @ts-expect-error módulo JavaScript compartido por Pages
import {resumirVersion} from '../web/lib/ultima-version.mjs'
const publicacion=()=>({draft:false,prerelease:false,tag_name:'v1.8.3',published_at:'2026-10-11T00:00:00Z',assets:[{name:'Victoria-Kingdom-actualizacion-1.8.3.exe',browser_download_url:'https://github.com/FalconKing574/victoria-launcher/releases/download/v1.8.3/Victoria-Kingdom-actualizacion-1.8.3.exe',digest:'sha256:'+'a'.repeat(64),size:108663562}]})
describe('Versión que instala el instalador permanente',()=>{
 it('elige el instalador completo oficial, no el bootstrap ni un archivo con nombre parecido',()=>{const r=publicacion();r.assets.unshift({...r.assets[0],name:'Victoria-Kingdom-Setup.exe',size:45000});expect(resumirVersion(r)).toMatchObject({version:'1.8.3',size:108663562,sha256:'a'.repeat(64)});})
 it.each(['draft','prerelease'])('rechaza %s',campo=>{expect(()=>resumirVersion({...publicacion(),[campo]:true})).toThrow()})
 it('consulta una publicación nueva sin una versión máxima incrustada',()=>{const r=JSON.parse(JSON.stringify(publicacion()).replaceAll('1.8.3','2.0.0'));expect(resumirVersion(r).version).toBe('2.0.0')})
 it.each(['url','hash','size','tag'])('rechaza metadatos no verificables: %s',caso=>{const r=publicacion();if(caso==='url')r.assets[0].browser_download_url='https://ajeno.invalid/instalador.exe';if(caso==='hash')r.assets[0].digest='';if(caso==='size')r.assets[0].size=9999999999;if(caso==='tag')r.tag_name='v1.8.3-beta';expect(()=>resumirVersion(r)).toThrow()})
})
