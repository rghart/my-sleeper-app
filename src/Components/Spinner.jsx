// Replaces loader.css's `.loader` (full-page) and `.panel-loader` (per-panel)
// with a single component. Both were a plain ring rotating via @keyframes;
// `animate-spin` plus a border ring reproduces that without a separate
// stylesheet.
//
// Deliberately `role="progressbar"`, not `role="status"`: ErrorBanner's
// warning variant already uses `status`, and several tests query
// `getByRole('status')` expecting exactly that banner. A second `status`
// node on screen at the same time makes those queries ambiguous.
const SIZING = {
    page: {
        wrapper: 'flex min-h-[50vh] items-center justify-center',
        ring: 'h-16 w-16 border-4',
        label: 'Loading your leagues',
    },
    panel: {
        wrapper: 'flex items-center justify-center py-6',
        ring: 'h-10 w-10 border-4',
        label: 'Loading',
    },
};

const Spinner = ({ size = 'panel' }) => {
    const { wrapper, ring, label } = SIZING[size];
    return (
        <div className={wrapper}>
            <div
                role="progressbar"
                aria-label={label}
                className={`${ring} border-line border-t-ink animate-spin rounded-full motion-reduce:animate-none`}
            />
        </div>
    );
};

export default Spinner;
