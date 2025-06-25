// src/api/client/client.ts
import axios, { AxiosError } from "axios";
import { QueryClient } from "@tanstack/react-query";

const API_TIMEOUT = 30000;

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
});

// Response interceptor
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
