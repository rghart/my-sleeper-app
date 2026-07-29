import Button from './Button';

// Two modes, chosen by `variant`:
// - 'error' (default): shown in place of the panels when there is no league
//   data to render them from. Deliberately blocking rather than a dismissible
//   toast - both panels read league data unconditionally, so there is nothing
//   useful behind it. Uses role="alert" so it interrupts a screen reader.
// - 'warning': a non-blocking notice rendered alongside the panels, for a
//   partial failure the app can still render around. Uses role="status" so
//   it does not interrupt.
// Both modes require an `onRetry`. An optional one was written first and then
// removed: both call sites pass a handler, so the "no button" branch was
// unreachable, and a sabotage that made the button unconditional passed the
// whole suite. Untested speculative generality is worse than the one-line
// change it would save if a retryless notice ever turns up.
// The shell is rebuilt now, so the legacy 10px radius / 15px padding / 3px
// margins carried over verbatim from this component's original stylesheet
// conversion become the scale values the shell already uses elsewhere:
// `rounded-card`, a raised surface, a 1px `border-line` shell, and a 6px
// leading dot in the variant's tone (danger/warn) instead of the old 4px
// left border - the dot marks the banner's tone without needing a
// border-side utility of its own.
const BANNER = 'border-line bg-raised rounded-card flex flex-row flex-wrap items-center gap-3 border p-4';

const DOT_TONE = {
    warning: 'bg-warn',
    error: 'bg-danger',
};

const ErrorBanner = ({ message, onRetry, variant = 'error' }) => {
    const role = variant === 'warning' ? 'status' : 'alert';
    return (
        <div className={BANNER} role={role}>
            <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_TONE[variant]}`} />
            <p className="text-ink m-0 flex-1">{message}</p>
            <Button text="Retry" btnStyle="active" onClick={onRetry} />
        </div>
    );
};

export default ErrorBanner;
