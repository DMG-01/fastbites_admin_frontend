import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { WaitersPage } from "./pages/waiters";
import { OrdersPage } from "./pages/order";
import { LoginPage } from "./pages/LoginPage";

const ProtectedRoute: React.FC<{ token: string | null; children: React.ReactNode }> = ({
  token,
  children,
}) => {
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("access_token")
  );

  const handleLoginSuccess = (newToken: string) => {
    setToken(newToken);
  };

  return (
    // DO NOT put <BrowserRouter> here if it's already in main.tsx
    <Routes>
      <Route
        path="/login"
        element={
          token ? (
            <Navigate to="/orders" replace />
          ) : (
            <LoginPage onLoginSuccess={handleLoginSuccess} />
          )
        }
      />
      <Route
        path="/waiters"
        element={
          <ProtectedRoute token={token}>
            <WaitersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute token={token}>
            <OrdersPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={token ? "/orders" : "/login"} replace />} />
    </Routes>
  );
}

export default App;