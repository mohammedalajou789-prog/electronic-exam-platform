'use client'

// Keeps signed-in students off the home page.
//
// src/proxy.ts already sends them to /dashboard when the home page is loaded from the
// server. This covers the cases that never reach the server: the browser's Back button
// (for example right after signing in) and links answered from the router's cache, where
// a copy of the home page kept from before signing in would otherwise be shown.
//
// The home page is cached and the same for everyone, so the check runs in the browser.
// When this browser holds a session cookie, the page content is hidden from the very first
// frame (the navbar stays), so the home page is never painted for a signed-in student.
// getSession() then confirms the session (read locally, no network call unless the token
// must be refreshed): a real session moves on to the dashboard without reloading the site,
// and a stale cookie simply shows the home page.

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// The cookie name Supabase uses: sb-<project ref>-auth-token (long sessions add .0, .1, ...)
const AUTH_COOKIE = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]}-auth-token`

function hasAuthCookie(): boolean {
  return document.cookie.split(';').some(c => c.trim().startsWith(AUTH_COOKIE))
}

// The cookie is read once per render; nothing needs to be watched
function subscribe(): () => void {
  return () => {}
}

export default function SignedInRedirect(): React.JSX.Element | null {
  const router = useRouter()
  // false on the server and while the page is hydrated (the server cannot see the cookie)
  const maybeSignedIn = useSyncExternalStore(subscribe, hasAuthCookie, () => false)
  // Set when the session check finds no real session (for example an expired cookie)
  const [notSignedIn, setNotSignedIn] = useState(false)

  useEffect(() => {
    let active = true

    function check(): void {
      createClient().auth.getSession().then(({ data }) => {
        if (!active) return
        if (!data.session) {
          setNotSignedIn(true)
          return
        }
        // replace(): Back does not return to this page
        router.replace('/dashboard')
      })
    }

    // A page restored by the browser's Back button (back/forward cache) does not run
    // effects again, so the check also runs when the page is shown from that cache.
    function onPageShow(event: PageTransitionEvent): void {
      if (event.persisted) check()
    }

    check()
    window.addEventListener('pageshow', onPageShow)
    return () => {
      active = false
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [router])

  if (!maybeSignedIn || notSignedIn) return null

  // A plain cover in the page colour, under the sticky navbar (z-index 50)
  return (
    <div
      data-signed-in-cover
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'var(--bg)' }}
    />
  )
}