import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useAnalyzeLocation() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (coords: { lat: number; lng: number }) => {
      const res = await fetch(api.analysis.analyze.path, {
        method: api.analysis.analyze.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coords),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to analyze location");
      }

      return api.analysis.analyze.responses[200].parse(await res.json());
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
}
