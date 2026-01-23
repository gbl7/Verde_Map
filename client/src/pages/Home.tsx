import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle } from "react-leaflet";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Loader2, Navigation, Compass } from "lucide-react";
import { usePins } from "@/hooks/use-pins";
import { useAnalyzeLocation } from "@/hooks/use-analysis";
import { EnvironmentalCard } from "@/components/EnvironmentalCard";
import { PinDialog } from "@/components/PinDialog";
import { GamificationPanel } from "@/components/GamificationPanel";
import { BadgeNotification } from "@/components/BadgeNotification";
import { useGamification } from "@/hooks/use-gamification";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

// --- Custom Icons ---
const createIcon = (color: string) => {
  return L.divIcon({
    className: "custom-pin",
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const icons = {
  animal: createIcon("#ea580c"), // Orange-600
  pollution: createIcon("#dc2626"), // Red-600
  trail: createIcon("#16a34a"), // Green-600
  other: createIcon("#2563eb"), // Blue-600
  user: L.divIcon({
    className: "user-pin",
    html: `<div style="background-color: #2563eb; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  }),
};

// --- Map Controller Components ---

function MapController({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 14, { duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

function LocationMarker({ onSelectLocation }: { onSelectLocation: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e: L.LeafletMouseEvent) {
      onSelectLocation(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// --- Main Page Component ---

export default function Home() {
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [layers, setLayers] = useState({
    air: true,
    water: true,
    pollution: true,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: pins } = usePins();
  const analyze = useAnalyzeLocation();
  const { stats, levelInfo, newBadges, recordPinDrop, recordExploration, clearNewBadges } = useGamification();

  // Initialize with user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCenter([latitude, longitude]);
          // Optional: Auto-analyze current location on load? Let's wait for user action instead.
        },
        () => {
          // Default to San Francisco if blocked
          setCenter([37.7749, -122.4194]);
          toast({
            title: "Location access denied",
            description: "Defaulting map to San Francisco.",
            variant: "destructive",
          });
        }
      );
    } else {
      setCenter([37.7749, -122.4194]);
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const newCenter: [number, number] = [parseFloat(lat), parseFloat(lon)];
        setCenter(newCenter);
        handleLocationSelect(newCenter[0], newCenter[1]);
      } else {
        toast({ title: "Location not found", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Search failed", variant: "destructive" });
    }
  };

  const handleRandomLocation = () => {
    // Generate random coordinates (land-biased simplistic approach or completely random)
    // Let's pick from a few predefined interesting eco-locations to make it "fun"
    const ecoSpots = [
      [44.4280, -110.5885], // Yellowstone
      [-3.4653, -62.2159], // Amazon Rainforest
      [35.3606, 138.7274], // Mt Fuji
      [-16.5004, -151.7415], // Bora Bora
      [64.1466, -21.9426], // Reykjavik
    ];
    const random = ecoSpots[Math.floor(Math.random() * ecoSpots.length)] as [number, number];
    setCenter(random);
    handleLocationSelect(random[0], random[1]);
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng });
    analyze.mutate({ lat, lng });
    recordExploration();
  };

  const handleDropPin = () => {
    if (!selectedLocation) {
      toast({ title: "Select a location first", description: "Click anywhere on the map." });
      return;
    }
    setIsPinDialogOpen(true);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      {/* Badge Notification */}
      <BadgeNotification badges={newBadges} onDismiss={clearNewBadges} />
      
      {/* Map Layer */}
      <div className="absolute inset-0 z-0">
        {center && (
          <MapContainer 
            center={center} 
            zoom={13} 
            zoomControl={false}
            className="w-full h-full"
            style={{ background: '#e5e7eb' }} // Fallback color
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <MapController center={center} />
            <LocationMarker onSelectLocation={(lat, lng) => handleLocationSelect(lat, lng)} />

            {/* Visual Layers (Heatmap/Circle Overlays Simulation) */}
            {layers.air && center && (
              <TileLayer
                url="https://tiles.waqi.info/tiles/usepa-aqi/{z}/{x}/{y}.png?token=demo"
                opacity={0.4}
              />
            )}
            
            {/* Simulation of Water Quality / Pollution with Circles if data available */}
            {layers.pollution && pins?.filter(p => p.type === 'pollution').map(p => (
              <Circle 
                key={`pollute-layer-${p.id}`}
                center={[p.lat, p.lng]}
                pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.2 }}
                radius={500}
              />
            ))}

            {/* Current Selection Marker */}
            {selectedLocation && (
              <Marker position={[selectedLocation.lat, selectedLocation.lng]} icon={icons.user}>
                <Popup className="font-sans">Selected Location</Popup>
              </Marker>
            )}

            {/* Community Pins */}
            {pins?.map((pin) => (
              <Marker 
                key={pin.id} 
                position={[pin.lat, pin.lng]} 
                icon={icons[pin.type as keyof typeof icons] || icons.other}
              >
                <Popup className="min-w-[200px] rounded-xl overflow-hidden shadow-lg border-none p-0">
                  <div className="p-3 bg-background">
                    <div className="font-bold text-sm capitalize mb-1 text-primary flex items-center gap-2">
                      {pin.type} Pin
                    </div>
                    <p className="text-sm text-foreground/80">{pin.description}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Floating UI Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
        
        {/* Top Bar: Search & Controls */}
        <div className="p-4 md:p-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between pointer-events-auto bg-gradient-to-b from-black/5 to-transparent">
          <div className="flex gap-2 w-full max-w-md shadow-2xl rounded-2xl bg-white/90 backdrop-blur-md p-1.5 border border-white/50">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search city, place..." 
                  className="pl-9 border-transparent bg-transparent focus-visible:ring-0 rounded-xl h-10"
                />
              </div>
              <Button type="submit" size="sm" className="rounded-xl h-10 px-4 bg-primary hover:bg-primary/90 text-white shadow-md">
                Go
              </Button>
            </form>
          </div>

          <div className="flex gap-3">
            <div className="flex gap-1 bg-white/90 backdrop-blur rounded-xl p-1 shadow-lg border border-white/50 pointer-events-auto">
              <Button 
                variant={layers.air ? "default" : "ghost"}
                size="sm"
                onClick={() => setLayers(l => ({...l, air: !l.air}))}
                className="rounded-lg h-8 px-3 text-xs"
              >
                Air
              </Button>
              <Button 
                variant={layers.water ? "default" : "ghost"}
                size="sm"
                onClick={() => setLayers(l => ({...l, water: !l.water}))}
                className="rounded-lg h-8 px-3 text-xs"
              >
                Water
              </Button>
              <Button 
                variant={layers.pollution ? "default" : "ghost"}
                size="sm"
                onClick={() => setLayers(l => ({...l, pollution: !l.pollution}))}
                className="rounded-lg h-8 px-3 text-xs"
              >
                Pollution
              </Button>
            </div>
            <Button 
              onClick={handleRandomLocation}
              variant="secondary"
              className="rounded-xl shadow-lg bg-white/90 backdrop-blur hover:bg-white text-foreground font-medium border border-white/50"
            >
              <Compass className="w-4 h-4 mr-2 text-accent" />
              Surprise Me
            </Button>
            <Button 
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition((pos) => {
                    const { latitude, longitude } = pos.coords;
                    setCenter([latitude, longitude]);
                    handleLocationSelect(latitude, longitude);
                  });
                }
              }}
              className="w-10 h-10 p-0 rounded-xl shadow-lg bg-white/90 backdrop-blur hover:bg-white text-foreground border border-white/50"
            >
              <Navigation className="w-5 h-5 text-primary" />
            </Button>
          </div>
        </div>
        
        {/* Bottom Row: Gamification Panel (left) and Analysis Card (right) */}
        <div className="flex-1 flex items-end p-4 md:p-6 pointer-events-none">
          {/* Left side: Gamification Panel */}
          <div className="pointer-events-auto w-64 hidden md:block">
            <GamificationPanel stats={stats} levelInfo={levelInfo} />
          </div>
          
          {/* Spacer */}
          <div className="flex-1" />
          
          {/* Right side: Analysis Card */}
          <div className="pointer-events-auto w-full max-w-sm md:max-w-md flex flex-col gap-4">
            
            {/* Context Actions if location selected */}
            <AnimatePresence>
              {selectedLocation && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex justify-end mb-2"
                >
                  <Button 
                    onClick={handleDropPin}
                    className="rounded-full shadow-xl bg-accent hover:bg-accent/90 text-white font-bold px-6 py-6"
                  >
                    <MapPin className="w-5 h-5 mr-2" />
                    Drop a Pin Here
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Analysis Card Display */}
            <AnimatePresence mode="wait">
              {analyze.isPending ? (
                <EnvironmentalCard key="loading" isLoading={true} data={{} as any} />
              ) : analyze.data ? (
                <EnvironmentalCard key="data" data={analyze.data} />
              ) : !selectedLocation ? (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-xl border border-white/50"
                >
                  <h3 className="text-xl font-bold font-display text-primary mb-2">Welcome to EcoVibe</h3>
                  <p className="text-muted-foreground">
                    Click anywhere on the map or search for a location to see its environmental "vibe" score, generated by AI.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground/80">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-600"/>Wildlife</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-600"/>Trails</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-600"/>Issues</div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

          </div>
        </div>
        
        {/* Mobile: Gamification Panel at bottom-left, above other content */}
        <div className="absolute bottom-4 left-4 z-20 pointer-events-auto w-56 md:hidden">
          <GamificationPanel stats={stats} levelInfo={levelInfo} />
        </div>
      </div>

      <PinDialog 
        open={isPinDialogOpen} 
        onOpenChange={setIsPinDialogOpen}
        location={selectedLocation}
        onPinCreated={recordPinDrop}
      />
    </div>
  );
}
