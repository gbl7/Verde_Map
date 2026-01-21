import { motion } from "framer-motion";
import { Wind, Droplets, Footprints, Trees, Trash2, CheckCircle2 } from "lucide-react";

interface ScoreProps {
  label: string;
  value: number;
  icon: any;
  colorClass: string;
  description?: string;
}

function ScoreRow({ label, value, icon: Icon, colorClass, description }: ScoreProps) {
  // Determine color based on score
  let statusColor = "bg-red-500";
  if (value >= 70) statusColor = "bg-green-500";
  else if (value >= 40) statusColor = "bg-yellow-500";

  return (
    <div className="group p-3 rounded-xl bg-secondary/30 hover:bg-secondary/60 transition-colors">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg bg-white shadow-sm ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold text-sm text-foreground/80">{label}</span>
            <span className="font-bold text-foreground">{value}/100</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${value}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full ${statusColor}`} 
            />
          </div>
        </div>
      </div>
      {description && <p className="text-xs text-muted-foreground ml-11">{description}</p>}
    </div>
  );
}

interface EnvironmentalCardProps {
  data: {
    location: string;
    summary: string;
    scores: {
      airQuality: number;
      waterQuality: number;
      walkability: number;
      greenSpace: number;
      pollution: number; // Cleanliness
    };
  };
  isLoading?: boolean;
}

export function EnvironmentalCard({ data, isLoading }: EnvironmentalCardProps) {
  if (isLoading) {
    return (
      <div className="bg-card/80 backdrop-blur-md border border-white/20 p-6 rounded-3xl shadow-xl w-full max-w-md animate-pulse">
        <div className="h-8 bg-muted rounded-lg w-2/3 mb-4"></div>
        <div className="h-20 bg-muted rounded-lg w-full mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  // Calculate overall vibe
  const scores = Object.values(data.scores);
  const average = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  
  let vibeLabel = "Good";
  let vibeColor = "text-green-600";
  if (average >= 80) { vibeLabel = "Excellent"; vibeColor = "text-emerald-600"; }
  else if (average < 50) { vibeLabel = "Poor"; vibeColor = "text-red-500"; }
  else if (average < 70) { vibeLabel = "Moderate"; vibeColor = "text-yellow-600"; }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/90 backdrop-blur-md border border-white/40 p-6 rounded-3xl shadow-xl w-full max-w-md overflow-hidden relative"
    >
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-accent to-primary" />
      
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold font-display text-foreground">{data.location}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Overall Vibe</span>
              <span className={`font-bold ${vibeColor}`}>{vibeLabel} ({average})</span>
            </div>
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg ${
            average >= 70 ? 'bg-green-500' : average >= 50 ? 'bg-yellow-500' : 'bg-red-500'
          }`}>
            {average}
          </div>
        </div>
        
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed bg-secondary/20 p-3 rounded-lg border border-secondary/50">
          {data.summary}
        </p>
      </div>

      <div className="space-y-3">
        <ScoreRow 
          label="Air Quality" 
          value={data.scores.airQuality} 
          icon={Wind} 
          colorClass="text-sky-500"
        />
        <ScoreRow 
          label="Water Quality" 
          value={data.scores.waterQuality} 
          icon={Droplets} 
          colorClass="text-blue-500"
        />
        <ScoreRow 
          label="Walkability" 
          value={data.scores.walkability} 
          icon={Footprints} 
          colorClass="text-orange-500"
        />
        <ScoreRow 
          label="Green Space" 
          value={data.scores.greenSpace} 
          icon={Trees} 
          colorClass="text-green-600"
        />
        <ScoreRow 
          label="Cleanliness" 
          value={data.scores.pollution} 
          icon={CheckCircle2} 
          colorClass="text-purple-500"
        />
      </div>
      
      <div className="mt-6 text-center">
        <p className="text-xs text-muted-foreground italic">
          Analysis generated by EcoVibe AI based on location data.
        </p>
      </div>
    </motion.div>
  );
}
