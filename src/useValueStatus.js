import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchValueStatus } from './lib/sleeperApi.js';
import { valueWarning } from './lib/valueStatus.js';

// Whether the market values are current, for the app-wide banner.
//
// Checked when the app opens, and again whenever the tab comes back into
// view after a while - a phone left on the app for a day should not keep
// showing yesterday's all-clear. `recheck` is the banner's Retry, so once a
// broken refresh is fixed the warning can be cleared without a reload.
const RECHECK_AFTER_MS = 10 * 60 * 1000;

export function useValueStatus() {
    const [status, setStatus] = useState(undefined);
    const lastChecked = useRef(0);

    const recheck = useCallback(() => {
        lastChecked.current = Date.now();
        fetchValueStatus().then(setStatus);
    }, []);

    useEffect(() => {
        recheck();
        const onVisible = () => {
            if (document.visibilityState === 'visible' && Date.now() - lastChecked.current > RECHECK_AFTER_MS) {
                recheck();
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [recheck]);

    return { warning: valueWarning(status), recheck };
}
