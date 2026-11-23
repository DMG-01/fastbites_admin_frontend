import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import { fetchWithAuth } from "../utils/api";
import "../styles/waiter-requests.css";

interface WaiterRequest {
  _id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone_number: string;
  telegram_id: number;
  submittedAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

type RequestDecision = "approve" | "reject";
type RequestFilter = "ALL" | "PENDING" | "REVIEWED";

async function getErrorMessage(response: Response, fallback: string) {
  const body: unknown = await response.json().catch(() => null);
  if (
    body &&
    typeof body === "object" &&
    "detail" in body &&
    typeof body.detail === "string"
  ) {
    return body.detail;
  }
  return fallback;
}

export const WaiterRequestsPanel: React.FC = () => {
  const [requests, setRequests] = useState<WaiterRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<RequestFilter>("ALL");

  const fetchRequests = useCallback(async (): Promise<WaiterRequest[]> => {
    const response = await fetchWithAuth("/waiter/requests");
    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, "Failed to load waiter applications."),
      );
    }
    return response.json();
  }, []);

  useEffect(() => {
    void fetchRequests()
      .then(setRequests)
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load waiter applications.",
        );
      })
      .finally(() => setLoading(false));
  }, [fetchRequests]);

  const refreshRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      setRequests(await fetchRequests());
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load waiter applications.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (
    request: WaiterRequest,
    decision: RequestDecision,
  ) => {
    setUpdatingId(request._id);
    setError(null);
    try {
      const response = await fetchWithAuth(
        `/waiter/requests/${encodeURIComponent(request._id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ decision }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
            `Failed to ${decision} waiter application.`,
          ),
        );
      }
      const updatedRequest: WaiterRequest = await response.json();
      setRequests((current) =>
        current.map((entry) =>
          entry._id === updatedRequest._id ? updatedRequest : entry,
        ),
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${decision} waiter application.`,
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const pendingCount = requests.filter(
    (request) => request.status === "PENDING",
  ).length;
  const approvedCount = requests.filter(
    (request) => request.status === "APPROVED",
  ).length;
  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesStatus =
        selectedFilter === "ALL" ||
        (selectedFilter === "PENDING" && request.status === "PENDING") ||
        (selectedFilter === "REVIEWED" && request.status !== "PENDING");
      const name =
        `${request.first_name} ${request.last_name || ""}`.toLowerCase();
      const matchesSearch =
        !query ||
        name.includes(query) ||
        request.email.toLowerCase().includes(query) ||
        request.telegram_id.toString().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [requests, searchQuery, selectedFilter]);

  return (
    <section className="applications-page">
      <div className="page-heading applications-heading">
        <div className="page-heading-copy">
          <p className="page-eyebrow">People & applications</p>
          <h1>Waiter applications</h1>
          <p>Review and manage requests to join your delivery team.</p>
        </div>
        <button
          className="button-secondary"
          onClick={() => void refreshRequests()}
          disabled={loading}
        >
          <Icon name="refresh" size={16} />
          Refresh applications
        </button>
      </div>

      <section className="metric-grid application-metrics" aria-label="Application summary">
        <article className="metric-card">
          <span className="metric-icon orange">
            <Icon name="users" size={20} />
          </span>
          <span className="metric-copy">
            <span>Total applications</span>
            <strong>{requests.length}</strong>
          </span>
        </article>
        <article className="metric-card">
          <span className="metric-icon amber">
            <Icon name="clock" size={20} />
          </span>
          <span className="metric-copy">
            <span>Needs review</span>
            <strong>{pendingCount}</strong>
          </span>
        </article>
        <article className="metric-card">
          <span className="metric-icon green">
            <Icon name="check" size={20} />
          </span>
          <span className="metric-copy">
            <span>Approved</span>
            <strong>{approvedCount}</strong>
          </span>
        </article>
      </section>

      <section className="panel applications-panel">
        <div className="panel-toolbar">
          <div className="panel-title">
            <h2>Application inbox</h2>
            <p>Review candidate details before adding them to the team.</p>
          </div>
          <span className="panel-count">{filteredRequests.length} shown</span>
        </div>

        <div className="filter-toolbar">
          <label className="search-control">
            <Icon name="search" size={17} />
            <input
              type="search"
              aria-label="Search waiter applications"
              placeholder="Search name, email, or Telegram ID"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <div className="application-filter-group" aria-label="Filter applications">
            {(["ALL", "PENDING", "REVIEWED"] as const).map((filter) => (
              <button
                key={filter}
                className={`application-filter ${selectedFilter === filter ? "active" : ""}`}
                onClick={() => setSelectedFilter(filter)}
                aria-pressed={selectedFilter === filter}
              >
                {filter === "ALL"
                  ? "All"
                  : filter === "PENDING"
                    ? "Needs review"
                    : "Reviewed"}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <span className="loading-spinner" />
            <span>Loading applications…</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="empty-state">
            <span className="metric-icon orange">
              <Icon name="users" size={20} />
            </span>
            <strong>
              {requests.length === 0
                ? "No applications yet"
                : "No matching applications"}
            </strong>
            <span>
              {requests.length === 0
                ? "New waiter requests will appear here."
                : "Try another search or status filter."}
            </span>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table requests-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Contact</th>
                  <th>Telegram ID</th>
                  <th>Applied</th>
                  <th>Status</th>
                  <th aria-label="Review actions" />
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request._id}>
                    <td>
                      <span className="waiter-person">
                        <span className="waiter-avatar applicant-avatar">
                          {request.first_name.charAt(0)}
                          {request.last_name?.charAt(0) || ""}
                        </span>
                        <span>
                          <strong className="cell-primary">
                            {request.first_name} {request.last_name || ""}
                          </strong>
                          <small className="cell-secondary">
                            Application #{request._id.slice(-6)}
                          </small>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="waiter-contact">{request.email}</span>
                      <small className="cell-secondary">
                        {request.phone_number || "No phone number"}
                      </small>
                    </td>
                    <td className="telegram-id">{request.telegram_id}</td>
                    <td>
                      <span className="applied-date">
                        {new Date(request.submittedAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`request-status ${request.status.toLowerCase()}`}
                      >
                        <span />
                        {request.status === "PENDING"
                          ? "Needs review"
                          : request.status}
                      </span>
                    </td>
                    <td>
                      {request.status === "PENDING" ? (
                        <div className="review-actions">
                          <button
                            className="review-button approve"
                            disabled={updatingId === request._id}
                            onClick={() =>
                              void handleDecision(request, "approve")
                            }
                          >
                            <Icon name="check" size={14} />
                            Approve
                          </button>
                          <button
                            className="review-button reject"
                            disabled={updatingId === request._id}
                            onClick={() =>
                              void handleDecision(request, "reject")
                            }
                          >
                            <Icon name="close" size={14} />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="reviewed-note">Review complete</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
};
