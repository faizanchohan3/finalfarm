mport { NextResponse } from "next/server"

/**
 * Returns a cached JSON response.
 * max: fresh for N seconds (browser serves from cache instantly)
 * swr: serve stale for this many extra seconds while refreshing in background
 */
export function cachedJson(data: unknown, max = 15, swr = 60) {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `private, max-age=${max}, stale-while-revalidate=${swr}`,
    },
  })
}

