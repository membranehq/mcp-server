import { describe, test, expect } from 'vitest';
import { selectHighestPriorityScope, SCOPE_PRIORITY } from '../../src/server/utils/oauth/scope';

describe('SCOPE_PRIORITY', () => {
  test('platform-user is higher priority than tenant', () => {
    const platformUserIndex = SCOPE_PRIORITY.indexOf('platform-user');
    const tenantIndex = SCOPE_PRIORITY.indexOf('tenant');
    expect(platformUserIndex).toBeLessThan(tenantIndex);
  });
});

describe('selectHighestPriorityScope', () => {
  test('returns undefined for empty array', () => {
    expect(selectHighestPriorityScope([])).toBeUndefined();
  });

  test('returns the single scope when only one is provided', () => {
    expect(selectHighestPriorityScope(['tenant'])).toBe('tenant');
    expect(selectHighestPriorityScope(['platform-user'])).toBe('platform-user');
  });

  test('selects platform-user over tenant (higher priority)', () => {
    expect(selectHighestPriorityScope(['platform-user', 'tenant'])).toBe('platform-user');
  });

  test('selects platform-user regardless of input order', () => {
    expect(selectHighestPriorityScope(['tenant', 'platform-user'])).toBe('platform-user');
  });

  test('returns first scope if none match the priority list', () => {
    expect(selectHighestPriorityScope(['unknown-scope', 'another-scope'])).toBe('unknown-scope');
  });

  test('selects highest priority even with unknown scopes mixed in', () => {
    expect(selectHighestPriorityScope(['unknown', 'tenant', 'other'])).toBe('tenant');
    expect(selectHighestPriorityScope(['unknown', 'platform-user', 'tenant'])).toBe(
      'platform-user'
    );
  });

  test('returns a single unknown scope as-is', () => {
    expect(selectHighestPriorityScope(['custom-scope'])).toBe('custom-scope');
  });
});
