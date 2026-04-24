// TESTING MODE: All limits are unlimited
const PLAN_LIMITS = {
  free: {
    seats: 999999,
    summariesPerMonth: null, // null = unlimited
    historyHours: 365 * 24 * 999 // ~2.7 years
  },
  starter: {
    seats: 999999,
    summariesPerMonth: null, // null = unlimited
    historyHours: 365 * 24 * 999
  },
  growth: {
    seats: 999999,
    summariesPerMonth: null, // null = unlimited
    historyHours: 365 * 24 * 999
  }
};

const DEFAULT_PLAN = 'free';

function normalizePlan(plan) {
  return PLAN_LIMITS[plan] ? plan : DEFAULT_PLAN;
}

export function getPlanLimits(plan) {
  const normalizedPlan = normalizePlan(plan);
  return PLAN_LIMITS[normalizedPlan];
}

export function getSummaryLimit(plan) {
  // Always return unlimited for testing
  return null;
}

export function getSeatLimit(plan) {
  // Always return unlimited for testing
  return 999999;
}

export function getHistoryLimitHours(plan) {
  // Always return unlimited for testing
  return 365 * 24 * 999;
}

export default PLAN_LIMITS;
