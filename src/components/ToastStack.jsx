import "./ToastStack.css";

export default function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="mm-toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`mm-toast is-${toast.tone || "info"}`}>
          <span>{toast.text}</span>
          <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
            x
          </button>
        </div>
      ))}
    </div>
  );
}
