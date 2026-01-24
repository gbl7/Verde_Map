import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Bell, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";

interface EmailSignupProps {
  lat?: number;
  lng?: number;
  locationName?: string;
  variant?: "inline" | "card";
}

export function EmailSignup({ lat, lng, locationName, variant = "card" }: EmailSignupProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");

    try {
      const response = await apiRequest("POST", "/api/subscribe", {
        email: email.trim(),
        lat: lat || undefined,
        lng: lng || undefined,
        locationName: locationName || undefined,
      });

      if (response.ok) {
        setStatus("success");
        setMessage("You're subscribed! We'll send you environmental alerts.");
        setEmail("");
      } else {
        const data = await response.json();
        if (response.status === 409) {
          setStatus("success");
          setMessage("You're already subscribed!");
        } else {
          setStatus("error");
          setMessage(data.message || "Something went wrong. Please try again.");
        }
      }
    } catch (err) {
      setStatus("error");
      setMessage("Failed to subscribe. Please try again.");
    }
  };

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2">
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            <motion.div
              key="trigger"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(true)}
                className="gap-2"
                data-testid="button-expand-email-signup"
              >
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Get Alerts</span>
              </Button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              onSubmit={handleSubmit}
              className="flex items-center gap-2"
            >
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 w-40 sm:w-48"
                data-testid="input-email-inline"
                disabled={status === "loading" || status === "success"}
              />
              <Button
                type="submit"
                size="sm"
                disabled={status === "loading" || status === "success" || !email.trim()}
                data-testid="button-submit-email-inline"
              >
                {status === "loading" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : status === "success" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setIsExpanded(false);
                  setStatus("idle");
                }}
                data-testid="button-close-email-inline"
              >
                <X className="w-4 h-4" />
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/90 backdrop-blur-md border border-white/40 rounded-2xl shadow-lg p-4 w-full max-w-sm"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-sm text-foreground">Environmental Alerts</h3>
          <p className="text-xs text-muted-foreground">Get notified about air quality changes</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {status === "success" ? (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200"
          >
            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span className="text-sm text-green-700">{message}</span>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleSubmit}
            className="space-y-3"
          >
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
                data-testid="input-email-card"
                disabled={status === "loading"}
              />
              <Button
                type="submit"
                disabled={status === "loading" || !email.trim()}
                data-testid="button-submit-email-card"
              >
                {status === "loading" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Subscribe"
                )}
              </Button>
            </div>
            
            {status === "error" && (
              <p className="text-xs text-red-500">{message}</p>
            )}
            
            <p className="text-xs text-muted-foreground">
              We'll only send important environmental updates. No spam.
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
