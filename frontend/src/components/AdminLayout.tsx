import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { Icon } from "./Icon";

interface AdminLayoutProps {
  activeSection: "orders" | "waiters";
  children: React.ReactNode;
  onLogout: () => void;
}

const today = new Date().toLocaleDateString(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  activeSection,
  children,
  onLogout,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="admin-layout">
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`admin-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <NavLink
          to="/orders"
          className="brand-lockup"
          onClick={() => setSidebarOpen(false)}
        >
          <span className="brand-mark">
            <img src="/fastbites-logo.png" alt="" />
          </span>
          <span className="brand-copy">
            <strong>FastBites</strong>
            <small>OPERATIONS</small>
          </span>
        </NavLink>

        <div className="sidebar-section-label">Workspace</div>
        <nav className="primary-nav" aria-label="Main navigation">
          <NavLink
            to="/orders"
            className={({ isActive }) =>
              `primary-nav-link ${isActive ? "active" : ""}`
            }
            onClick={() => setSidebarOpen(false)}
          >
            <Icon name="orders" />
            <span>Orders</span>
            {activeSection === "orders" && <span className="nav-active-dot" />}
          </NavLink>
          <NavLink
            to="/waiters"
            className={({ isActive }) =>
              `primary-nav-link ${isActive ? "active" : ""}`
            }
            onClick={() => setSidebarOpen(false)}
          >
            <Icon name="users" />
            <span>Waiters</span>
            {activeSection === "waiters" && <span className="nav-active-dot" />}
          </NavLink>
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-profile">
          <div className="profile-avatar">A</div>
          <div className="profile-copy">
            <strong>Admin Portal</strong>
            <span>Administrator</span>
          </div>
          <button
            className="logout-button"
            type="button"
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
          >
            <Icon name="logout" size={16} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="app-topbar">
          <button
            className="icon-button mobile-menu-button"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="topbar-context">
            <span className="topbar-kicker">FASTBITES / ADMIN</span>
            <strong>
              {activeSection === "orders" ? "Order operations" : "Team management"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="topbar-date">
              <Icon name="calendar" size={16} />
              {today}
            </span>
            <span className="topbar-divider" />
            <span className="topbar-avatar" aria-label="Administrator">
              A
            </span>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
};
