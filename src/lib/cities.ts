export type Region = "us" | "europe" | "africa";
export type RegionFilter = Region | "all";

export interface City {
  id: string;
  name: string;
  country: string;
  region: Region;
  lat: number;
  lng: number;
  /** Passed to filter.location.query; Qloo fuzzy-matches locality names. */
  query: string;
}

export const REGION_LABELS: Record<RegionFilter, string> = {
  all: "Worldwide",
  us: "United States",
  europe: "UK & Europe",
  africa: "Africa",
};

const c = (
  id: string,
  name: string,
  country: string,
  region: Region,
  lat: number,
  lng: number,
  query = name,
): City => ({ id, name, country, region, lat, lng, query });

export const CITIES: City[] = [
  // United States
  c("nyc", "New York", "US", "us", 40.7128, -74.006, "New York City"),
  c("lax", "Los Angeles", "US", "us", 34.0522, -118.2437),
  c("chi", "Chicago", "US", "us", 41.8781, -87.6298),
  c("hou", "Houston", "US", "us", 29.7604, -95.3698),
  c("atl", "Atlanta", "US", "us", 33.749, -84.388),
  c("dc", "Washington", "US", "us", 38.9072, -77.0369, "Washington DC"),
  c("mia", "Miami", "US", "us", 25.7617, -80.1918),
  c("dal", "Dallas", "US", "us", 32.7767, -96.797),
  c("sfo", "San Francisco", "US", "us", 37.7749, -122.4194),
  c("sea", "Seattle", "US", "us", 47.6062, -122.3321),
  c("bos", "Boston", "US", "us", 42.3601, -71.0589),
  c("phl", "Philadelphia", "US", "us", 39.9526, -75.1652),
  c("det", "Detroit", "US", "us", 42.3314, -83.0458),
  c("min", "Minneapolis", "US", "us", 44.9778, -93.265),
  // UK & Europe
  c("lon", "London", "GB", "europe", 51.5074, -0.1278),
  c("man", "Manchester", "GB", "europe", 53.4808, -2.2426),
  c("bhm", "Birmingham", "GB", "europe", 52.4862, -1.8904),
  c("gla", "Glasgow", "GB", "europe", 55.8642, -4.2518),
  c("dub", "Dublin", "IE", "europe", 53.3498, -6.2603),
  c("par", "Paris", "FR", "europe", 48.8566, 2.3522),
  c("ams", "Amsterdam", "NL", "europe", 52.3676, 4.9041),
  c("bru", "Brussels", "BE", "europe", 50.8503, 4.3517),
  c("ber", "Berlin", "DE", "europe", 52.52, 13.405),
  c("cph", "Copenhagen", "DK", "europe", 55.6761, 12.5683),
  c("sto", "Stockholm", "SE", "europe", 59.3293, 18.0686),
  c("mad", "Madrid", "ES", "europe", 40.4168, -3.7038),
  c("lis", "Lisbon", "PT", "europe", 38.7223, -9.1393),
  c("mil", "Milan", "IT", "europe", 45.4642, 9.19),
  // Africa
  c("los", "Lagos", "NG", "africa", 6.5244, 3.3792),
  c("abv", "Abuja", "NG", "africa", 9.0765, 7.3986),
  c("acc", "Accra", "GH", "africa", 5.6037, -0.187),
  c("nbo", "Nairobi", "KE", "africa", -1.2921, 36.8219),
  c("jnb", "Johannesburg", "ZA", "africa", -26.2041, 28.0473),
  c("cpt", "Cape Town", "ZA", "africa", -33.9249, 18.4241),
  c("dur", "Durban", "ZA", "africa", -29.8587, 31.0218),
  c("dar", "Dar es Salaam", "TZ", "africa", -6.7924, 39.2083),
  c("kla", "Kampala", "UG", "africa", 0.3476, 32.5825),
  c("kgl", "Kigali", "RW", "africa", -1.9441, 30.0619),
  c("dkr", "Dakar", "SN", "africa", 14.7167, -17.4677),
  c("abj", "Abidjan", "CI", "africa", 5.36, -4.0083),
];

export function citiesFor(region: RegionFilter): City[] {
  return region === "all" ? CITIES : CITIES.filter((city) => city.region === region);
}
