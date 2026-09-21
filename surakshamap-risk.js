/**
 * SurakshaMap: explainable risk scoring and hotspot grouping.
 *
 * Expected report format:
 * {
 *   id: "r1",
 *   category: "Broken streetlight",
 *   description: "The light is not working near the gate",
 *   latitude: 19.1234,
 *   longitude: 72.9876,
 *   severity: "high",        // low | medium | high | critical
 *   submittedAt: "2026-09-15T21:00:00+05:30",
 *   status: "open"            // open | under_review | resolved
 * }
 */

const DEFAULT_OPTIONS = {
  // Reports within this distance belong to the same hotspot.
  groupingRadiusMeters: 200,
  // Reports submitted within this many days are treated as recent.
  recentDays: 7,
  // India Standard Time by default. Change when deploying elsewhere.
  timeZone: "Asia/Kolkata",
  // Maximum number of reports shown in an explanation.
  maxExplanationExamples: 3,
};

const SEVERITY_POINTS = { low: 1, medium: 2, high: 3, critical: 4 };

const CATEGORY_POINTS = {
  "broken streetlight": 1,
  "unsafe crossing": 1,
  "broken footpath": 1,
  obstruction: 1,
  waterlogging: 1,
  "open manhole": 2,
  other: 0,
};

function getSeverityPoints(severity) {
  if (typeof severity === "number") return Math.min(4, Math.max(1, severity));
  const normalized = String(severity || "medium").trim().toLowerCase();
  return SEVERITY_POINTS[normalized] || SEVERITY_POINTS.medium;
}

/** True for reports submitted between 19:00 and 05:59 local time. */
function isNightTime(date, timeZone = DEFAULT_OPTIONS.timeZone) {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", { hour: "2-digit", hourCycle: "h23", timeZone }).format(date),
  );
  return hour >= 19 || hour < 6;
}

function isRecent(date, now, recentDays) {
  const ageInDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  return ageInDays <= recentDays;
}

function getCategoryPoints(category) {
  const normalized = String(category || "other").trim().toLowerCase();
  return CATEGORY_POINTS[normalized] || 0;
}

function classifyRisk(score) {
  if (score >= 17) return "Critical";
  if (score >= 11) return "High";
  if (score >= 6) return "Medium";
  return "Low";
}

function getRecommendation(category, riskLevel) {
  const normalized = String(category || "other").trim().toLowerCase();
  const recommendations = {
    "broken streetlight": "Inspect and repair the streetlight. Consider temporary lighting until repair.",
    "open manhole": "Place a temporary barricade immediately and arrange urgent maintenance.",
    "unsafe crossing": "Evaluate the location for signage, road markings, a zebra crossing or traffic calming.",
    "broken footpath": "Repair the footpath and remove hazards affecting pedestrians or wheelchair users.",
    obstruction: "Remove the obstruction and inspect the area for recurring causes.",
    waterlogging: "Inspect drainage, clear blockages and monitor the location during rainfall.",
    other: "Assign the report to a community safety officer for human review.",
  };
  const recommendation = recommendations[normalized] || recommendations.other;
  return riskLevel === "Critical" ? `Urgent action: ${recommendation}` : recommendation;
}

/**
 * score = severity points * 3 + category points + 1 if recent + 2 if night.
 */
function calculateReportBaseScore(report, options = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const date = new Date(report.submittedAt);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid submittedAt value for report ${report.id || "unknown"}`);
  }
  const now = settings.now ? new Date(settings.now) : new Date();
  const severityPoints = getSeverityPoints(report.severity);
  const categoryPoints = getCategoryPoints(report.category);
  const recentPoints = isRecent(date, now, settings.recentDays) ? 1 : 0;
  const nightTimePoints = isNightTime(date, settings.timeZone) ? 2 : 0;
  const score = severityPoints * 3 + categoryPoints + recentPoints + nightTimePoints;
  return { severityPoints, categoryPoints, recentPoints, nightTimePoints, score };
}

function calculateRiskScore(report, nearbyReports = [], options = {}) {
  const base = calculateReportBaseScore(report, options);
  const repeatedReportCount = nearbyReports.filter((r) => r.id !== report.id).length;
  const repeatedReportPoints = repeatedReportCount * 2;
  const totalScore = base.score + repeatedReportPoints;
  const riskLevel = classifyRisk(totalScore);
  return {
    score: totalScore,
    riskLevel,
    breakdown: { ...base, repeatedReportCount, repeatedReportPoints },
    recommendation: getRecommendation(report.category, riskLevel),
  };
}

/** Haversine distance in metres. */
function distanceInMeters(latitude1, longitude1, latitude2, longitude2) {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(latitude1);
  const lat2 = toRadians(latitude2);
  const deltaLat = toRadians(latitude2 - latitude1);
  const deltaLon = toRadians(longitude2 - longitude1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

function hasValidLocation(report) {
  return (
    Number.isFinite(Number(report.latitude)) &&
    Number.isFinite(Number(report.longitude)) &&
    Number(report.latitude) >= -90 &&
    Number(report.latitude) <= 90 &&
    Number(report.longitude) >= -180 &&
    Number(report.longitude) <= 180
  );
}

function reportsNearCenter(reports, center, radiusMeters) {
  return reports.filter((report) => {
    if (!hasValidLocation(report)) return false;
    const distance = distanceInMeters(
      Number(report.latitude), Number(report.longitude), center.latitude, center.longitude,
    );
    return distance <= radiusMeters;
  });
}

function calculateCenter(reports) {
  const total = reports.reduce(
    (result, report) => {
      result.latitude += Number(report.latitude);
      result.longitude += Number(report.longitude);
      return result;
    },
    { latitude: 0, longitude: 0 },
  );
  return { latitude: total.latitude / reports.length, longitude: total.longitude / reports.length };
}

function findDominantCategory(reports) {
  const counts = {};
  for (const report of reports) {
    const category = report.category || "Other";
    counts[category] = (counts[category] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Other";
}

function createHotspotExplanation(hotspot, options = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const nightReports = hotspot.reports.filter((report) => {
    const date = new Date(report.submittedAt);
    return !Number.isNaN(date.getTime()) && isNightTime(date, settings.timeZone);
  }).length;
  const recentReports = hotspot.reports.filter((report) => {
    const date = new Date(report.submittedAt);
    const now = settings.now ? new Date(settings.now) : new Date();
    return !Number.isNaN(date.getTime()) && isRecent(date, now, settings.recentDays);
  }).length;
  const examples = hotspot.reports.slice(0, settings.maxExplanationExamples).map((r) => r.category || "Other");
  return (
    `${hotspot.riskLevel} risk because ${hotspot.reports.length} report(s) were found within ` +
    `${settings.groupingRadiusMeters} metres; ${recentReports} are recent and ${nightReports} were submitted at night. ` +
    `Main issue(s): ${examples.join(", ")}.`
  );
}

/**
 * Group reports into geographic hotspots using simple radius clustering:
 * seed a report, pull in unassigned neighbours, recompute the centre,
 * repeat until the group stops changing.
 */
function groupReportsIntoHotspots(reports, options = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const validReports = reports.filter(hasValidLocation);
  const unassigned = new Set(validReports.map((report) => report.id));
  const hotspots = [];
  let hotspotNumber = 1;

  while (unassigned.size > 0) {
    const seedReport = validReports.find((report) => unassigned.has(report.id));
    let center = { latitude: Number(seedReport.latitude), longitude: Number(seedReport.longitude) };
    let members = [];
    let changed = true;

    while (changed) {
      const candidateReports = validReports.filter((report) => unassigned.has(report.id));
      const nearbyReports = reportsNearCenter(candidateReports, center, settings.groupingRadiusMeters);
      const previousIds = new Set(members.map((report) => report.id));
      const currentIds = new Set(nearbyReports.map((report) => report.id));
      changed = previousIds.size !== currentIds.size || [...previousIds].some((id) => !currentIds.has(id));
      members = nearbyReports;
      if (members.length > 0) center = calculateCenter(members);
    }

    if (members.length === 0) members = [seedReport];
    for (const report of members) unassigned.delete(report.id);

    const dominantCategory = findDominantCategory(members);
    const scoredReports = members.map((report) => calculateReportBaseScore(report, settings));
    const totalBaseScore = scoredReports.reduce((sum, result) => sum + result.score, 0);
    const repeatedReportPoints = Math.max(0, members.length - 1) * 2;
    const averageBaseScore = totalBaseScore / members.length;
    const hotspotScore = Math.round(averageBaseScore + repeatedReportPoints);
    const riskLevel = classifyRisk(hotspotScore);

    const hotspot = {
      id: `hotspot-${hotspotNumber++}`,
      center,
      reports: members,
      reportCount: members.length,
      dominantCategory,
      score: hotspotScore,
      riskLevel,
      recommendation: getRecommendation(dominantCategory, riskLevel),
      status: members.every((report) => report.status === "resolved") ? "resolved" : "open",
      lastUpdated: new Date().toISOString(),
    };
    hotspot.explanation = createHotspotExplanation(hotspot, settings);
    hotspots.push(hotspot);
  }

  return hotspots.sort((a, b) => b.score - a.score);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { calculateReportBaseScore, calculateRiskScore, classifyRisk, distanceInMeters, groupReportsIntoHotspots, getRecommendation };
}
if (typeof exports === "undefined" && typeof window !== "undefined") {
  window.SurakshaMapRisk = { calculateReportBaseScore, calculateRiskScore, classifyRisk, distanceInMeters, groupReportsIntoHotspots, getRecommendation };
}
