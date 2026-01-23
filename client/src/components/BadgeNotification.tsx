import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { Badge } from '@/lib/gamification';
import { Button } from '@/components/ui/button';

interface BadgeNotificationProps {
  badges: Badge[];
  onDismiss: () => void;
}

export function BadgeNotification({ badges, onDismiss }: BadgeNotificationProps) {
  if (badges.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: -20 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
        data-testid="badge-notification"
      >
        <div className="bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 p-1 rounded-2xl shadow-2xl">
          <div className="bg-white rounded-xl p-4 min-w-[280px]">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span className="font-bold text-foreground">New Badge{badges.length > 1 ? 's' : ''} Earned!</span>
              </div>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-6 w-6" 
                onClick={onDismiss}
                data-testid="button-dismiss-badge"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
              {badges.map(badge => (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-3 border border-amber-200"
                >
                  <div className="text-2xl">{badge.icon}</div>
                  <div>
                    <div className="font-semibold text-amber-900">{badge.name}</div>
                    <div className="text-xs text-amber-700">{badge.description}</div>
                  </div>
                </motion.div>
              ))}
            </div>
            
            <div className="mt-3 text-center text-xs text-muted-foreground">
              +{badges.length * 25} bonus points!
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
