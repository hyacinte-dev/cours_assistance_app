import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { PLANS, isPlanType, type PlanType } from '@/utils/plans'

const CHARIOW_API_URL = 'https://api.chariow.com/v1/checkout'
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Chariow fixe le prix dans chaque produit : choisir le produit = choisir le prix
const CHARIOW_PRODUCT_IDS: Record<PlanType, string | undefined> = {
    mensuel: process.env.CHARIOW_PRODUCT_ID,
    decouverte: process.env.CHARIOW_PRODUCT_ID_DECOUVERTE,
}

export async function POST(request: Request) {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    // 1. Vérification de l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // 2. Plan demandé : validé côté serveur, sans plan par défaut
    const body = await request.json().catch(() => null)
    const requestedPlan: unknown = body?.plan
    if (!isPlanType(requestedPlan)) {
        return NextResponse.json({ error: 'Plan invalide' }, { status: 400 })
    }
    const plan: PlanType = requestedPlan

    // 3. Produit Chariow correspondant au plan (doit être un identifiant, pas une URL)
    const productId = CHARIOW_PRODUCT_IDS[plan]
    if (!productId || !/^prd_[a-z0-9]+$/i.test(productId)) {
        console.error('Identifiant produit Chariow invalide ou manquant pour le plan', plan)
        return NextResponse.json({ error: 'Configuration de paiement invalide' }, { status: 500 })
    }

    // 4. Le pack découverte est réservé aux comptes sans aucun abonnement passé
    if (plan === 'decouverte') {
        const { count, error: countError } = await supabase
            .from('subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('teacher_id', user.id)
            .neq('status', 'unpaid')

        if (countError) {
            console.error('Erreur vérification éligibilité pack découverte:', countError)
            return NextResponse.json({ error: 'Vérification impossible' }, { status: 500 })
        }
        if ((count ?? 0) > 0) {
            return NextResponse.json({ error: 'Pack découverte non disponible' }, { status: 403 })
        }
    }

    // 5. Récupération du profil pour pré-remplir le checkout
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', user.id)
        .single()

    const [firstName, ...rest] = (profile?.full_name ?? 'Enseignant Fiches+').split(' ')
    const lastName = rest.join(' ') || firstName
    const cleanPhone = (profile?.phone ?? '').replace(/\s+/g, '').replace(/^\+226/, '')

    // 6. Appel à l'API Chariow pour initier le checkout
    try {
        const response = await fetch(CHARIOW_API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.CHARIOW_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                product_id: productId,
                email: user.email,
                first_name: firstName,
                last_name: lastName,
                phone: {
                    number: cleanPhone || '00000000',
                    country_code: 'BF',
                },
                // Permet de relier le paiement Chariow au bon enseignant lors du webhook
                custom_metadata: {
                    teacher_id: user.id,
                },
                redirect_url: `${BASE_URL}/fiches?paiement=succes`,
            }),
        })

        const data = await response.json()

        if (!response.ok) {
            console.error('Erreur Chariow checkout:', data)
            return NextResponse.json(
                { error: data.message || 'Erreur lors de la création du paiement' },
                { status: response.status }
            )
        }

        // 7. Gestion des différents états possibles retournés par Chariow
        if (data.data.step === 'already_purchased') {
            return NextResponse.json(
                { error: 'Un paiement est déjà en cours de traitement pour ce produit.' },
                { status: 409 }
            )
        }

        if (data.data.step !== 'payment') {
            console.error('Statut checkout Chariow inattendu:', data.data.step)
            return NextResponse.json({ error: 'Statut de paiement inattendu' }, { status: 400 })
        }

        // 8. Enregistrement de l'abonnement en attente, lié au sale_id Chariow
        const { error: insertError } = await supabase
            .from('subscriptions')
            .insert({
                teacher_id: user.id,
                status: 'unpaid',
                amount: PLANS[plan].amount,
                plan,
                payment_ref: data.data.purchase.id, // ex. sal_xyz789
                payment_provider: 'chariow',
            })

        if (insertError) {
            console.error('Erreur insertion subscription:', insertError)
            return NextResponse.json({ error: 'Impossible de préparer l\'abonnement' }, { status: 500 })
        }

        return NextResponse.json({ paymentUrl: data.data.payment.checkout_url })

    } catch (error) {
        console.error('Erreur Chariow API:', error)
        return NextResponse.json({ error: 'Impossible de créer le paiement' }, { status: 500 })
    }
}