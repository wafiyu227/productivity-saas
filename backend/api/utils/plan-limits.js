const PLAN_LIMITS = {
  free: {
    seats: 5,
    summariesPerMonth: 50,
    historyHours: 7 * 24
  },
  starter: {
    seats: 20,
    summariesPerMonth: 1000,
    historyHours: 90 * 24
  },
  growth: {
    seats: 75,
    summariesPerMonth: null, // null = unlimited
    historyHours: 365 * 24
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
  return getPlanLimits(plan).summariesPerMonth;
}

export function getSeatLimit(plan) {
  return getPlanLimits(plan).seats;
}

export function getHistoryLimitHours(plan) {
  return getPlanLimits(plan).historyHours;
}

export default PLAN_LIMITS;
