import { aqiToScore } from "./waqiQuery";

export interface ScoreResult {
  score: number;
  factors: string[];
  tips: string[];
}

export interface CesData {
  CIscoreP?: number;
  ozoneP?: number;
  pmP?: number;
  dieselP?: number;
  pesticidesP?: number;
  toxrelP?: number;
  trafficP?: number;
  cleanupsP?: number;
  gwthreatsP?: number;
  hazP?: number;
  drinkP?: number;
  iwbP?: number;
  solidwasteP?: number;
  leadP?: number;
  polburdP?: number;
  popcharP?: number;
  ozone?: number;
  pm?: number;
  diesel?: number;
  pesticides?: number;
  toxrel?: number;
  traffic?: number;
  cleanups?: number;
  gwthreats?: number;
  haz?: number;
  drink?: number;
  iwb?: number;
  solidwaste?: number;
  lead?: number;
}

export interface LandCoverData {
  vegetationPercentage: number;
  treePercentage: number;
  builtPercentage: number;
  waterPercentage: number;
  cropPercentage: number;
}

export interface EpaData {
  totalFacilities: number;
  majorFacilities: number;
  facilitiesWithViolations: number;
}

export interface ClimateData {
  totalEmissions: number;
  sources: { emissions: number | null }[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function percentileToScore(percentile: number | undefined): number | null {
  if (percentile === undefined || percentile === null) return null;
  return clamp(100 - percentile, 0, 100);
}

export function computeAirQualityScore(
  aqi: number | null,
  cesData?: CesData | null
): ScoreResult | null {
  const baseScore = aqiToScore(aqi);
  const factors: string[] = [];
  const tips: string[] = [];

  if (baseScore === null && !cesData) return null;

  let finalScore: number;

  if (cesData && cesData.ozoneP !== undefined && cesData.pmP !== undefined) {
    const cesOzoneScore = percentileToScore(cesData.ozoneP)!;
    const cesPmScore = percentileToScore(cesData.pmP)!;
    const cesAvg = (cesOzoneScore + cesPmScore) / 2;

    if (baseScore !== null) {
      finalScore = clamp(baseScore * 0.5 + cesAvg * 0.5, 0, 100);
      factors.push(`Real-time AQI: ${aqi}`);
    } else {
      finalScore = clamp(cesAvg, 0, 100);
    }

    factors.push(`CES Ozone percentile: ${cesData.ozoneP?.toFixed(1)}%`);
    factors.push(`CES PM2.5 percentile: ${cesData.pmP?.toFixed(1)}%`);

    if (cesData.dieselP !== undefined && cesData.dieselP > 70) {
      factors.push(`High diesel PM exposure (${cesData.dieselP.toFixed(1)} percentile)`);
      finalScore = clamp(finalScore - 5, 0, 100);
    }
  } else if (baseScore !== null) {
    finalScore = baseScore;
    factors.push(`Real-time AQI: ${aqi}`);
  } else {
    return null;
  }

  if (finalScore >= 80) {
    tips.push("Air quality is good — outdoor activities are safe");
  } else if (finalScore >= 60) {
    tips.push("Consider limiting prolonged outdoor exertion on high-pollution days");
  } else if (finalScore >= 40) {
    tips.push("Use air quality forecasts to plan outdoor activities");
    tips.push("Consider using an air purifier indoors");
  } else {
    tips.push("Limit outdoor exposure, especially for sensitive groups");
    tips.push("Keep windows closed and use HEPA air purifiers");
  }

  return { score: clamp(finalScore, 0, 100), factors, tips };
}

export function computeGreenSpaceScore(
  landCoverData: LandCoverData | null,
  cesData?: CesData | null
): ScoreResult | null {
  if (!landCoverData || landCoverData.vegetationPercentage === 0 && landCoverData.treePercentage === 0 && landCoverData.builtPercentage === 0) {
    return null;
  }

  const factors: string[] = [];
  const tips: string[] = [];

  const vegScore = Math.min(landCoverData.vegetationPercentage * 1.5, 50);
  const treeBonus = Math.min(landCoverData.treePercentage * 0.8, 25);
  const builtPenalty = Math.min(landCoverData.builtPercentage * 0.5, 30);
  const waterBonus = Math.min(landCoverData.waterPercentage * 0.3, 10);

  let finalScore = clamp(vegScore + treeBonus - builtPenalty + waterBonus + 15, 0, 100);

  factors.push(`Vegetation cover: ${landCoverData.vegetationPercentage.toFixed(1)}%`);
  factors.push(`Tree cover: ${landCoverData.treePercentage.toFixed(1)}%`);
  factors.push(`Built area: ${landCoverData.builtPercentage.toFixed(1)}%`);

  if (landCoverData.waterPercentage > 1) {
    factors.push(`Water bodies: ${landCoverData.waterPercentage.toFixed(1)}%`);
  }

  if (finalScore >= 70) {
    tips.push("Good green space coverage — enjoy local parks and natural areas");
  } else if (finalScore >= 45) {
    tips.push("Moderate green space — seek out community gardens or nearby parks");
    tips.push("Consider supporting local tree-planting initiatives");
  } else {
    tips.push("Limited green space — look for indoor plants to improve air quality at home");
    tips.push("Advocate for urban greening projects in your community");
  }

  return { score: finalScore, factors, tips };
}

export function computePollutionScore(
  epaData: EpaData | null,
  cesData?: CesData | null,
  climateData?: ClimateData | null
): ScoreResult | null {
  const factors: string[] = [];
  const tips: string[] = [];

  if (cesData && cesData.polburdP !== undefined) {
    let finalScore = percentileToScore(cesData.polburdP)!;

    factors.push(`CES pollution burden percentile: ${cesData.polburdP.toFixed(1)}%`);

    if (cesData.cleanupsP !== undefined && cesData.cleanupsP > 50) {
      factors.push(`Cleanup sites percentile: ${cesData.cleanupsP.toFixed(1)}%`);
    }
    if (cesData.hazP !== undefined && cesData.hazP > 50) {
      factors.push(`Hazardous waste percentile: ${cesData.hazP.toFixed(1)}%`);
    }
    if (cesData.toxrelP !== undefined && cesData.toxrelP > 50) {
      factors.push(`Toxic releases percentile: ${cesData.toxrelP.toFixed(1)}%`);
    }
    if (cesData.solidwasteP !== undefined && cesData.solidwasteP > 50) {
      factors.push(`Solid waste percentile: ${cesData.solidwasteP.toFixed(1)}%`);
    }

    if (finalScore >= 70) {
      tips.push("Low pollution burden in this area");
    } else if (finalScore >= 40) {
      tips.push("Moderate pollution burden — check local facility compliance reports");
    } else {
      tips.push("High pollution burden — consider reviewing CalEnviroScreen data for details");
      tips.push("Engage with local environmental justice efforts");
    }

    return { score: clamp(finalScore, 2, 100), factors, tips };
  }

  if (epaData && epaData.totalFacilities > 0) {
    let baseScore = 85;

    const facilityPenalty = Math.min(Math.log10(epaData.totalFacilities + 1) * 12, 30);
    baseScore -= facilityPenalty;

    const majorPenalty = Math.min(epaData.majorFacilities * 3, 20);
    baseScore -= majorPenalty;

    const violationPenalty = Math.min(epaData.facilitiesWithViolations * 2, 25);
    baseScore -= violationPenalty;

    factors.push(`${epaData.totalFacilities} EPA-tracked facilities nearby`);
    if (epaData.majorFacilities > 0) {
      factors.push(`${epaData.majorFacilities} major facilities`);
    }
    if (epaData.facilitiesWithViolations > 0) {
      factors.push(`${epaData.facilitiesWithViolations} facilities with violations`);
    }

    if (climateData && climateData.totalEmissions > 0) {
      const emissionsPenalty = Math.min(climateData.totalEmissions / 10_000_000, 10);
      baseScore -= emissionsPenalty;
      factors.push(`Nearby emissions: ${formatEmissionsShort(climateData.totalEmissions)} tonnes CO2e/yr`);
    }

    const finalEpaScore = clamp(baseScore, 5, 100);

    if (finalEpaScore >= 70) {
      tips.push("Relatively low industrial pollution presence");
    } else if (finalEpaScore >= 40) {
      tips.push("Moderate industrial presence — monitor facility compliance through EPA ECHO");
    } else {
      tips.push("Significant industrial pollution — check EPA ECHO for detailed facility reports");
      tips.push("Consider attending public comment periods for facility permits");
    }

    return { score: finalEpaScore, factors, tips };
  }

  if (climateData && climateData.totalEmissions > 0) {
    let baseScore = 75;
    const emissionsPenalty = Math.min(climateData.totalEmissions / 500_000, 40);
    baseScore -= emissionsPenalty;

    factors.push(`Regional emissions: ${formatEmissionsShort(climateData.totalEmissions)} tonnes CO2e/yr`);
    factors.push(`${climateData.sources.length} emission sources tracked nearby`);

    if (baseScore >= 60) {
      tips.push("Moderate emission levels in the region");
    } else {
      tips.push("High regional emissions — consider supporting clean energy initiatives");
    }

    return { score: clamp(baseScore, 0, 100), factors, tips };
  }

  return null;
}

export function computeWaterQualityScore(
  cesData?: CesData | null
): ScoreResult | null {
  if (!cesData) return null;

  const drinkScore = percentileToScore(cesData.drinkP);
  const gwScore = percentileToScore(cesData.gwthreatsP);
  const iwbScore = percentileToScore(cesData.iwbP);

  const validScores = [drinkScore, gwScore, iwbScore].filter(
    (s): s is number => s !== null
  );

  if (validScores.length === 0) return null;

  const factors: string[] = [];
  const tips: string[] = [];

  const avgScore = validScores.reduce((a, b) => a + b, 0) / validScores.length;
  const finalScore = clamp(avgScore, 0, 100);

  if (cesData.drinkP !== undefined) {
    factors.push(`Drinking water contaminants percentile: ${cesData.drinkP.toFixed(1)}%`);
  }
  if (cesData.gwthreatsP !== undefined) {
    factors.push(`Groundwater threats percentile: ${cesData.gwthreatsP.toFixed(1)}%`);
  }
  if (cesData.iwbP !== undefined) {
    factors.push(`Impaired water bodies percentile: ${cesData.iwbP.toFixed(1)}%`);
  }

  if (finalScore >= 70) {
    tips.push("Water quality indicators are relatively good for this area");
  } else if (finalScore >= 40) {
    tips.push("Some water quality concerns — consider checking local water quality reports");
    tips.push("A home water filter may be beneficial");
  } else {
    tips.push("Significant water quality concerns in this census tract");
    tips.push("Use a certified water filter for drinking water");
    tips.push("Review your local Consumer Confidence Report for details");
  }

  return { score: finalScore, factors, tips };
}

export interface ClimateEmissionsInput {
  totalEmissions: number;
  sourcesCount: number;
  sectorBreakdown: Record<string, { count: number; emissions: number }>;
  topSources: { name: string; sector: string; emissions: number | null }[];
  radiusKm: number;
}

export function computeClimateEmissionsScore(
  climateInput: ClimateEmissionsInput | null,
  cesData?: CesData | null
): ScoreResult | null {
  if (!climateInput || (climateInput.sourcesCount === 0 && climateInput.totalEmissions === 0)) {
    return null;
  }

  const factors: string[] = [];
  const tips: string[] = [];

  const emissionsMt = climateInput.totalEmissions / 1_000_000;

  let finalScore: number;
  if (emissionsMt <= 0.01) {
    finalScore = 95;
  } else if (emissionsMt <= 0.1) {
    finalScore = 85;
  } else if (emissionsMt <= 1) {
    finalScore = 75;
  } else if (emissionsMt <= 10) {
    finalScore = 65 - Math.min((emissionsMt - 1) * 2.5, 20);
  } else if (emissionsMt <= 100) {
    finalScore = 45 - Math.min((emissionsMt - 10) * 0.3, 20);
  } else {
    finalScore = 25 - Math.min(Math.log10(emissionsMt / 100) * 10, 20);
  }

  const sectorCount = Object.keys(climateInput.sectorBreakdown).length;
  if (sectorCount > 10) {
    finalScore -= Math.min((sectorCount - 10) * 0.5, 5);
  }

  factors.push(`${climateInput.sourcesCount} emission sources within ${climateInput.radiusKm}km`);
  factors.push(`Total: ${formatEmissionsMt(climateInput.totalEmissions)} CO2e/year`);

  const sortedSectors = Object.entries(climateInput.sectorBreakdown)
    .sort((a, b) => b[1].emissions - a[1].emissions)
    .slice(0, 3);

  for (const [sector, data] of sortedSectors) {
    const pct = climateInput.totalEmissions > 0
      ? ((data.emissions / climateInput.totalEmissions) * 100).toFixed(0)
      : "0";
    factors.push(`${formatSectorName(sector)}: ${formatEmissionsMt(data.emissions)} (${pct}%)`);
  }

  if (climateInput.topSources.length > 0) {
    const top = climateInput.topSources[0];
    if (top.emissions && top.emissions > 1_000_000) {
      factors.push(`Largest source: ${top.name} (${formatEmissionsMt(top.emissions)})`);
    }
  }

  if (cesData && cesData.trafficP !== undefined) {
    const trafficScore = percentileToScore(cesData.trafficP)!;
    finalScore = clamp(finalScore * 0.7 + trafficScore * 0.3, 0, 100);
    factors.push(`CES traffic density: ${cesData.trafficP.toFixed(0)}th percentile`);
  }

  finalScore = clamp(finalScore, 3, 100);

  if (finalScore >= 75) {
    tips.push("Low local emissions — this area has a relatively small carbon footprint");
  } else if (finalScore >= 50) {
    tips.push("Moderate emissions — consider supporting local clean energy initiatives");
    tips.push("Check if your energy provider offers renewable options");
  } else if (finalScore >= 30) {
    tips.push("Significant industrial emissions nearby — follow local air quality advisories");
    tips.push("Support community efforts to transition to cleaner energy sources");
  } else {
    tips.push("Heavy industrial emissions in this area — stay informed about local environmental health");
    tips.push("Engage with local climate action groups and public comment processes");
  }

  return { score: clamp(finalScore, 3, 100), factors, tips };
}

function formatSectorName(sector: string): string {
  const labels: Record<string, string> = {
    "electricity-generation": "Power generation",
    "road-transportation": "Road transport",
    "oil-and-gas-refining": "Oil & gas refining",
    "oil-and-gas-production": "Oil & gas production",
    "oil-and-gas-transport": "Oil & gas transport",
    "residential-onsite-fuel-usage": "Residential fuel",
    "non-residential-onsite-fuel-usage": "Commercial fuel",
    "international-aviation": "International aviation",
    "domestic-aviation": "Domestic aviation",
    "international-shipping": "International shipping",
    "domestic-shipping": "Domestic shipping",
    "iron-and-steel": "Iron & steel",
    "coal-mining": "Coal mining",
    "forest-land-fires": "Forest fires",
    "forest-land-clearing": "Deforestation",
    "shrubgrass-fires": "Brush fires",
    "enteric-fermentation-cattle-pasture": "Livestock (pasture)",
    "enteric-fermentation-cattle-operation": "Livestock (feedlot)",
    "solid-waste-disposal": "Solid waste",
    "domestic-wastewater-treatment-and-discharge": "Wastewater",
    "food-beverage-tobacco": "Food & beverage",
    "cement": "Cement",
    "chemicals": "Chemicals",
    "other-chemicals": "Chemicals",
    "petrochemical-steam-cracking": "Petrochemicals",
    "rice-cultivation": "Rice cultivation",
    "synthetic-fertilizer-application": "Fertilizers",
  };
  return labels[sector] || sector.charAt(0).toUpperCase() + sector.slice(1).replace(/-/g, " ");
}

function formatEmissionsMt(tonnes: number): string {
  if (tonnes >= 1_000_000_000) return `${(tonnes / 1_000_000_000).toFixed(1)}B tonnes`;
  if (tonnes >= 1_000_000) return `${(tonnes / 1_000_000).toFixed(1)}M tonnes`;
  if (tonnes >= 1_000) return `${(tonnes / 1_000).toFixed(1)}K tonnes`;
  return `${tonnes.toFixed(0)} tonnes`;
}

function formatEmissionsShort(tonnes: number): string {
  if (tonnes >= 1_000_000_000) return `${(tonnes / 1_000_000_000).toFixed(1)}B`;
  if (tonnes >= 1_000_000) return `${(tonnes / 1_000_000).toFixed(1)}M`;
  if (tonnes >= 1_000) return `${(tonnes / 1_000).toFixed(1)}K`;
  return tonnes.toFixed(0);
}
