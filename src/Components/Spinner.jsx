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
        // A row-sized box - three ListRow single-line rows (46px each) -
        // rather than a fixed py-6 wrapper, so the panel that will hold rows
        // once loading finishes already occupies the space they'll land in
        // and the page doesn't jump when they arrive. border-4 read heavy at
        // this box's 40px scale (the ring nearly touched itself in the
        // middle); border-2 keeps the same two tokens legible without
        // looking like a solid disc.
        wrapper: 'flex min-h-[138px] items-center justify-center',
        ring: 'h-10 w-10 border-2',
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
