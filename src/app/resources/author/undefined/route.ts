const retiredPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Author archive retired | EIC Agency</title></head><body><main><h1>This author archive has been retired.</h1><p>Browse the current <a href="https://eic.agency/resources">EIC Agency resources</a>.</p></main></body></html>`;

export function GET() {
  return new Response(retiredPage, {
    status: 410,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
