import 'server-only';
import {
	Body,
	Container,
	Head,
	Hr,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Text,
	render,
} from '@react-email/components';
import { interpolate } from '@/lib/dictionary';
import { type Locale, htmlLangFor } from '@/lib/i18n';
import { createMailTransport } from '@/lib/mail';

// Copy lives here, not in src/dictionaries/, because the dictionaries are
// bundled into the client and this is server-only content -- the same rule
// product-submission's confirmation-email.ts follows.
const COPY = {
	en: {
		subject: 'Your Blackwater RC sign-in code: {code}',
		preview: 'Your sign-in code is {code}. It works for 10 minutes.',
		label: 'Sign-in code',
		intro: 'Here is your code to sign in to Blackwater RC:',
		meta: 'Valid 10 min · Single use',
		expiry: 'It works for 10 minutes.',
		ignore:
			"If you didn't ask to sign in, you can ignore this email. No one can sign in without the code.",
	},
	zh_tw: {
		subject: '您的 Blackwater RC 登入驗證碼：{code}',
		preview: '您的登入驗證碼是 {code}，10 分鐘內有效。',
		label: '登入驗證碼',
		intro: '這是您登入 Blackwater RC 的驗證碼：',
		meta: '10 分鐘內有效 · 僅限使用一次',
		expiry: '10 分鐘內有效。',
		ignore:
			'如果您沒有要求登入，可以忽略這封信。沒有驗證碼，任何人都無法登入。',
	},
} satisfies Record<Locale, Record<string, string>>;

// DESIGN.md's dark tokens as hex, since mail clients know no OKLCH. Dark on
// purpose, not only because the site is: Gmail's app inverts light emails but
// leaves dark ones alone, and a light layout there turns the black wordmark
// into black-on-black.
const INK = '#fafafa'; // --foreground   oklch(0.985)
const PAPER = '#0a0a0a'; // --background oklch(0.145)
const CARD = '#171717'; // --card         oklch(0.205)
const MUTED = '#a1a1a1'; // --muted-fg    oklch(0.708)
const RULE = '#262626'; // oklch(0.269)

const SANS =
	"'Helvetica Neue', Helvetica, Arial, 'PingFang TC', 'Microsoft JhengHei', sans-serif";
// Standing in for Basel Typewriter, which no mail client will load.
const MONO =
	"ui-monospace, 'SF Mono', Menlo, Consolas, 'Courier New', monospace";

const mono = {
	fontFamily: MONO,
	fontSize: '11px',
	lineHeight: '16px',
	letterSpacing: '0.12em',
	textTransform: 'uppercase',
	color: MUTED,
	margin: 0,
} as const;

const body = {
	fontFamily: SANS,
	fontSize: '15px',
	lineHeight: '24px',
	color: INK,
	margin: 0,
} as const;

export function SignInCodeEmail({
	code,
	locale,
	siteUrl,
}: {
	code: string;
	locale: Locale;
	siteUrl: string;
}) {
	const t = COPY[locale];
	return (
		<Html lang={htmlLangFor(locale)} dir="ltr">
			<Head>
				{/* Tells Apple Mail and Outlook the layout is already dark, so they
				    leave it alone rather than re-inverting it. */}
				<meta name="color-scheme" content="dark" />
				<meta name="supported-color-schemes" content="dark" />
			</Head>
			<Preview>{interpolate(t.preview, { code })}</Preview>
			<Body style={{ backgroundColor: PAPER, margin: 0, padding: '40px 0' }}>
				<Container
					style={{
						maxWidth: '480px',
						backgroundColor: CARD,
						border: `1px solid ${RULE}`,
						padding: '32px',
					}}
				>
					{/* A PNG, never the SVG: Gmail strips SVG images. Absolute, so
					    it only loads for a mail client once SITE_URL is public. */}
					<Img
						src={`${siteUrl}/blackwater_wordmark_RGB_blkwtr_wordmark_white.png`}
						alt="Blackwater RC"
						width="120"
						height="34"
					/>
					<Hr style={{ borderColor: RULE, margin: '28px 0' }} />
					<Text style={mono}>{t.label}</Text>
					<Text style={{ ...body, marginTop: '12px' }}>{t.intro}</Text>
					<Section
						style={{
							marginTop: '20px',
							border: `1px solid ${INK}`,
							backgroundColor: PAPER,
							textAlign: 'center',
						}}
					>
						{/* One text run, not a box per digit, so selecting it copies
						    exactly six digits. The left padding balances the
						    letter-spacing after the last digit, which would otherwise
						    push the code off-centre. */}
						<Text
							style={{
								fontFamily: MONO,
								fontSize: '36px',
								lineHeight: '44px',
								letterSpacing: '0.35em',
								color: INK,
								margin: 0,
								padding: '20px 0 20px 0.35em',
							}}
						>
							<strong>{code}</strong>
						</Text>
					</Section>
					<Text style={{ ...mono, marginTop: '12px', textAlign: 'center' }}>
						{t.meta}
					</Text>
					<Text
						style={{
							...body,
							fontSize: '13px',
							lineHeight: '20px',
							color: MUTED,
							marginTop: '28px',
						}}
					>
						{t.ignore}
					</Text>
					<Hr style={{ borderColor: RULE, margin: '28px 0 16px' }} />
					<Text style={mono}>
						<Link
							href={siteUrl}
							style={{ color: MUTED, textDecoration: 'none' }}
						>
							Blackwater RC — Taipei
						</Link>
					</Text>
				</Container>
			</Body>
		</Html>
	);
}

/**
 * The code sits in the subject as well as the body on purpose: most members
 * read the site on a phone, and a code in the subject is readable straight
 * off the notification without leaving the page they are signing in on.
 */
export async function buildSignInCodeEmail(code: string, locale: Locale) {
	const t = COPY[locale];
	const siteUrl = process.env.SITE_URL || 'https://blackwaterrc.com';
	return {
		subject: interpolate(t.subject, { code }),
		// Written out rather than derived from the HTML, so the code keeps a
		// line of its own in clients that show only the text part.
		text: [t.intro, '', code, '', t.expiry, '', t.ignore].join('\n'),
		html: await render(
			<SignInCodeEmail code={code} locale={locale} siteUrl={siteUrl} />
		),
	};
}

/** Sends over the site's shared SMTP account -- see src/lib/mail.ts. */
export async function sendSignInCode({
	email,
	code,
	locale,
}: {
	email: string;
	code: string;
	locale: Locale;
}) {
	const user = process.env.EMAIL_SERVER_USER;
	const pass = process.env.EMAIL_SERVER_PASSWORD;
	if (!user || !pass) {
		throw new Error(
			'Missing environment variable: EMAIL_SERVER_USER / EMAIL_SERVER_PASSWORD'
		);
	}
	const transporter = await createMailTransport({ user, pass });
	await transporter.sendMail({
		from: `"${process.env.EMAIL_DISPLAY_NAME || 'Blackwater RC'}" <${user}>`,
		to: email,
		...(await buildSignInCodeEmail(code, locale)),
	});
}
