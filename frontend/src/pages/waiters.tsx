import React, { useCallback, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AdminLayout } from "../components/AdminLayout";
import { Icon } from "../components/Icon";
import { WaiterRequestsPanel } from "./WaiterRequestsPanel";
import { fetchWithAuth } from "../utils/api";
import "../styles/waiter.css";

export interface Waiter {
  _id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone_number: string;
  telegram_id: number;
  is_active: boolean;
}

export interface WaiterUpdatePayload {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  account_number?: number | null;
  bank_name?: string | null;
  is_active?: boolean;
}

const API_BASE_URL = "/waiter";

export const WaitersPage: React.FC<{ onLogout: () => void }> = ({
  onLogout,
}) => {
  const location = useLocation();
  const isApplicationsTab =
    location.pathname.replace(/\/+$/, "") === "/waiters/requests";
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<Waiter | null>(null);
  const [editFormData, setEditFormData] = useState<WaiterUpdatePayload>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingWaiterId, setUpdatingWaiterId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchWaiters = useCallback(async (): Promise<Waiter[]> => {
    const response = await fetchWithAuth(`${API_BASE_URL}/`);
    if (!response.ok) throw new Error("Failed to load waiters.");
    return response.json();
  }, []);

  useEffect(() => {
    void fetchWaiters()
      .then(setWaiters)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load waiters.");
      })
      .finally(() => setLoading(false));
  }, [fetchWaiters]);

  const handleToggleActive = async (waiter: Waiter) => {
    const updatedStatus = !waiter.is_active;
    setUpdatingWaiterId(waiter._id);
    setError(null);
    setWaiters((current) =>
      current.map((entry) =>
        entry._id === waiter._id
          ? { ...entry, is_active: updatedStatus }
          : entry,
      ),
    );

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/${waiter._id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: updatedStatus }),
      });
      if (!response.ok) throw new Error("Failed to update waiter status.");
      const updatedWaiter: Waiter = await response.json();
      setWaiters((current) =>
        current.map((entry) =>
          entry._id === updatedWaiter._id ? updatedWaiter : entry,
        ),
      );
    } catch (err: unknown) {
      setWaiters((current) =>
        current.map((entry) =>
          entry._id === waiter._id
            ? { ...entry, is_active: waiter.is_active }
            : entry,
        ),
      );
      setError(
        err instanceof Error
          ? err.message
          : "Could not update waiter status. Please try again.",
      );
    } finally {
      setUpdatingWaiterId(null);
    }
  };

  const handleStartEdit = (waiter: Waiter) => {
    setIsEditing(waiter);
    setEditError(null);
    setEditFormData({
      first_name: waiter.first_name,
      last_name: waiter.last_name || "",
      email: waiter.email,
      account_number: null,
      bank_name: "",
    });
  };

  const handleSaveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isEditing) return;

    setSaving(true);
    setEditError(null);
    try {
      const response = await fetchWithAuth(
        `${API_BASE_URL}/${isEditing._id}`,
        {
          method: "PUT",
          body: JSON.stringify(editFormData),
        },
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to save waiter details.");
      }

      const updatedWaiter: Waiter = await response.json();
      setWaiters((current) =>
        current.map((entry) =>
          entry._id === updatedWaiter._id ? updatedWaiter : entry,
        ),
      );
      setIsEditing(null);
    } catch (err: unknown) {
      setEditError(
        err instanceof Error ? err.message : "Failed to save waiter details.",
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredWaiters = waiters.filter((waiter) => {
    const fullName =
      `${waiter.first_name} ${waiter.last_name || ""}`.toLowerCase();
    const query = searchQuery.trim().toLowerCase();
    return (
      fullName.includes(query) ||
      waiter.email.toLowerCase().includes(query) ||
      waiter.telegram_id.toString().includes(query)
    );
  });
  const activeCount = waiters.filter((waiter) => waiter.is_active).length;
  const inactiveCount = waiters.length - activeCount;

  return (
    <AdminLayout activeSection="waiters" onLogout={onLogout}>
      <div className="page-heading">
        <div className="page-heading-copy">
          <p className="page-eyebrow">People & applications</p>
          <h1>Waiters</h1>
          <p>Manage your delivery team and review new applications.</p>
        </div>
        {!isApplicationsTab && (
          <button
            className="button-secondary"
            onClick={() => {
              setLoading(true);
              setError(null);
              void fetchWaiters()
                .then(setWaiters)
                .catch((err: unknown) => {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Failed to load waiters.",
                  );
                })
                .finally(() => setLoading(false));
            }}
            disabled={loading}
          >
            <Icon name="refresh" size={16} />
            Refresh team
          </button>
        )}
      </div>

      <nav className="section-tabs" aria-label="Waiter sections">
        <NavLink to="/waiters" end>
          Waiters
          <span>{waiters.length}</span>
        </NavLink>
        <NavLink to="/waiters/requests">Applications</NavLink>
      </nav>

      {isApplicationsTab ? (
        <WaiterRequestsPanel />
      ) : (
        <>
          <section className="metric-grid waiter-metrics" aria-label="Waiter summary">
            <article className="metric-card">
              <span className="metric-icon orange">
                <Icon name="users" size={20} />
              </span>
              <span className="metric-copy">
                <span>Total waiters</span>
                <strong>{waiters.length}</strong>
              </span>
            </article>
            <article className="metric-card">
              <span className="metric-icon green">
                <Icon name="check" size={20} />
              </span>
              <span className="metric-copy">
                <span>Active</span>
                <strong>{activeCount}</strong>
              </span>
            </article>
            <article className="metric-card">
              <span className="metric-icon amber">
                <Icon name="clock" size={20} />
              </span>
              <span className="metric-copy">
                <span>Inactive</span>
                <strong>{inactiveCount}</strong>
              </span>
            </article>
          </section>

          <section className="panel waiters-panel">
            <div className="panel-toolbar">
              <div className="panel-title">
                <h2>Team directory</h2>
                <p>Update staff details and account availability.</p>
              </div>
              <span className="panel-count">{filteredWaiters.length} shown</span>
            </div>
            <div className="filter-toolbar">
              <label className="search-control">
                <Icon name="search" size={17} />
                <input
                  type="search"
                  aria-label="Search waiters"
                  placeholder="Search name, email, or Telegram ID"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </label>
            </div>

            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}

            {loading ? (
              <div className="loading-state">
                <span className="loading-spinner" />
                <span>Loading your team…</span>
              </div>
            ) : filteredWaiters.length === 0 ? (
              <div className="empty-state">
                <span className="metric-icon orange">
                  <Icon name="users" size={20} />
                </span>
                <strong>No waiters found</strong>
                <span>Try a different search, or review the Applications tab.</span>
              </div>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table waiters-table">
                  <thead>
                    <tr>
                      <th>Waiter</th>
                      <th>Contact</th>
                      <th>Telegram ID</th>
                      <th>Availability</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWaiters.map((waiter) => (
                      <tr key={waiter._id}>
                        <td>
                          <span className="waiter-person">
                            <span className="waiter-avatar">
                              {waiter.first_name.charAt(0)}
                              {waiter.last_name?.charAt(0) || ""}
                            </span>
                            <span>
                              <strong className="cell-primary">
                                {waiter.first_name} {waiter.last_name || ""}
                              </strong>
                              <small className="cell-secondary">
                                ID {waiter._id.slice(0, 10)}
                              </small>
                            </span>
                          </span>
                        </td>
                        <td>
                          <span className="waiter-contact">{waiter.email}</span>
                          <small className="cell-secondary">
                            {waiter.phone_number || "No phone number"}
                          </small>
                        </td>
                        <td className="telegram-id">{waiter.telegram_id}</td>
                        <td>
                          <span
                            className={`staff-status ${waiter.is_active ? "active" : "inactive"}`}
                          >
                            <span />
                            {waiter.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div className="waiter-actions">
                            <button
                              className="table-action"
                              onClick={() => handleStartEdit(waiter)}
                            >
                              Edit
                            </button>
                            <button
                              className={`availability-action ${waiter.is_active ? "deactivate" : "activate"}`}
                              onClick={() => void handleToggleActive(waiter)}
                              disabled={updatingWaiterId === waiter._id}
                            >
                              {updatingWaiterId === waiter._id
                                ? "Saving…"
                                : waiter.is_active
                                  ? "Deactivate"
                                  : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {isEditing && (
        <div
          className="staff-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsEditing(null);
          }}
        >
          <section
            className="staff-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-waiter-title"
          >
            <header className="staff-modal-header">
              <div>
                <p className="page-eyebrow">Team directory</p>
                <h2 id="edit-waiter-title">Edit waiter</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close edit form"
                onClick={() => setIsEditing(null)}
              >
                <Icon name="close" size={18} />
              </button>
            </header>
            <form onSubmit={handleSaveEdit}>
              <div className="staff-modal-fields">
                <label className="staff-form-group">
                  First name
                  <input
                    className="form-control"
                    value={editFormData.first_name || ""}
                    onChange={(event) =>
                      setEditFormData({
                        ...editFormData,
                        first_name: event.target.value,
                      })
                    }
                    required
                  />
                </label>
                <label className="staff-form-group">
                  Last name
                  <input
                    className="form-control"
                    value={editFormData.last_name || ""}
                    onChange={(event) =>
                      setEditFormData({
                        ...editFormData,
                        last_name: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="staff-form-group staff-form-wide">
                  Email address
                  <input
                    className="form-control"
                    type="email"
                    value={editFormData.email || ""}
                    onChange={(event) =>
                      setEditFormData({
                        ...editFormData,
                        email: event.target.value,
                      })
                    }
                    required
                  />
                </label>
                <label className="staff-form-group">
                  Account number
                  <input
                    className="form-control"
                    inputMode="numeric"
                    value={editFormData.account_number ?? ""}
                    onChange={(event) =>
                      setEditFormData({
                        ...editFormData,
                        account_number: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                  />
                </label>
                <label className="staff-form-group">
                  Bank name
                  <input
                    className="form-control"
                    value={editFormData.bank_name || ""}
                    onChange={(event) =>
                      setEditFormData({
                        ...editFormData,
                        bank_name: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              {editError && (
                <div className="error-banner" role="alert">
                  {editError}
                </div>
              )}
              <footer className="staff-modal-footer">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setIsEditing(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button className="button-primary" type="submit" disabled={saving}>
                  {saving ? "Saving changes…" : "Save changes"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </AdminLayout>
  );
};
