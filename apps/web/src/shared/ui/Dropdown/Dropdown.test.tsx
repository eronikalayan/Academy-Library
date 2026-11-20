import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dropdown } from './Dropdown';
import { DropdownItem } from './DropdownItem';
import { DropdownMenu } from './DropdownMenu';
import { DropdownTrigger } from './DropdownTrigger';

function renderMenu(onSelect: () => void = () => undefined) {
  return render(
    <Dropdown>
      <DropdownTrigger>Actions</DropdownTrigger>
      <DropdownMenu>
        <DropdownItem onClick={onSelect}>Rename</DropdownItem>
        <DropdownItem>Share</DropdownItem>
        <DropdownItem destructive>Delete</DropdownItem>
      </DropdownMenu>
    </Dropdown>,
  );
}

describe('Dropdown', () => {
  it('opens on trigger click and focuses the first menu item', async () => {
    const user = userEvent.setup();
    renderMenu();

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Actions' }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
  });

  it('moves focus between items with ArrowDown/ArrowUp, wrapping at the ends', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: 'Actions' }));

    const rename = screen.getByRole('menuitem', { name: 'Rename' });
    const share = screen.getByRole('menuitem', { name: 'Share' });
    const destroy = screen.getByRole('menuitem', { name: 'Delete' });

    await user.keyboard('{ArrowDown}');
    expect(share).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(destroy).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(rename).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(destroy).toHaveFocus();
  });

  it('selecting an item runs its handler and closes the menu', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderMenu(onSelect);

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    renderMenu();

    const trigger = screen.getByRole('button', { name: 'Actions' });
    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes when clicking outside the trigger and menu', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });
});
