import { useState } from 'react';
import { syncAccountAndUserDoc } from '../../../../app/bootstrap';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { authErrorMessage, resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail } from '../../../../services/auth';
import { glassCardClass, smokeInputClass } from '../styles';

type Mode = 'signIn' | 'signUp';

export function AuthPage() {
	const [mode, setMode] = useState<Mode>('signIn');
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [info, setInfo] = useState<string | null>(null);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setError(null);
		setInfo(null);
		setBusy(true);
		try {
			if (mode === 'signIn') {
				await signInWithEmail(email.trim(), password);
			} else {
				await signUpWithEmail(email.trim(), password, name);
				await syncAccountAndUserDoc();
			}
		} catch (err) {
			setError(authErrorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	async function handleGoogle() {
		setError(null);
		setInfo(null);
		setBusy(true);
		try {
			await signInWithGoogle();
		} catch (err) {
			setError(authErrorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	async function handleForgotPassword() {
		if (!email.trim()) {
			setError('Enter your email above first, then tap "Forgot password?" again.');
			return;
		}
		setError(null);
		setBusy(true);
		try {
			await resetPassword(email.trim());
			setInfo('Password reset email sent — check your inbox.');
		} catch (err) {
			setError(authErrorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="mx-auto flex h-dvh max-w-md flex-col justify-center gap-4 overflow-y-auto overscroll-contain px-4 py-10">
			<div>
				<h1 className="font-[DM_Serif_Display] text-5xl tracking-[-0.04em] text-text">Smokeless</h1>
				<p className="mt-3 text-[15px] leading-relaxed text-text-dim">
					Track every cigarette, watch your cessation streaks grow, and quit on your own terms.
				</p>
			</div>

			<Card className={`${glassCardClass} rounded-[32px]`}>
				<form className="flex flex-col gap-3" onSubmit={handleSubmit}>
					<div className="mb-1 grid grid-cols-2 gap-1 rounded-full bg-white/[0.04] p-1.5">
						<button
							type="button"
							onClick={() => setMode('signIn')}
							className={`rounded-full border-0 px-2 py-[0.7rem] text-[13px] font-semibold transition ${mode === 'signIn' ? 'bg-white/[0.22] text-text' : 'bg-transparent text-text-dim'}`}
						>
							Sign in
						</button>
						<button
							type="button"
							onClick={() => setMode('signUp')}
							className={`rounded-full border-0 px-2 py-[0.7rem] text-[13px] font-semibold transition ${mode === 'signUp' ? 'bg-white/[0.22] text-text' : 'bg-transparent text-text-dim'}`}
						>
							Create account
						</button>
					</div>

					{mode === 'signUp' ? (
						<label className="flex flex-col gap-2">
							<span className="text-detail uppercase tracking-[0.16em] text-text-dim">Name</span>
							<input
								className={smokeInputClass}
								type="text"
								autoComplete="name"
								value={name}
								onChange={(e) => setName(e.currentTarget.value)}
							/>
						</label>
					) : null}

					<label className="flex flex-col gap-2">
						<span className="text-detail uppercase tracking-[0.16em] text-text-dim">Email</span>
						<input
							className={smokeInputClass}
							type="email"
							autoComplete="email"
							required
							value={email}
							onChange={(e) => setEmail(e.currentTarget.value)}
						/>
					</label>

					<label className="flex flex-col gap-2">
						<span className="text-detail uppercase tracking-[0.16em] text-text-dim">Password</span>
						<input
							className={smokeInputClass}
							type="password"
							autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
							required
							minLength={6}
							value={password}
							onChange={(e) => setPassword(e.currentTarget.value)}
						/>
					</label>

					{mode === 'signIn' ? (
						<button
							type="button"
							onClick={() => void handleForgotPassword()}
							className="self-start text-[13px] text-text-dim underline decoration-white/20 underline-offset-4"
						>
							Forgot password?
						</button>
					) : null}

					{error ? <p className="text-[13px] text-negative">{error}</p> : null}
					{info ? <p className="text-[13px] text-positive">{info}</p> : null}

					<Button type="submit" variant="highlight" className="mt-2 rounded-[20px]" disabled={busy}>
						{mode === 'signIn' ? 'Sign in' : 'Create account'}
					</Button>

					<div className="my-1 flex items-center gap-3 text-text-dim">
						<div className="h-px flex-1 bg-white/[0.08]" />
						<span className="text-[11px] uppercase tracking-[0.2em]">or</span>
						<div className="h-px flex-1 bg-white/[0.08]" />
					</div>

					<Button type="button" variant="secondary" className="rounded-[20px]" disabled={busy} onClick={() => void handleGoogle()}>
						Continue with Google
					</Button>
				</form>
			</Card>
		</div>
	);
}
