import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Navigation, Compass, Layers, X, Menu } from "lucide-react";
import { usePins } from "@/hooks/use-pins";
import { useAnalyzeLocation } from "@/hooks/use-analysis";
import { EnvironmentalCard } from "@/components/EnvironmentalCard";
import { PinDialog } from "@/components/PinDialog";
import { GamificationPanel } from "@/components/GamificationPanel";
import { BadgeNotification } from "@/components/BadgeNotification";
import { EsriLayers } from "@/components/EsriLayers";
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
  const [isCardMinimized, setIsCardMinimized] = useState(false);
  const [isCardVisible, setIsCardVisible] = useState(true);
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const { toast } = useToast();

  const { data: pins } = usePins();
  const analyze = useAnalyzeLocation();
  const { stats, levelInfo, newBadges, recordPinDrop, recordExploration, clearNewBadges } = useGamification();

  // Initialize with user location (with fast timeout fallback)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const setDefaultLocation = () => {
      if (!center) {
        setCenter([37.7749, -122.4194]);
      }
    };
    
    // Set fallback after 3 seconds if geolocation is slow
    timeoutId = setTimeout(setDefaultLocation, 3000);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          const { latitude, longitude } = position.coords;
          setCenter([latitude, longitude]);
        },
        () => {
          clearTimeout(timeoutId);
          setCenter([37.7749, -122.4194]);
        },
        { timeout: 5000, maximumAge: 60000 }
      );
    } else {
      clearTimeout(timeoutId);
      setCenter([37.7749, -122.4194]);
    }
    
    return () => clearTimeout(timeoutId);
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
    setIsCardVisible(true);
    setIsCardMinimized(false);
  };
  
  const handleCloseCard = () => {
    setIsCardVisible(false);
    analyze.reset();
  };
  
  const handleToggleMinimize = () => {
    setIsCardMinimized(!isCardMinimized);
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

            {/* Visual Layers */}
            {layers.air && center && (
              <TileLayer
                url="https://tiles.waqi.info/tiles/usepa-aqi/{z}/{x}/{y}.png?token=demo"
                opacity={0.4}
              />
            )}
            
            {/* ESRI Layers: EPA ECHO (Pollution) and GEMStat (Water Quality) */}
            <EsriLayers 
              showEpaEcho={layers.pollution} 
              showGemsWater={layers.water}
            />

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
        <div className="p-3 md:p-6 flex gap-2 md:gap-4 items-center justify-between pointer-events-auto bg-gradient-to-b from-black/10 to-transparent">
          {/* Search bar */}
          <div className="flex gap-2 flex-1 max-w-sm md:max-w-md shadow-xl rounded-2xl bg-white/95 backdrop-blur-md p-1 md:p-1.5 border border-white/50">
            <form onSubmit={handleSearch} className="flex-1 flex gap-1 md:gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..." 
                  className="pl-8 md:pl-9 border-transparent bg-transparent focus-visible:ring-0 rounded-xl h-9 md:h-10 text-sm"
                  data-testid="input-search"
                />
              </div>
              <Button type="submit" size="sm" className="rounded-xl h-9 md:h-10 px-3 md:px-4 bg-primary hover:bg-primary/90 text-white shadow-md" data-testid="button-search">
                Go
              </Button>
            </form>
          </div>

          {/* Right controls */}
          <div className="flex gap-1.5 md:gap-3 flex-shrink-0">
            {/* Layer toggle - collapsible on mobile */}
            <div className="relative">
              <Button 
                onClick={() => setShowLayerMenu(!showLayerMenu)}
                variant="secondary"
                size="icon"
                className="md:hidden h-9 w-9 rounded-xl shadow-lg bg-white/95 backdrop-blur border border-white/50"
                data-testid="button-layers-mobile"
              >
                <Layers className="w-4 h-4" />
              </Button>
              
              {/* Desktop layer toggles */}
              <div className="hidden md:flex gap-1 bg-white/95 backdrop-blur rounded-xl p-1 shadow-lg border border-white/50">
                <Button 
                  variant={layers.air ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setLayers(l => ({...l, air: !l.air}))}
                  className="rounded-lg h-8 px-3 text-xs"
                  data-testid="button-layer-air"
                >
                  Air
                </Button>
                <Button 
                  variant={layers.water ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setLayers(l => ({...l, water: !l.water}))}
                  className="rounded-lg h-8 px-3 text-xs"
                  data-testid="button-layer-water"
                >
                  Water
                </Button>
                <Button 
                  variant={layers.pollution ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setLayers(l => ({...l, pollution: !l.pollution}))}
                  className="rounded-lg h-8 px-3 text-xs"
                  data-testid="button-layer-pollution"
                >
                  EPA
                </Button>
              </div>
              
              {/* Mobile layer dropdown */}
              <AnimatePresence>
                {showLayerMenu && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="md:hidden absolute right-0 top-12 bg-white/95 backdrop-blur rounded-xl p-2 shadow-xl border border-white/50 z-50 min-w-[140px]"
                  >
                    <div className="flex flex-col gap-1">
                      <Button 
                        variant={layers.air ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setLayers(l => ({...l, air: !l.air}))}
                        className="rounded-lg h-9 justify-start text-sm"
                      >
                        Air Quality
                      </Button>
                      <Button 
                        variant={layers.water ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setLayers(l => ({...l, water: !l.water}))}
                        className="rounded-lg h-9 justify-start text-sm"
                      >
                        Water Quality
                      </Button>
                      <Button 
                        variant={layers.pollution ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setLayers(l => ({...l, pollution: !l.pollution}))}
                        className="rounded-lg h-9 justify-start text-sm"
                      >
                        EPA Facilities
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Surprise Me - hidden on mobile, icon only on tablet */}
            <Button 
              onClick={handleRandomLocation}
              variant="secondary"
              className="hidden sm:flex rounded-xl shadow-lg bg-white/95 backdrop-blur hover:bg-white text-foreground font-medium border border-white/50 h-9 md:h-10 px-2 md:px-4"
              data-testid="button-random"
            >
              <Compass className="w-4 h-4 md:mr-2 text-accent" />
              <span className="hidden md:inline">Surprise Me</span>
            </Button>
            
            {/* My Location */}
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
              size="icon"
              className="h-9 w-9 md:w-10 md:h-10 rounded-xl shadow-lg bg-white/95 backdrop-blur hover:bg-white text-foreground border border-white/50"
              data-testid="button-my-location"
            >
              <Navigation className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </Button>
          </div>
        </div>
        
        {/* Bottom Row: Gamification Panel (left) and Analysis Card (right) */}
        <div className="flex-1 flex items-end p-3 md:p-6 pointer-events-none gap-3">
          {/* Left side: Gamification Panel - desktop only */}
          <div className="pointer-events-auto w-56 hidden lg:block">
            <GamificationPanel stats={stats} levelInfo={levelInfo} />
          </div>
          
          {/* Spacer */}
          <div className="flex-1" />
          
          {/* Right side: Analysis Card */}
          <div className="pointer-events-auto w-full max-w-[calc(100%-80px)] sm:max-w-sm md:max-w-md flex flex-col gap-3">
            
            {/* Context Actions if location selected */}
            <AnimatePresence>
              {selectedLocation && isCardVisible && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex justify-end"
                >
                  <Button 
                    onClick={handleDropPin}
                    className="rounded-full shadow-xl bg-accent hover:bg-accent/90 text-white font-bold px-4 py-5 md:px-6 md:py-6 text-sm md:text-base"
                    data-testid="button-drop-pin"
                  >
                    <MapPin className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                    <span className="hidden sm:inline">Drop a Pin Here</span>
                    <span className="sm:hidden">Pin</span>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Analysis Card Display */}
            <AnimatePresence mode="wait">
              {analyze.isPending ? (
                <EnvironmentalCard 
                  key="loading" 
                  isLoading={true} 
                  data={{} as any} 
                />
              ) : analyze.data && isCardVisible ? (
                <EnvironmentalCard 
                  key={`data-${selectedLocation?.lat}-${selectedLocation?.lng}`} 
                  data={analyze.data} 
                  lat={selectedLocation?.lat} 
                  lng={selectedLocation?.lng}
                  onClose={handleCloseCard}
                  isMinimized={isCardMinimized}
                  onToggleMinimize={handleToggleMinimize}
                />
              ) : !selectedLocation ? (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="bg-white/95 backdrop-blur-md p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-xl border border-white/50"
                >
                  <h3 className="text-lg md:text-xl font-bold font-display text-primary mb-2">Welcome to EcoVibe</h3>
                  <p className="text-sm md:text-base text-muted-foreground">
                    Tap anywhere on the map to see its environmental vibe score.
                  </p>
                  <div className="mt-3 md:mt-4 flex flex-wrap gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground/80">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-600"/>Wildlife</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-600"/>Trails</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-600"/>Issues</div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

          </div>
        </div>
        
        {/* Mobile/Tablet: Gamification Panel at bottom-left */}
        <div className="absolute bottom-3 left-3 z-20 pointer-events-auto w-48 sm:w-52 lg:hidden">
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
