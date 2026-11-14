import 'server-only';

/** Callers must provide an explicit stable ordering before requesting a page. */
export async function collectSpartacoRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 500,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await page(from, from + pageSize - 1);
    if (result.error) throw result.error;
    if (!result.data) throw new Error('Saved report source returned no data');
    rows.push(...result.data);
    if (result.data.length < pageSize) return rows;
  }
}
