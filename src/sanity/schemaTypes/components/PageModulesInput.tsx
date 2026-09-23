/**
 * PageModulesInput — visual picker for the two `pageModules` array fields
 * (p-home.ts, p-general.ts).
 *
 * Replaces the default "Add item" dropdown with a dialog of cards, one per
 * allowed module type. Each card shows the module's title over a live preview of
 * it; clicking a card inserts a new instance of that type with a fresh `_key`.
 * Everything else about the array (drag-reorder, the edit dialog, delete,
 * validation, and the per-row eye toggle from PageModuleItem.tsx) stays
 * Sanity's, because only `arrayFunctions` is swapped in `renderDefault`.
 *
 * Each card's preview is an iframe of `/module-preview/{locale}/{schemaName}`,
 * which renders the real frontend module through `PageModules` from preset
 * data (src/app/module-preview/), so a card cannot drift from what the page
 * ships. The locale is the edited document's own `language`, so a zh_tw page
 * previews its modules in Chinese.
 *
 * A member with no preset would render a 404 card; page-module.test.ts
 * compares the two lists.
 */
import React, { useCallback, useId, useState } from 'react';
import { AddIcon } from '@sanity/icons';
import { Box, Button, Card, Dialog, Grid, Heading, Stack } from '@sanity/ui';
import { DEFAULT_LOCALE, type Locale, isLocale } from '@/lib/i18n';
import { newArrayKey } from '@/lib/sanity-key';
import {
	type ArrayOfObjectsInputProps,
	type InputProps,
	type SchemaType,
	useFormValue,
} from 'sanity';

/** The slice of an array-member schema the picker cards read. */
type ModuleSchema = Pick<SchemaType, 'name' | 'title'>;

// The iframe's own layout viewport. Wide enough that the modules render their
// desktop layout — at the card's size they would all render mobile, which is
// not what an editor is choosing between.
const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = Math.round((PREVIEW_WIDTH * 38) / 60);

// The card's preview box. Fixed rather than measured: `transform: scale()` takes
// no percentage, so a fluid card would need a ResizeObserver per card just to
// turn a width into a number. `Dialog width="auto"` sizes to its content, so
// pinning the box lets the dialog follow, and every card previews at the same
// scale whatever the viewport. `maxWidth: '100%'` below is the backstop for a
// grid track narrower than CARD_WIDTH: the box clips rather than overflowing
// the dialog sideways.
const CARD_WIDTH = 280;
const CARD_SCALE = CARD_WIDTH / PREVIEW_WIDTH;

const GridItem = ({
	schema,
	locale,
	onClick,
}: {
	schema: ModuleSchema;
	locale: Locale;
	onClick: () => void;
}) => {
	const label = schema.title || schema.name;
	const headingId = useId();
	// The feedback `Card as="button"` used to give for free: a tone on hover or
	// keyboard focus, plus a ring for focus. `:focus-visible` is read on focus
	// because an inline style cannot select it, and a mouse click should not
	// leave a ring behind.
	const [hovered, setHovered] = useState(false);
	const [focusVisible, setFocusVisible] = useState(false);
	return (
		<Card
			shadow={1}
			padding={3}
			radius={2}
			tone={hovered || focusVisible ? 'primary' : 'default'}
			style={{ position: 'relative' }}
		>
			{/* The card's one control, stretched over it. A sibling of the heading
			    and the preview rather than their parent, because a <button> may
			    hold neither a heading nor an iframe. Named BY the heading, which is
			    itself hidden from assistive tech, so the type is announced once and
			    the two cannot drift apart. */}
			<button
				type="button"
				aria-labelledby={headingId}
				onClick={onClick}
				onMouseEnter={() => setHovered(true)}
				onMouseLeave={() => setHovered(false)}
				onFocus={(event) =>
					setFocusVisible(event.currentTarget.matches(':focus-visible'))
				}
				onBlur={() => setFocusVisible(false)}
				style={{
					position: 'absolute',
					inset: 0,
					zIndex: 1,
					background: 'transparent',
					border: 0,
					borderRadius: 'inherit',
					cursor: 'pointer',
					outline: focusVisible
						? '2px solid var(--card-focus-ring-color)'
						: 'none',
					outlineOffset: -2,
				}}
			/>
			<Stack padding={1} space={3}>
				<Heading as="h5" size={1} id={headingId} aria-hidden>
					{label}
				</Heading>
				<div
					style={{
						position: 'relative',
						overflow: 'hidden',
						width: CARD_WIDTH,
						maxWidth: '100%',
						height: Math.round(PREVIEW_HEIGHT * CARD_SCALE),
						background: 'var(--card-bg-color, transparent)',
					}}
				>
					{/* `pointer-events: none` so the click lands on the button above,
					    which owns the interaction and already names the type. */}
					<iframe
						src={`/module-preview/${locale}/${schema.name}`}
						title={label}
						loading="lazy"
						tabIndex={-1}
						aria-hidden
						style={{
							position: 'absolute',
							top: 0,
							left: 0,
							width: PREVIEW_WIDTH,
							height: PREVIEW_HEIGHT,
							border: 0,
							pointerEvents: 'none',
							transform: `scale(${CARD_SCALE})`,
							transformOrigin: 'top left',
						}}
					/>
				</div>
			</Stack>
		</Card>
	);
};

// Accepts the full InputProps union (what any components.input slot supplies)
// and narrows: this input is only ever wired onto object arrays.
export const PageModulesInput = (inputProps: InputProps) => {
	const props = inputProps as ArrayOfObjectsInputProps<{
		_key: string;
		_type: string;
	}>;
	const { onInsert, readOnly, schemaType, renderDefault } = props;
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	// pHome and pGeneral are document-localized; a document with no language
	// yet previews in the default one.
	const language = useFormValue(['language']);
	const locale = isLocale(language) ? language : DEFAULT_LOCALE;

	const handleAddItem = (schema: ModuleSchema) => {
		onInsert({
			items: [{ _type: schema.name, _key: newArrayKey() }],
			position: 'after',
			referenceItem: -1,
			open: true,
		});
		// Close after the insert is queued so the dialog doesn't block the
		// item-opened state on the new entry.
		queueMicrotask(() => setIsDialogOpen(false));
	};

	// Memoized because `renderDefault` receives it as a component TYPE: a new
	// function each render would remount the button.
	const ArrayFunctions = useCallback(
		() => (
			<Button
				onClick={() => setIsDialogOpen(true)}
				icon={AddIcon}
				mode="ghost"
				text={`Add item${readOnly ? ' (Read only)' : ''}`}
				disabled={readOnly}
			/>
		),
		[readOnly]
	);

	return (
		<Box>
			<Stack space={3}>
				{renderDefault({
					...props,
					arrayFunctions: ArrayFunctions,
				} as typeof inputProps)}
			</Stack>

			{isDialogOpen && (
				<Dialog
					id="page-modules-input-picker"
					header="Select a section"
					width="auto"
					onClose={() => setIsDialogOpen(false)}
				>
					<Box padding={1}>
						<Grid columns={[1, 1, 2, 2, 3]} gap={3} padding={3}>
							{schemaType.of.map((schema) => (
								<GridItem
									key={schema.name}
									schema={schema}
									locale={locale}
									onClick={() => handleAddItem(schema)}
								/>
							))}
						</Grid>
					</Box>
				</Dialog>
			)}
		</Box>
	);
};
