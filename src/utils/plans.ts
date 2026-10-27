
export const PLANS = {
    mensuel: {
        amount: 5000,
        limit: 200,
        durationDays: 30,
        description: "Abonnement Mensuel Fiches+"
    },
    decouverte: {
        amount: 1500,
        limit: 50,
        durationDays: 7,
        description: "Pack Découverte Fiches+ (7 jours)"
    }
} as const;

export type PlanType = keyof typeof PLANS;

export const FREE_FICHES_LIMIT = 2;