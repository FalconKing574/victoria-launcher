const WEB = 'https://victoriakingdom.com';
const WIKI = 'https://wiki.victoriakingdom.com';

// Datos públicos de la comunidad; sin reseñas ni estadísticas inventadas.
export function datosEstructurados({ titulo, descripcion, url, wiki = false }) {
  const inicio = wiki ? `${WIKI}/wiki` : `${WEB}/`;
  const sitio = wiki ? WIKI : WEB;
  const organizacion = {
    '@type': 'Organization', '@id': `${WEB}/#organizacion`,
    name: 'Victoria Kingdom', url: `${WEB}/`,
    logo: `${WEB}/img/icono.png`, sameAs: ['https://discord.gg/HFvsGaxc7G']
  };
  const pagina = {
    '@type': wiki && url !== inicio ? 'TechArticle' : wiki ? 'CollectionPage' : 'WebPage',
    '@id': `${url}#pagina`, url, name: titulo, description: descripcion,
    inLanguage: 'es', isPartOf: { '@id': `${sitio}/#sitio` },
    publisher: { '@id': organizacion['@id'] }
  };
  if (pagina['@type'] === 'TechArticle') {
    pagina.headline = titulo;
    pagina.mainEntityOfPage = url;
  }
  const graph = [organizacion, {
    '@type': 'WebSite', '@id': `${sitio}/#sitio`, url: `${sitio}/`,
    name: wiki ? 'Wiki Victoria Kingdom' : 'Victoria Kingdom',
    inLanguage: 'es', publisher: { '@id': organizacion['@id'] }
  }, pagina];
  if (url !== inicio) graph.push({
    '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: wiki ? 'Wiki Victoria Kingdom' : 'Victoria Kingdom', item: inicio },
      { '@type': 'ListItem', position: 2, name: titulo, item: url }
    ]
  });
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}
