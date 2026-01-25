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
import { EmailSignup } from "@/components/EmailSignup";
import { useGamification } from "@/hooks/use-gamification";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

// --- Custom Icons with SVG symbols for different pin types ---
const createPinIcon = (color: string, svgPath: string) => {
  return L.divIcon({
    className: "custom-pin",
    html: `
      <div style="
        background-color: ${color}; 
        width: 32px; 
        height: 32px; 
        border-radius: 50%; 
        border: 3px solid white; 
        box-shadow: 0 3px 8px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          ${svgPath}
        </svg>
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const icons = {
  // Wildlife/Animal - Orange with paw print
  animal: createPinIcon("#ea580c", '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="4" cy="8" r="2"/><path d="M12 14c3 0 5 2 5 5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2c0-3 2-5 5-5"/>'),
  // Pollution/Concern - Red with warning triangle
  pollution: createPinIcon("#dc2626", '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.363 3.591l-8.106 13.534A1.914 1.914 0 0 0 3.9 20h16.2a1.914 1.914 0 0 0 1.643-2.875l-8.106-13.534a1.914 1.914 0 0 0-3.274 0z"/>'),
  // Trail/Park - Green with trees
  trail: createPinIcon("#16a34a", '<path d="M12 3v18"/><path d="M5 12l7-4 7 4"/><path d="M5 18l7-4 7 4"/>'),
  // Other - Blue with info icon
  other: createPinIcon("#2563eb", '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  // User location marker
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
    satellite: false,
    climate: false,
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
    // Diverse land locations around the world - cities, natural wonders, and interesting places
    const landLocations: [number, number][] = [
      // North America
      [40.7128, -74.0060], // New York City
      [34.0522, -118.2437], // Los Angeles
      [41.8781, -87.6298], // Chicago
      [37.7749, -122.4194], // San Francisco
      [47.6062, -122.3321], // Seattle
      [25.7617, -80.1918], // Miami
      [44.4280, -110.5885], // Yellowstone
      [36.1070, -112.1130], // Grand Canyon
      [45.4215, -75.6972], // Ottawa
      [49.2827, -123.1207], // Vancouver
      [19.4326, -99.1332], // Mexico City
      [20.6534, -87.0736], // Tulum
      // South America
      [-22.9068, -43.1729], // Rio de Janeiro
      [-34.6037, -58.3816], // Buenos Aires
      [-33.4489, -70.6693], // Santiago
      [-12.0464, -77.0428], // Lima
      [-3.4653, -62.2159], // Amazon Rainforest
      [-13.1631, -72.5450], // Machu Picchu
      [-27.1127, -109.3497], // Easter Island
      // Europe
      [51.5074, -0.1278], // London
      [48.8566, 2.3522], // Paris
      [52.5200, 13.4050], // Berlin
      [41.9028, 12.4964], // Rome
      [40.4168, -3.7038], // Madrid
      [55.7558, 37.6173], // Moscow
      [59.3293, 18.0686], // Stockholm
      [52.3676, 4.9041], // Amsterdam
      [47.4979, 19.0402], // Budapest
      [50.0755, 14.4378], // Prague
      [64.1466, -21.9426], // Reykjavik
      [60.1699, 24.9384], // Helsinki
      [46.2044, 6.1432], // Geneva
      // Asia
      [35.6762, 139.6503], // Tokyo
      [31.2304, 121.4737], // Shanghai
      [22.3193, 114.1694], // Hong Kong
      [1.3521, 103.8198], // Singapore
      [13.7563, 100.5018], // Bangkok
      [28.6139, 77.2090], // New Delhi
      [19.0760, 72.8777], // Mumbai
      [35.3606, 138.7274], // Mt Fuji
      [27.1751, 78.0421], // Agra (Taj Mahal)
      [37.5665, 126.9780], // Seoul
      [25.0330, 121.5654], // Taipei
      [39.9042, 116.4074], // Beijing
      // Africa
      [-33.9249, 18.4241], // Cape Town
      [-1.2921, 36.8219], // Nairobi
      [30.0444, 31.2357], // Cairo
      [-3.3869, 36.6830], // Mt Kilimanjaro
      [15.5007, 32.5599], // Khartoum
      [-19.0154, 29.1549], // Victoria Falls
      [33.9716, -6.8498], // Rabat
      // Oceania
      [-33.8688, 151.2093], // Sydney
      [-37.8136, 144.9631], // Melbourne
      [-41.2865, 174.7762], // Wellington
      [-17.7134, 178.0650], // Fiji
      [-16.5004, -151.7415], // Bora Bora
      [-43.5321, 172.6362], // Christchurch
      [-27.4698, 153.0251], // Brisbane
      // Middle East
      [25.2048, 55.2708], // Dubai
      [24.7136, 46.6753], // Riyadh
      [32.0853, 34.7818], // Tel Aviv
      [41.0082, 28.9784], // Istanbul
      [29.9792, 31.1342], // Giza Pyramids
      // Natural Wonders
      [-8.4095, 115.1889], // Bali
      [27.9881, 86.9250], // Mt Everest base
      [-25.3444, 131.0369], // Uluru
      [9.1021, -79.4023], // Panama Canal
      [36.4566, 25.3772], // Santorini
      [-22.9519, -43.2105], // Sugarloaf Mountain
      [44.4279, 7.3733], // French Alps
      [46.5197, 6.6323], // Swiss Alps
    ];
    
    const random = landLocations[Math.floor(Math.random() * landLocations.length)];
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
            {layers.satellite ? (
              <TileLayer
                attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            ) : (
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            )}
            
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
                  variant={layers.satellite ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setLayers(l => ({...l, satellite: !l.satellite}))}
                  className="rounded-lg h-8 px-3 text-xs"
                  data-testid="button-layer-satellite"
                >
                  Satellite
                </Button>
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
                <Button 
                  variant={layers.climate ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setLayers(l => ({...l, climate: !l.climate}))}
                  className="rounded-lg h-8 px-3 text-xs"
                  data-testid="button-layer-climate"
                >
                  CO2
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
                        variant={layers.satellite ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setLayers(l => ({...l, satellite: !l.satellite}))}
                        className="rounded-lg h-9 justify-start text-sm"
                        data-testid="button-layer-satellite-mobile"
                      >
                        Satellite View
                      </Button>
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
                      <Button 
                        variant={layers.climate ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setLayers(l => ({...l, climate: !l.climate}))}
                        className="rounded-lg h-9 justify-start text-sm"
                        data-testid="button-layer-climate-mobile"
                      >
                        CO2 Emissions
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Surprise Me - icon only on mobile, full text on desktop */}
            <Button 
              onClick={handleRandomLocation}
              variant="secondary"
              className="flex rounded-xl shadow-lg bg-white/95 backdrop-blur hover:bg-white text-foreground font-medium border border-white/50 h-9 md:h-10 px-2 md:px-4"
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
            
            {/* Email Signup - inline on desktop/tablet */}
            <div className="hidden sm:block bg-white/95 backdrop-blur rounded-xl shadow-lg border border-white/50 px-2">
              <EmailSignup 
                variant="inline" 
                lat={selectedLocation?.lat}
                lng={selectedLocation?.lng}
                locationName={analyze.data?.location}
              />
            </div>
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
