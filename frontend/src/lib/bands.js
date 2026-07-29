// Keep in sync with backend/ml-service/model/bands.py and the Verification
// mongoose enum. Anything the ML service returns must resolve to a label/color
// so the UI never renders `undefined` chips.
export const BAND_LABEL = {
  high: "High Trust",
  likely: "Likely Genuine",
  caution: "Caution",
  risk: "High Risk",
};
export const BAND_COLOR = {
  high: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  likely: "text-lime-300 bg-lime-500/10 border-lime-500/30",
  caution: "text-yellow-300 bg-yellow-500/10 border-yellow-500/30",
  risk: "text-red-300 bg-red-500/10 border-red-500/30",
};
export function bandFor(score) {
  if (score >= 90) return "high";
  if (score >= 70) return "likely";
  if (score >= 40) return "caution";
  return "risk";
}
export function labelFor(band) { return BAND_LABEL[band] || "Unrated"; }
export function colorFor(band) {
  return BAND_COLOR[band] || "text-muted bg-white/5 border-white/10";
}