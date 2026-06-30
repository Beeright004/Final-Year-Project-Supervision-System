const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return "/api";
  const clean = envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
  return clean.endsWith("/api") ? clean : `${clean}/api`;
};

const API_BASE = getApiBase();

export async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("supervision_token");
  
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const fullUrl = `${API_BASE}${endpoint}`;
  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type");
  const isHtml = contentType && contentType.includes("text/html");

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`API Endpoint Not Found (404): Could not reach "${fullUrl}". If you are hosting the frontend separately (e.g., on Vercel, Netlify, or GitHub Pages), ensure your backend Express server is deployed and set the environment variable "VITE_API_URL" to your backend server URL.`);
    }
    if (isHtml) {
      if (response.status === 403) {
        throw new Error(`Authorization Blocked (403): The sandbox environment proxy requires validation. This usually happens inside the iframe preview due to "Prevent Cross-Site Tracking" or third-party cookie restrictions. Please click "Open in New Tab" in the top-right corner of the pane to run the application in a fresh native window!`);
      }
      if (response.status === 401) {
        throw new Error(`Session Expired (401): Your sandbox token has expired. Please refresh the page or restart your live session credentials.`);
      }
      throw new Error(`HTTP Error ${response.status}: The server returned an HTML response instead of JSON. Try clicking "Open in New Tab" to bypass browser canvas restrictions.`);
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${response.status}: ${response.statusText}`);
  }

  if (isHtml) {
    throw new Error("The API server returned an HTML document unexpectedly. Try opening the applet inside a New Tab to establish a fresh workspace session.");
  }

  return response.json() as Promise<T>;
}

export const api = {
  auth: {
    login: (credentials: any) => request("/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
    register: (details: any) => request("/auth/register", { method: "POST", body: JSON.stringify(details) }),
    confirmRegister: (email: string, otp: string) => request("/auth/register/confirm", { method: "POST", body: JSON.stringify({ email, otp }) }),
    me: () => request("/auth/me", { method: "GET" }),
    forgotPassword: (email: string) => request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
    resetPassword: (payload: any) => request("/auth/reset-password", { method: "POST", body: JSON.stringify(payload) }),
  },
  supervisors: {
    list: () => request("/supervisors", { method: "GET" }),
    students: () => request("/supervisors/students", { method: "GET" }),
  },
  topics: {
    list: () => request("/topics", { method: "GET" }),
    submit: (topic: { title: string; description: string }) => request("/topics", { method: "POST", body: JSON.stringify(topic) }),
    edit: (id: string, topic: { title: string; description: string }) => request(`/topics/${id}`, { method: "PUT", body: JSON.stringify(topic) }),
    review: (id: string, review: { status: "approved" | "rejected" | "revision"; feedback: string }) => 
      request(`/topics/${id}/review`, { method: "PUT", body: JSON.stringify(review) }),
  },
  proposals: {
    upload: (payload: FormData | { topicId: string; fileName: string; fileDataUrl: string; fileSize: string }) => {
      if (payload instanceof FormData) {
        return request("/proposals", { method: "POST", body: payload });
      }
      return request("/proposals", { method: "POST", body: JSON.stringify(payload) });
    },
    review: (id: string, review: { status: "approved" | "rejected"; feedback: string }) => 
      request(`/proposals/${id}/review`, { method: "PUT", body: JSON.stringify(review) }),
  },
  documents: {
    list: () => request("/documents", { method: "GET" }),
    share: (payload: FormData | { fileName: string; fileDataUrl: string; fileSize: string; tag: string }) => {
      if (payload instanceof FormData) {
        return request("/documents", { method: "POST", body: payload });
      }
      return request("/documents", { method: "POST", body: JSON.stringify(payload) });
    },
    delete: (id: string) => request(`/documents/${id}`, { method: "DELETE" }),
    addFeedback: (id: string, feedback: string) => 
      request(`/documents/${id}/feedback`, { method: "PUT", body: JSON.stringify({ feedback }) }),
  },
  schedules: {
    list: () => request("/schedules", { method: "GET" }),
    create: (meeting: any) => request("/schedules", { method: "POST", body: JSON.stringify(meeting) }),
    updateStatus: (id: string, status: "approved" | "rejected" | "completed" | "cancelled") => 
      request(`/schedules/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
    delete: (id: string) => request(`/schedules/${id}`, { method: "DELETE" }),
  },
  notifications: {
    list: () => request("/notifications", { method: "GET" }),
    markRead: (id: string) => request(`/notifications/${id}/read`, { method: "PUT" }),
    clearAll: () => request("/notifications/clear-all", { method: "PUT" }),
  },
  presentations: {
    list: () => request("/presentations", { method: "GET" }),
    create: (payload: { studentId: string; title: string; description: string; dueDate: string; meetingUrl?: string }) => 
      request("/presentations", { method: "POST", body: JSON.stringify(payload) }),
    submit: (id: string, payload: { slidesUrl?: string; fileName?: string; fileDataUrl?: string; fileSize?: string }) => 
      request(`/presentations/${id}/submit`, { method: "PUT", body: JSON.stringify(payload) }),
    review: (id: string, payload: { status: "approved" | "revision"; feedback: string }) => 
      request(`/presentations/${id}/review`, { method: "PUT", body: JSON.stringify(payload) }),
  },
  admin: {
    users: {
      list: () => request("/admin/users", { method: "GET" }),
      create: (user: any) => request("/admin/users", { method: "POST", body: JSON.stringify(user) }),
      update: (id: string, user: any) => request(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(user) }),
      delete: (id: string) => request(`/admin/users/${id}`, { method: "DELETE" }),
    },
    stats: () => request("/admin/stats", { method: "GET" }),
    emails: {
      list: () => request("/admin/emails", { method: "GET" }),
      clear: () => request("/admin/emails/clear", { method: "DELETE" }),
    }
  },
  agora: {
    getToken: (channelName: string, isScreen: boolean = false) => request<{ token: string; uid: number; channelName: string; appId: string }>(`/agora/token?channelName=${encodeURIComponent(channelName)}&isScreen=${isScreen}`, { method: "GET" }),
    getNameMap: () => request<Record<number, string>>("/users/map", { method: "GET" }),
  },
  system: {
    dbStatus: () => request<{ connected: boolean; type: string; uri: string }>("/db-status", { method: "GET" }),
  }
};
