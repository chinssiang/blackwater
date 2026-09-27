'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DELETE_NEEDS_FRESH_SIGN_IN } from '@/lib/member/shared';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui/Button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/Dialog';
import { toast } from 'sonner';

/**
 * Settings -> Delete account, confirmed in a dialog, through Better Auth's
 * delete-user route. That route wants a sign-in from the last day (auth.ts);
 * an older session gets a way to sign in again rather than an error.
 */
export function DeleteAccount({ className }: { className?: string }) {
	const account = useTranslations('account');
	const t = account.settings;
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const [needsSignIn, setNeedsSignIn] = useState(false);

	const post = (path: string) =>
		fetch(`/api/auth/${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{}',
		}).catch(() => undefined);

	const onDelete = async () => {
		if (pending) return;
		setPending(true);
		const res = await post('delete-user');
		if (res?.ok) {
			// `pending` stays set: the refresh replaces this page with the
			// sign-in form, and the header's hint follows via SessionRefresh.
			toast.success(t.deleted);
			router.refresh();
			return;
		}
		const body = await res?.json().catch(() => undefined);
		if (
			(body as { code?: string } | undefined)?.code ===
			DELETE_NEEDS_FRESH_SIGN_IN
		) {
			setNeedsSignIn(true);
		} else if (res?.status === 401) {
			router.refresh();
		} else {
			toast.error(account.signIn.errorHeading, {
				description: account.signIn.errorBody,
			});
		}
		setPending(false);
	};

	// Signs out here, so the page this refreshes into is the sign-in form --
	// and a code entered there comes straight back to Settings.
	const onSignInAgain = async () => {
		setPending(true);
		const res = await post('sign-out');
		if (res?.ok) {
			router.refresh();
			return;
		}
		toast.error(account.signIn.errorHeading, {
			description: account.signIn.errorBody,
		});
		setPending(false);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setNeedsSignIn(false);
			}}
		>
			<DialogTrigger
				render={
					<Button
						type="button"
						variant="outline"
						size="lg"
						className={className}
					/>
				}
			>
				{t.deleteButton}
			</DialogTrigger>
			<DialogContent className="gap-6">
				<DialogHeader className="text-left">
					<DialogTitle className="t-h-3">{t.deleteConfirmHeading}</DialogTitle>
					<DialogDescription className="t-b-1 text-pretty">
						{needsSignIn ? t.deleteNeedsSignIn : t.deleteConfirmBody}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						size="lg"
						onClick={() => setOpen(false)}
					>
						{t.deleteCancel}
					</Button>
					{needsSignIn ? (
						<Button
							type="button"
							size="lg"
							disabled={pending}
							onClick={onSignInAgain}
						>
							{t.signInAgain}
						</Button>
					) : (
						<Button
							type="button"
							variant="destructive"
							size="lg"
							disabled={pending}
							onClick={onDelete}
						>
							{pending ? t.deleting : t.deleteConfirm}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
