import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Crown, Leaf, Zap, Star, Shield, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
}

interface Product {
  id: string;
  name: string;
  description: string;
  prices: Price[];
}

export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const { data: productsData, isLoading: productsLoading } = useQuery<{ products: Product[] }>({
    queryKey: ['/api/stripe/products'],
    enabled: open,
  });

  const verdeProProduct = productsData?.products?.find(p => p.name === 'Verde Pro');
  const monthlyPrice = verdeProProduct?.prices?.find(p => p.recurring?.interval === 'month');
  const yearlyPrice = verdeProProduct?.prices?.find(p => p.recurring?.interval === 'year');

  const handleUpgrade = async () => {
    const priceId = billingCycle === 'monthly' ? monthlyPrice?.id : yearlyPrice?.id;
    
    if (!priceId) {
      console.error('No valid price ID found');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priceId }),
      });
      
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: Zap, text: "Unlimited environmental analyses" },
    { icon: Leaf, text: "Unlimited community pins" },
    { icon: Star, text: "Priority AI responses" },
    { icon: Shield, text: "Exclusive pro badges" },
    { icon: Crown, text: "Early access to new features" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Crown className="h-5 w-5 text-yellow-500" />
            Upgrade to Verde Pro
          </DialogTitle>
          <DialogDescription>
            Unlock unlimited environmental exploration and community features.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={cn(
                "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
                billingCycle === 'monthly' 
                  ? "bg-background shadow text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid="button-billing-monthly"
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={cn(
                "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors relative",
                billingCycle === 'yearly' 
                  ? "bg-background shadow text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid="button-billing-yearly"
            >
              Yearly
              <span className="absolute -top-2 -right-2 bg-green-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                Save 33%
              </span>
            </button>
          </div>
          
          <div className="text-center">
            {productsLoading ? (
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-green-600" />
            ) : !monthlyPrice || !yearlyPrice ? (
              <div className="text-sm text-muted-foreground">
                Unable to load pricing. Please try again later.
              </div>
            ) : (
              <>
                <div className="text-4xl font-bold text-green-600">
                  ${billingCycle === 'monthly' 
                    ? (monthlyPrice.unit_amount / 100).toFixed(2) 
                    : (yearlyPrice.unit_amount / 100).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">
                  per {billingCycle === 'monthly' ? 'month' : 'year'}
                </div>
                {billingCycle === 'yearly' && (
                  <div className="text-xs text-green-600 mt-1">
                    That's just ${((yearlyPrice.unit_amount / 100) / 12).toFixed(2)}/month
                  </div>
                )}
              </>
            )}
          </div>
          
          <div className="space-y-3">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <feature.icon className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-sm">{feature.text}</span>
              </div>
            ))}
          </div>
          
          <Button
            onClick={handleUpgrade}
            disabled={isLoading || productsLoading || !monthlyPrice || !yearlyPrice}
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
            data-testid="button-upgrade-confirm"
          >
            {isLoading ? (
              "Processing..."
            ) : (
              <>
                <Crown className="mr-2 h-4 w-4" />
                Upgrade Now
              </>
            )}
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            Cancel anytime. Secure payment via Stripe.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
