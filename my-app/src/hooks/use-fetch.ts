"use client";
import { useState } from "react";
import { toast } from "sonner";

/**
 * A custom hook for making asynchronous API calls with loading, error, and data states
 * @template T - The type of data returned by the API call
 * @template Args - The types of arguments passed to the callback function
 * @param cb - The callback function that makes the API call
 */
export const useFetch = <T, Args extends unknown[]>(
  cb: (...args: Args) => Promise<T>
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fn = async (...args: Args): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await cb(...args);
      setData(response);
      return response;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error("Unknown error");
      setError(errorObj);
      toast.error(errorObj.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    loading,
    error,
    fn,
    setData,
    isLoading: loading, // Added for convenience and clarity
  };
};

export default useFetch;
