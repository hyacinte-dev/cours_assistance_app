import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { canCreateFiche, type FicheAccess } from '@/utils/subscription'
import { PLANS, FREE_FICHES_LIMIT } from '@/utils/plans'
import NewFicheForm from './NewFicheForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: "Nouvelle fiche",
};

const fmt = (n: number) => n.toLocaleString('fr-FR')

// Message et bouton de l'écran de blocage selon la situation de l'enseignant
function getBlockedContent(access: FicheAccess): { title: string; text: string; cta: string | null } {
    switch (access.reason) {
        case 'PLAN_LIMIT':
            if (access.plan === 'decouverte') {
                return {
                    title: `Vous avez utilisé les ${access.limit} fiches de votre pack découverte`,
                    text: "Passez à l'abonnement mensuel pour continuer sans attendre la fin des 7 jours.",
                    cta: 'Passer au mensuel',
                }
            }
            return {
                title: `Vous avez atteint votre limite de ${access.limit} fiches ce mois-ci`,
                text: "Votre quota se renouvelle avec votre prochain cycle d'abonnement.",
                cta: null,
            }
        case 'EXPIRED':
            return {
                title: 'Votre offre est terminée',
                text: `Passez à l'abonnement mensuel (${fmt(PLANS.mensuel.amount)} FCFA) pour créer jusqu'à ${PLANS.mensuel.limit} fiches par mois.`,
                cta: "Voir l'abonnement",
            }
        default:
            return {
                title: `Vous avez utilisé vos ${FREE_FICHES_LIMIT} fiches gratuites`,
                text: `Choisissez le pack découverte (${fmt(PLANS.decouverte.amount)} FCFA, ${PLANS.decouverte.durationDays} jours, ${PLANS.decouverte.limit} fiches) ou l'abonnement mensuel (${fmt(PLANS.mensuel.amount)} FCFA, jusqu'à ${PLANS.mensuel.limit} fiches par mois).`,
                cta: 'Voir les offres',
            }
    }
}

export default async function NewFichePage() {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/login')
    }

    const access = await canCreateFiche(supabase, user.id)

    if (!access.allowed) {
        const blocked = getBlockedContent(access)

        return (
            <div className="max-w-md mx-auto px-6 py-16 text-center">
                <div className="bg-white border border-line rounded-2xl p-8">
                    <p className="font-display font-extrabold text-xl text-ink mb-2">
                        {blocked.title}
                    </p>
                    <p className="text-sm text-muted mb-6">
                        {blocked.text}
                    </p>
                    {blocked.cta && (
                        <Link
                            href="/subscription"
                            className="inline-block bg-linear-to-r from-brand to-brand2 text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition"
                        >
                            {blocked.cta}
                        </Link>
                    )}
                </div>
            </div>
        )
    }

    const quotaText = access.isSubscribed
        ? access.plan === 'decouverte'
            ? `${access.fichesUsed}/${access.limit} fiches utilisées sur votre pack découverte.`
            : `${access.fichesUsed}/${access.limit} fiches ce mois-ci.`
        : `Il vous reste ${FREE_FICHES_LIMIT - access.fichesUsed} fiche(s) gratuite(s) sur ${FREE_FICHES_LIMIT}.`

    return (
        <div className="max-w-2xl mx-auto px-6 py-10">
            <h1 className="font-display font-extrabold text-2xl text-ink mb-2">
                Créer une nouvelle fiche
            </h1>
            <p className="text-sm text-muted mb-8">
                {access.isSubscribed
                    ? `Décrivez votre leçon, la fiche est générée en quelques secondes. (${quotaText})`
                    : quotaText}
            </p>

            <NewFicheForm />
        </div>
    )
}