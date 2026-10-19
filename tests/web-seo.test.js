import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { onRequest } from '../web/functions/_middleware.js';
import { articulos } from '../web/wiki-contenido.mjs';

const leer = ruta => readFileSync(new URL('../web/public/'+ruta, import.meta.url), 'utf8');
const pedir = (url, next = vi.fn(async () => new Response('contenido'))) => onRequest({request:new Request(url), next});

describe('Direcciones e indexación pública', () => {
  it('anuncia un sitemap de su propio dominio en cada robots.txt', async () => {
    for (const host of ['victoriakingdom.com','wiki.victoriakingdom.com']) {
      const res = await pedir(`https://${host}/robots.txt`);
      expect(await res.text()).toContain(`Sitemap: https://${host}/sitemap.xml`);
    }
  });
  it('sirve el mapa de la wiki al pedirlo desde su dominio', async () => {
    const next = vi.fn(async request => new Response(request.url));
    const res = await pedir('https://wiki.victoriakingdom.com/sitemap.xml', next);
    expect(await res.text()).toBe('https://wiki.victoriakingdom.com/sitemap-wiki.xml');
  });
  it('redirige copias al dominio canónico preservando rutas y parámetros', async () => {
    for (const [desde,hacia] of [
      ['https://victoriakingdom.com/wiki/telefono?origen=web','https://wiki.victoriakingdom.com/wiki/telefono?origen=web'],
      ['https://www.victoriakingdom.com/guia','https://victoriakingdom.com/guia'],
      ['https://victoriakingdom.pages.dev/wiki/banco','https://wiki.victoriakingdom.com/wiki/banco'],
      ['https://wiki.victoriakingdom.com/','https://wiki.victoriakingdom.com/wiki'],
      ['https://victoriakingdom.pages.dev/novedades','https://victoriakingdom.com/novedades'],
      ['https://wiki.victoriakingdom.com/privacidad','https://victoriakingdom.com/privacidad']
    ]) {
      const res = await pedir(desde);
      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toBe(hacia);
    }
  });
  it('mantiene las API del dominio antiguo para los launchers distribuidos', async () => {
    for (const path of ['/api/launcher?actual=1','/api/modpack','/api/estado','/api/normas','/api/discord','/datos/novedades.json']) {
      const next = vi.fn(async () => new Response('compatible'));
      const res = await pedir('https://victoriakingdom.pages.dev'+path, next);
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    }
  });
  it('excluye despliegues de prueba del índice, sin excluir el sitio oficial', async () => {
    expect((await pedir('https://prueba.victoriakingdom.pages.dev/')).headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect((await pedir('https://victoriakingdom.com/')).headers.get('x-robots-tag')).toBeNull();
  });
});

describe('Contenido entregado a los buscadores sin JavaScript', () => {
  const paginas = [
    ['index.html','https://victoriakingdom.com/'],
    ['guia.html','https://victoriakingdom.com/guia'],
    ['normas.html','https://victoriakingdom.com/normas'],
    ['novedades.html','https://victoriakingdom.com/novedades'],
    ['privacidad.html','https://victoriakingdom.com/privacidad'],
    ['wiki.html','https://wiki.victoriakingdom.com/wiki'],
    ...articulos.map(a=>[`wiki/${a.id}.html`,`https://wiki.victoriakingdom.com/wiki/${a.id}`])
  ];
  it('tiene títulos únicos, canónicas y datos estructurados válidos para las 27 páginas', () => {
    const titulos = [];
    for (const [archivo,url] of paginas) {
      const html = leer(archivo);
      const titulo = html.match(/<title>(.*?)<\/title>/)[1];
      titulos.push(titulo);
      expect(titulo).toContain('Victoria Kingdom');
      expect(html).toContain(`rel="canonical" href="${url}"`);
      expect(html).toContain(`property="og:url" content="${url}"`);
      const schema = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
      expect(schema['@graph'].some(n=>n.url===url && ['WebPage','CollectionPage','TechArticle'].includes(n['@type']))).toBe(true);
      expect(html).not.toMatch(/name="robots" content="noindex/);
    }
    expect(new Set(titulos).size).toBe(27);
  });
  it('cada sitemap contiene únicamente páginas canónicas de su propio host', () => {
    for (const [archivo,host,total] of [['sitemap.xml','victoriakingdom.com',5],['sitemap-wiki.xml','wiki.victoriakingdom.com',22]]) {
      const urls = [...leer(archivo).matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
      expect(urls).toHaveLength(total);
      expect(new Set(urls).size).toBe(total);
      for (const url of urls) {
        expect(new URL(url).hostname).toBe(host);
        expect(paginas.some(p=>p[1]===url)).toBe(true);
      }
    }
  });
  it('la página de error continúa fuera del índice', () => {
    expect(leer('404.html')).toMatch(/name="robots" content="noindex/);
  });
});
