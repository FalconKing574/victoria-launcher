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
