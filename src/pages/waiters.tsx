import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/waiter.css"
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
const endpoint = import.meta.env.VITE_API_URL 
const API_BASE_URL = `${endpoint}/waiter`;

export const WaitersPage: React.FC = () => {
  const navigate = useNavigate()
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active Navigation Tab State
  const [activeTab, setActiveTab] = useState<string>("waiters");
  // Mobile Sidebar Toggle State
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Edit Modal State
  const [editingWaiter, setEditingWaiter] = useState<Waiter | null>(null);
  const [editFormData, setEditFormData] = useState<WaiterUpdatePayload>({});

  // Search Filter State
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    fetchWaiters();
  }, []);

  const fetchWaiters = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/`);
      if (!response.ok) throw new Error("Failed to load waiters.");
      const data: Waiter[] = await response.json();
      setWaiters(data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (waiter: Waiter) => {
    const updatedStatus = !waiter.is_active;

    setWaiters((prev) =>
      prev.map((w) => (w._id === waiter._id ? { ...w, is_active: updatedStatus } : w))
    );

    try {
      const response = await fetch(`${API_BASE_URL}/${waiter._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: updatedStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }
    } catch (err) {
      setWaiters((prev) =>
        prev.map((w) => (w._id === waiter._id ? { ...w, is_active: waiter.is_active } : w))
      );
      alert("Could not update waiter status. Please try again.");
    }
  };

  const handleStartEdit = (waiter: Waiter) => {
    setEditingWaiter(waiter);
    setEditFormData({
      first_name: waiter.first_name,
      last_name: waiter.last_name || "",
      email: waiter.email,
      account_number: null,
      bank_name: "",
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWaiter) return;

    try {
      const response = await fetch(`${API_BASE_URL}/${editingWaiter._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });

      if (!response.ok) throw new Error("Failed to save changes.");

      const updatedWaiter: Waiter = await response.json();

      setWaiters((prev) =>
        prev.map((w) => (w._id === updatedWaiter._id ? updatedWaiter : w))
      );
      setEditingWaiter(null);
    } catch (err: any) {
      alert(err.message || "Failed to update waiter details.");
    }
  };

  const filteredWaiters = waiters.filter((w) => {
    const fullName = `${w.first_name} ${w.last_name || ""}`.toLowerCase();
    return (
      fullName.includes(searchQuery.toLowerCase()) ||
      w.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.telegram_id.toString().includes(searchQuery)
    );
  });

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
              setActiveTab("waiters");
              setIsSidebarOpen(false);
            }}
          >
            🤵 <span>Waiters</span>
          </button>
          <button
            className={`nav-item ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => {
              navigate("/orders")
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
          <div className="user-profile">
            <div className="avatar">A</div>
            <div className="user-info">
              <p className="user-name">Admin Portal</p>
              <p className="user-role">System Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === "waiters" ? (
          <div className="waiter-container">
            <div className="content-header">
              <div>
                <h1>Waiters Management</h1>
                <p className="subtitle">View, edit, and toggle active status for staff members.</p>
              </div>
              <input
                type="text"
                className="search-input"
                placeholder="Search by name, email, or Telegram ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {error && <div className="error-banner">{error}</div>}

            {loading ? (
              <div className="loading-state">Loading waiters list...</div>
            ) : (
              <div className="table-wrapper">
                <table className="waiters-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone Number</th>
                      <th>Telegram ID</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWaiters.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="no-data">
                          No waiters found.
                        </td>
                      </tr>
                    ) : (
                      filteredWaiters.map((waiter) => (
                        <tr key={waiter._id}>
                          <td className="id-cell">{waiter._id.slice(0, 8)}...</td>
                          <td className="font-semibold">
                            {waiter.first_name} {waiter.last_name || ""}
                          </td>
                          <td>{waiter.email}</td>
                          <td>{waiter.phone_number || "N/A"}</td>
                          <td>{waiter.telegram_id}</td>
                          <td>
                            <span
                              className={`status-badge ${
                                waiter.is_active ? "active" : "inactive"
                              }`}
                            >
                              {waiter.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="action-buttons">
                            <button
                              className={`toggle-btn ${
                                waiter.is_active ? "deactivate" : "activate"
                              }`}
                              onClick={() => handleToggleActive(waiter)}
                            >
                              {waiter.is_active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              className="edit-btn"
                              onClick={() => handleStartEdit(waiter)}
                            >
                              Edit
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

      {/* Edit Modal */}
      {editingWaiter && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Edit Waiter Details</h3>
            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  value={editFormData.first_name || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, first_name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  value={editFormData.last_name || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, last_name: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={editFormData.email || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, email: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Account Number (Optional)</label>
                <input
                  type="number"
                  value={editFormData.account_number || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      account_number: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Bank Name (Optional)</label>
                <input
                  type="text"
                  value={editFormData.bank_name || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, bank_name: e.target.value })
                  }
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setEditingWaiter(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="save-btn">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};