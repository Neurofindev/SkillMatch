import type { SupabaseClient } from '@supabase/supabase-js';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { Avatar, Button } from '@/components/ui';
import {
  getAvatarPublicUrl,
  getFrenchAvatarError,
  removeAvatar,
  uploadAvatar,
} from '@/features/profiles/avatar';
import type { SkillLevel } from '@/features/profiles/profileSchemas';
import type { SkillOption } from '@/features/profiles/profileApi';
import type { Database } from '@/types/database.generated';

export interface SelectedSkill {
  level: SkillLevel;
  skillId: number;
}

const levelLabels: Record<SkillLevel, string> = {
  advanced: 'Avancé',
  beginner: 'Débutant',
  expert: 'Expert',
  intermediate: 'Intermédiaire',
};

export function SkillsEditor({
  error,
  onChange,
  options,
  selected,
}: {
  error?: string | undefined;
  onChange: (skills: SelectedSkill[]) => void;
  options: SkillOption[];
  selected: SelectedSkill[];
}) {
  const selectedById = new Map(selected.map((skill) => [skill.skillId, skill]));
  return (
    <fieldset
      aria-describedby={error ? 'skills-error' : 'skills-description'}
      className="skills-fieldset"
    >
      <legend>Compétences et niveaux *</legend>
      <p className="field-description" id="skills-description">
        Choisissez entre 1 et 12 compétences. Les niveaux sont déclaratifs.
      </p>
      {options.length === 0 ? (
        <p className="field-error" role="alert">
          Aucune compétence active n’est disponible pour le moment.
        </p>
      ) : (
        <div className="skills-options">
          {options.map((option) => {
            const current = selectedById.get(option.id);
            return (
              <div className="skill-option" key={option.id}>
                <label>
                  <input
                    checked={Boolean(current)}
                    onChange={(event) => {
                      if (event.target.checked) {
                        onChange([
                          ...selected,
                          { level: 'intermediate', skillId: option.id },
                        ]);
                      } else {
                        onChange(
                          selected.filter(
                            (skill) => skill.skillId !== option.id,
                          ),
                        );
                      }
                    }}
                    type="checkbox"
                  />
                  <span>
                    <strong>{option.name}</strong>
                    <small>{option.category}</small>
                  </span>
                </label>
                {current ? (
                  <select
                    aria-label={`Niveau pour ${option.name}`}
                    className="form-control"
                    onChange={(event) =>
                      onChange(
                        selected.map((skill) =>
                          skill.skillId === option.id
                            ? {
                                ...skill,
                                level: event.target.value as SkillLevel,
                              }
                            : skill,
                        ),
                      )
                    }
                    value={current.level}
                  >
                    {Object.entries(levelLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {error ? (
        <p className="field-error" id="skills-error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export function AvatarUploader({
  client,
  displayName,
  onChange,
  path,
  userId,
}: {
  client: SupabaseClient<Database>;
  displayName: string;
  onChange: (path: string | null) => void;
  path: string | null;
  userId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const src = getAvatarPublicUrl(client, path);

  const selectFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setIsBusy(true);
    try {
      onChange(await uploadAvatar(client, userId, file));
    } catch (uploadError) {
      setError(getFrenchAvatarError(uploadError));
    } finally {
      setIsBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    setError(null);
    setIsBusy(true);
    try {
      await removeAvatar(client, userId);
      onChange(null);
    } catch (removeError) {
      setError(getFrenchAvatarError(removeError));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="avatar-uploader">
      <Avatar
        name={displayName || 'Profil'}
        size="lg"
        {...(src ? { src } : {})}
      />
      <div>
        <label className="button button-secondary" htmlFor="profile-avatar">
          <ImagePlus aria-hidden="true" size={18} />
          {isBusy ? 'Traitement…' : 'Choisir une image'}
        </label>
        <input
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={isBusy}
          id="profile-avatar"
          onChange={(event) => void selectFile(event.target.files?.[0])}
          ref={inputRef}
          type="file"
        />
        {path ? (
          <Button
            disabled={isBusy}
            onClick={() => void remove()}
            variant="quiet"
          >
            <Trash2 aria-hidden="true" size={18} /> Retirer l’avatar
          </Button>
        ) : null}
        <p className="field-description">
          JPEG, PNG ou WebP. Compression côté navigateur, maximum stocké : 2
          Mio.
        </p>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
