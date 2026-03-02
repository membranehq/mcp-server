import express from 'express';
import { selectHighestPriorityScope } from '../utils/oauth/scope';

export const oauthRouter = express.Router();

const MEMBRANE_API_URL = process.env.MEMBRANE_API_URL || 'https://api.getmembrane.com';

const UPSTREAM_AUTHORIZE_URL = `${MEMBRANE_API_URL}/oauth/authorize`;
const UPSTREAM_TOKEN_URL = `${MEMBRANE_API_URL}/oauth/token`;
const UPSTREAM_REGISTRATION_URL = `${MEMBRANE_API_URL}/oauth/register`;
const UPSTREAM_REVOCATION_URL = `${MEMBRANE_API_URL}/oauth/revoke`;

/**
 * Scopes to advertise in metadata. Only "tenant" is advertised to prevent
 * clients from requesting multiple scopes (the upstream API only accepts one).
 */
const SCOPES_SUPPORTED = ['tenant'];

/**
 * OAuth Authorization Server Metadata (RFC 8414)
 *
 * Points clients to this server's /oauth/authorize proxy endpoint instead
 * of the upstream Membrane API directly. This lets us normalize multi-scope
 * requests before forwarding.
 */
oauthRouter.get('/.well-known/oauth-authorization-server', (_req, res) => {
  const serverUrl = process.env.MCP_SERVER_URL || MEMBRANE_API_URL;

  res.json({
    issuer: MEMBRANE_API_URL,
    authorization_endpoint: `${serverUrl}/oauth/authorize`,
    token_endpoint: UPSTREAM_TOKEN_URL,
    registration_endpoint: UPSTREAM_REGISTRATION_URL,
    revocation_endpoint: UPSTREAM_REVOCATION_URL,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: SCOPES_SUPPORTED,
    code_challenge_methods_supported: ['S256'],
    client_id_metadata_document_supported: true,
  });
});

/**
 * OAuth Protected Resource Metadata (RFC 9728)
 */
oauthRouter.get('/.well-known/oauth-protected-resource', (_req, res) => {
  const resourceUrl = process.env.MCP_RESOURCE_URL || `${MEMBRANE_API_URL}/mcp/self-integration`;

  res.json({
    resource: resourceUrl,
    authorization_servers: [MEMBRANE_API_URL],
    scopes_supported: SCOPES_SUPPORTED,
    bearer_methods_supported: ['header'],
  });
});

/**
 * OAuth Authorize Proxy
 *
 * Intercepts authorize requests from MCP clients. When clients send multiple
 * scopes (e.g. "platform-user tenant"), this handler selects the highest-permission
 * scope and redirects to the upstream Membrane API with a single scope.
 *
 * This fixes the issue where the upstream API rejects space-delimited multi-scope
 * values with: "scope: Invalid option: expected one of 'platform-user'|'tenant'"
 */
oauthRouter.get('/oauth/authorize', (req, res) => {
  const params = new URLSearchParams();

  // Copy all query parameters to the upstream URL
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') {
      if (key === 'scope') {
        // Parse space-delimited scopes and select the highest-priority one
        const scopes = value.split(' ').filter(Boolean);
        const selectedScope = selectHighestPriorityScope(scopes);
        if (selectedScope) {
          params.set('scope', selectedScope);
        }
      } else {
        params.set(key, value);
      }
    }
  }

  const targetUrl = `${UPSTREAM_AUTHORIZE_URL}?${params.toString()}`;
  res.redirect(302, targetUrl);
});
