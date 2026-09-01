/**
 * Where the shop is. Sent into a chat as a card rather than a naked link:
 * a customer taps "Open the map" and their phone hands it to Google Maps,
 * Waze or whatever they use for directions.
 */
export const SHOP_LOCATION = {
  lat: 33.3114556,
  lng: 44.443511,
  label: 'شركة الواعظ للقدرة',
  address: 'بغداد، شارع الصناعة — مقابل رئاسة الجامعة التكنولوجية',
  /** The place itself on Google Maps, with the pin already dropped. */
  maps: 'https://www.google.com/maps/place/?q=place_id:ChIJS-oOsqeBVxURnLpKX56_pCU',
  /** Waze opens straight into navigation from wherever they are. */
  waze: 'https://waze.com/ul?ll=33.3114556,44.443511&navigate=yes',
} as const;
