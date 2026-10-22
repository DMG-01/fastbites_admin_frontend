import React, { useState, useEffect, useCallback } from "react";
import { fetchWithAuth } from "../utils/api";
import { useNavigate } from "react-router-dom";
import "../styles/order.css";

// Principal roles matched with FastAPI endpoint rules
export type PrincipalRole = "ADMIN" | "WAITER" | "USER";

export interface Principal {
  id: string | number;
  type: PrincipalRole;
  name?: string;
}

// Matches orderFilter Pydantic Schema
export interface OrderFilter {
  _id?: string;
  user_id?: string;
  waiter_id?: number;
  recipient?: string;
  status?: string[];
  paymentStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  waiter_settlement_status?: string;
  include_unassigned?: boolean;
}

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

const endpoint = import.meta.env.VITE_API_URL || "http://localhost:8000";
const API_BASE_URL = `${endpoint}/order`;

export const OrdersPage: React.FC = () => {
    const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active Principal Role State (Simulating logged in user)
  const [currentPrincipal, setCurrentPrincipal] = useState<Principal>({
    id: "admin_01",
    type: "ADMIN",
    name: "Admin User",
  });

  // Filter Bar Form State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>("");
  const [selectedSettlementStatus, setSelectedSettlementStatus] = useState<string>("");
  const [includeUnassigned, setIncludeUnassigned] = useState<boolean>(false);

  // Active Navigation Tab & Mobile Sidebar State
  const [activeTab, setActiveTab] = useState<string>("orders");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Selected Order Detail View Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Build Filter Query Parameters aligned with Backend Dependency
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filterParams = new URLSearchParams();

      // Apply Frontend Filter Form values
      if (searchQuery.trim()) {
        filterParams.append("recipient", searchQuery.trim());
      }
      if (selectedStatus) {
        filterParams.append("status", selectedStatus);
      }
      if (selectedPaymentStatus) {
        filterParams.append("paymentStatus", selectedPaymentStatus);
      }
      if (selectedSettlementStatus) {
        filterParams.append("waiter_settlement_status", selectedSettlementStatus);
      }

      // Role-specific filter adjustments (mirroring backend logic for UI context)
      if (currentPrincipal.type === "USER") {
        filterParams.append("user_id", String(currentPrincipal.id));
      } else if (currentPrincipal.type === "WAITER") {
        filterParams.append("waiter_id", String(currentPrincipal.id));
        filterParams.append("include_unassigned", "true");
      } else if (currentPrincipal.type === "ADMIN") {
        if (includeUnassigned) {
          filterParams.append("include_unassigned", "true");
        }
      }

      const response = await fetchWithAuth(`/order?${filterParams.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to load orders.");
      }

      const data: Order[] = await response.json();
      setOrders(data);
    } catch (err: any) {
      setError(err.message || "An error occurred while fetching orders.");
    } finally {
      setLoading(false);
    }
  }, [
    currentPrincipal,
    searchQuery,
    selectedStatus,
    selectedPaymentStatus,
    selectedSettlementStatus,
    includeUnassigned,
  ]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Handle Role Switching for Testing/Simulation
  const handleRoleChange = (role: PrincipalRole) => {
    if (role === "ADMIN") {
      setCurrentPrincipal({ id: "admin_01", type: "ADMIN", name: "System Admin" });
    } else if (role === "WAITER") {
      setCurrentPrincipal({ id: 102, type: "WAITER", name: "John (Waiter #102)" });
    } else {
      setCurrentPrincipal({ id: "usr_55", type: "USER", name: "Alice (Customer)" });
    }
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedStatus("");
    setSelectedPaymentStatus("");
    setSelectedSettlementStatus("");
    setIncludeUnassigned(false);
  };

  return (
    <div className="app-layout">
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <button className="hamburger-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          ☰
        </button>
        <div className="brand-logo">FastBites Admin</div>
      </header>

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Side Navigation */}
      <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-icon">⚡</span>
          <h2>FastBites</h2>
        </div>

        <nav className="sidebar-menu">
          <button
            className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("dashboard");
              setIsSidebarOpen(false);
            }}
          >
            📊 <span>Dashboard</span>
          </button>
          <button
            className={`nav-item ${activeTab === "waiters" ? "active" : ""}`}
            onClick={() => {
              navigate("/waiters")
              setActiveTab("waiters");
              setIsSidebarOpen(false);
            }}
          >
            🤵 <span>Waiters</span>
          </button>
          <button
            className={`nav-item ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => {
             
              setActiveTab("orders");
              setIsSidebarOpen(false);
            }}
          >
            📦 <span>Orders</span>
          </button>
          <button
            className={`nav-item ${activeTab === "inventory" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("inventory");
              setIsSidebarOpen(false);
            }}
          >
            🍔 <span>Inventory</span>
          </button>
          <button
            className={`nav-item ${activeTab === "users" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("users");
              setIsSidebarOpen(false);
            }}
          >
            👥 <span>Users</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="role-switcher">
            <span className="switcher-label">View Mode (Principal):</span>
            <div className="role-buttons">
              <button
                className={`role-btn ${currentPrincipal.type === "ADMIN" ? "active" : ""}`}
                onClick={() => handleRoleChange("ADMIN")}
              >
                ADMIN
              </button>
              <button
                className={`role-btn ${currentPrincipal.type === "WAITER" ? "active" : ""}`}
                onClick={() => handleRoleChange("WAITER")}
              >
                WAITER
              </button>
              <button
                className={`role-btn ${currentPrincipal.type === "USER" ? "active" : ""}`}
                onClick={() => handleRoleChange("USER")}
              >
                USER
              </button>
            </div>
          </div>

          <div className="user-profile">
            <div className="avatar">{currentPrincipal.type[0]}</div>
            <div className="user-info">
              <p className="user-name">{currentPrincipal.name}</p>
              <p className="user-role">Role: {currentPrincipal.type}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === "orders" ? (
          <div className="order-container">
            <div className="content-header">
              <div>
                <h1>Orders Management</h1>
                <p className="subtitle">
                  Filter, monitor, and manage active restaurant order requests.
                </p>
              </div>

              <div className="principal-badge-info">
                <span>Active Scope:</span>
                <strong className={`badge-role ${currentPrincipal.type.toLowerCase()}`}>
                  {currentPrincipal.type}
                </strong>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="filter-card">
              <div className="filter-grid">
                <div className="filter-group">
                  <label>Search Recipient / ID</label>
                  <input
                    type="text"
                    className="filter-input"
                    placeholder="Recipient or Order ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="filter-group">
                  <label>Order Status</label>
                  <select
                    className="filter-select"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    <option value="PENDING">PENDING</option>
                    <option value="PREPARING">PREPARING</option>
                    <option value="READY">READY</option>
                    <option value="DELIVERED">DELIVERED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Payment Status</label>
                  <select
                    className="filter-select"
                    value={selectedPaymentStatus}
                    onChange={(e) => setSelectedPaymentStatus(e.target.value)}
                  >
                    <option value="">All Payment States</option>
                    <option value="PAID">PAID</option>
                    <option value="PENDING">PENDING</option>
                    <option value="FAILED">FAILED</option>
                    <option value="REFUNDED">REFUNDED</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Waiter Settlement</label>
                  <select
                    className="filter-select"
                    value={selectedSettlementStatus}
                    onChange={(e) => setSelectedSettlementStatus(e.target.value)}
                  >
                    <option value="">All Settlement</option>
                    <option value="SETTLED">SETTLED</option>
                    <option value="UNSETTLED">UNSETTLED</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>
              </div>

              <div className="filter-actions">
                {currentPrincipal.type === "ADMIN" && (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={includeUnassigned}
                      onChange={(e) => setIncludeUnassigned(e.target.checked)}
                    />
                    Include Unassigned Orders
                  </label>
                )}

                <button className="clear-filter-btn" onClick={handleClearFilters}>
                  Reset Filters
                </button>
              </div>
            </div>

            {error && <div className="error-banner">{error}</div>}

            {loading ? (
              <div className="loading-state">Loading orders...</div>
            ) : (
              <div className="table-wrapper">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Recipient</th>
                      <th>User ID</th>
                      <th>Waiter ID</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th>Settlement</th>
                      <th>Total</th>
                      <th>Created At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="no-data">
                          No orders found matching the filter criteria.
                        </td>
                      </tr>
                    ) : (
                      orders.map((order) => (
                        <tr key={order._id}>
                          <td className="id-cell">#{order._id.slice(-8)}</td>
                          <td className="font-semibold">{order.recipient || "N/A"}</td>
                          <td className="id-cell">{order.user_id || "Guest"}</td>
                          <td>
                            {order.waiter_id ? (
                              <span className="waiter-badge">#{order.waiter_id}</span>
                            ) : (
                              <span className="unassigned-badge">Unassigned</span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`status-badge ${
                                order.status?.toLowerCase() || "pending"
                              }`}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`pay-badge ${
                                order.paymentStatus?.toLowerCase() || "pending"
                              }`}
                            >
                              {order.paymentStatus}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`settle-badge ${
                                order.waiter_settlement_status?.toLowerCase() || "unsettled"
                              }`}
                            >
                              {order.waiter_settlement_status}
                            </span>
                          </td>
                          <td className="font-semibold">${order.totalAmount?.toFixed(2)}</td>
                          <td>
                            {new Date(order.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="action-buttons">
                            <button
                              className="view-btn"
                              onClick={() => setSelectedOrder(order)}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="placeholder-view">
            <h2>{activeTab.toUpperCase()} Section</h2>
            <p>This module is coming soon!</p>
          </div>
        )}
      </main>

      {/* Order Details Modal Overlay */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content order-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Order Details (#{selectedOrder._id})</h3>
              <button className="close-btn" onClick={() => setSelectedOrder(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">Recipient:</span>
                <span className="detail-value">{selectedOrder.recipient}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">User ID:</span>
                <span className="detail-value">{selectedOrder.user_id}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Waiter ID:</span>
                <span className="detail-value">
                  {selectedOrder.waiter_id || "None (Unassigned)"}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Status:</span>
                <span className={`status-badge ${selectedOrder.status.toLowerCase()}`}>
                  {selectedOrder.status}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Payment Status:</span>
                <span className={`pay-badge ${selectedOrder.paymentStatus.toLowerCase()}`}>
                  {selectedOrder.paymentStatus}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Settlement Status:</span>
                <span
                  className={`settle-badge ${selectedOrder.waiter_settlement_status.toLowerCase()}`}
                >
                  {selectedOrder.waiter_settlement_status}
                </span>
              </div>

              <h4 className="items-title">Ordered Items</h4>
              <div className="items-list">
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((item, idx) => (
                    <div className="item-row" key={idx}>
                      <span>
                        {item.quantity}x {item.name}
                      </span>
                      <span>${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <p className="no-items">No item breakdown available.</p>
                )}
              </div>

              <div className="total-row">
                <span>Total Amount:</span>
                <span>${selectedOrder.totalAmount?.toFixed(2)}</span>
              </div>
            </div>

            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setSelectedOrder(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};