import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertPin, Pin } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function usePins() {
  return useQuery({
    queryKey: [api.pins.list.path],
    queryFn: async () => {
      const res = await fetch(api.pins.list.path);
      if (!res.ok) throw new Error("Failed to fetch pins");
      return api.pins.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreatePin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertPin) => {
      const validated = api.pins.create.input.parse(data);
      const res = await fetch(api.pins.create.path, {
        method: api.pins.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = await res.json();
          throw new Error(error.message || "Invalid pin data");
        }
        throw new Error("Failed to create pin");
      }
      
      return api.pins.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.pins.list.path] });
      toast({
        title: "Pin Dropped!",
        description: "Your observation has been added to the map.",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });
}
