interface ClimateTraceSource {
  id: number;
  name: string;
  sector: string;
  subsector: string;
  lat: number;
  lng: number;
  emissions: number | null;
  emissionsUnit: string;
  country: string;
}

interface ClimateTraceResult {
  sources: ClimateTraceSource[];
  totalEmissions: number;
  sectorBreakdown: Record<string, { count: number; emissions: number }>;
}

const SECTOR_LABELS: Record<string, string> = {
  "power": "Power Generation",
  "transportation": "Transportation",
  "buildings": "Buildings",
  "fossil-fuel-operations": "Fossil Fuel Operations",
  "manufacturing": "Manufacturing",
  "mineral-extraction": "Mining & Extraction",
  "agriculture": "Agriculture",
  "waste": "Waste Management",
  "forestry-and-land-use": "Forestry & Land Use",
};

export async function queryClimateTraceSources(
  lat: number,
  lng: number,
  radiusKm: number = 50
): Promise<ClimateTraceResult> {
  try {
    const countryCode = await getCountryCode(lat, lng);
    if (!countryCode) {
      console.log("Climate TRACE: Could not determine country code");
      return emptyResult();
    }

    const bounds = calculateBounds(lat, lng, radiusKm);
    
    const params = new URLSearchParams({
      countries: countryCode,
      year: "2023",
      limit: "100",
    });

    const url = `https://api.climatetrace.org/v6/assets?${params.toString()}`;
    console.log("Climate TRACE query for:", countryCode, "near", lat, lng);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Verde/1.0 (environmental mapping app)',
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.warn("Climate TRACE API error:", response.status);
      return emptyResult();
    }

    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      console.log("Climate TRACE: No sources found");
      return emptyResult();
    }

    const sources: ClimateTraceSource[] = [];
    const sectorBreakdown: Record<string, { count: number; emissions: number }> = {};
    let totalEmissions = 0;

    for (const feature of data) {
      if (feature.geometry?.type !== "Point" || !feature.geometry.coordinates) {
        continue;
      }

      const [sourceLng, sourceLat] = feature.geometry.coordinates;
      const distance = calculateDistance(lat, lng, sourceLat, sourceLng);
      
      if (distance > radiusKm) {
        continue;
      }

      const props = feature.properties || {};
      const sector = props.sector || "other";
      const emissions = props.emissions_quantity || null;

      sources.push({
        id: feature.id,
        name: props.source_name || props.name || "Unknown Source",
        sector: sector,
        subsector: props.subsector || "",
        lat: sourceLat,
        lng: sourceLng,
        emissions: emissions,
        emissionsUnit: props.emissions_quantity_units || "tonnes CO2e",
        country: countryCode,
      });

      if (!sectorBreakdown[sector]) {
        sectorBreakdown[sector] = { count: 0, emissions: 0 };
      }
      sectorBreakdown[sector].count++;
      if (emissions) {
        sectorBreakdown[sector].emissions += emissions;
        totalEmissions += emissions;
      }
    }

    sources.sort((a, b) => (b.emissions || 0) - (a.emissions || 0));

    console.log(`Climate TRACE: Found ${sources.length} sources within ${radiusKm}km`);
    
    return {
      sources: sources.slice(0, 20),
      totalEmissions,
      sectorBreakdown,
    };
  } catch (error) {
    console.error("Climate TRACE query failed:", error);
    return emptyResult();
  }
}

async function getCountryCode(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=3`,
      {
        headers: {
          'User-Agent': 'Verde/1.0 (environmental mapping app)',
        }
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const countryCode = data.address?.country_code?.toUpperCase();
    
    if (countryCode && countryCode.length === 2) {
      return iso2ToIso3(countryCode);
    }
    return null;
  } catch {
    return null;
  }
}

function iso2ToIso3(iso2: string): string {
  const mapping: Record<string, string> = {
    "US": "USA", "CA": "CAN", "MX": "MEX", "GB": "GBR", "FR": "FRA",
    "DE": "DEU", "IT": "ITA", "ES": "ESP", "JP": "JPN", "CN": "CHN",
    "IN": "IND", "BR": "BRA", "AU": "AUS", "RU": "RUS", "KR": "KOR",
    "ID": "IDN", "TR": "TUR", "SA": "SAU", "ZA": "ZAF", "AR": "ARG",
    "PL": "POL", "NL": "NLD", "BE": "BEL", "SE": "SWE", "CH": "CHE",
    "AT": "AUT", "NO": "NOR", "DK": "DNK", "FI": "FIN", "IE": "IRL",
    "PT": "PRT", "GR": "GRC", "CZ": "CZE", "HU": "HUN", "IL": "ISR",
    "AE": "ARE", "SG": "SGP", "MY": "MYS", "TH": "THA", "VN": "VNM",
    "PH": "PHL", "EG": "EGY", "NG": "NGA", "KE": "KEN", "CL": "CHL",
    "CO": "COL", "PE": "PER", "VE": "VEN", "NZ": "NZL", "PK": "PAK",
    "BD": "BGD", "UA": "UKR", "RO": "ROU", "CU": "CUB", "EC": "ECU",
  };
  return mapping[iso2] || iso2;
}

function calculateBounds(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function emptyResult(): ClimateTraceResult {
  return {
    sources: [],
    totalEmissions: 0,
    sectorBreakdown: {},
  };
}

export function formatEmissions(tonnes: number): string {
  if (tonnes >= 1_000_000) {
    return `${(tonnes / 1_000_000).toFixed(1)}M`;
  } else if (tonnes >= 1_000) {
    return `${(tonnes / 1_000).toFixed(1)}K`;
  }
  return tonnes.toFixed(0);
}

export function getSectorLabel(sector: string): string {
  return SECTOR_LABELS[sector] || sector.charAt(0).toUpperCase() + sector.slice(1).replace(/-/g, ' ');
}
