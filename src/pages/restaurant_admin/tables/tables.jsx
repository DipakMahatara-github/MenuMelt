import { useEffect, useState } from "react";
import "./tables.css";
import { authFetch, API_BASE } from "../../../lib/api";
import ConfirmDialog from "../../../components/ConfirmDialog";
import ToastStack from "../../../components/ToastStack";
import { useToastQueue } from "../../../hooks/useToastQueue";

export default function Tables() {

  const API = `${API_BASE}/api/tables/tables/`;

  const [tables, setTables] = useState([]);
  const getQrImageUrl = (qrImagePath) => {
    if (!qrImagePath) return null;
    if (qrImagePath.startsWith("http://") || qrImagePath.startsWith("https://")) {
      return qrImagePath;
    }
    return `${API_BASE}${qrImagePath}`;
  };

  const [number, setNumber] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [busyDeleteId, setBusyDeleteId] = useState("");
  const { toasts, pushToast, removeToast } = useToastQueue();

  // ✅ FETCH TABLES
  const fetchTables = async () => {
    try {
      const res = await authFetch(API);
      const data = await res.json().catch(() => ({}));

      const tableList = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
        ? data.results
        : [];

      setTables(tableList);
    } catch (error) {
      console.error("Failed to fetch tables:", error);
      setTables([]);
      pushToast("error", "Failed to load tables.");
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  // ✅ ADD TABLE
  const addTable = async () => {
    if (!number) return;

    if (tables.find(t => t.number === Number(number))) {
      pushToast("warning", "Table already exists.");
      return;
    }

    const res = await authFetch(API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number: Number(number),
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      pushToast("error", data.error || "Could not create table.");
      return;
    }

    setNumber("");
    pushToast("success", `Table ${Number(number)} created.`);
    fetchTables();
  };

  // ✅ DELETE TABLE
  const deleteTable = async (table) => {
    setBusyDeleteId(String(table.id));
    try {
      const res = await authFetch(`${API}${table.id}/`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast("error", data.error || "Could not delete table.");
        return;
      }
      pushToast("success", `Table ${table.number} removed.`);
      setConfirmState(null);
      fetchTables();
    } catch (error) {
      console.error("Failed to delete table:", error);
      pushToast("error", "Network error while deleting table.");
    } finally {
      setBusyDeleteId("");
    }
  };

  return (
    <div className="mm-tables">
      <header className="mm-tables__hero">
        <p className="mm-tables__eyebrow">Floor</p>
        <h1 className="mm-tables__title">Table management</h1>
        <p className="mm-tables__lead">
          Create numbered tables and share QR codes so guests open your menu instantly.
        </p>
      </header>

      <div className="mm-tables__toolbar">
        <input
          className="mm-tables__input"
          type="number"
          min={1}
          placeholder="Table number…"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
        <button type="button" className="mm-tables__add" onClick={addTable}>
          Add table
        </button>
      </div>

      <div className="mm-tables__grid">
        {tables.length === 0 ? (
          <p className="mm-tables__empty">No tables yet. Add a number above to get started.</p>
        ) : (
          tables.map((table) => (
            <div key={table.id} className="mm-tables__card">
              <div className="mm-tables__card-label">
                <span className="mm-tables__card-icon" aria-hidden>
                  ◈
                </span>
                Table {table.number}
              </div>
              <div className="mm-tables__actions">
                <button
                  type="button"
                  className="mm-tables__btn mm-tables__btn--qr"
                  onClick={() => setSelectedTable(table)}
                >
                  View QR
                </button>
                <button
                  type="button"
                  className="mm-tables__btn mm-tables__btn--delete"
                  onClick={() =>
                    setConfirmState({
                      title: `Delete table ${table.number}?`,
                      description: "The table and its QR code will be removed from the restaurant setup.",
                      confirmLabel: "Delete table",
                      tone: "danger",
                      meta: [`Table ${table.number}`],
                      table,
                    })
                  }
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedTable && (
        <div
          className="mm-tables__modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mm-tables-qr-title"
          onClick={() => setSelectedTable(null)}
          onKeyDown={(e) => e.key === "Escape" && setSelectedTable(null)}
        >
          <div
            className="mm-tables__modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="mm-tables-qr-title">Table {selectedTable.number}</h2>
            <p className="mm-tables__modal-note">Scan to open the menu</p>
            <div>
              {selectedTable.qr_image ? (
                <img
                  src={getQrImageUrl(selectedTable.qr_image)}
                  alt={`QR code for table ${selectedTable.number}`}
                  className="mm-tables__qr"
                />
              ) : (
                <p className="mm-tables__modal-note">
                  QR image is not available for this table.
                </p>
              )}
            </div>
            <p className="mm-tables__modal-note">
              Guests scan this code to browse and order.
            </p>
            <button
              type="button"
              onClick={() => setSelectedTable(null)}
              className="mm-tables__close"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        tone={confirmState?.tone}
        meta={confirmState?.meta || []}
        busy={Boolean(busyDeleteId)}
        onCancel={() => {
          if (busyDeleteId) return;
          setConfirmState(null);
        }}
        onConfirm={() => {
          if (!confirmState?.table) return;
          deleteTable(confirmState.table);
        }}
      />

      <ToastStack toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
