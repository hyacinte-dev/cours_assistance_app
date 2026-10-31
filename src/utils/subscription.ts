import { SupabaseClient } from '@supabase/supabase-js'
import { PLANS, FREE_FICHES_LIMIT, isPlanType, type PlanType } from '@/utils/plans'

// Compatibilité : d'autres fichiers peuvent encore importer ces constantes depuis ici
export { FREE_FICHES_LIMIT }
export const MAX_FICHES_PER_MONTH = PLANS.mensuel.limit

export type AccessReason = 'FREE_LIMIT' | 'EXPIRED' | 'PLAN_LIMIT'

export interface FicheAccess {
    allowed: boolean
    isSubscribed: boolean
    plan: PlanType | null
    fichesUsed: number
    limit: number
    reason: AccessReason | null
}

/**
 * Retourne l'abonnement payé encore valide aujourd'hui (celui qui se termine le plus tard
 * s'il y en a plusieurs), ou null.
 */
export async function hasActiveSubscription(supabase: SupabaseClient, userId: string) {
    const today = new Date().toISOString().slice(0, 10)

    const { data } = await supabase
        .from('subscriptions')
        .select('id, plan, start_date, end_date, paid_at')
        .eq('teacher_id', userId)
        .eq('status', 'paid')
        .gte('end_date', today)
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle()

    return data ?? null
}

/**
 * Compte les fiches créées par l'enseignant depuis `since`.
 * `since` est l'heure exacte du paiement (paid_at), de sorte que les fiches
 * gratuites créées avant le paiement, même le même jour, ne comptent pas dans le quota.
 */
async function countFichesSince(supabase: SupabaseClient, userId: string, since: string) {
    const { count } = await supabase
        .from('fiches')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', userId)
        .gte('created_at', since)

    return count ?? 0
}

/**
 * Détermine si l'enseignant peut créer une nouvelle fiche.
 * - Abonnement actif : quota du plan (50 pour le pack, 200 pour le mensuel), compté depuis le paiement.
 * - Sinon : fiches gratuites (FREE_FICHES_LIMIT), comptées sur toutes les fiches de l'enseignant.
 */
export async function canCreateFiche(supabase: SupabaseClient, userId: string): Promise<FicheAccess> {
    const activeSubscription = await hasActiveSubscription(supabase, userId)

    if (activeSubscription) {
        const plan: PlanType = isPlanType(activeSubscription.plan) ? activeSubscription.plan : 'mensuel'
        const limit = PLANS[plan].limit

        // paid_at est précis à la seconde ; start_date (date seule) sert de repli pour les anciennes lignes
        const since = activeSubscription.paid_at ?? activeSubscription.start_date
        const fichesUsed = await countFichesSince(supabase, userId, since)
        const allowed = fichesUsed < limit

        return {
            allowed,
            isSubscribed: true,
            plan,
            fichesUsed,
            limit,
            reason: allowed ? null : 'PLAN_LIMIT',
        }
    }

    const { count } = await supabase
        .from('fiches')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', userId)

    const fichesUsed = count ?? 0
    const allowed = fichesUsed < FREE_FICHES_LIMIT

    let reason: AccessReason | null = null
    if (!allowed) {
        // A-t-il déjà eu une offre payée ? Alors elle a expiré, sinon ce sont les fiches gratuites qui sont épuisées.
        const { data: lastPaid } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('teacher_id', userId)
            .eq('status', 'paid')
            .limit(1)
            .maybeSingle()

        reason = lastPaid ? 'EXPIRED' : 'FREE_LIMIT'
    }

    return {
        allowed,
        isSubscribed: false,
        plan: null,
        fichesUsed,
        limit: FREE_FICHES_LIMIT,
        reason,
    }
}