const ENDPOINT = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("access_token");

  // Merge headers with Authorization token
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${ENDPOINT}${url}`, {
    ...options,
    headers,
  });

  // Automatically redirect to login if token is expired or invalid
  if (response.status === 401) {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  return response;
}