import { Tier } from "../types";

export interface PlanDefinition {
  tier: Tier;
  name: string;
  features: string[];
  maxRounds: number;
  maxDevices: number;
  strategies: string[];
  realBetting: boolean;
  autopilot: boolean;
  sniper: boolean;
}

export const PLANS: Record<Tier, PlanDefinition> = {
  free: {
    tier: "free",
    name: "Free",
    features: ["simulation", "flat-conservative", "flat-balanced", "basic-stats"],
    maxRounds: 50,
    maxDevices: 1,
    strategies: ["flat-conservative", "flat-balanced"],
    realBetting: false,
    autopilot: false,
    sniper: false,
  },
  basic: {
    tier: "basic",
    name: "Basic",
    features: [
      "simulation", "real-betting", "all-strategies", "auto-switch",
      "goal-seeker", "anti-martingale", "1-3-2-6", "d-alembert",
      "oscars-grind", "quant-kelly", "flat-conservative", "flat-balanced",
    ],
    maxRounds: 200,
    maxDevices: 2,
    strategies: [
      "quant-kelly", "goal-seeker", "flat-conservative", "flat-balanced",
      "anti-martingale", "1-3-2-6", "d-alembert", "oscars-grind",
    ],
    realBetting: true,
    autopilot: false,
    sniper: false,
  },
  pro: {
    tier: "pro",
    name: "Pro",
    features: [
      "simulation", "real-betting", "all-strategies", "auto-switch",
      "autopilot", "sniper", "unlimited-rounds",
      "goal-seeker", "anti-martingale", "1-3-2-6", "d-alembert",
      "oscars-grind", "quant-kelly", "flat-conservative", "flat-balanced",
    ],
    maxRounds: -1, // unlimited
    maxDevices: 3,
    strategies: [
      "quant-kelly", "goal-seeker", "flat-conservative", "flat-balanced",
      "anti-martingale", "1-3-2-6", "d-alembert", "oscars-grind", "sniper",
    ],
    realBetting: true,
    autopilot: true,
    sniper: true,
  },
};

export function getPlan(tier: Tier): PlanDefinition {
  return PLANS[tier] || PLANS.free;
}
