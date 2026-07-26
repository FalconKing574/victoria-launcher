export interface AuthorizeUrlOptions {
  clientId: string
  redirectUri: string
  state: string
}

export function buildAuthorizeUrl({ clientId, redirectUri, state }: AuthorizeUrlOptions): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
    state
  })
  return `https://discord.com/oauth2/authorize?${params.toString()}`
}
