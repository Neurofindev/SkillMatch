import type { SupabaseClient } from '@supabase/supabase-js';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { Avatar, Button } from '@/components/ui';
import {
  getAvatarPublicUrl,
  getFrenchAvatarError,
  removeAvatar,
  uploadAvatar,
} from '@/features/profiles/avatar';
import type { SkillLevel } from '@/features/profiles/profileSchemas';
import type { SkillChoice } from '@/features/profiles/profileApi';
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
  defaultLevel = 'intermediate',
  error,
  onCreate,
  onChange,
  options,
  selected,
}: {
  defaultLevel?: SkillLevel;
  error?: string | undefined;
  onCreate: (name: string) => Promise<SkillChoice>;
  onChange: (skills: SelectedSkill[]) => void;
  options: SkillChoice[];
  selected: SelectedSkill[];
}) {
  const selectedById = new Map(selected.map((skill) => [skill.skillId, skill]));
  const [createdSkills, setCreatedSkills] = useState<SkillChoice[]>([]);
  const optionsById = new Map(
    [...options, ...createdSkills].map((skill) => [skill.id, skill]),
  );
  const [name, setName] = useState('');
  const [creationError, setCreationError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const addSkill = async () => {
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    setCreationError('');
    if (normalizedName.length < 2 || normalizedName.length > 80) {
      setCreationError('Saisissez une compétence entre 2 et 80 caractères.');
      return;
    }
    if (/[<>]/.test(normalizedName)) {
      setCreationError('Les caractères < et > ne sont pas autorisés.');
      return;
    }
    if (selected.length >= 12) {
      setCreationError('Vous pouvez renseigner au maximum 12 compétences.');
      return;
    }

    setIsCreating(true);
    try {
      const skill = await onCreate(normalizedName);
      if (selectedById.has(skill.id)) {
        setCreationError('Cette compétence est déjà ajoutée.');
        return;
      }
      setCreatedSkills((current) =>
        current.some((item) => item.id === skill.id)
          ? current
          : [...current, skill],
      );
      onChange([...selected, { level: defaultLevel, skillId: skill.id }]);
      setName('');
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null
          ? (error as { code?: string }).code
          : undefined;
      setCreationError(
        code === '54000'
          ? 'La limite de nouvelles compétences a été atteinte pour aujourd’hui.'
          : code === '22023'
            ? 'Cette compétence ne peut pas être utilisée. Choisissez un autre intitulé.'
            : 'La compétence n’a pas pu être ajoutée. Vérifiez votre connexion puis réessayez.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <fieldset
      aria-describedby={error ? 'skills-error' : 'skills-description'}
      className="skills-fieldset"
    >
      <legend>Compétences et niveaux *</legend>
      <p className="field-description" id="skills-description">
        Saisissez librement entre 1 et 12 compétences. Les niveaux sont
        déclaratifs.
      </p>
      <div className="skill-entry-row">
        <label htmlFor="skill-entry">Ajouter une compétence</label>
        <div>
          <input
            className="form-control"
            id="skill-entry"
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void addSkill();
              }
            }}
            placeholder="Ex. Photographie culinaire"
            value={name}
          />
          <Button
            disabled={!name.trim() || selected.length >= 12}
            isLoading={isCreating}
            loadingLabel="Ajout en cours"
            onClick={() => void addSkill()}
            variant="secondary"
          >
            <Plus aria-hidden="true" size={18} /> Ajouter
          </Button>
        </div>
      </div>
      {creationError ? (
        <p className="field-error" role="alert">
          {creationError}
        </p>
      ) : null}
      {selected.length ? (
        <div className="skills-options">
          {selected.map((current) => {
            const option = optionsById.get(current.skillId);
            return (
              <div className="skill-option" key={current.skillId}>
                <div className="skill-option-heading">
                  <strong>
                    {option?.name ?? `Compétence ${current.skillId}`}
                  </strong>
                  <Button
                    aria-label={`Retirer ${option?.name ?? 'cette compétence'}`}
                    onClick={() =>
                      onChange(
                        selected.filter(
                          (skill) => skill.skillId !== current.skillId,
                        ),
                      )
                    }
                    size="sm"
                    variant="quiet"
                  >
                    <Trash2 aria-hidden="true" size={18} /> Retirer
                  </Button>
                </div>
                <select
                  aria-label={`Niveau pour ${option?.name ?? 'cette compétence'}`}
                  className="form-control"
                  onChange={(event) =>
                    onChange(
                      selected.map((skill) =>
                        skill.skillId === current.skillId
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
              </div>
            );
          })}
        </div>
      ) : (
        <p className="inline-empty">Aucune compétence ajoutée.</p>
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
