import "./ConfirmDialog.css";

export default function ConfirmDialog({
  open,
  title,
  description,
  kicker = "Please confirm",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  meta = [],
  busy = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="mm-confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="mm-confirm-title">
      <div className="mm-confirm-card">
        <p className="mm-confirm-kicker">{kicker}</p>
        <h2 id="mm-confirm-title">{title}</h2>
        {description ? <p className="mm-confirm-text">{description}</p> : null}
        {meta.length ? (
          <div className="mm-confirm-meta">
            {meta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ) : null}
        <div className="mm-confirm-actions">
          <button type="button" className="mm-confirm-btn mm-confirm-btn--ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`mm-confirm-btn mm-confirm-btn--solid is-${tone}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
