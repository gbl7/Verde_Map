import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md mx-auto rounded-2xl shadow-xl border-border/50">
        <CardContent className="pt-6 text-center">
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold font-display text-foreground mb-2">
            404 Page Not Found
          </h1>
          <p className="text-muted-foreground mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link href="/" className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-medium text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
            Return Home
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
