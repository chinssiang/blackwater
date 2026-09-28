/**
 * "Import events" Studio tool: paste an event list or upload a CSV, review the
 * parsed rows, and create them as pEvent DRAFTS for editors to publish.
 *
 * Parsing lives in src/sanity/lib/event-import.ts (tested there). This file only
 * fetches what a row is matched against — saved venues, categories, and the
 * slugs already taken — and writes through the signed-in editor's client, so
 * it needs no token and respects their permissions.
 */
import React, { useCallback, useState } from 'react';
import { apiVersion } from '@/sanity/env';
import {
	CSV_COLUMNS,
	type ImportResult,
	type ImportRow,
	buildEventDraft,
	matchCategory,
	matchLocation,
	parseEventCsv,
	parseEventText,
} from '@/sanity/lib/event-import';
import { UploadIcon } from '@sanity/icons';
import {
	Badge,
	Box,
	Button,
	Card,
	Code,
	Flex,
	Heading,
	Select,
	Stack,
	Text,
	TextArea,
} from '@sanity/ui';
import { definePlugin, useClient } from 'sanity';

type I18nValue = { language?: string; value?: string };
type Venue = { _id: string; name?: I18nValue[] | null };
type Category = {
	_id: string;
	title?: I18nValue[] | null;
	slug?: string | null;
};

type ReviewRow = ImportRow & {
	exists: boolean;
	locationId: string | null;
	categoryId: string | null;
};

const LOOKUP_QUERY = `{
	"venues": *[_type == "gLocation" && !(_id in path("drafts.**"))]{ _id, name },
	"categories": *[_type == "pEventCategory" && !(_id in path("drafts.**"))]{ _id, title, "slug": slug.current },
	"taken": *[_type == "pEvent" && slug.current in $slugs].slug.current
}`;

// Slugs written by hand before the importer existed drop the "bw-" prefix.
const legacySlug = (slug: string) => slug.replace(/^bw-/, '');

const label = (values?: I18nValue[] | null) =>
	values?.find((v) => v.language === 'en')?.value ||
	values?.find((v) => v.value)?.value ||
	'Untitled';

function EventImportTool() {
	const client = useClient({ apiVersion });
	const [text, setText] = useState('');
	const [rows, setRows] = useState<ReviewRow[]>([]);
	const [skipped, setSkipped] = useState<ImportResult['skipped']>([]);
	const [venues, setVenues] = useState<Venue[]>([]);
	const [categories, setCategories] = useState<Category[]>([]);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<{
		tone: 'positive' | 'critical';
		text: string;
	} | null>(null);

	const review = useCallback(
		async (parse: () => ImportResult) => {
			setMessage(null);
			setBusy(true);
			try {
				const result = parse();
				const lookup = await client.fetch<{
					venues: Venue[];
					categories: Category[];
					taken: string[];
				}>(LOOKUP_QUERY, {
					slugs: result.rows.flatMap((r) => [r.slug, legacySlug(r.slug)]),
				});
				setVenues(lookup.venues);
				setCategories(lookup.categories);
				setSkipped(result.skipped);
				setRows(
					result.rows.map((row) => ({
						...row,
						exists:
							lookup.taken.includes(row.slug) ||
							lookup.taken.includes(legacySlug(row.slug)),
						locationId: matchLocation(row, lookup.venues),
						categoryId: matchCategory(row.code, lookup.categories),
					}))
				);
			} catch (error) {
				setMessage({
					tone: 'critical',
					text: String((error as Error).message ?? error),
				});
			} finally {
				setBusy(false);
			}
		},
		[client]
	);

	const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;
		file.text().then((csv) => review(() => parseEventCsv(csv)));
	};

	const ready = rows.filter((row) => !row.exists && row.errors.length === 0);

	const create = async () => {
		setBusy(true);
		setMessage(null);
		try {
			const transaction = client.transaction();
			for (const row of ready) transaction.create(buildEventDraft(row, row));
			await transaction.commit();
			const created = new Set(ready.map((row) => row.slug));
			setRows((current) =>
				current.map((row) =>
					created.has(row.slug) ? { ...row, exists: true } : row
				)
			);
			setMessage({
				tone: 'positive',
				text: `Created ${ready.length} draft event(s). Review and publish them under Events.`,
			});
		} catch (error) {
			setMessage({
				tone: 'critical',
				text: String((error as Error).message ?? error),
			});
		} finally {
			setBusy(false);
		}
	};

	const setLocation = (slug: string, locationId: string) =>
		setRows((current) =>
			current.map((row) =>
				row.slug === slug ? { ...row, locationId: locationId || null } : row
			)
		);

	return (
		<Box padding={4} style={{ maxWidth: 1400, margin: '0 auto' }}>
			<Stack space={5}>
				<Stack space={3}>
					<Heading size={2}>Import events</Heading>
					<Text muted size={1}>
						Each line needs a date in front:{' '}
						<code>
							10/31 • BW 183 SRP / 7:00AM / Sunrise Program 5K @ Taipei Dome
						</code>
						. Paste the Chinese and English lists as separate paragraphs; lines
						are paired by BW number. Lines without a date are skipped. Events
						are created as drafts.
					</Text>
				</Stack>

				<Card padding={3} radius={2} border>
					<Stack space={3}>
						<TextArea
							rows={12}
							value={text}
							onChange={(e) => setText(e.currentTarget.value)}
							placeholder="Paste the event list here…"
							style={{ fontFamily: 'monospace' }}
						/>
						<Flex gap={2} align="center" wrap="wrap">
							<Button
								text="Review pasted list"
								tone="primary"
								disabled={busy || !text.trim()}
								onClick={() => review(() => parseEventText(text))}
							/>
							<Text muted size={1}>
								or
							</Text>
							<Button
								as="label"
								icon={UploadIcon}
								mode="ghost"
								text="Upload .csv"
							>
								<input
									type="file"
									accept=".csv,text/csv"
									hidden
									disabled={busy}
									onChange={onFile}
								/>
							</Button>
							<Text muted size={1}>
								Columns: <code>{CSV_COLUMNS.join(',')}</code>
							</Text>
						</Flex>
					</Stack>
				</Card>

				{message && (
					<Card padding={3} radius={2} tone={message.tone}>
						<Text size={1}>{message.text}</Text>
					</Card>
				)}

				{rows.length > 0 && (
					<Stack space={3}>
						<Flex align="center" justify="space-between" gap={3}>
							<Text size={1} muted>
								{rows.length} event(s) · {ready.length} ready ·{' '}
								{rows.filter((r) => r.exists).length} already exist ·{' '}
								{rows.filter((r) => r.errors.length).length} with errors
							</Text>
							<Button
								text={`Create ${ready.length} draft(s)`}
								tone="positive"
								disabled={busy || ready.length === 0}
								onClick={create}
							/>
						</Flex>
						<Card radius={2} border overflow="auto">
							<table style={{ width: '100%', borderCollapse: 'collapse' }}>
								<thead>
									<tr>
										{[
											'Status',
											'Date',
											'Time',
											'Title',
											'Subtitle',
											'Location',
											'Category',
										].map((h) => (
											<th key={h} style={{ textAlign: 'left', padding: 8 }}>
												<Text size={1} weight="semibold">
													{h}
												</Text>
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{rows.map((row) => (
										<tr
											key={row.slug}
											style={{
												borderTop: '1px solid var(--card-border-color)',
											}}
										>
											<td style={{ padding: 8, verticalAlign: 'top' }}>
												<Stack space={2}>
													{row.errors.length > 0 ? (
														<Badge tone="critical">Error</Badge>
													) : row.exists ? (
														<Badge>Exists</Badge>
													) : (
														<Badge tone="positive">Ready</Badge>
													)}
													{row.errors.map((e) => (
														<Text
															key={e}
															size={0}
															style={{
																color: 'var(--card-badge-critical-fg-color)',
															}}
														>
															{e}
														</Text>
													))}
												</Stack>
											</td>
											<td style={{ padding: 8, verticalAlign: 'top' }}>
												<Text size={1}>{row.date}</Text>
											</td>
											<td style={{ padding: 8, verticalAlign: 'top' }}>
												<Text size={1}>{row.time ?? 'TBA'}</Text>
											</td>
											<td style={{ padding: 8, verticalAlign: 'top' }}>
												<Text size={1}>{row.title}</Text>
											</td>
											<td style={{ padding: 8, verticalAlign: 'top' }}>
												<Stack space={2}>
													<Text size={1}>{row.subtitle.en}</Text>
													<Text size={1} muted>
														{row.subtitle.zh_tw}
													</Text>
												</Stack>
											</td>
											<td
												style={{
													padding: 8,
													verticalAlign: 'top',
													minWidth: 220,
												}}
											>
												<Select
													fontSize={1}
													value={row.locationId ?? ''}
													disabled={busy || row.exists}
													onChange={(e) =>
														setLocation(row.slug, e.currentTarget.value)
													}
												>
													<option value="">
														One-off: {row.location.en} / {row.location.zh_tw}
													</option>
													{venues.map((v) => (
														<option key={v._id} value={v._id}>
															{label(v.name)}
														</option>
													))}
												</Select>
											</td>
											<td style={{ padding: 8, verticalAlign: 'top' }}>
												<Text size={1} muted={!row.categoryId}>
													{row.categoryId
														? label(
																categories.find((c) => c._id === row.categoryId)
																	?.title
															)
														: '—'}
												</Text>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</Card>
					</Stack>
				)}

				{skipped.length > 0 && (
					<Stack space={3}>
						<Text size={1} weight="semibold">
							Skipped ({skipped.length})
						</Text>
						<Card padding={3} radius={2} tone="caution">
							<Stack space={3}>
								{skipped.map((s, i) => (
									<Stack key={i} space={2}>
										<Code size={1}>{s.source}</Code>
										<Text size={0} muted>
											{s.reason}
										</Text>
									</Stack>
								))}
							</Stack>
						</Card>
					</Stack>
				)}
			</Stack>
		</Box>
	);
}

export const eventImportTool = definePlugin({
	name: 'event-import',
	tools: [
		{
			name: 'event-import',
			title: 'Import events',
			icon: UploadIcon,
			component: EventImportTool,
		},
	],
});
