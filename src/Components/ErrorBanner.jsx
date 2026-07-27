import Button from './Button';

// Shown in place of the panels when there is no league data to render them
// from. Deliberately blocking rather than a dismissible toast: both panels
// read league data unconditionally, so there is nothing useful behind it.
const ErrorBanner = ({ message, onRetry }) => {
    return (
        <div className="error-banner" role="alert">
            <p>{message}</p>
            <Button text="Retry" btnStyle="primary" onClick={onRetry} />
        </div>
    );
};

export default ErrorBanner;
