// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

// localStorage is shared by every test in a file. useSeenPicks writes to it on
// mount, so without this a test that renders the draft board leaves a seen
// snapshot behind and the next test in the same file starts as a "returning
// visit" - which changes accessible names ("..., new") in App.test.jsx
// depending only on test order. Clearing globally keeps that per-test rather
// than per-file.
beforeEach(() => {
    localStorage.clear();
});
