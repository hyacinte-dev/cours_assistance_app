import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import SubscribeButton from './Abonnement'
import { PLANS, type PlanType } from '@/utils/plans'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: "Abonnement",
};

const OFFERS: Record<
    PlanType,
    { title: string; subtitle: string; features: string[]; cta: string }
> = {
    mensuel: {
        title: 'Plan mensuel',
        subtitle: 'par mois, sans engagement',
        features: [
            `Jusqu'à ${PLANS.mensuel.limit} fiches par mois`,
            'Toutes matières du CP1 au CM2',
            'Export PDF prêt à imprimer',
            'Paiement Orange Money, Moov Money ou carte bancaire',
        ],
        cta: "S'abonner maintenant",
    },
    decouverte: {
        title: 'Pack découverte',
        subtitle: `pour ${PLANS.decouverte.durationDays} jours, une seule fois`,
        features: [
            `${PLANS.decouverte.limit} fiches pendant ${PLANS.decouverte.durationDays} jours`,
            'Toutes matières du CP1 au CM2',
            'Export PDF prêt à imprimer',
            'Idéal pour tester Fiches+',
        ],
        cta: 'Essayer le pack découverte',
    },
}

function OfferCard({ plan, outline = false }: { plan: PlanType; outline?: boolean }) {
    const offer = OFFERS[plan]
    return (
        <div className="bg-white border border-line rounded-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-6 border-b border-line">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                    {offer.title}
                </p>
                <p className="font-display font-extrabold text-4xl text-ink mb-1">
                    {PLANS[plan].amount.toLocaleString('fr-FR')}{' '}
                    <span className="text-lg font-medium text-muted">FCFA</span>
                </p>
                <p className="text-sm text-muted">{offer.subtitle}</p>
            </div>

            <ul className="px-6 py-6 flex flex-col gap-3 flex-1">
                {offer.features.map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-ink/80">
                        <span className="text-brand">✓</span>
                        {item}
                    </li>
                ))}
            </ul>

            <div className="px-6 pb-6">
                <SubscribeButton plan={plan} label={offer.cta} outline={outline} />
            </div>
        </div>
    )
}

export default async function AbonnementPage() {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/login')
    }

    // Tous les paiements validés, du plus récent au plus ancien
    const { data: paidRows } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('teacher_id', user.id)
        .eq('status', 'paid')
        .order('end_date', { ascending: false })

    const today = new Date().toISOString().slice(0, 10)
    const subscription = paidRows?.find((s) => s.end_date >= today) ?? null // offre active
    const lastSub = paidRows?.[0] ?? null // dernière offre payée (pour le message « expirée »)
    const isActive = !!subscription

    // Le pack découverte n'est proposé qu'aux comptes qui n'ont jamais payé.
    // Affichage seulement : la vraie vérification se fait côté serveur.
    const canBuyDecouverte = !paidRows || paidRows.length === 0

    const isDecouverte = subscription?.plan === 'decouverte'

    return (
        <div className="max-w-3xl mx-auto px-6 py-10">
            <div className="text-center mb-8">
                <h1 className="font-display font-extrabold text-2xl text-ink mb-2">
                    Abonnement
                </h1>
                <p className="text-sm text-muted">
                    {isActive
                        ? 'Votre abonnement Fiches+.'
                        : 'Choisissez l’offre qui vous convient.'}
                </p>
            </div>

            {isActive ? (
                <>
                <div className="max-w-md mx-auto bg-white border border-line rounded-2xl overflow-hidden">
                    <div className="bg-linear-to-r from-brand to-brand2 px-6 py-6">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-white/80 text-xs font-semibold uppercase tracking-wide">
                                {isDecouverte ? 'Pack découverte' : 'Plan mensuel'}
                            </p>
                            <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
                                Actif
                            </span>
                        </div>
                        <p className="text-white font-display font-extrabold text-3xl">
                            {subscription.amount.toLocaleString('fr-FR')}
                            <span className="text-base font-medium"> FCFA</span>
                        </p>
                    </div>
                    <div className="p-6">
                        <div className="flex justify-between items-center border-b border-line pb-3 mb-3">
                            <span className="text-sm text-muted">Actif depuis</span>
                            <span className="text-sm font-medium text-ink">
                                {new Date(subscription.start_date).toLocaleDateString('fr-FR')}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted">
                                {isDecouverte ? 'Expire le' : 'Renouvellement'}
                            </span>
                            <span className="text-sm font-medium text-ink">
                                {new Date(subscription.end_date).toLocaleDateString('fr-FR')}
                            </span>
                        </div>
                    </div>
                </div>
                {isDecouverte && (
                        <div className="max-w-md mx-auto mt-5">
                            <OfferCard plan="mensuel" />
                        </div>
                    )}
                </>
            ) : (
                <>
                    {lastSub && (
                        <p className="text-xs text-muted text-center mb-4">
                            Votre offre précédente a expiré le{' '}
                            {new Date(lastSub.end_date).toLocaleDateString('fr-FR')}.
                        </p>
                    )}

                    <div
                        className={`grid gap-5 ${
                            canBuyDecouverte ? 'sm:grid-cols-2' : 'max-w-md mx-auto'
                        }`}
                    >
                        {canBuyDecouverte && <OfferCard plan="decouverte" outline />}
                        <OfferCard plan="mensuel" />
                    </div>
                </>
            )}
        </div>
    )
}