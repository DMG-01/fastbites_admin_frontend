import React, { useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { WaitersPage } from "./pages/waiters";
import { OrdersPage } from "./pages/order";
import { LoginPage } from "./pages/LoginPage";

const ProtectedRoute: React.FC<{ token: string | null; children: React.ReactNode }> = ({
  token,
  children,
}) => {
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
};

function App() {
  const location = useLocation();
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("access_token")
  );
  const loginState = location.state as
    | { from?: { pathname?: string } }
    | null;
  const requestedPath = loginState?.from?.pathname;
  const postLoginPath =
    requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
      ? requestedPath
      : "/orders";

  const handleLoginSuccess = (newToken: string) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setToken(null);
  };

  return (
    // DO NOT put <BrowserRouter> here if it's already in main.tsx
    <Routes>
      <Route
        path="/login"
        element={
          token ? (
            <Navigate to={postLoginPath} replace />
          ) : (
            <LoginPage onLoginSuccess={handleLoginSuccess} />
          )
        }
      />
      <Route
        path="/waiters"
        element={
          <ProtectedRoute token={token}>
            <WaitersPage onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/waiters/requests"
        element={
          <ProtectedRoute token={token}>
            <WaitersPage onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/waiter-requests"
        element={<Navigate to="/waiters/requests" replace />}
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute token={token}>
            <OrdersPage onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to={token ? "/orders" : "/login"} replace />} />
      <Route path="*" element={<Navigate to={token ? "/orders" : "/login"} replace />} />
    </Routes>
  );
}

export default App;