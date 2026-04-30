"use_strict";

/**
 * Build and show a small context menu near the given screen
 * coordinates.  Used by TopLevel and MDISubWindow to show the
 * right-click title-bar menu.
 *
 * Supports two interaction styles, like a menubar:
 *   - Click-release: open the menu on mouseup (or contextmenu), then
 *     a separate click on a menu item activates it.
 *   - Press-drag: open the menu on mousedown, drag onto an item, and
 *     release to activate.  Pass `armed: true` to enable this — the
 *     caller hooks up the menu opening on mousedown and forwards the
 *     event so we can wire mouseup to either fire an item or close.
 *
 * @param {number} clientX - Mouse position (clientX from event).
 * @param {number} clientY - Mouse position (clientY from event).
 * @param {Array<{label: string, action: Function} | null>} items
 *   Menu items in display order.  null entries become separators.
 * @param {Object} [opts]
 * @param {boolean} [opts.armed=false] - When true, the menu listens
 *   for mouseup-on-item to activate (press-drag style).  The caller
 *   must pass the originating mousedown event so the immediate
 *   mouseup that follows the open press doesn't fire.
 * @param {Event}   [opts.openEvent=null] - The originating event
 *   (only used when armed is true) so we can ignore the matching
 *   mouseup if the user releases without moving.
 */
function showWindowMenu(clientX, clientY, items, opts={}) {
    // Dismiss any existing window menu before showing a new one.
    let existing = document.querySelector('.window-context-menu');
    if (existing) existing.remove();

    let menu = document.createElement('div');
    menu.className = 'window-context-menu';
    menu.style.position = 'fixed';
    menu.style.left = clientX + 'px';
    menu.style.top = clientY + 'px';
    menu.style.zIndex = '100000';

    let armed = !!opts.armed;

    let activateItem = (item) => {
        menu.remove();
        try {
            item.action();
        } catch (err) {
            console.error("[WindowMenu] action error:", err);
        }
    };

    for (let item of items) {
        if (item == null) {
            let sep = document.createElement('div');
            sep.className = 'window-context-separator';
            menu.appendChild(sep);
            continue;
        }
        let entry = document.createElement('div');
        entry.className = 'window-context-item';
        entry.textContent = item.label;
        // Stash the item so the global mouseup handler can find it.
        entry._wmItem = item;
        entry.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        entry.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            activateItem(item);
        });
        menu.appendChild(entry);
    }

    document.body.appendChild(menu);

    // Clamp inside the viewport.
    let rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        menu.style.left = (window.innerWidth - rect.width - 4) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        menu.style.top = (window.innerHeight - rect.height - 4) + 'px';
    }

    let armedMouseUpFired = false;
    let onArmedMouseUp = (e) => {
        // First armed mouseup from anywhere: decide whether to activate
        // or to disarm into click-mode.
        document.removeEventListener('mouseup', onArmedMouseUp, true);
        armedMouseUpFired = true;
        let entry = e.target && e.target.closest
            ? e.target.closest('.window-context-item') : null;
        if (entry && entry._wmItem) {
            e.preventDefault();
            e.stopPropagation();
            activateItem(entry._wmItem);
            return;
        }
        // If the user released over the menu (e.g. the bare frame) or
        // didn't move from where they pressed, transition into
        // click-mode: keep the menu open and wait for a normal click.
        // Otherwise dismiss.
        if (menu.contains(e.target)) return;
        menu.remove();
    };

    // Close on any outside click or Escape.  In click-mode (after the
    // armed press-drag has resolved into an open menu), this is what
    // dismisses the menu.
    let dismiss = (e) => {
        if (e && e.target && menu.contains(e.target)) return;
        menu.remove();
        document.removeEventListener('mousedown', dismiss, true);
        document.removeEventListener('contextmenu', dismiss, true);
        window.removeEventListener('blur', dismiss);
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('mouseup', onArmedMouseUp, true);
    };
    let onKey = (e) => {
        if (e.key === 'Escape') dismiss();
    };
    setTimeout(() => {
        document.addEventListener('mousedown', dismiss, true);
        document.addEventListener('contextmenu', dismiss, true);
        window.addEventListener('blur', dismiss);
        document.addEventListener('keydown', onKey, true);
    }, 0);
    if (armed) {
        document.addEventListener('mouseup', onArmedMouseUp, true);
    }
}

export { showWindowMenu };
