'use client';

import { useState } from 'react';
import Navigation from '@/components/landing/Navigation';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Where to go after login, e.g. /login?next=/simulate. Only same-site paths: "//evil.com" is another site.
  const nextPath = () => {
    const next = new URLSearchParams(window.location.search).get('next') || '';
    return next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(nextPath());
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          router.push(nextPath());
        } else {
          // Supabase still has "Confirm email" on: there is no session until the link is clicked.
          setNotice('Account created. Check your email for a confirmation link, then log in.');
          setIsLogin(true);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-black">
      <Navigation />

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="card enter w-full max-w-[26rem] p-7 md:p-9">
          <div key={isLogin ? 'in' : 'up'} className="enter mb-8 flex flex-col gap-2 text-center">
            <h1 className="display m-0 text-[3rem]">{isLogin ? <>Welcome <em>back</em></> : <>Make an <em>account</em></>}</h1>
            <p className="m-0 muted">
              {isLogin ? 'Log in to see your plans and chats.' : 'Free. Your plans are saved here and only you can see them.'}
            </p>
          </div>

          {error && (
            <div role="alert" className="enter mb-5 rounded-2xl bg-error/10 px-4 py-3 text-center text-sm text-error">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="enter mb-5 rounded-2xl bg-primary/10 px-4 py-3 text-center text-sm text-primary-fixed-dim">
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label htmlFor="email" className="flex flex-col gap-2 text-sm font-medium">
              Email
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="field font-normal" />
            </label>
            <label htmlFor="password" className="flex flex-col gap-2 text-sm font-medium">
              Password
              <input id="password" type="password" required minLength={6} autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="field font-normal" />
            </label>
            <button disabled={loading} type="submit" className="btn btn-primary mt-2 w-full">
              {loading && <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              {isLogin ? 'Log in' : 'Create account'}
            </button>
          </form>

          <p className="m-0 mt-6 text-center text-sm muted">
            {isLogin ? "Don't have an account? " : 'Already have one? '}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
              }}
              className="cursor-pointer font-medium text-primary-fixed-dim transition-colors hover:text-white"
            >
              {isLogin ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
