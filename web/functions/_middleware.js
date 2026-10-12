export async function onRequest({request,next}) {
 const url=new URL(request.url);
 if(url.hostname==='www.victoriakingdom.com'){
  url.hostname='victoriakingdom.com';return Response.redirect(url.href,301);
 }
 if(url.hostname==='wiki.victoriakingdom.com'&&url.pathname==='/'){
  url.pathname='/wiki';return Response.redirect(url.href,302);
 }
 return next();
}
