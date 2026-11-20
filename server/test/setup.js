import { vi } from 'vitest';

// Build a chainable Supabase query builder that resolves to { data, error }.
// Pass a map of table -> result to control what each table query resolves to.
export function makeSupabaseMock(resultByTable = {}) {
  function builder(tableResult) {
    const chain = {};
    const methods = [
      'select', 'eq', 'lt', 'lte', 'gte', 'gt', 'order', 'limit',
      'update', 'insert', 'delete', 'single', 'maybeSingle', 'in', 'neq',
    ];
    for (const m of methods) {
      chain[m] = vi.fn(() => chain);
    }
    // Make the chain thenable so `await chain` resolves to the result.
    chain.then = (resolve) => resolve(tableResult);
    return chain;
  }
  return {
    from: vi.fn((table) => builder(resultByTable[table] || { data: null, error: null })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };
}
