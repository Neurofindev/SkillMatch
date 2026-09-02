import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormField, Input } from '@/components/ui/FormControls';

describe('FormField', () => {
  it('relie la description et l’erreur au contrôle', () => {
    render(
      <FormField
        description="Format attendu : nom@exemple.fr"
        error="Adresse invalide"
        id="email"
        label="Adresse e-mail"
        required
      >
        {(field) => <Input {...field} />}
      </FormField>,
    );

    const input = screen.getByLabelText(/Adresse e-mail/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      'Format attendu : nom@exemple.fr Adresse invalide',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Adresse invalide');
  });
});
