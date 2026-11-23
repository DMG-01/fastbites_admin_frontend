import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../components/AdminLayout";
import { Icon } from "../components/Icon";
import { fetchWithAuth } from "../utils/api";
import "../styles/order.css";

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  _id: string;
  user_id: string;
  waiter_id: number | null;
  recipient: string;
  status: string;
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  waiter_settlement_status: "UNSETTLED" | "SETTLED" | "PENDING";
  items: OrderItem[];
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

interface OrderEventChange {
  field: string;
  from: unknown;
  to: unknown;
}

interface OrderEvent {
  _id: string;
  order_id: string;
  type: string;
  message: string;
  actor_name: string;
  actor_role: string;
  createdAt: string;
  changes?: OrderEventChange[];
}

function formatEventValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "None";
  return typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "NGN",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateGroup(dateValue: string) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const OrdersPage: React.FC<{ onLogout: () => void }> = ({
  onLogout,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("");
  const [selectedSettlementStatus, setSelectedSettlementStatus] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderEvents, setOrderEvents] = useState<OrderEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  const fetchOrders = useCallback(async (requestedPage = 1, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const filterParams = new URLSearchParams();
      filterParams.append("page", String(requestedPage));
      filterParams.append("limit", "10");
      if (searchQuery.trim()) {
        filterParams.append("recipient", searchQuery.trim());
      }
      if (selectedStatus) filterParams.append("status", selectedStatus);
      if (selectedPaymentStatus) {
        filterParams.append("paymentStatus", selectedPaymentStatus);
      }
      if (selectedSettlementStatus) {
        filterParams.append(
          "waiter_settlement_status",
          selectedSettlementStatus,
        );
      }

      const response = await fetchWithAuth(`/order?${filterParams.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to load orders.");
      }
      const result: unknown = await response.json();
      if (Array.isArray(result)) {
        setOrders(result);
        setPage(1);
        setTotalPages(1);
        setTotalOrders(result.length);
      } else if (
        result &&
        typeof result === "object" &&
        "orders" in result &&
        Array.isArray(result.orders)
      ) {
        const paginated = result as {
          orders: Order[];
          pagination: { page: number; totalPages: number; total: number };
        };
        setOrders((current) =>
          append ? [...current, ...paginated.orders] : paginated.orders,
        );
        setPage(paginated.pagination.page);
        setTotalPages(paginated.pagination.totalPages);
        setTotalOrders(paginated.pagination.total);
      } else {
        throw new Error("The order service returned an invalid response.");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An error occurred while fetching orders.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    searchQuery,
    selectedStatus,
    selectedPaymentStatus,
    selectedSettlementStatus,
  ]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!selectedOrder) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedOrder(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedOrder]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedStatus("");
    setSelectedPaymentStatus("");
    setSelectedSettlementStatus("");
  };

  const handleViewOrder = async (order: Order) => {
    setSelectedOrder(order);
    setOrderEvents([]);
    setEventsLoading(true);
    setEventsError(null);
    try {
      const response = await fetchWithAuth(
        `/order/${encodeURIComponent(order._id)}/events`,
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to load order activity.");
      }
      const events: OrderEvent[] = await response.json();
      setOrderEvents(events);
    } catch (err: unknown) {
      setEventsError(
        err instanceof Error ? err.message : "Failed to load order activity.",
      );
    } finally {
      setEventsLoading(false);
    }
  };

  const pendingCount = orders.filter(
    (order) => order.status === "PENDING" && order.waiter_id === null,
  ).length;
  const preparingCount = orders.filter(
    (order) => order.status === "PREPARING" || order.status === "ACCEPTED",
  ).length;
  const paidValue = orders
    .filter((order) => order.paymentStatus === "PAID")
    .reduce((sum, order) => sum + order.totalAmount, 0);
  const orderGroups = useMemo(() => {
    const groups = new Map<string, Order[]>();
    orders.forEach((order) => {
      const created = new Date(order.createdAt);
      const dateKey = Number.isNaN(created.getTime())
        ? "Unknown date"
        : created.toISOString().slice(0, 10);
      const group = groups.get(dateKey) || [];
      group.push(order);
      groups.set(dateKey, group);
    });
    return Array.from(groups.entries()).map(([dateKey, groupedOrders]) => ({
      dateKey,
      label: formatDateGroup(groupedOrders[0]?.createdAt || dateKey),
      orders: groupedOrders,
    }));
  }, [orders]);

  return (
    <AdminLayout activeSection="orders" onLogout={onLogout}>
      <div className="page-heading">
        <div className="page-heading-copy">
          <p className="page-eyebrow">Daily operations</p>
          <h1>Orders</h1>
          <p>Track every order from the kitchen to the customer.</p>
        </div>
        <button
          className="button-secondary"
          onClick={() => void fetchOrders()}
          disabled={loading}
        >
          <Icon name="refresh" size={16} />
          Refresh orders
        </button>
      </div>

      <section className="metric-grid" aria-label="Order summary">
        <article className="metric-card">
          <span className="metric-icon orange">
            <Icon name="orders" size={20} />
          </span>
          <span className="metric-copy">
            <span>Orders shown</span>
            <strong>{orders.length}</strong>
          </span>
        </article>
        <article className="metric-card">
          <span className="metric-icon amber">
            <Icon name="clock" size={20} />
          </span>
          <span className="metric-copy">
            <span>Awaiting a waiter</span>
            <strong>{pendingCount}</strong>
          </span>
        </article>
        <article className="metric-card">
          <span className="metric-icon blue">
            <Icon name="activity" size={20} />
          </span>
          <span className="metric-copy">
            <span>In progress</span>
            <strong>{preparingCount}</strong>
          </span>
        </article>
        <article className="metric-card">
          <span className="metric-icon green">
            <Icon name="dollar" size={20} />
          </span>
          <span className="metric-copy">
            <span>Paid order value</span>
            <strong>{formatCurrency(paidValue)}</strong>
          </span>
        </article>
      </section>

      <section className="panel orders-panel">
        <div className="panel-toolbar">
          <div className="panel-title">
            <h2>All orders</h2>
            <p>Review status, payment, waiter assignment, and order history.</p>
          </div>
          <span className="panel-count">
            {totalOrders || orders.length} orders
          </span>
        </div>

        <div className="filter-toolbar">
          <label className="search-control">
            <Icon name="search" size={17} />
            <input
              type="search"
              aria-label="Search orders by recipient"
              placeholder="Search recipient or order ID"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <select
            className="filter-select"
            aria-label="Filter by order status"
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="PREPARING">Preparing</option>
            <option value="READY">Ready</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            className="filter-select"
            aria-label="Filter by payment status"
            value={selectedPaymentStatus}
            onChange={(event) => setSelectedPaymentStatus(event.target.value)}
          >
            <option value="">All payments</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>
          <select
            className="filter-select"
            aria-label="Filter by waiter settlement"
            value={selectedSettlementStatus}
            onChange={(event) => setSelectedSettlementStatus(event.target.value)}
          >
            <option value="">All settlements</option>
            <option value="SETTLED">Settled</option>
            <option value="UNSETTLED">Unsettled</option>
            <option value="PENDING">Pending</option>
          </select>
          {(searchQuery ||
            selectedStatus ||
            selectedPaymentStatus ||
            selectedSettlementStatus) && (
            <button className="filter-reset" onClick={handleClearFilters}>
              Reset
            </button>
          )}
        </div>

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <span className="loading-spinner" />
            <span>Loading orders…</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <span className="metric-icon orange">
              <Icon name="orders" size={20} />
            </span>
            <strong>No orders found</strong>
            <span>Try changing your search or filters.</span>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table orders-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Waiter</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Settlement</th>
                  <th>Total</th>
                  <th>Placed</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {orderGroups.map((group) => (
                  <React.Fragment key={group.dateKey}>
                    <tr className="date-group-row">
                      <td colSpan={9}>
                        <span className="date-group-label">{group.label}</span>
                        <span className="date-group-count">
                          {group.orders.length} {group.orders.length === 1 ? "order" : "orders"}
                        </span>
                      </td>
                    </tr>
                    {group.orders.map((order) => (
                  <tr key={order._id}>
                    <td>
                      <span className="order-id">#{order._id.slice(-8)}</span>
                      <span className="cell-secondary order-item-count">
                        {order.items?.length || 0} items
                      </span>
                    </td>
                    <td>
                      <span className="cell-primary">{order.recipient || "Guest"}</span>
                      <span className="cell-secondary">
                        {order.user_id || "Walk-in customer"}
                      </span>
                    </td>
                    <td>
                      {order.waiter_id ? (
                        <span className="waiter-assigned">
                          <span className="waiter-avatar">
                            {String(order.waiter_id).slice(-2)}
                          </span>
                          Waiter #{order.waiter_id}
                        </span>
                      ) : (
                        <span className="waiter-unassigned">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`status-pill ${order.status.toLowerCase()}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`payment-pill ${order.paymentStatus.toLowerCase()}`}
                      >
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`settlement-pill ${order.waiter_settlement_status.toLowerCase()}`}
                      >
                        {order.waiter_settlement_status}
                      </span>
                    </td>
                    <td className="cell-primary">
                      {formatCurrency(order.totalAmount || 0)}
                    </td>
                    <td>
                      <span className="placed-date">
                        {new Date(order.createdAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="cell-secondary">
                        {new Date(order.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </td>
                    <td>
                      <button
                        className="table-action"
                        onClick={() => void handleViewOrder(order)}
                        aria-label={`View details for order ${order._id}`}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {orders.length > 0 && page < totalPages && (
          <div className="orders-pagination">
            <span>
              Showing {orders.length} of {totalOrders} orders
            </span>
            <button
              className="button-secondary"
              onClick={() => void fetchOrders(page + 1, true)}
              disabled={loading}
            >
              <Icon name="refresh" size={15} />
              Load next 10
            </button>
          </div>
        )}
      </section>

      {selectedOrder && (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedOrder(null);
          }}
        >
          <section
            className="detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-detail-title"
          >
            <header className="modal-titlebar">
              <div>
                <span className="page-eyebrow">Order details</span>
                <h2 id="order-detail-title">
                  Order #{selectedOrder._id.slice(-8)}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close order details"
                onClick={() => setSelectedOrder(null)}
              >
                <Icon name="close" size={18} />
              </button>
            </header>

            <div className="modal-scroll-body">
              <div className="detail-grid">
                <div>
                  <span>Customer</span>
                  <strong>{selectedOrder.recipient || "Guest"}</strong>
                </div>
                <div>
                  <span>Waiter</span>
                  <strong>
                    {selectedOrder.waiter_id
                      ? `Waiter #${selectedOrder.waiter_id}`
                      : "Awaiting assignment"}
                  </strong>
                </div>
                <div>
                  <span>Order status</span>
                  <strong>{selectedOrder.status}</strong>
                </div>
                <div>
                  <span>Payment</span>
                  <strong>{selectedOrder.paymentStatus}</strong>
                </div>
              </div>

              <section className="modal-section">
                <div className="modal-section-heading">
                  <h3>Items</h3>
                  <span>{selectedOrder.items?.length || 0} items</span>
                </div>
                <div className="order-items-list">
                  {selectedOrder.items?.length ? (
                    selectedOrder.items.map((item, index) => (
                      <div className="order-item-line" key={item.id || index}>
                        <span className="item-quantity">{item.quantity}×</span>
                        <span className="item-name">{item.name}</span>
                        <span className="item-price">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="muted-copy">No item details available.</p>
                  )}
                  <div className="order-total-line">
                    <span>Total</span>
                    <strong>{formatCurrency(selectedOrder.totalAmount || 0)}</strong>
                  </div>
                </div>
              </section>

              <section className="modal-section">
                <div className="modal-section-heading">
                  <div>
                    <h3>Order activity</h3>
                    <p>Every recorded change, in order.</p>
                  </div>
                  <Icon name="activity" size={18} />
                </div>
                <div className="activity-feed" aria-live="polite">
                  {eventsLoading ? (
                    <div className="activity-feedback">
                      <span className="loading-spinner" />
                      Loading activity…
                    </div>
                  ) : eventsError ? (
                    <div className="error-banner" role="alert">
                      {eventsError}
                    </div>
                  ) : orderEvents.length === 0 ? (
                    <p className="muted-copy">
                      No activity has been recorded for this order yet.
                    </p>
                  ) : (
                    <ol className="activity-timeline">
                      {orderEvents.map((event) => (
                        <li key={event._id} className="activity-event">
                          <span className="activity-marker" />
                          <div className="activity-event-content">
                            <div className="activity-event-topline">
                              <strong>{event.message}</strong>
                              <time dateTime={event.createdAt}>
                                {new Date(event.createdAt).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </time>
                            </div>
                            <span className="activity-actor">
                              {event.actor_name} · {event.actor_role.toLowerCase()}
                            </span>
                            {event.changes?.map((change) => (
                              <span
                                className="activity-change"
                                key={`${event._id}-${change.field}`}
                              >
                                {change.field.replaceAll("_", " ")}:{" "}
                                {formatEventValue(change.from)} →{" "}
                                {formatEventValue(change.to)}
                              </span>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </section>
            </div>

            <footer className="modal-footer">
              <button
                className="button-secondary"
                onClick={() => setSelectedOrder(null)}
              >
                Close details
              </button>
            </footer>
          </section>
        </div>
      )}
    </AdminLayout>
  );
};
