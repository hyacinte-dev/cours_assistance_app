'use client'

import { useState } from 'react'
import type { PlanType } from '@/utils/plans'

export default function SubscribeButton({
    plan,
    label,
    outline = false,
}: {
    plan: PlanType
    label: string
    outline?: boolean
}) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubscribe = async () => {
        setIsLoading(true)
        setError('')

        try {
            const res = await fetch('/api/chariow/create-payement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan }),
            })
            const data = await res.json()

            if (res.status === 403) {
                setError("Cette offre n'est plus disponible pour votre compte.")
                setIsLoading(false)
                return
            }
            if (!res.ok || !data.paymentUrl) {
                setError('Impossible de créer le paiement. Réessayez dans un instant.')
                setIsLoading(false)
                return
            }

            // Redirection vers le guichet de paiement Chariow
            window.location.href = data.paymentUrl
        } catch {
            setError('Une erreur réseau est survenue. Vérifiez votre connexion.')
            setIsLoading(false)
        }
    }

    return (
        <>
            <button
                onClick={handleSubscribe}
                disabled={isLoading}
                className={`w-full font-semibold py-3.5 rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${
                    outline
                        ? 'border-[1.5px] border-brand text-brand bg-white hover:bg-brand/5'
                        : 'bg-linear-to-r from-brand to-brand2 text-white hover:opacity-90'
                }`}
            >
                {isLoading ? 'Redirection...' : label}
            </button>
            {error && (
                <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-4 py-3 text-center mt-3">
                    {error}
                </p>
            )}
        </>
    )
}