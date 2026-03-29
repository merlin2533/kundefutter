"use client";
import { useState, useCallback, useTransition } from "react";

interface UseOptimisticOptions<T> {
  onSubmit: (data: T) => Promise<T>;
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
}

export function useOptimistic<T>({ onSubmit, onSuccess, onError }: UseOptimisticOptions<T>) {
  const [isPending, startTransition] = useTransition();
  const [optimisticData, setOptimisticData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (data: T) => {
    setOptimisticData(data);
    setError(null);
    try {
      const result = await onSubmit(data);
      onSuccess?.(result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fehler beim Speichern";
      setError(msg);
      setOptimisticData(null); // rollback
      onError?.(e instanceof Error ? e : new Error(msg));
      throw e;
    }
  }, [onSubmit, onSuccess, onError]);

  return { submit, isPending, optimisticData, error, clearError: () => setError(null) };
}
