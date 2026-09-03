import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  SkillsEditor,
  type SelectedSkill,
} from '@/features/profiles/ProfileFields';

describe('saisie libre des compétences', () => {
  it('crée puis sélectionne une compétence saisie par l’utilisateur', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({
      category: 'Saisie utilisateur',
      id: 42,
      name: 'Photographie culinaire',
    });

    function Harness() {
      const [selected, setSelected] = useState<SelectedSkill[]>([]);
      return (
        <SkillsEditor
          onChange={setSelected}
          onCreate={onCreate}
          options={[]}
          selected={selected}
        />
      );
    }

    render(<Harness />);

    await user.type(
      screen.getByLabelText('Ajouter une compétence'),
      '  Photographie   culinaire  ',
    );
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(onCreate).toHaveBeenCalledWith('Photographie culinaire');
    expect(screen.getByText('Photographie culinaire')).toBeVisible();
    expect(
      screen.getByRole('combobox', {
        name: 'Niveau pour Photographie culinaire',
      }),
    ).toHaveValue('intermediate');
  });
});
