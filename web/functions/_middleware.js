export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const wiki = url.hostname === 'wiki.victoriakingdom.com';
  const principal = url.hostname === 'victoriakingdom.com';
  const origen = url.hostname === 'victoriakingdom.pages.dev';
  const vistaPrevia = url.hostname.endsWith('.victoriakingdom.pages.dev');
  const paginaWiki = /^\/wiki(?:\/|$|\.html$)/.test(url.pathname);
  const paginaWeb = /^\/(?:index(?:\.html)?|guia(?:\.html)?|normas(?:\.html)?)?\/?$/.test(url.pathname);

  if (url.hostname === 'www.victoriakingdom.com' || (origen && (paginaWiki || paginaWeb))) {
    url.hostname = paginaWiki ? 'wiki.victoriakingdom.com' : 'victoriakingdom.com';
    return Response.redirect(url.href, 301);
  }
  if (principal && paginaWiki) {
    url.hostname = 'wiki.victoriakingdom.com';
    return Response.redirect(url.href, 301);
  }
  if (wiki && /^\/(?:index(?:\.html)?)?$/.test(url.pathname)) {
    url.pathname = '/wiki';
    return Response.redirect(url.href, 301);
  }
  if (wiki && paginaWeb) {
    url.hostname = 'victoriakingdom.com';
    return Response.redirect(url.href, 301);
  }
  if (url.pathname === '/robots.txt' && (principal || wiki || origen || vistaPrevia)) {
    const contenido = origen || vistaPrevia
      ? 'User-agent: *\nDisallow: /\n'
      : `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: https://${url.hostname}/sitemap.xml\n`;
    return new Response(request.method === 'HEAD' ? null : contenido, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
    });
  }
  if (wiki && url.pathname === '/sitemap.xml') {
    url.pathname = '/sitemap-wiki.xml';
    return next(new Request(url.href, request));
  }
  const respuesta = await next();
  if (vistaPrevia) {
    const copia = new Response(respuesta.body, respuesta);
    copia.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return copia;
  }
  return respuesta;
}
