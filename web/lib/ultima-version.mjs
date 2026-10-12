const REPO='FalconKing574/victoria-launcher';
export function resumirVersion(release) {
 if(!release||release.draft!==false||release.prerelease!==false||!/^v\d+\.\d+\.\d+$/.test(release.tag_name??''))throw Error('No hay una versión estable válida.');
 const version=release.tag_name.slice(1),nombre=`Victoria-Kingdom-actualizacion-${version}.exe`;
 const asset=release.assets?.find(x=>x.name===nombre),url=`https://github.com/${REPO}/releases/download/${release.tag_name}/${nombre}`;
 if(!asset||asset.browser_download_url!==url||!/^sha256:[a-f0-9]{64}$/i.test(asset.digest??'')||!Number.isSafeInteger(asset.size)||asset.size<1000000||asset.size>536870912)throw Error('El instalador no tiene una integridad verificable.');
 return {version,url,sha256:asset.digest.slice(7).toLowerCase(),size:asset.size,publishedAt:release.published_at??null};
}
export const URL_ULTIMA=`https://api.github.com/repos/${REPO}/releases/latest`;
