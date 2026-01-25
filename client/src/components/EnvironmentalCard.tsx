import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wind, Droplets, Footprints, Trees, CheckCircle2, MessageCircle, Send, Loader2, Factory, AlertTriangle, ChevronDown, Lightbulb, Info, X, Minimize2, Maximize2, Share2, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

interface ScoreDetail {
  value: number;
  factors: string[];
  tips?: string[];
}

interface ScoreProps {
  label: string;
  value: number;
  icon: any;
  colorClass: string;
  detail?: ScoreDetail;
  testId?: string;
}

function ScoreRow({ label, value, icon: Icon, colorClass, detail, testId }: ScoreProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  let statusColor = "bg-red-500";
  if (value >= 70) statusColor = "bg-green-500";
  else if (value >= 40) statusColor = "bg-yellow-500";

  const hasDetails = detail && (detail.factors?.length > 0 || detail.tips?.length);

  return (
    <div className="rounded-xl bg-secondary/30 transition-colors overflow-hidden">
      <button
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        className={`w-full p-3 text-left hover:bg-secondary/60 transition-colors ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}
        data-testid={testId}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className={`p-2 rounded-lg bg-white shadow-sm ${colorClass}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-sm text-foreground/80">{label}</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{value}/100</span>
                {hasDetails && (
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                )}
              </div>
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
      </button>
      
      <AnimatePresence>
        {isExpanded && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2" data-testid={`${testId}-details`}>
              {detail.factors && detail.factors.length > 0 && (
                <div className="ml-11 p-2 rounded-lg bg-white/50 border border-secondary">
                  <div className="flex items-center gap-1 mb-1">
                    <Info className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Contributing Factors</span>
                  </div>
                  <ul className="space-y-1">
                    {detail.factors.map((factor, i) => (
                      <li key={i} className="text-xs text-foreground/80 flex items-start gap-1">
                        <span className="text-muted-foreground mt-0.5">•</span>
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {detail.tips && detail.tips.length > 0 && (
                <div className="ml-11 p-2 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-1 mb-1">
                    <Lightbulb className="w-3 h-3 text-amber-600" />
                    <span className="text-xs font-medium text-amber-700">Tips</span>
                  </div>
                  <ul className="space-y-1">
                    {detail.tips.map((tip, i) => (
                      <li key={i} className="text-xs text-amber-800 flex items-start gap-1">
                        <span className="text-amber-500 mt-0.5">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
      pollution: number;
    };
    scoreDetails?: {
      airQuality?: ScoreDetail;
      waterQuality?: ScoreDetail;
      walkability?: ScoreDetail;
      greenSpace?: ScoreDetail;
      pollution?: ScoreDetail;
    };
    epaContext?: {
      totalFacilities: number;
      majorEmitters: number;
      facilitiesWithViolations: number;
      topIndustries: string[];
    };
    aqiContext?: {
      aqi: number;
      category: string;
      station: string | null;
      dominantPollutant: string | null;
      lastUpdated: string | null;
    };
    climateTraceContext?: {
      sourcesCount: number;
      totalEmissions: number;
      totalEmissionsFormatted: string;
      topSources: {
        name: string;
        sector: string;
        emissions: number | null;
        emissionsFormatted: string | null;
      }[];
      sectorBreakdown: {
        sector: string;
        count: number;
        emissions: number;
        emissionsFormatted: string;
      }[];
    };
  };
  lat?: number;
  lng?: number;
  isLoading?: boolean;
}

interface EnvironmentalCardFullProps extends EnvironmentalCardProps {
  onClose?: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export function EnvironmentalCard({ data, lat, lng, isLoading, onClose, isMinimized, onToggleMinimize }: EnvironmentalCardFullProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");

  const handleShare = async () => {
    const scores = data.scores;
    const average = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length);
    
    const shareText = `Check out the environmental vibe of ${data.location}!

Overall Score: ${average}/100
Air Quality: ${scores.airQuality}/100
Water Quality: ${scores.waterQuality}/100
Walkability: ${scores.walkability}/100
Green Space: ${scores.greenSpace}/100
Pollution: ${scores.pollution}/100

Explore environmental data at Verde`;

    const shareUrl = window.location.href;
    
    // Try native share first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Verde - ${data.location}`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // User cancelled or share failed, fall back to clipboard
      }
    }
    
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || !lat || !lng) return;
    
    setIsAsking(true);
    setAnswer("");
    
    try {
      const response = await apiRequest("POST", "/api/ask", {
        lat,
        lng,
        location: data.location,
        question: question.trim(),
      });
      const result = await response.json();
      setAnswer(result.answer);
    } catch (error) {
      setAnswer("Sorry, I couldn't get an answer. Please try again.");
    } finally {
      setIsAsking(false);
    }
  };

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

  // Minimized view
  if (isMinimized) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/90 backdrop-blur-md border border-white/40 rounded-2xl shadow-xl overflow-hidden"
      >
        <button
          onClick={onToggleMinimize}
          className="w-full p-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors"
          data-testid="button-expand-card"
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0 ${
            average >= 70 ? 'bg-green-500' : average >= 50 ? 'bg-yellow-500' : 'bg-red-500'
          }`}>
            {average}
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="font-semibold text-sm text-foreground truncate">{data.location}</div>
            <div className={`text-xs ${vibeColor}`}>{vibeLabel} Environmental Vibe</div>
          </div>
          <Maximize2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/90 backdrop-blur-md border border-white/40 rounded-3xl shadow-xl w-full max-w-md overflow-hidden relative flex flex-col max-h-[70vh] md:max-h-[80vh]"
    >
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-accent to-primary z-10" />
      
      {/* Header with close/minimize buttons */}
      <div className="flex items-center justify-between p-3 pt-4 border-b border-secondary/30">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0 ${
            average >= 70 ? 'bg-green-500' : average >= 50 ? 'bg-yellow-500' : 'bg-red-500'
          }`}>
            {average}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold font-display text-foreground truncate">{data.location}</h2>
            <div className="flex items-center gap-1">
              <span className={`text-xs font-medium ${vibeColor}`}>{vibeLabel}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleShare}
            className="h-8 w-8 rounded-lg"
            data-testid="button-share"
            title={shareStatus === "copied" ? "Copied!" : "Share"}
          >
            {shareStatus === "copied" ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </Button>
          {onToggleMinimize && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onToggleMinimize}
              className="h-8 w-8 rounded-lg"
              data-testid="button-minimize-card"
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
          )}
          {onClose && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="h-8 w-8 rounded-lg"
              data-testid="button-close-card"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      
      <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar">
        <div className="mb-4">
          <div className="flex justify-between items-start">
            <div className="sr-only">
              <h2>{data.location}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span>Overall Vibe</span>
                <span className={vibeColor}>{vibeLabel} ({average})</span>
              </div>
            </div>
          </div>
          
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed bg-secondary/20 p-3 rounded-lg border border-secondary/50">
            {data.summary}
          </p>

          {/* Real-time AQI Data */}
          {data.aqiContext ? (
            <div className="mt-4 p-3 rounded-lg bg-sky-50 border border-sky-200" data-testid="section-aqi-context">
              <div className="flex items-center gap-2 mb-2">
                <Wind className="w-4 h-4 text-sky-600" />
                <span className="text-sm font-medium text-sky-800">Real-time Air Quality</span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <div 
                  className={`text-center p-2 px-4 rounded border ${
                    data.aqiContext.aqi <= 50 ? 'bg-green-100 border-green-200' :
                    data.aqiContext.aqi <= 100 ? 'bg-yellow-100 border-yellow-200' :
                    data.aqiContext.aqi <= 150 ? 'bg-orange-100 border-orange-200' :
                    'bg-red-100 border-red-200'
                  }`}
                  data-testid="badge-aqi-value"
                >
                  <div className={`text-2xl font-bold ${
                    data.aqiContext.aqi <= 50 ? 'text-green-700' :
                    data.aqiContext.aqi <= 100 ? 'text-yellow-700' :
                    data.aqiContext.aqi <= 150 ? 'text-orange-700' :
                    'text-red-700'
                  }`}>{data.aqiContext.aqi}</div>
                  <div className="text-xs text-muted-foreground">AQI</div>
                </div>
                <div className="flex-1">
                  <div 
                    className={`text-sm font-medium ${
                      data.aqiContext.aqi <= 50 ? 'text-green-700' :
                      data.aqiContext.aqi <= 100 ? 'text-yellow-700' :
                      data.aqiContext.aqi <= 150 ? 'text-orange-700' :
                      'text-red-700'
                    }`}
                    data-testid="text-aqi-category"
                  >{data.aqiContext.category}</div>
                  {data.aqiContext.dominantPollutant && (
                    <div className="text-xs text-muted-foreground" data-testid="text-aqi-pollutant">
                      Main pollutant: {data.aqiContext.dominantPollutant.toUpperCase()}
                    </div>
                  )}
                  {data.aqiContext.station && (
                    <div className="text-xs text-muted-foreground truncate" title={data.aqiContext.station} data-testid="text-aqi-station">
                      Station: {data.aqiContext.station}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-muted" data-testid="section-aqi-unavailable">
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Real-time air quality data unavailable for this location</span>
              </div>
            </div>
          )}

          {/* EPA Facility Context */}
          {data.epaContext && data.epaContext.totalFacilities > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200" data-testid="section-epa-context">
              <div className="flex items-center gap-2 mb-2">
                <Factory className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">EPA Facility Data (10 mi radius)</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="text-center p-2 bg-white rounded border border-amber-100">
                  <div className="text-lg font-bold text-foreground">{data.epaContext.totalFacilities}</div>
                  <div className="text-xs text-muted-foreground">Facilities</div>
                </div>
                <div className="text-center p-2 bg-white rounded border border-amber-100">
                  <div className="text-lg font-bold text-foreground">{data.epaContext.majorEmitters}</div>
                  <div className="text-xs text-muted-foreground">Major</div>
                </div>
                <div className={`text-center p-2 bg-white rounded border ${data.epaContext.facilitiesWithViolations > 0 ? 'border-red-200 bg-red-50' : 'border-amber-100'}`}>
                  <div className={`text-lg font-bold ${data.epaContext.facilitiesWithViolations > 0 ? 'text-red-600' : 'text-foreground'}`}>
                    {data.epaContext.facilitiesWithViolations}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    {data.epaContext.facilitiesWithViolations > 0 && <AlertTriangle className="w-3 h-3 text-red-500" />}
                    Violations
                  </div>
                </div>
              </div>
              {data.epaContext.topIndustries && data.epaContext.topIndustries.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {data.epaContext.topIndustries.map((industry, i) => (
                    <Badge key={i} variant="secondary" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                      {industry}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Climate TRACE Global Emissions Data */}
          {data.climateTraceContext && data.climateTraceContext.sourcesCount > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200" data-testid="section-climate-trace">
              <div className="flex items-center gap-2 mb-2">
                <Factory className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-800">Climate TRACE National Emissions</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="text-center p-2 bg-white rounded border border-emerald-100">
                  <div className="text-lg font-bold text-foreground">{data.climateTraceContext.sourcesCount}</div>
                  <div className="text-xs text-muted-foreground">Emission Sources</div>
                </div>
                <div className="text-center p-2 bg-white rounded border border-emerald-100">
                  <div className="text-lg font-bold text-foreground">{data.climateTraceContext.totalEmissionsFormatted}</div>
                  <div className="text-xs text-muted-foreground">tonnes CO2e/yr</div>
                </div>
              </div>
              {data.climateTraceContext.sectorBreakdown.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-emerald-700 font-medium mb-1">By Sector:</div>
                  <div className="flex flex-wrap gap-1">
                    {data.climateTraceContext.sectorBreakdown.map((sector, i) => (
                      <Badge key={i} variant="secondary" className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200">
                        {sector.sector}: {sector.emissionsFormatted}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {data.climateTraceContext.topSources.length > 0 && (
                <div>
                  <div className="text-xs text-emerald-700 font-medium mb-1">Top Emitters:</div>
                  <div className="space-y-1">
                    {data.climateTraceContext.topSources.slice(0, 3).map((source, i) => (
                      <div key={i} className="text-xs text-muted-foreground flex justify-between">
                        <span className="truncate flex-1" title={source.name}>{source.name}</span>
                        <span className="ml-2 text-emerald-700 font-medium">{source.emissionsFormatted || 'N/A'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Ask a Question Section */}
          <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Ask about this place</span>
            </div>
            <form 
              onSubmit={(e) => { e.preventDefault(); handleAskQuestion(); }}
              className="flex gap-2"
            >
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g., Best hiking trails nearby?"
                className="flex-1 h-9 text-sm bg-white border-primary/20"
                disabled={isAsking}
                data-testid="input-question"
              />
              <Button 
                type="submit" 
                size="icon" 
                disabled={!question.trim() || isAsking}
                className="h-9 w-9"
                data-testid="button-ask"
              >
                {isAsking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
            {answer && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-3 p-2 rounded bg-white border border-primary/10 text-sm text-foreground/90"
                data-testid="text-ai-answer"
              >
                {answer}
              </motion.div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <ScoreRow 
            label="Air Quality" 
            value={data.scores.airQuality} 
            icon={Wind} 
            colorClass="text-sky-500"
            detail={data.scoreDetails?.airQuality}
            testId="score-air-quality"
          />
          <ScoreRow 
            label="Water Quality" 
            value={data.scores.waterQuality} 
            icon={Droplets} 
            colorClass="text-blue-500"
            detail={data.scoreDetails?.waterQuality}
            testId="score-water-quality"
          />
          <ScoreRow 
            label="Walkability" 
            value={data.scores.walkability} 
            icon={Footprints} 
            colorClass="text-orange-500"
            detail={data.scoreDetails?.walkability}
            testId="score-walkability"
          />
          <ScoreRow 
            label="Green Space" 
            value={data.scores.greenSpace} 
            icon={Trees} 
            colorClass="text-green-600"
            detail={data.scoreDetails?.greenSpace}
            testId="score-green-space"
          />
          <ScoreRow 
            label="Cleanliness" 
            value={data.scores.pollution} 
            icon={CheckCircle2} 
            colorClass="text-purple-500"
            detail={data.scoreDetails?.pollution}
            testId="score-cleanliness"
          />
        </div>
        
        <p className="text-xs text-center text-muted-foreground mt-2">
          Click any score to see detailed factors
        </p>
        
        <div className="mt-6 text-center pb-2">
          <p className="text-xs text-muted-foreground italic">
            Analysis powered by Verde AI with real EPA ECHO facility data.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
