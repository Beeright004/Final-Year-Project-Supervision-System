import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "../lib/api.js";
import { User, Notification } from "../types.js";

// Toast Notification Interface
export interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

interface AppContextType {
  user: User | null;
  loading: boolean;
  toasts: ToastMessage[];
  notifications: Notification[];
  supervisors: { id: string; name: string; department: string; email: string }[];
  addToast: (message: string, type?: ToastMessage["type"]) => void;
  removeToast: (id: string) => void;
  login: (credentials: any) => Promise<User>;
  register: (details: any) => Promise<any>;
  confirmRegister: (email: string, otp: string) => Promise<any>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  fetchSupervisors: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);

  // Toast builder
  const addToast = (message: string, type: ToastMessage["type"] = "info") => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Check login state on mount
  useEffect(() => {
    async function checkSession() {
      const token = localStorage.getItem("supervision_token");
      if (token) {
        try {
          const profile = await api.auth.me();
          setUser(profile);
          // Load relative context
          api.notifications.list().then(setNotifications).catch(() => {});
        } catch (e) {
          console.error("Session verification failed. Token invalidated.", e);
          localStorage.removeItem("supervision_token");
          setUser(null);
        }
      }
      setLoading(false);
    }
    checkSession();
    fetchSupervisors();
  }, []);

  // Poll notifications when logged in
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      api.notifications.list().then((data) => {
        // Simple check if counts increased to trigger fresh toasts
        if (data.length > notifications.length) {
          const newEntries = data.slice(0, data.length - notifications.length);
          newEntries.forEach((n) => {
            if (!n.read) addToast(n.message, n.type || "info");
          });
        }
        setNotifications(data);
      }).catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [user, notifications.length]);

  const refreshUser = async () => {
    try {
      const profile = await api.auth.me();
      setUser(profile);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSupervisors = async () => {
    try {
      const list = await api.supervisors.list();
      setSupervisors(list);
    } catch (e) {
      console.error("Failed to load supervisor profiles", e);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const list = await api.notifications.list();
      setNotifications(list);
    } catch (e) {
      console.error(e);
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const login = async (credentials: any) => {
    try {
      const response = await api.auth.login(credentials);
      localStorage.setItem("supervision_token", response.token);
      setUser(response.user);
      addToast(`Welcome back, ${response.user.name}!`, "success");
      // Fetch fresh system records
      api.notifications.list().then(setNotifications).catch(() => {});
      return response.user;
    } catch (error: any) {
      addToast(error.message || "Failed to log in. Please check your credentials.", "error");
      throw error;
    }
  };

  const register = async (details: any) => {
    try {
      const response = await api.auth.register(details);
      addToast(response.message || "OTP code sent to your simulated EduMail Inbox!", "success");
      return response;
    } catch (error: any) {
      addToast(error.message || "Registration failed.", "error");
      throw error;
    }
  };

  const confirmRegister = async (email: string, otp: string) => {
    try {
      const response = await api.auth.confirmRegister(email, otp);
      addToast(response.message || "Account activated successfully!", "success");
      return response;
    } catch (error: any) {
      addToast(error.message || "Activation failed.", "error");
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("supervision_token");
    addToast(`Goodbye, ${user?.name || "academic partner"}!`, "info");
    setUser(null);
    setNotifications([]);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        loading,
        toasts,
        notifications,
        supervisors,
        addToast,
        removeToast,
        login,
        register,
        confirmRegister,
        logout,
        refreshUser,
        fetchNotifications,
        markNotificationRead,
        fetchSupervisors,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be utilized within an AppProvider context element.");
  }
  return context;
}
