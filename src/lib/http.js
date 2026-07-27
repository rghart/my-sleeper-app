/**
 * Throws on any non-ok response so a failed request lands in a `.catch`
 * rather than flowing on as a body that isn't there. Returns the response
 * untouched otherwise, so it composes as a `.then` link in a fetch chain.
 */
export function checkErrors(response) {
    if (!response.ok) {
        throw new Error(response.statusText, response.status);
    }
    return response;
}

/**
 * A fetch wrapper that swallows its own errors: any network failure, and any
 * non-ok response (via `checkErrors`), resolves to `undefined` rather than
 * rejecting.
 *
 * That is load-bearing for every caller - a returned `undefined` is how a
 * failure is signalled, so callers must check the result before reading from
 * it. Reading `.json()` or a property first is what caused #101 and #103, both
 * of which surfaced as a TypeError far from the request that failed.
 */
export async function fetchRequest(url, type, data, custHeaders) {
    const response = await fetch(url, {
        method: type,
        headers: custHeaders
            ? custHeaders
            : {
                  'Content-type': 'application/json',
              },
        body: data ? JSON.stringify(data) : null,
    })
        .then(checkErrors)
        .catch((err) => console.error('Error:', err));
    if (response) {
        console.log(response.statusText);
    }
    return response;
}
