# La web de Victoria Kingdom

Portada, guía de instalación y normas, en Cloudflare Pages (gratis). Mismo
aspecto que el launcher.

```bash
npm run web:ver        # http://localhost:8788, con las funciones de /api
npm run web:publicar   # a producción (la primera vez, ver la guía)
```

Todo lo demás —qué hay dónde, cómo publicar la primera vez, cómo cambiar
novedades, capturas o enlaces, y las trampas— está en
[`docs/mantenimiento/06-web.md`](../docs/mantenimiento/06-web.md).

## Dominio y wiki (11-10-2026)

Sitio oficial: https://victoriakingdom.com · Wiki: https://wiki.victoriakingdom.com
Minecraft Java: mc.victoriakingdom.com (SRV, puerto 25567).

La portada conserva su diseño. La wiki es estática: los artículos funcionan sin
JavaScript; el buscador consulta /datos/wiki.json. No hay servicios externos de búsqueda.

Para editar artículos y regenerar el HTML, el índice de búsqueda y el sitemap:

    node web/generar-wiki.mjs

El contenido editorial vive en web/wiki-contenido.mjs. Contrastar cambios con
ContenidoGuia.java y docs/COMANDOS.md de VictoriaRP. No publicar requisitos o
precios de planes sin implementar. Normas sigue consultando la normativa oficial.

Cloudflare Pages: proyecto victoriakingdom, cuenta a5e7924cd0a13f25c9477a45c6af74f3.
Dominios: victoriakingdom.com, www.victoriakingdom.com y wiki.victoriakingdom.com.
El middleware redirige www al dominio principal y la raíz de wiki a /wiki.
El dominio pages.dev sigue funcionando para los instaladores ya distribuidos.
/api/launcher conserva la consulta de la última publicación; no fijar una versión.

Validación del 11-10-2026: typecheck correcto; 12 pruebas de funciones web correctas;
21 artículos accesibles, enlaces relacionados válidos, búsqueda y vista móvil comprobadas.

Publicación manual autorizada del sitio: 56527279.victoriakingdom.pages.dev.
No modifica ni publica el ejecutable del launcher.

## Búsqueda orgánica (12-10-2026)

Las 25 páginas públicas tienen títulos propios, descripción, URL canónica,
Open Graph y JSON-LD de la comunidad, el sitio y la página. Los artículos
incluyen rutas de navegación estructuradas. `web/seo.mjs` genera el JSON-LD;
`node web/generar-wiki.mjs` regenera las guías y ambos sitemaps. Los metadatos
de portada, instalación y normas se mantienen en sus HTML.

`/sitemap.xml` contiene tres páginas en el dominio principal y 22 en el
dominio de la wiki: el middleware entrega `sitemap-wiki.xml` en este último.
Cada `robots.txt` anuncia el mapa de su propio host. Las copias de páginas en
el dominio antiguo y en el dominio principal redirigen permanentemente a su
dirección oficial. Las API de pages.dev se conservan para los instaladores.
Los despliegues de prueba llevan `X-Robots-Tag: noindex, nofollow`.

Verificación: `npm run typecheck` y `npm test`, incluyendo regresiones de
canónicas, separación de mapas, redirecciones y compatibilidad de las API.
Search Console debe conservar la verificación DNS para poder enviar mapas,
inspeccionar URL y medir consultas. Un envío no garantiza indexación ni una
posición determinada. No añadir palabras clave ocultas ni reseñas ficticias.

## Portada completa, novedades y privacidad (19-10-2026)

La portada suma Sistemas (pestañas que enlazan a la wiki), Tu historia,
preguntas frecuentes con su JSON-LD y la gente del Discord en vivo
(`/api/discord`). Hay dos páginas nuevas, `novedades` y `privacidad`, en el
sitemap y en las redirecciones del middleware.

La cabecera, el pie y las novedades ya no se copian a mano en cada página:

    node web/generar-paginas.mjs

Las novedades salen de `public/datos/novedades.json`, que **también lee el
launcher** para su pantalla Jugar. Todo el detalle, en
`docs/mantenimiento/06-web.md`.
