/**
 * Throws on any non-ok response so a failed request lands in a `.catch`
 * rather than flowing on as a body that isn't there. Returns the response
 * untouched otherwise, so it composes as a `.then` link in a fetch chain.
 */
export function checkErrors(response) {
    if (!response.ok) {
        // The status goes in the message, not in a second argument. Error's
        // second parameter is an options object (`{ cause }`), so passing a
        // number there discarded it silently - and the status is often the
        // only thing distinguishing a 404 from a 500 in the logged output,
        // since statusText is routinely empty over HTTP/2.
        throw new Error(response.status ? `${response.status} ${response.statusText}` : response.statusText);
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
