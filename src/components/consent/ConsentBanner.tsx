'use client';

import { useCallback, useEffect, useState } from 'react';
import CustomLink from '@/components/CustomLink';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/Dialog';
import { Separator } from '@/components/ui/Separator';
import {
	CONSENT_CHANGED_EVENT,
	writeConsentClient,
	DENY_ALL,
	GRANT_ALL,
	type ConsentCategories,
} from '@/lib/consent';
import { useConsent } from '@/hooks/useConsent';
import type { Dictionary } from '@/lib/dictionary';

// Window event other parts of the UI (e.g. a footer "Cookie settings" link)
// dispatch to re-open the preferences dialog.
export const OPEN_CONSENT_EVENT = 'open-consent-preferences';

type ConsentLink = {
	href?: string;
	label?: string;
	isNewTab?: boolean;
	linkType?: 'internal' | 'external';
};

export type ConsentSettings = {
	enabled?: boolean;
	bannerTitle?: string;
	bannerBody?: string;
	acceptAllLabel?: string;
	rejectAllLabel?: string;
	preferencesLabel?: string;
	savePreferencesLabel?: string;
	necessaryTitle?: string;
	necessaryDescription?: string;
	analyticsTitle?: string;
	analyticsDescription?: string;
	marketingTitle?: string;
	marketingDescription?: string;
	privacyPolicyLink?: ConsentLink;
	cookiePolicyLink?: ConsentLink;
} | null;

// Keys shared between the Sanity copy and the localized dictionary fallback.
type ConsentCopyKey =
	| 'bannerTitle'
	| 'bannerBody'
	| 'acceptAllLabel'
	| 'rejectAllLabel'
	| 'preferencesLabel'
	| 'savePreferencesLabel'
	| 'necessaryTitle'
	| 'necessaryDescription'
	| 'analyticsTitle'
	| 'analyticsDescription'
	| 'marketingTitle'
	| 'marketingDescription';

export default function ConsentBanner({
	settings,
	fallback,
}: {
	settings: ConsentSettings;
	// Locale-aware fallback copy, used before the Sanity copy is authored.
	fallback: Dictionary['consent'];
}) {
	const t = (key: ConsentCopyKey) => settings?.[key] || fallback[key];

	// The decision comes straight from the cookie: `undefined` until it has been
	// read, then null (prompt) or the stored choice. Committing below re-reads
	// through the same hook, so there is no local copy to keep in step.
	const consent = useConsent();
	const [prefsOpen, setPrefsOpen] = useState(false);
	// Copied, not the shared DENY_ALL reference: this is component state, and an
	// in-place edit of it would corrupt the exported constant for every consumer.
	const [draft, setDraft] = useState<ConsentCategories>({ ...DENY_ALL });

	// Subscribe to the reopen event so the preferences dialog can be triggered
	// from elsewhere (e.g. the footer "Cookie settings" link). The draft is
	// seeded on open from the same `consent` the banner itself reads, so the
	// dialog and the banner can never disagree — which a second, direct cookie
	// read here would allow. Hence `consent` in the deps: the handler must close
	// over the current decision, not the one at mount.
	useEffect(() => {
		const openPrefs = () => {
			if (consent)
				setDraft({ analytics: consent.analytics, marketing: consent.marketing });
			setPrefsOpen(true);
		};
		window.addEventListener(OPEN_CONSENT_EVENT, openPrefs);
		return () => window.removeEventListener(OPEN_CONSENT_EVENT, openPrefs);
	}, [consent]);

	// Persist, then announce. Everything else — this banner hiding itself, and
	// HeadTrackingCode mounting or updating the tags — follows from re-reading
	// the cookie. This replaces the router.refresh() that used to re-render the
	// server tree: the decision and the scripts are both client-side now, so a
	// server round trip would tell them nothing.
	const commit = useCallback((categories: ConsentCategories) => {
		writeConsentClient(categories);
		window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
		setPrefsOpen(false);
	}, []);

	// Hide entirely when the feature is explicitly disabled in Sanity.
	if (settings?.enabled === false) return null;

	const showBar = consent === null;

	return (
		<>
			{showBar && (
				<div
					role="dialog"
					aria-label={t('bannerTitle')}
					aria-live="polite"
					className="fixed inset-x-0 bottom-0 z-dialog border-t border-foreground/15 bg-background p-x-max py-5 shadow-lg"
				>
					<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						<div className="max-w-2xl">
							<p className="t-b-1 mb-1 font-medium text-foreground">
								{t('bannerTitle')}
							</p>
							<p className="t-l-2 text-foreground/70">{t('bannerBody')}</p>
							<PolicyLinks settings={settings} className="mt-2" />
						</div>
						<div className="flex flex-wrap gap-2 justify-end">
							<Button variant="outline" onClick={() => setPrefsOpen(true)}>
								{t('preferencesLabel')}
							</Button>
							<Button variant="outline" onClick={() => commit(DENY_ALL)}>
								{t('rejectAllLabel')}
							</Button>
							<Button onClick={() => commit(GRANT_ALL)}>
								{t('acceptAllLabel')}
							</Button>
						</div>
					</div>
				</div>
			)}

			<Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('preferencesLabel')}</DialogTitle>
						<DialogDescription>{t('bannerBody')}</DialogDescription>
					</DialogHeader>

					<div className="flex flex-col gap-4">
						<CategoryRow
							title={t('necessaryTitle')}
							description={t('necessaryDescription')}
							checked
							disabled
						/>
						<Separator />
						<CategoryRow
							title={t('analyticsTitle')}
							description={t('analyticsDescription')}
							checked={draft.analytics}
							onCheckedChange={(v) => setDraft((d) => ({ ...d, analytics: v }))}
						/>
						<Separator />
						<CategoryRow
							title={t('marketingTitle')}
							description={t('marketingDescription')}
							checked={draft.marketing}
							onCheckedChange={(v) => setDraft((d) => ({ ...d, marketing: v }))}
						/>
					</div>

					<PolicyLinks settings={settings} />

					<DialogFooter>
						<Button variant="outline" onClick={() => commit(DENY_ALL)}>
							{t('rejectAllLabel')}
						</Button>
						<Button onClick={() => commit(draft)}>
							{t('savePreferencesLabel')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function CategoryRow({
	title,
	description,
	checked,
	disabled,
	onCheckedChange,
}: {
	title: string;
	description: string;
	checked: boolean;
	disabled?: boolean;
	onCheckedChange?: (value: boolean) => void;
}) {
	return (
		<div className="flex items-start justify-between gap-4">
			<div className="space-y-1">
				<p className="t-b-2 font-medium text-foreground">{title}</p>
				<p className="t-l-2 text-foreground/60">{description}</p>
			</div>
			<Checkbox
				checked={checked}
				disabled={disabled}
				onCheckedChange={(v) => onCheckedChange?.(v === true)}
				className="mt-0.5"
			/>
		</div>
	);
}

function PolicyLinks({
	settings,
	className,
}: {
	settings: ConsentSettings;
	className?: string;
}) {
	const links = [
		settings?.privacyPolicyLink,
		settings?.cookiePolicyLink,
	].filter((link): link is ConsentLink => !!link?.href);
	if (links.length === 0) return null;
	return (
		<div className={className}>
			{links.map((link, i) => (
				<CustomLink
					key={i}
					link={link}
					className="t-l-2 mr-4 inline-block text-foreground underline underline-offset-2 hover:text-foreground/70"
				>
					{link.label || link.href}
				</CustomLink>
			))}
		</div>
	);
}
