// src/api/client/client.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { QueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";

const API_TIMEOUT = 30000;
// Track if we're already redirecting to prevent loops
let isRedirecting = false;

// Routes that don't require auth checking
const PUBLIC_ROUTES = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/verify",
  "/api/auth/reset-password",
  "/api/auth/forgot-password",
];

// Helper function to handle redirects to login page
const redirectToLogin = () => {
  if (typeof window !== "undefined" && !isRedirecting) {
    isRedirecting = true;

    // Clear any auth tokens
    Cookies.remove("sessionToken");

    // Only redirect if we're not already on the login page
    if (!window.location.pathname.includes("/login")) {
      window.location.href = "/login";
    } else {
      // Reset the redirect flag if we're already on login
      isRedirecting = false;
    }
  }
};

export class ApiError extends Error {
  constructor(
    public code: number,
    public message: string,
    public data?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL + "/api",
  timeout: API_TIMEOUT,
  withCredentials: true,
  headers: { "Cache-Control": "no-cache" }
});

// Request interceptor - only check if the route requires auth
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const sessionToken = Cookies.get("sessionToken");
      const url = config.url || "";

      // Only redirect for authenticated routes
      const isPublicRoute = PUBLIC_ROUTES.some((route) => url.includes(route));

      // For non-public routes, check token but don't redirect here
      // Instead, let the 401 response trigger the redirect
      if (!sessionToken && !isPublicRoute && typeof window !== "undefined") {
        console.log("No session token for protected route:", url);
        // We'll let the request go through and fail with 401
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle auth errors here
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const normalizedError: ApiError = {
      code: error.response?.status || 500,
      message: error.response?.data?.error || "Unknown error",
      data: error.response?.data,
      name: error.response?.data?.name || "ApiError",
    };
    console.log("error", normalizedError);
    // Handle 401 (Unauthorized) responses - this is the only place we redirect
    if (normalizedError.code === 401) {
      redirectToLogin();
    }

    return Promise.reject(normalizedError);
  }
);

// Query client configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error) => {
        console.log("retry", failureCount, error);
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 401) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});
