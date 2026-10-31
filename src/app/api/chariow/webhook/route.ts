import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getEndDate, isPlanType } from '@/utils/plans'

export async function POST(request: Request) {
    try {
        // 1. Lecture du corps BRUT (obligatoire pour la vérification de signature)
        const rawBody = await request.text()
        const receivedSignature = request.headers.get('x-chariow-signature') ?? ''

        // Chaque pulse peut avoir son propre secret : on accepte ceux qui sont configurés
        const secrets = [
            process.env.CHARIOW_PULSE_SECRET,
            process.env.CHARIOW_PULSE_SECRET_2,
        ].filter((s): s is string => !!s)

        const received = Buffer.from(receivedSignature)
        const isValid = secrets.some((secret) => {
            const expected = Buffer.from(
                'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
            )
            return expected.length === received.length && crypto.timingSafeEqual(received, expected)
        })

        if (!isValid) {
            console.error('Webhook Chariow : signature invalide')
            return NextResponse.json({ error: 'Signature invalide' }, { status: 401 })
        }

        // 2. Parsing du payload APRÈS vérification de la signature
        const payload = JSON.parse(rawBody)
        const event = payload.event


        // On n'agit que sur les ventes réussies ; on accuse réception pour le reste
        if (event !== 'successful.sale') {
            return NextResponse.json({ received: true })
        }

        const teacherId = payload.sale?.custom_metadata?.teacher_id
        const saleId = payload.sale?.id

        if (!teacherId || !saleId) {
            console.error('Webhook Chariow : métadonnées manquantes', payload)
            return NextResponse.json({ error: 'Métadonnées manquantes' }, { status: 400 })
        }

        const supabase = createAdminClient()

        // 3. Retrouver la ligne créée à l'initiation du paiement (elle contient le plan)
        const { data: existing } = await supabase
            .from('subscriptions')
            .select('status, plan')
            .eq('payment_ref', saleId)
            .eq('teacher_id', teacherId)
            .single()

        if (!existing) {
            console.error('Webhook Chariow : aucune ligne subscriptions pour', saleId)
            return NextResponse.json({ error: 'Abonnement introuvable' }, { status: 404 })
        }

        // Idempotence : éviter de retraiter un paiement déjà validé
        if (existing.status === 'paid') {
            return NextResponse.json({ received: true, already: true })
        }

        if (!isPlanType(existing.plan)) {
            console.error('Webhook Chariow : plan inconnu en base pour', saleId, existing.plan)
            return NextResponse.json({ error: 'Plan inconnu' }, { status: 500 })
        }

        // 4. Activation selon le plan enregistré côté serveur
        const startDate = new Date()

        const { error } = await supabase
            .from('subscriptions')
            .update({
                status: 'paid',
                start_date: startDate.toISOString().slice(0, 10),
                end_date: getEndDate(existing.plan, startDate),
                paid_at: startDate.toISOString(),
            })
            .eq('payment_ref', saleId)
            .eq('teacher_id', teacherId)

        if (error) {
            // 23505 = index unique : un pack découverte payé existe déjà pour ce compte
            if (error.code === '23505') {
                console.error('Pack découverte déjà payé, remboursement à traiter à la main :', saleId)
                return NextResponse.json({ received: true, duplicate: true })
            }
            console.error('Erreur mise à jour subscription Supabase:', error)
            return NextResponse.json({ error }, { status: 500 })
        }

        return NextResponse.json({ received: true })

    } catch (error) {
        console.error('Erreur générale Webhook Chariow:', error)
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
    }
}