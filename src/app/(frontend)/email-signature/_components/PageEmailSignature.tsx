'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/Button';

const INSTRUCTIONS_LIST = [
	{
		title: 'Gmail (app)',
		url: 'https://support.google.com/mail/answer/8395?hl=en&co=GENIE.Platform%3DAndroid',
	},
	{
		title: 'Gmail (web)',
		url: 'https://support.google.com/mail/answer/8395?hl=en&co=GENIE.Platform%3DDesktop',
	},
	{
		title: 'Apple Mail (Mac)',
		url: 'https://www.hubspot.com/email-signature-generator/add-html-signature-mail-mac',
	},
	{
		title: 'IOS',
		url: 'https://support.dominionlending.ca/hc/en-us/articles/360061469614-How-do-I-add-my-email-signature-to-Apple-Mail-iPhone',
	},
];

const ICON_COLOR = ['black', 'white'];
type PageEmailSignature = {
	siteUrl: string;
};
export function PageEmailSignature({ siteUrl }: PageEmailSignature) {
	const COPY_TEXT_INITIAL = 'Click to copy';
	const COPY_TEXT_CLICKED = 'Copied!';
	const clipboardRef = useRef<HTMLTableElement>(null);
	const [buttonText, setButtonText] = useState(COPY_TEXT_INITIAL);

	const [name, setName] = useState('Blackwater RC');
	const [position, setPosition] = useState('');
	const [subtext, setSubtext] = useState(
		'A running community exploring movement & meaning.'
	);
	const [iconColor, setIconColor] = useState('black');

	// Copy the signature's own markup rather than a DOM selection: a
	// selection copy inlines the page's computed styles (Tailwind resets,
	// fonts, custom properties) onto every element, so the pasted
	// signature carries styles we never wrote and renders differently per
	// mail client. Only the inline styles below reach the clipboard.
	const onHandleCopy = async () => {
		const table = clipboardRef.current;
		if (!table) return;

		const html = table.outerHTML;
		const text = table.innerText;

		let copied = true;
		try {
			await navigator.clipboard.write([
				new ClipboardItem({
					'text/html': new Blob([html], { type: 'text/html' }),
					'text/plain': new Blob([text], { type: 'text/plain' }),
				}),
			]);
		} catch {
			// No async Clipboard API (insecure context, older Firefox) or
			// permission denied: fall back to execCommand, still writing
			// our own markup via the copy event rather than a selection.
			const onCopy = (e: ClipboardEvent) => {
				e.clipboardData?.setData('text/html', html);
				e.clipboardData?.setData('text/plain', text);
				e.preventDefault();
			};
			document.addEventListener('copy', onCopy);
			copied = document.execCommand('copy');
			document.removeEventListener('copy', onCopy);
		}

		setButtonText(copied ? COPY_TEXT_CLICKED : 'Copy failed');
		setTimeout(() => {
			setButtonText(COPY_TEXT_INITIAL);
		}, 2000);
	};

	const onHandleInputName = (e: React.ChangeEvent<HTMLInputElement>) => {
		setName(e.target.value);
	};

	const onHandleInputPosition = (e: React.ChangeEvent<HTMLInputElement>) => {
		setPosition(e.target.value);
	};

	const onHandleInputSubtext = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setSubtext(e.target.value);
	};

	const onHandleInputColor = (e: React.ChangeEvent<HTMLInputElement>) => {
		setIconColor(e.target.value);
	};

	return (
		<div className="p-contain flex flex-col items-center justify-center gap-10 pt-[calc(var(--height-header)+60px)]">
			<div className="flex max-w-md flex-col gap-4">
				<div className="flex w-full flex-wrap gap-2">
					<div className="flex flex-1 flex-col gap-1">
						<label htmlFor="email-signature-name" className="t-l-1 mb-1">
							Name
						</label>
						<input
							id="email-signature-name"
							type="text"
							value={name}
							placeholder="Enter your name"
							onChange={onHandleInputName}
							className="bg-alabaster rounded border border-white px-2 py-1"
						/>
					</div>
					<div className="flex flex-1 flex-col gap-1">
						<label htmlFor="email-signature-position" className="t-l-1 mb-1">
							Position
						</label>
						<input
							id="email-signature-position"
							type="text"
							value={position}
							placeholder="Enter your position"
							onChange={onHandleInputPosition}
							className="bg-alabaster rounded border border-white px-2 py-1"
						/>
					</div>
				</div>
				<div className="flex w-full flex-col gap-1">
					<label htmlFor="email-signature-subtext" className="t-l-1 mb-1">
						Subtext
					</label>
					<textarea
						id="email-signature-subtext"
						value={subtext}
						placeholder="Enter your subtext"
						rows={3}
						onChange={onHandleInputSubtext}
						className="bg-alabaster min-h-12 rounded border border-white px-2 py-1"
					/>
				</div>
				<fieldset className="hidden w-full rounded border border-white p-4">
					<legend className="t-l-1 bg-alabaster px-2">Icon Color</legend>
					<div className="grid grid-cols-3 items-center gap-3">
						{ICON_COLOR.map((color, i) => (
							<div key={i} className="flex items-center">
								<input
									type="radio"
									id={`icon-color-${color}`}
									name="icon-color"
									value={color}
									checked={iconColor === color}
									onChange={onHandleInputColor}
									className="radius-full size-4 min-h-0 min-w-0 flex-none border border-white checked:bg-black"
								/>
								<label
									htmlFor={`icon-color-${color}`}
									className="t-l-1 capitalize"
								>
									{color}
								</label>
							</div>
						))}
					</div>
				</fieldset>
			</div>
			<div className="rounded-xs bg-white p-3">
				<table
					ref={clipboardRef}
					role="presentation"
					border={0}
					cellPadding={0}
					cellSpacing={0}
					style={{ borderCollapse: 'collapse' }}
				>
					<tbody>
						<tr>
							<td style={{ paddingRight: '15px', verticalAlign: 'middle' }}>
								<a
									href={`${siteUrl}/?ref=email-sig`}
									target="_blank"
									rel="noreferrer"
								>
									{/* display:block drops the inline descender gap under
									    the image; border:0 stops older clients framing a
									    linked image in link blue. */}
									<img
										width="50"
										height="50"
										alt="Blackwater RC Logo"
										src={`${siteUrl}/blackwater_wordmark_white.jpg`}
										style={{ display: 'block', border: 0 }}
									/>
								</a>
							</td>
							<td
								style={{
									verticalAlign: 'middle',
									fontFamily: 'Helvetica, Arial, sans-serif',
									fontSize: '12px',
									lineHeight: 1.25,
									color: 'black',
								}}
							>
								{/* <div>, not <p>: mail clients apply their own default
								    <p> margins, which the page's CSS reset hides here. */}
								<div>
									<strong>{name}</strong>
									{position ? ` ${position}` : ''}
								</div>
								{subtext && <div>{subtext}</div>}
								<div>
									<a
										href={`${siteUrl}/?ref=email-sig`}
										target="_blank"
										rel="noreferrer"
										style={{ color: 'black', textDecoration: 'underline' }}
									>
										Website
									</a>
									&nbsp;|&nbsp;
									<a
										href="https://www.instagram.com/blackwater.rc"
										target="_blank"
										rel="noreferrer"
										style={{ color: 'black', textDecoration: 'underline' }}
									>
										IG
									</a>
									&nbsp;|&nbsp;
									<a
										href="https://linktr.ee/blackwater.rc"
										target="_blank"
										rel="noreferrer"
										style={{ color: 'black', textDecoration: 'underline' }}
									>
										Events
									</a>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<Button aria-label="Click to copy email signature" onClick={onHandleCopy}>
				{buttonText}
			</Button>

			<div className="flex flex-col items-center gap-5">
				<p>Instructions:</p>
				<ul className="flex flex-wrap justify-center gap-5">
					{INSTRUCTIONS_LIST.map((item, i) => (
						<li key={i}>
							<Link
								href={item.url}
								target="_blank"
								rel="noreferrer"
								className={buttonVariants()}
							>
								{item.title}
							</Link>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
