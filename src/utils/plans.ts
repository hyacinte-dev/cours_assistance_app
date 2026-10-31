
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

// Date de fin (format YYYY-MM-DD) d'un abonnement qui commence à `from`
export function getEndDate(plan: PlanType, from: Date = new Date()): string {
    const end = new Date(from)
    end.setDate(end.getDate() + PLANS[plan].durationDays)
    return end.toISOString().slice(0, 10)
}
//vérifie qu'une valeur reçue est bien un plan connu

export function isPlanType(value: unknown): value is PlanType {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLANS, value)
}
