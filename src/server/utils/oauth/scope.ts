/**
 * Scope priority list, highest permission first.
 * "platform-user" has broader access than "tenant".
 */
export const SCOPE_PRIORITY: string[] = ['platform-user', 'tenant'];

/**
 * Given an array of OAuth scopes, return the single highest-priority scope.
 *
 * When MCP clients (like Lovable) request multiple scopes (e.g. "platform-user tenant"),
 * the upstream Membrane API only accepts a single scope. This function selects the
 * most permissive one based on SCOPE_PRIORITY.
 *
 * - If the array is empty, returns undefined.
 * - If none match the priority list, returns the first scope (forward-compatibility).
 */
export function selectHighestPriorityScope(scopes: string[]): string | undefined {
  if (scopes.length === 0) return undefined;
  if (scopes.length === 1) return scopes[0];

  for (const priorityScope of SCOPE_PRIORITY) {
    if (scopes.includes(priorityScope)) {
      return priorityScope;
    }
  }

  return scopes[0];
}
