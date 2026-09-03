'use client';

import {
	createContext,
	useCallback,
	useContext,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent,
	type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { EyeClosedIcon, EyeOpenIcon } from '@sanity/icons';
import { Button, Text, Tooltip } from '@sanity/ui';
import {
	set,
	unset,
	type ObjectItem,
	type ObjectItemProps,
	type PreviewProps,
} from 'sanity';

// The eye button on a `pageModules` array row. It toggles the module's `hidden`
// flag so an editor can park a section instead of deleting it -- deleting the
// array item is the only alternative the Studio offers, and it throws away the
// module's content. The schema half of the pair (the field, and the validation
// exemption) is objects/page-module.ts.
//
// WHERE THE EYE SITS, and why it takes a portal.
//
// It belongs in the row's trailing control cluster, beside the "..." menu. (The
// drag handle is NOT in that cluster -- RowLayout renders [handle, preview,
// cluster], so the handle leads and the cluster trails.) The cluster is filled
// from PreviewItem's internal `menu`/`presence`/`validation` props: no prop on
// ObjectItemProps reaches it and there is no array-item action API, so React
// alone cannot put anything there.
//
// A portal can. `renderDefault` is still called, so nothing native is re-owned:
// insert before/after, the error marker for a nested field, duplicate/copy key
// regeneration, the max-reached guard and the edit dialog all remain Sanity's.
//
// FINDING THE CLUSTER. Two properties matter and both were got wrong once:
//
//  - Scope. The lookup runs against THIS row's subtree, not the document. Form
//    ids are the item's path (`pageModules[_key=="ab12"]`) and are namespaced by
//    neither pane nor document, so a document open beside its duplicate -- or a
//    split pane -- makes `document.getElementById` resolve both rows to the
//    first match: one row got two eyes, the other none.
//  - Depth. `closest('[data-ui="Flex"]')`, never `parentElement`. Sanity's
//    internal Button wraps itself in a tooltip `<span>` when `tooltipProps` is
//    set, and ContextMenuButton always sets them -- so the button's parent may
//    be that span rather than the cluster, which would nest the eye inside the
//    "..." tooltip trigger and double the tooltips. `closest` lands on the
//    cluster Flex under either DOM shape.
//
// The effect is keyed on `readOnly` -- that is what makes the cluster appear or
// vanish -- and `isConnected` is checked at render instead: the cluster is conditionally rendered
// (`(presence || validation || menu) && <Flex>`) and `menu` is null when
// read-only or when the array sets `disableActions`, so the node we captured can
// be torn out from under us. Re-measuring is a no-op when nothing moved --
// setState bails on Object.is.
//
// When there is no cluster the toggle falls back into the preview's `status`
// slot, which is where it used to live. Read-only rows always take that path
// (Sanity nulls `menu` for them), and so would a Studio upgrade that moves the
// anchor -- a placement regression rather than a missing control.
//
// The Studio is a client-only React app, which is what makes a post-mount portal
// safe here; do not copy the pattern into anything server-rendered.

type Visibility = {
	isHidden: boolean;
	toggle: () => void;
	readOnly: boolean;
	/** Distinguishes rows: see the note where it is built. */
	name: string;
};

// Provided only when the toggle needs rendering in the preview. When the item
// portals it into the cluster there is nothing for the preview to add, and the
// same preview component is also resolved for surfaces that are not a row.
const VisibilityContext = createContext<Visibility | null>(null);

const MENU_BUTTON = '[data-testid="array-item-menu-button"]';
const CLUSTER = '[data-ui="Flex"]';
const CONTENTS = { display: 'contents' } as const;

const EyeToggle = ({ isHidden, toggle, readOnly, name }: Visibility) => {
	// Derived here, not passed in: the tooltip and the aria-label are the only
	// two consumers and they must agree, so computing it at the point of use
	// makes that structural rather than incidental.
	const label = isHidden ? 'Show this section' : 'Hide this section';
	// Read-only: report the state, claim none of the interaction, and let the
	// click reach the row so it still opens the module to view. `role="img"`
	// because the name has to land on an element whose role permits one -- on
	// @sanity/ui's `Text` (a styled div, implicit role `generic`) an `aria-label`
	// is ignored outright, so this branch announced nothing at all.
	if (readOnly) {
		return (
			<Text
				size={1}
				muted
				role="img"
				aria-label={`${isHidden ? 'Hidden' : 'Visible'}: ${name}`}
			>
				{isHidden ? <EyeClosedIcon /> : <EyeOpenIcon />}
			</Text>
		);
	}

	// Only `stopPropagation`, never `preventDefault`: in the fallback placement
	// the eye sits inside the row's own <button>, so the click must not reach it
	// -- but preventing the default also stopped the eye from taking focus, so
	// its focus ring and tooltip only ever appeared via Tab.
	const stop = (event: MouseEvent | KeyboardEvent) => event.stopPropagation();

	const activate = (event: MouseEvent | KeyboardEvent) => {
		stop(event);
		toggle();
	};

	return (
		<Tooltip portal content={<Text size={1}>{label}</Text>}>
			<Button
				// A span, not a button: in the fallback placement this renders inside
				// the row's own <button>, where a nested one is invalid HTML. `type` is
				// meaningless on a span; if @sanity/ui reapplies its default the
				// attribute is inert either way.
				as="span"
				type={undefined}
				role="button"
				tabIndex={0}
				mode="bleed"
				padding={2}
				icon={isHidden ? EyeClosedIcon : EyeOpenIcon}
				aria-label={`${label}: ${name}`}
				style={{ cursor: 'pointer' }}
				onMouseDown={stop}
				onClick={activate}
				// Space activates on keyUP, matching a real button. On keydown it
				// fired once per OS auto-repeat tick, so holding the key emitted a
				// burst of patches. Keydown still preventDefaults Space to kill the
				// page scroll, and Enter activates there because that is where a
				// native button handles it.
				onKeyDown={(event: KeyboardEvent) => {
					if (event.key === 'Enter') activate(event);
					else if (event.key === ' ') event.preventDefault();
				}}
				onKeyUp={(event: KeyboardEvent) => {
					if (event.key === ' ') activate(event);
				}}
			/>
		</Tooltip>
	);
};

export const PageModuleItem = (props: ObjectItemProps) => {
	const { index, inputProps, readOnly, renderDefault, schemaType } = props;
	const { onChange } = inputProps;

	// `?.` is deliberate: `value` is typed non-optional but that is a
	// compile-time guarantee only, and PreviewItem renders a row while its
	// initial value is still resolving. A throw here is not contained to one row
	// -- it trips the form's error boundary and blanks the whole array.
	const isHidden =
		(props.value as (ObjectItem & { hidden?: boolean }) | undefined)?.hidden ===
		true;

	// Names the ACTION, which is why there is no `aria-pressed` beside it:
	// "Show this section, pressed" reads as a contradiction.
	// `props.title` on an array item is the SCHEMA TYPE's title, not the row's
	// prepared preview title -- Sanity passes `member.item.schemaType.title`, and
	// the prepared value only ever reaches PreviewProps. So it is the same string
	// for every row of a type, and three heroBlocks would offer three buttons all
	// named "Hide this section: Hero". The 1-based position is what actually
	// distinguishes them, and the item already has it.
	const name = `${schemaType.title || schemaType.name} ${index + 1}`;

	const toggle = useCallback(() => {
		// `inputProps.onChange` is ArrayOfObjectsItem's handleChange, which
		// prefixes every path with `{_key: member.key}` -- so these paths are
		// relative to THIS item. A top-level ['hidden'] would patch the document.
		//
		// `unset` on the way back rather than `set(false)`: absent means visible,
		// which is what keeps the GROQ predicate free of a backfill migration.
		onChange(isHidden ? unset(['hidden']) : set(true, ['hidden']));
	}, [isHidden, onChange]);

	const visibility = useMemo<Visibility>(
		() => ({ isHidden, toggle, readOnly: !!readOnly, name }),
		[isHidden, toggle, readOnly, name]
	);

	const rowRef = useRef<HTMLDivElement>(null);
	const [slot, setSlot] = useState<HTMLElement | null>(null);

	// Measured after commit, because the anchor only exists once
	// `renderDefault`'s output is in the DOM -- one extra render per row. Keyed
	// on `readOnly` because that is what makes the cluster appear or vanish
	// (Sanity nulls `menu` for read-only rows); a cluster torn out while mounted
	// is caught by the `isConnected` check below rather than by re-measuring, so
	// this does not need to run on every commit.
	//
	// An inserted slot rather than portalling into the cluster directly:
	// `createPortal` APPENDS, which put the eye after the "..." menu at the row's
	// outer edge -- so it read as detached from the row's controls and, worse,
	// became the row's LAST tab stop, reachable only past the menu that holds
	// remove. The slot is inserted before whichever cluster child contains the
	// menu button, so the eye lands ahead of it in both paint and tab order.
	useLayoutEffect(() => {
		const menuButton = rowRef.current?.querySelector(MENU_BUTTON);
		const cluster = menuButton?.closest<HTMLElement>(CLUSTER);
		if (!cluster || !menuButton) {
			// eslint-disable-next-line react-hooks/set-state-in-effect -- see above
			setSlot(null);
			return;
		}

		// The menu's own outermost child of the cluster, not the button itself:
		// Sanity wraps ContextMenuButton in a tooltip <span>, so the button is
		// often a grandchild and `insertBefore(el, menuButton)` would land inside
		// that wrapper.
		const menuChild = Array.from(cluster.children).find((c) =>
			c.contains(menuButton)
		);

		const el = document.createElement('span');
		cluster.insertBefore(el, menuChild ?? null);
		setSlot(el);

		return () => el.remove();
	}, [readOnly]);

	// Checked at render, not just at measure time: the cluster unmounts when its
	// last child goes away, and a detached node would take the portal with it
	// while still suppressing the fallback.
	const target = slot?.isConnected ? slot : null;

	return (
		<VisibilityContext.Provider value={target ? null : visibility}>
			{/* `display: contents` so this generates no box inside the virtualized
			    list item -- it exists only to scope the anchor lookup to this row. */}
			<div ref={rowRef} style={CONTENTS}>
				{renderDefault(props)}
			</div>
			{target ? createPortal(<EyeToggle {...visibility} />, target) : null}
		</VisibilityContext.Provider>
	);
};

export const PageModuleItemPreview = (props: PreviewProps) => {
	const visibility = useContext(VisibilityContext);

	// No context means the item portaled the toggle into the cluster, or this is
	// not an array row at all. `layout` guards the non-row surfaces that would
	// otherwise inherit a control with nowhere sensible to sit.
	if (!visibility || props.layout !== 'default') {
		return props.renderDefault(props);
	}

	// `status` is replaced, not composed: no `renderPreview` call site in Sanity
	// passes one for an array row (the upload indicator rides its own `progress`
	// prop), so there is nothing here to preserve.
	return props.renderDefault({
		...props,
		status: <EyeToggle {...visibility} />,
	});
};

/**
 * Both Studio halves. `item` carries the toggle and portals it into the row's
 * control cluster; `preview` renders it in the `status` slot when there is no
 * cluster — read-only rows, and any Studio upgrade that moves the anchor.
 * Registering only `item` therefore keeps the eye on editable rows but loses the
 * read-only state indicator and that fallback.
 */
export const pageModuleComponents = {
	item: PageModuleItem,
	preview: PageModuleItemPreview,
};
