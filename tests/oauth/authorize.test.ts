import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import { oauthRouter } from '../../src/server/routes/oauth';

const TEST_PORT = 3456;
let server: http.Server;

beforeAll(async () => {
  const app = express();
  app.use(oauthRouter);
  await new Promise<void>(resolve => {
    server = app.listen(TEST_PORT, resolve);
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(err => (err ? reject(err) : resolve()));
  });
});

describe('OAuth authorize proxy', () => {
  test('redirects single scope unchanged', async () => {
    const response = await fetch(
      `http://localhost:${TEST_PORT}/oauth/authorize?` +
        new URLSearchParams({
          client_id: 'test-client',
          scope: 'tenant',
          response_type: 'code',
          redirect_uri: 'http://localhost/callback',
          code_challenge: 'abc123',
          code_challenge_method: 'S256',
          state: 'state123',
        }).toString(),
      { redirect: 'manual' }
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location')!);
    expect(location.origin).toBe('https://api.getmembrane.com');
    expect(location.pathname).toBe('/oauth/authorize');
    expect(location.searchParams.get('scope')).toBe('tenant');
    expect(location.searchParams.get('client_id')).toBe('test-client');
    expect(location.searchParams.get('state')).toBe('state123');
  });

  test('reduces multi-scope to highest priority (platform-user > tenant)', async () => {
    const response = await fetch(
      `http://localhost:${TEST_PORT}/oauth/authorize?` +
        new URLSearchParams({
          client_id: 'test-client',
          scope: 'platform-user tenant',
          response_type: 'code',
          redirect_uri: 'http://localhost/callback',
          code_challenge: 'abc123',
          code_challenge_method: 'S256',
        }).toString(),
      { redirect: 'manual' }
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location')!);
    expect(location.searchParams.get('scope')).toBe('platform-user');
  });

  test('reduces multi-scope regardless of order (tenant before platform-user)', async () => {
    const response = await fetch(
      `http://localhost:${TEST_PORT}/oauth/authorize?` +
        new URLSearchParams({
          client_id: 'test-client',
          scope: 'tenant platform-user',
          response_type: 'code',
          redirect_uri: 'http://localhost/callback',
          code_challenge: 'abc123',
          code_challenge_method: 'S256',
        }).toString(),
      { redirect: 'manual' }
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location')!);
    expect(location.searchParams.get('scope')).toBe('platform-user');
  });

  test('preserves all non-scope query parameters', async () => {
    const response = await fetch(
      `http://localhost:${TEST_PORT}/oauth/authorize?` +
        new URLSearchParams({
          client_id: 'oauth_abc123',
          scope: 'platform-user tenant',
          response_type: 'code',
          redirect_uri: 'https://api.lovable.dev/workspaces/oauth/callback',
          resource: 'https://api.getmembrane.com/mcp/self-integration',
          code_challenge: 'lv7W7NgFSJwgzs5coqXFL_GWm0g1ws5uLj6QAcquaJ4',
          code_challenge_method: 'S256',
          state: 'eyJzaWQiOiJlYjk0MWZmNy0xODJjLTRkOWUtOWY1NS0yZmI3M2RiYjQ3NTIifQ',
        }).toString(),
      { redirect: 'manual' }
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location')!);
    expect(location.searchParams.get('scope')).toBe('platform-user');
    expect(location.searchParams.get('client_id')).toBe('oauth_abc123');
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('redirect_uri')).toBe(
      'https://api.lovable.dev/workspaces/oauth/callback'
    );
    expect(location.searchParams.get('resource')).toBe(
      'https://api.getmembrane.com/mcp/self-integration'
    );
    expect(location.searchParams.get('code_challenge')).toBe(
      'lv7W7NgFSJwgzs5coqXFL_GWm0g1ws5uLj6QAcquaJ4'
    );
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('state')).toBe(
      'eyJzaWQiOiJlYjk0MWZmNy0xODJjLTRkOWUtOWY1NS0yZmI3M2RiYjQ3NTIifQ'
    );
  });

  test('handles request with no scope parameter', async () => {
    const response = await fetch(
      `http://localhost:${TEST_PORT}/oauth/authorize?` +
        new URLSearchParams({
          client_id: 'test-client',
          response_type: 'code',
          redirect_uri: 'http://localhost/callback',
          code_challenge: 'abc123',
          code_challenge_method: 'S256',
        }).toString(),
      { redirect: 'manual' }
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location')!);
    expect(location.searchParams.has('scope')).toBe(false);
  });
});

describe('OAuth metadata endpoints', () => {
  test('serves authorization server metadata with corrected scopes', async () => {
    const response = await fetch(
      `http://localhost:${TEST_PORT}/.well-known/oauth-authorization-server`
    );
    expect(response.status).toBe(200);

    const metadata = await response.json();
    expect(metadata.issuer).toBe('https://api.getmembrane.com');
    expect(metadata.scopes_supported).toEqual(['tenant']);
    expect(metadata.response_types_supported).toEqual(['code']);
    expect(metadata.code_challenge_methods_supported).toEqual(['S256']);
    expect(metadata.token_endpoint).toBe('https://api.getmembrane.com/oauth/token');
    expect(metadata.registration_endpoint).toBe('https://api.getmembrane.com/oauth/register');
  });

  test('serves protected resource metadata', async () => {
    const response = await fetch(
      `http://localhost:${TEST_PORT}/.well-known/oauth-protected-resource`
    );
    expect(response.status).toBe(200);

    const metadata = await response.json();
    expect(metadata.authorization_servers).toEqual(['https://api.getmembrane.com']);
    expect(metadata.scopes_supported).toEqual(['tenant']);
    expect(metadata.bearer_methods_supported).toEqual(['header']);
  });
});
