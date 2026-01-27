interface EpaFacility {
  name: string;
  type: string;
  majorFlag: boolean;
  hasViolation: boolean;
  distance: number;
}

interface EpaQueryResult {
  totalFacilities: number;
  majorFacilities: number;
  facilitiesWithViolations: number;
  nearbyFacilities: EpaFacility[];
  industryBreakdown: Record<string, number>;
}

const NAICS_LABELS: Record<string, string> = {
  "324": "Petroleum/Refinery",
  "562": "Waste Management",
  "325": "Chemical Manufacturing",
  "221": "Utilities/Power",
  "331": "Metal Manufacturing",
  "332": "Fabricated Metal",
  "336": "Transportation Equipment",
  "322": "Paper Manufacturing",
  "327": "Nonmetallic Mineral",
  "333": "Machinery Manufacturing",
};

// Low-impact NAICS prefixes to exclude (common urban facilities with minimal environmental impact)
const LOW_IMPACT_NAICS: string[] = [
  "44", "45",   // Retail trade (gas stations, auto dealers, stores)
  "72",         // Accommodation and food services (restaurants, hotels)
  "81",         // Other services (dry cleaners, auto repair, laundromats)
  "61",         // Educational services (schools)
  "62",         // Health care (hospitals, clinics - already regulated)
  "52", "53",   // Finance, insurance, real estate
  "54",         // Professional services (offices)
  "51",         // Information (data centers, offices)
  "71",         // Arts, entertainment, recreation
  "48", "49",   // Transportation and warehousing (except major terminals)
  "23",         // Construction (temporary sites)
];

function getNaicsLabel(naics: string | null): string {
  if (!naics) return "Other";
  const prefix = naics.substring(0, 3);
  return NAICS_LABELS[prefix] || "Industrial";
}

function isLowImpactFacility(naicsCode: string | null, isMajor: boolean, hasViolation: boolean): boolean {
  // Always include major facilities and those with violations
  if (isMajor || hasViolation) return false;
  
  // If no NAICS code, include it (could be significant)
  if (!naicsCode) return false;
  
  // Check if NAICS prefix matches low-impact categories
  const prefix2 = naicsCode.substring(0, 2);
  return LOW_IMPACT_NAICS.includes(prefix2);
}

export async function queryNearbyEpaFacilities(
  lat: number,
  lng: number,
  radiusMiles: number = 10
): Promise<EpaQueryResult> {
  const radiusMeters = radiusMiles * 1609.34;
  
  const baseUrl = "https://echogeo.epa.gov/arcgis/rest/services/ECHO/Facilities/MapServer/0/query";
  
  // Use URLSearchParams for proper encoding
  // Field names verified from EPA ECHO MapServer schema
  const params = new URLSearchParams({
    geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPoint",
    spatialRel: "esriSpatialRelIntersects",
    distance: radiusMeters.toString(),
    units: "esriSRUnit_Meter",
    outFields: "FAC_NAME,FAC_NAICS_CODES,FAC_MAJOR_FLAG,FAC_CURR_SNC_FLG,FAC_QTRS_IN_NC",
    where: "1=1",
    returnGeometry: "false",  // Must be false - API rejects large geometry responses
    f: "json",
  });

  try {
    const url = `${baseUrl}?${params.toString()}`;
    console.log("EPA query for:", lat, lng, "radius:", radiusMiles, "mi");
    
    // Add 15 second timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error("EPA API error:", response.status);
      return emptyResult();
    }

    const data = await response.json();
    console.log("EPA response:", data.features?.length || 0, "features", data.error ? `Error: ${JSON.stringify(data.error)}` : "");
    
    if (!data.features || data.features.length === 0) {
      return emptyResult();
    }

    const facilities: EpaFacility[] = [];
    const industryBreakdown: Record<string, number> = {};
    let majorCount = 0;
    let violationCount = 0;

    let skippedLowImpact = 0;
    
    for (const feature of data.features) {
      const attrs = feature.attributes;
      
      const isMajor = attrs.FAC_MAJOR_FLAG === "Y";
      const hasViolation = 
        attrs.FAC_CURR_SNC_FLG === "Y" ||
        (attrs.FAC_QTRS_IN_NC && attrs.FAC_QTRS_IN_NC > 0);
      
      // FAC_NAICS_CODES can be a comma-separated list, use first code
      const naicsCode = attrs.FAC_NAICS_CODES?.split(",")[0]?.trim() || null;
      
      // Skip low-impact facilities (unless they're major or have violations)
      if (isLowImpactFacility(naicsCode, isMajor, hasViolation)) {
        skippedLowImpact++;
        continue;
      }
      
      if (isMajor) majorCount++;
      if (hasViolation) violationCount++;

      const industryType = getNaicsLabel(naicsCode);
      industryBreakdown[industryType] = (industryBreakdown[industryType] || 0) + 1;

      facilities.push({
        name: attrs.FAC_NAME || "Unknown Facility",
        type: industryType,
        majorFlag: isMajor,
        hasViolation,
        distance: radiusMiles, // All facilities are within radius
      });
    }
    
    if (skippedLowImpact > 0) {
      console.log(`Filtered out ${skippedLowImpact} low-impact facilities`);
    }

    // Sort by violation status and major flag (most concerning first)
    facilities.sort((a, b) => {
      if (a.hasViolation !== b.hasViolation) return a.hasViolation ? -1 : 1;
      if (a.majorFlag !== b.majorFlag) return a.majorFlag ? -1 : 1;
      return 0;
    });

    return {
      totalFacilities: facilities.length,
      majorFacilities: majorCount,
      facilitiesWithViolations: violationCount,
      nearbyFacilities: facilities.slice(0, 10),
      industryBreakdown,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log("EPA query timed out after 15 seconds");
    } else {
      console.error("EPA query failed:", error);
    }
    return emptyResult();
  }
}

function emptyResult(): EpaQueryResult {
  return {
    totalFacilities: 0,
    majorFacilities: 0,
    facilitiesWithViolations: 0,
    nearbyFacilities: [],
    industryBreakdown: {},
  };
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
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
