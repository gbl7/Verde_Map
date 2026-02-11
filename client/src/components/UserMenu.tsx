import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, LogOut, Crown, Settings, Leaf } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { UpgradeModal } from "./UpgradeModal";

export function UserMenu() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => window.location.href = "/api/login"}
          data-testid="button-login-google"
        >
          <SiGoogle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign in with Google</span>
          <span className="sm:hidden">Sign in</span>
        </Button>
      </div>
    );
  }

  const initials = user?.firstName && user?.lastName 
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.firstName?.[0] || "U";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 rounded-full"
            data-testid="button-user-menu"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
              <AvatarFallback className="bg-green-600 text-white text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="flex items-center gap-2 p-2">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="bg-green-600 text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {user?.subscriptionTier === 'pro' ? (
                  <>
                    <Crown className="h-3 w-3 text-yellow-500" />
                    Verde Pro
                  </>
                ) : (
                  <>
                    <Leaf className="h-3 w-3 text-green-500" />
                    Free Plan
                  </>
                )}
              </span>
            </div>
          </div>
          <DropdownMenuSeparator />
          
          {user?.subscriptionTier !== 'pro' && (
            <>
              <DropdownMenuItem
                onClick={() => setShowUpgrade(true)}
                className="text-green-600 focus:text-green-700"
                data-testid="menu-item-upgrade"
              >
                <Crown className="mr-2 h-4 w-4" />
                Upgrade to Pro
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          
          {user?.subscriptionTier === 'pro' && (
            <>
              <DropdownMenuItem
                onClick={async () => {
                  const res = await fetch('/api/stripe/create-portal-session', {
                    method: 'POST',
                    credentials: 'include',
                  });
                  const data = await res.json();
                  if (data.url) {
                    window.location.href = data.url;
                  }
                }}
                data-testid="menu-item-manage-subscription"
              >
                <Settings className="mr-2 h-4 w-4" />
                Manage Subscription
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          
          <DropdownMenuItem
            onClick={() => logout()}
            className="text-red-600 focus:text-red-700"
            data-testid="menu-item-logout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
    </>
  );
}
