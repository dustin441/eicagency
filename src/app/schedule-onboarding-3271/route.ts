const retiredPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Page retired | EIC Agency</title></head><body><main><h1>This page has been retired.</h1><p>Visit <a href="https://eic.agency/">EIC Agency</a> for current information.</p></main></body></html>`;

export function GET() {
  return new Response(retiredPage, {
    status: 410,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
