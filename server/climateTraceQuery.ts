export interface ClimateTraceSource {
  id: string | number;
  name: string;
  sector: string;
  subsector: string;
  lat: number | null;
  lng: number | null;
  emissions: number | null;
  emissionsFormatted?: string;
  emissionsUnit: string;
  country: string;
}

export interface ClimateTraceResult {
  sources: ClimateTraceSource[];
  totalEmissions: number;
  sectorBreakdown: Record<string, { count: number; emissions: number }>;
}

const SECTOR_LABELS: Record<string, string> = {
  "power": "Power",
  "electricity-generation": "Power",
  "transportation": "Transport",
  "road-transportation": "Road Transport",
  "aviation": "Aviation",
  "shipping": "Shipping",
  "buildings": "Buildings",
  "fossil-fuel-operations": "Fossil Fuels",
  "oil-and-gas-production-and-transport": "Oil & Gas",
  "oil-and-gas-production": "Oil & Gas",
  "oil-and-gas-refining": "Refining",
  "coal-mining": "Coal Mining",
  "manufacturing": "Manufacturing",
  "steel": "Steel",
  "cement": "Cement",
  "aluminum": "Aluminum",
  "chemicals": "Chemicals",
  "mineral-extraction": "Mining",
  "agriculture": "Agriculture",
  "livestock": "Livestock",
  "cropland": "Cropland",
  "waste": "Waste",
  "solid-waste": "Solid Waste",
  "wastewater": "Wastewater",
  "forestry-and-land-use": "Forestry",
  "forest-land-fires": "Forest Fires",
  "other": "Other",
};

export async function queryClimateTraceSources(
  lat: number,
  lng: number,
  radiusKm: number = 100
): Promise<ClimateTraceResult> {
  try {
    const countryCode = await getCountryCode(lat, lng);
    if (!countryCode) {
      console.log("Climate TRACE: Could not determine country code for", lat, lng);
      return emptyResult();
    }

    const iso3 = iso2ToIso3(countryCode);
    if (iso3.length !== 3) {
      console.log("Climate TRACE: Invalid ISO3 code:", iso3, "from", countryCode);
      return emptyResult();
    }

    const params = new URLSearchParams({
      countries: iso3,
      year: "2022",
      limit: "500",
    });

    const url = `https://api.climatetrace.org/v6/assets?${params.toString()}`;
    console.log("Climate TRACE query:", url);
    
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
    
    let assets: any[] = [];
    if (data && Array.isArray(data.assets)) {
      assets = data.assets;
    } else if (Array.isArray(data)) {
      assets = data;
    } else {
      console.log("Climate TRACE: Unexpected response format, keys:", Object.keys(data || {}));
      return emptyResult();
    }

    if (assets.length === 0) {
      console.log("Climate TRACE: No assets found for", iso3);
      return emptyResult();
    }

    console.log("Climate TRACE: Processing", assets.length, "assets for", iso3);

    const sources: ClimateTraceSource[] = [];
    const sectorBreakdown: Record<string, { count: number; emissions: number }> = {};
    let totalEmissions = 0;

    for (const asset of assets) {
      const sector = asset.Sector || asset.sector || "other";
      
      let emissions: number | null = null;
      if (asset.EmissionsSummary && Array.isArray(asset.EmissionsSummary)) {
        const co2Summary = asset.EmissionsSummary.find(
          (s: any) => s.Gas === "co2e_100yr" || s.Gas === "co2e" || s.Gas === "co2"
        );
        if (co2Summary && co2Summary.EmissionsQuantity) {
          emissions = co2Summary.EmissionsQuantity;
        }
      }
      
      let assetLat: number | null = null;
      let assetLng: number | null = null;
      
      if (asset.geometry && asset.geometry.coordinates) {
        assetLng = asset.geometry.coordinates[0];
        assetLat = asset.geometry.coordinates[1];
      } else if (asset.Lat !== undefined && asset.Lon !== undefined) {
        assetLat = asset.Lat;
        assetLng = asset.Lon;
      } else if (asset.lat !== undefined && asset.lon !== undefined) {
        assetLat = asset.lat;
        assetLng = asset.lon;
      } else if (asset.latitude !== undefined && asset.longitude !== undefined) {
        assetLat = asset.latitude;
        assetLng = asset.longitude;
      }
      
      const props = asset.properties || asset;

      sources.push({
        id: props.source_id || props.Id || asset.id || Math.random().toString(36).slice(2),
        name: props.source_name || props.Name || asset.name || "Unknown Source",
        sector: props.sector || sector,
        subsector: props.subsector || props.AssetType || "",
        lat: assetLat,
        lng: assetLng,
        emissions: emissions,
        emissionsFormatted: emissions ? formatEmissions(emissions) : undefined,
        emissionsUnit: "tonnes CO2e/yr",
        country: iso3,
      });

      if (!sectorBreakdown[sector]) {
        sectorBreakdown[sector] = { count: 0, emissions: 0 };
      }
      sectorBreakdown[sector].count++;
      if (emissions && typeof emissions === 'number') {
        sectorBreakdown[sector].emissions += emissions;
        totalEmissions += emissions;
      }
    }

    sources.sort((a, b) => (b.emissions || 0) - (a.emissions || 0));

    console.log(`Climate TRACE: Found ${sources.length} sources in ${iso3}, total emissions: ${formatEmissions(totalEmissions)}`);
    
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
      return countryCode;
    }
    return null;
  } catch {
    return null;
  }
}

function iso2ToIso3(iso2: string): string {
  const mapping: Record<string, string> = {
    "AF": "AFG", "AL": "ALB", "DZ": "DZA", "AS": "ASM", "AD": "AND",
    "AO": "AGO", "AI": "AIA", "AQ": "ATA", "AG": "ATG", "AR": "ARG",
    "AM": "ARM", "AW": "ABW", "AU": "AUS", "AT": "AUT", "AZ": "AZE",
    "BS": "BHS", "BH": "BHR", "BD": "BGD", "BB": "BRB", "BY": "BLR",
    "BE": "BEL", "BZ": "BLZ", "BJ": "BEN", "BM": "BMU", "BT": "BTN",
    "BO": "BOL", "BA": "BIH", "BW": "BWA", "BR": "BRA", "BN": "BRN",
    "BG": "BGR", "BF": "BFA", "BI": "BDI", "CV": "CPV", "KH": "KHM",
    "CM": "CMR", "CA": "CAN", "KY": "CYM", "CF": "CAF", "TD": "TCD",
    "CL": "CHL", "CN": "CHN", "CO": "COL", "KM": "COM", "CG": "COG",
    "CD": "COD", "CR": "CRI", "CI": "CIV", "HR": "HRV", "CU": "CUB",
    "CY": "CYP", "CZ": "CZE", "DK": "DNK", "DJ": "DJI", "DM": "DMA",
    "DO": "DOM", "EC": "ECU", "EG": "EGY", "SV": "SLV", "GQ": "GNQ",
    "ER": "ERI", "EE": "EST", "SZ": "SWZ", "ET": "ETH", "FJ": "FJI",
    "FI": "FIN", "FR": "FRA", "GA": "GAB", "GM": "GMB", "GE": "GEO",
    "DE": "DEU", "GH": "GHA", "GR": "GRC", "GL": "GRL", "GD": "GRD",
    "GT": "GTM", "GN": "GIN", "GW": "GNB", "GY": "GUY", "HT": "HTI",
    "HN": "HND", "HK": "HKG", "HU": "HUN", "IS": "ISL", "IN": "IND",
    "ID": "IDN", "IR": "IRN", "IQ": "IRQ", "IE": "IRL", "IL": "ISR",
    "IT": "ITA", "JM": "JAM", "JP": "JPN", "JO": "JOR", "KZ": "KAZ",
    "KE": "KEN", "KI": "KIR", "KP": "PRK", "KR": "KOR", "KW": "KWT",
    "KG": "KGZ", "LA": "LAO", "LV": "LVA", "LB": "LBN", "LS": "LSO",
    "LR": "LBR", "LY": "LBY", "LI": "LIE", "LT": "LTU", "LU": "LUX",
    "MO": "MAC", "MG": "MDG", "MW": "MWI", "MY": "MYS", "MV": "MDV",
    "ML": "MLI", "MT": "MLT", "MH": "MHL", "MR": "MRT", "MU": "MUS",
    "MX": "MEX", "FM": "FSM", "MD": "MDA", "MC": "MCO", "MN": "MNG",
    "ME": "MNE", "MA": "MAR", "MZ": "MOZ", "MM": "MMR", "NA": "NAM",
    "NR": "NRU", "NP": "NPL", "NL": "NLD", "NZ": "NZL", "NI": "NIC",
    "NE": "NER", "NG": "NGA", "MK": "MKD", "NO": "NOR", "OM": "OMN",
    "PK": "PAK", "PW": "PLW", "PS": "PSE", "PA": "PAN", "PG": "PNG",
    "PY": "PRY", "PE": "PER", "PH": "PHL", "PL": "POL", "PT": "PRT",
    "PR": "PRI", "QA": "QAT", "RO": "ROU", "RU": "RUS", "RW": "RWA",
    "KN": "KNA", "LC": "LCA", "VC": "VCT", "WS": "WSM", "SM": "SMR",
    "ST": "STP", "SA": "SAU", "SN": "SEN", "RS": "SRB", "SC": "SYC",
    "SL": "SLE", "SG": "SGP", "SK": "SVK", "SI": "SVN", "SB": "SLB",
    "SO": "SOM", "ZA": "ZAF", "SS": "SSD", "ES": "ESP", "LK": "LKA",
    "SD": "SDN", "SR": "SUR", "SE": "SWE", "CH": "CHE", "SY": "SYR",
    "TW": "TWN", "TJ": "TJK", "TZ": "TZA", "TH": "THA", "TL": "TLS",
    "TG": "TGO", "TO": "TON", "TT": "TTO", "TN": "TUN", "TR": "TUR",
    "TM": "TKM", "TV": "TUV", "UG": "UGA", "UA": "UKR", "AE": "ARE",
    "GB": "GBR", "US": "USA", "UY": "URY", "UZ": "UZB", "VU": "VUT",
    "VE": "VEN", "VN": "VNM", "YE": "YEM", "ZM": "ZMB", "ZW": "ZWE",
  };
  return mapping[iso2] || iso2;
}

function emptyResult(): ClimateTraceResult {
  return {
    sources: [],
    totalEmissions: 0,
    sectorBreakdown: {},
  };
}

export function formatEmissions(tonnes: number): string {
  if (tonnes >= 1_000_000_000) {
    return `${(tonnes / 1_000_000_000).toFixed(1)}B`;
  } else if (tonnes >= 1_000_000) {
    return `${(tonnes / 1_000_000).toFixed(1)}M`;
  } else if (tonnes >= 1_000) {
    return `${(tonnes / 1_000).toFixed(1)}K`;
  }
  return tonnes.toFixed(0);
}

export function getSectorLabel(sector: string): string {
  return SECTOR_LABELS[sector] || sector.charAt(0).toUpperCase() + sector.slice(1).replace(/-/g, ' ');
}

// Top emitting countries for global data display
const TOP_EMITTING_COUNTRIES = [
  'CHN', 'USA', 'IND', 'RUS', 'JPN', 'DEU', 'IRN', 'SAU', 'IDN', 'KOR',
  'CAN', 'MEX', 'BRA', 'ZAF', 'TUR', 'AUS', 'GBR', 'POL', 'THA', 'ITA',
  'FRA', 'VNM', 'EGY', 'MYS', 'ARE', 'PAK', 'TWN', 'ARG', 'NGA', 'KAZ'
];

export async function queryClimateTraceSourcesForMap(
  lat: number,
  lng: number,
  radiusKm: number = 100
): Promise<ClimateTraceSource[]> {
  try {
    // Query multiple top-emitting countries in parallel for global coverage
    const countriesToQuery = TOP_EMITTING_COUNTRIES.slice(0, 10); // Query top 10 emitters
    
    console.log("Climate TRACE Map: Querying global emissions from", countriesToQuery.length, "countries");
    
    const fetchPromises = countriesToQuery.map(async (iso3) => {
      try {
        const params = new URLSearchParams({
          countries: iso3,
          year: "2022",
          limit: "50", // Get top 50 from each country
        });
        
        const url = `https://api.climatetrace.org/v6/assets?${params.toString()}`;
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Verde/1.0 (environmental mapping app)',
            'Accept': 'application/json',
          }
        });
        
        if (!response.ok) return [];
        
        const data = await response.json();
        return data.assets || data || [];
      } catch {
        return [];
      }
    });
    
    const allResults = await Promise.all(fetchPromises);
    let features: any[] = allResults.flat();

    const sources: ClimateTraceSource[] = [];
    let coordsFound = 0;
    let coordsMissing = 0;
    
    for (const feature of features) {
      let assetLat: number | null = null;
      let assetLng: number | null = null;
      
      // Try multiple coordinate formats (API uses Centroid.Geometry as [lng, lat] array)
      if (feature.Centroid && Array.isArray(feature.Centroid.Geometry)) {
        assetLng = feature.Centroid.Geometry[0];
        assetLat = feature.Centroid.Geometry[1];
      } else if (feature.Centroid && feature.Centroid.coordinates) {
        assetLng = feature.Centroid.coordinates[0];
        assetLat = feature.Centroid.coordinates[1];
      } else if (feature.Geometry && feature.Geometry.coordinates) {
        assetLng = feature.Geometry.coordinates[0];
        assetLat = feature.Geometry.coordinates[1];
      } else if (feature.geometry && feature.geometry.coordinates) {
        assetLng = feature.geometry.coordinates[0];
        assetLat = feature.geometry.coordinates[1];
      } else if (feature.Lat !== undefined && feature.Lon !== undefined) {
        assetLat = feature.Lat;
        assetLng = feature.Lon;
      } else if (feature.lat !== undefined && feature.lon !== undefined) {
        assetLat = feature.lat;
        assetLng = feature.lon;
      } else if (feature.latitude !== undefined && feature.longitude !== undefined) {
        assetLat = feature.latitude;
        assetLng = feature.longitude;
      }
      
      if (assetLat === null || assetLng === null) {
        coordsMissing++;
        continue;
      }
      coordsFound++;
      
      // No distance filtering - show global data
      let emissions: number | null = null;
      if (feature.EmissionsSummary && Array.isArray(feature.EmissionsSummary)) {
        const co2Summary = feature.EmissionsSummary.find(
          (s: any) => s.Gas === "co2e_100yr" || s.Gas === "co2e" || s.Gas === "co2"
        );
        if (co2Summary && co2Summary.EmissionsQuantity) {
          emissions = co2Summary.EmissionsQuantity;
        }
      }

      sources.push({
        id: feature.Id || feature.id || Math.random().toString(36).slice(2),
        name: feature.Name || feature.name || "Unknown Source",
        sector: feature.Sector || feature.sector || "other",
        subsector: feature.AssetType || feature.subsector || "",
        lat: assetLat,
        lng: assetLng,
        emissions: emissions,
        emissionsFormatted: emissions ? formatEmissions(emissions) : undefined,
        emissionsUnit: "tonnes CO2e/yr",
        country: feature.Country || "Unknown",
      });
    }

    sources.sort((a, b) => (b.emissions || 0) - (a.emissions || 0));
    
    console.log(`Climate TRACE Map: ${features.length} features, ${coordsFound} with coords, ${coordsMissing} missing coords, ${sources.length} global sources`);
    
    // Log sample feature for debugging if no coordinates found
    if (coordsMissing > 0 && coordsFound === 0 && features.length > 0) {
      console.log("Climate TRACE Map: Sample feature keys:", Object.keys(features[0]));
      if (features[0].Centroid) {
        console.log("Climate TRACE Map: Centroid structure:", JSON.stringify(features[0].Centroid));
      }
    }
    
    // Return top 200 emitters globally
    return sources.slice(0, 200);
  } catch (error) {
    console.error("Climate TRACE Map query failed:", error);
    return [];
  }
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
