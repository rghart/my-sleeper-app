import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { checkErrors, fetchRequest } from './http.js';

// fetchRequest's contract is that it never rejects: every failure - network
// error or non-ok response - resolves to `undefined`. Callers rely on that to
// signal failure, and reading from the result before checking it is exactly
// what caused #101 and #103. These tests pin the contract now that it lives in
// a module of its own rather than as a method on App.

const okResponse = (body = {}) => ({ ok: true, statusText: 'OK', json: () => Promise.resolve(body) });

describe('checkErrors', () => {
    it('returns an ok response untouched so it composes in a then-chain', () => {
        const response = okResponse();
        expect(checkErrors(response)).toBe(response);
    });

    it('throws on a non-ok response', () => {
        expect(() => checkErrors({ ok: false, status: 404, statusText: 'Not Found' })).toThrow('Not Found');
    });

    it('treats any falsy ok as a failure, not just an explicit false', () => {
        expect(() => checkErrors({ ok: undefined, statusText: 'Gateway Timeout' })).toThrow();
    });
});

describe('fetchRequest', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('resolves to the response on success', async () => {
        const response = okResponse({ some: 'data' });
        global.fetch = vi.fn(() => Promise.resolve(response));

        expect(await fetchRequest('https://example.test/x', 'GET')).toBe(response);
    });

    it('resolves to undefined when the network rejects', async () => {
        global.fetch = vi.fn(() => Promise.reject(new Error('offline')));

        // Not a rejection: callers `await` this without a try/catch, so a
        // rejection here would become an unhandled one far from the call site.
        await expect(fetchRequest('https://example.test/x', 'GET')).resolves.toBeUndefined();
    });

    it('resolves to undefined on a non-ok response', async () => {
        // The path that matters most: checkErrors throws, the internal catch
        // swallows it, and the caller gets undefined rather than a response
        // object whose .json() would throw.
        global.fetch = vi.fn(() => Promise.resolve({ ok: false, statusText: 'Internal Server Error' }));

        await expect(fetchRequest('https://example.test/x', 'GET')).resolves.toBeUndefined();
    });

    it('serialises a body and defaults to a JSON content type', async () => {
        global.fetch = vi.fn(() => Promise.resolve(okResponse()));

        await fetchRequest('https://example.test/x', 'PUT', { rank_list: [1, 2] });

        expect(global.fetch).toHaveBeenCalledWith('https://example.test/x', {
            method: 'PUT',
            headers: { 'Content-type': 'application/json' },
            body: JSON.stringify({ rank_list: [1, 2] }),
        });
    });

    it('sends a null body when there is no data, rather than the string "undefined"', async () => {
        global.fetch = vi.fn(() => Promise.resolve(okResponse()));

        await fetchRequest('https://example.test/x', 'DELETE');

        expect(global.fetch.mock.calls[0][1].body).toBeNull();
    });

    it('prefers caller-supplied headers over the JSON default', async () => {
        global.fetch = vi.fn(() => Promise.resolve(okResponse()));

        await fetchRequest('https://example.test/x', 'POST', null, { Authorization: 'Bearer t' });

        expect(global.fetch.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer t' });
    });
});
