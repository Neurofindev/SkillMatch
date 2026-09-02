import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '@/app/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox, Input, Select } from '@/components/ui/FormControls';
import { EmptyState, ErrorState } from '@/components/ui/FeedbackStates';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import {
  getFrenchMissionError,
  listMissionSkillOptions,
  missionQueryKeys,
  searchMissions,
  setFavorite,
  type MissionSummary,
} from '@/features/missions/missionApi';
import {
  MISSION_CATEGORIES,
  SKILL_LEVELS,
  WORK_MODES,
} from '@/features/missions/missionSchemas';
import { MissionCard } from '@/features/missions/MissionCard';
import {
  formatSkillLevel,
  missionFiltersFromParams,
  setCsvParam,
} from '@/features/missions/missionView';
import { getAvatarPublicUrl } from '@/features/profiles/avatar';
import { getSupabaseClient } from '@/lib/supabase/client';

const modeLabels = {
  hybrid: 'Hybride',
  local: 'Sur place',
  remote: 'À distance',
} as const;

export function MissionDiscoveryPage({
  favoritesOnly = false,
}: {
  favoritesOnly?: boolean;
}) {
  const auth = useAuth();
  const client = getSupabaseClient();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [params, setSearchParams] = useSearchParams();
  const serializedParams = params.toString();
  const filters = useMemo(
    () =>
      missionFiltersFromParams(
        new URLSearchParams(serializedParams),
        favoritesOnly,
      ),
    [favoritesOnly, serializedParams],
  );
  const [searchTerm, setSearchTerm] = useState(filters.query ?? '');

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSearchTerm(filters.query ?? '');
    });
    return () => window.cancelAnimationFrame(frame);
  }, [filters.query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const normalized = searchTerm.trim();
      if (normalized === (filters.query ?? '')) return;
      setSearchParams(
        (current) => {
          if (normalized) current.set('q', normalized);
          else current.delete('q');
          current.delete('page');
          return current;
        },
        { replace: true },
      );
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [filters.query, searchTerm, setSearchParams]);

  const catalogQuery = useQuery({
    enabled: Boolean(client),
    queryFn: () => listMissionSkillOptions(client!),
    queryKey: missionQueryKeys.catalog,
    staleTime: 10 * 60 * 1000,
  });
  const missionsQuery = useQuery({
    enabled: Boolean(client),
    placeholderData: (previous) => previous,
    queryFn: () => searchMissions(client!, filters),
    queryKey: missionQueryKeys.discovery(filters),
  });
  const [pendingFavoriteId, setPendingFavoriteId] = useState<string>();
  const favoriteMutation = useMutation({
    mutationFn: (mission: MissionSummary) => {
      if (!client || !auth.user) throw new Error('AUTH_REQUIRED');
      setPendingFavoriteId(mission.id);
      return setFavorite(client, auth.user.id, mission.id, !mission.isFavorite);
    },
    onError: (error) => {
      notify({
        description: getFrenchMissionError(error),
        title: 'Favori non enregistré',
        tone: 'danger',
      });
    },
    onSettled: async (_data, _error, mission) => {
      setPendingFavoriteId(undefined);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: missionQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: missionQueryKeys.detail(mission.id),
        }),
      ]);
    },
    onSuccess: (_data, mission) => {
      notify({
        title: mission.isFavorite
          ? 'Mission retirée des favoris'
          : 'Mission ajoutée aux favoris',
        tone: 'success',
      });
    },
  });

  const updateParam = (key: string, value: string) => {
    setSearchParams(
      (current) => {
        if (value) current.set(key, value);
        else current.delete(key);
        if (key !== 'page') current.delete('page');
        return current;
      },
      { replace: true },
    );
  };

  const toggleCsvValue = (
    key: string,
    value: string | number,
    checked: boolean,
  ) => {
    setSearchParams(
      (current) => {
        const values = (current.get(key) ?? '').split(',').filter(Boolean);
        const normalized = String(value);
        const next = checked
          ? Array.from(new Set([...values, normalized]))
          : values.filter((item) => item !== normalized);
        setCsvParam(current, key, next);
        current.delete('page');
        return current;
      },
      { replace: true },
    );
  };

  const shareMission = async (mission: MissionSummary) => {
    const url = `${window.location.origin}/espace/missions/${mission.id}`;
    try {
      if (navigator.share) await navigator.share({ title: mission.title, url });
      else await navigator.clipboard.writeText(url);
      notify({
        title: 'Lien de la mission prêt à être partagé',
        tone: 'success',
      });
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        notify({ title: 'Le lien n’a pas pu être copié', tone: 'danger' });
      }
    }
  };

  const totalPages = Math.max(
    1,
    Math.ceil((missionsQuery.data?.total ?? 0) / filters.pageSize),
  );

  return (
    <section className="missions-page">
      <header className="missions-page-heading">
        <div>
          <p className="eyebrow">
            {favoritesOnly ? 'Sélection personnelle' : 'Missions ouvertes'}
          </p>
          <h1>{favoritesOnly ? 'Mes favoris' : 'Trouver une mission'}</h1>
          <p>
            {favoritesOnly
              ? 'Retrouvez les missions enregistrées dans votre compte.'
              : 'Recherchez un besoin réel et affinez les résultats sans exposer de coordonnées privées.'}
          </p>
        </div>
      </header>

      <div className="mission-discovery-layout">
        <Card className="mission-filters">
          <div className="filter-heading">
            <SlidersHorizontal aria-hidden="true" />
            <h2>Filtres</h2>
          </div>
          <label className="filter-search" htmlFor="mission-search">
            <span>Recherche</span>
            <span className="control-shell">
              <Input
                id="mission-search"
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Titre, besoin ou catégorie"
                type="search"
                value={searchTerm}
              />
              <Search aria-hidden="true" className="control-icon" size={18} />
            </span>
          </label>

          <label>
            <span>Catégorie</span>
            <Select
              onChange={(event) => updateParam('categorie', event.target.value)}
              value={filters.category ?? ''}
            >
              <option value="">Toutes les catégories</option>
              {MISSION_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </label>

          <fieldset>
            <legend>Mode</legend>
            {WORK_MODES.map((mode) => (
              <Checkbox
                checked={filters.workModes.includes(mode)}
                key={mode}
                label={modeLabels[mode]}
                onChange={(event) =>
                  toggleCsvValue('modes', mode, event.target.checked)
                }
              />
            ))}
          </fieldset>

          <label>
            <span>Ville ou région approximative</span>
            <Input
              onChange={(event) => updateParam('ville', event.target.value)}
              placeholder="Ex. Lyon"
              value={filters.city ?? ''}
            />
            <small>
              Les missions à distance restent incluses et ne reçoivent aucun
              score de distance.
            </small>
          </label>

          <details>
            <summary>Compétences</summary>
            <div className="filter-options-scroll">
              {catalogQuery.isLoading ? (
                <Skeleton label="Chargement des compétences" lines={3} />
              ) : null}
              {(catalogQuery.data ?? []).map((skill) => (
                <Checkbox
                  checked={filters.skillIds.includes(skill.id)}
                  key={skill.id}
                  label={skill.name}
                  onChange={(event) =>
                    toggleCsvValue(
                      'competences',
                      skill.id,
                      event.target.checked,
                    )
                  }
                />
              ))}
            </div>
          </details>

          <details>
            <summary>Niveau attendu</summary>
            {SKILL_LEVELS.map((level) => (
              <Checkbox
                checked={filters.requiredLevels.includes(level)}
                key={level}
                label={formatSkillLevel(level)}
                onChange={(event) =>
                  toggleCsvValue('niveaux', level, event.target.checked)
                }
              />
            ))}
          </details>

          <div className="form-grid-two">
            <label>
              <span>Budget min.</span>
              <Input
                inputMode="decimal"
                min="0"
                onChange={(event) =>
                  updateParam('budgetMin', event.target.value)
                }
                type="number"
                value={filters.budgetMin ?? ''}
              />
            </label>
            <label>
              <span>Budget max.</span>
              <Input
                inputMode="decimal"
                min="0"
                onChange={(event) =>
                  updateParam('budgetMax', event.target.value)
                }
                type="number"
                value={filters.budgetMax ?? ''}
              />
            </label>
          </div>
          <p className="filter-budget-note">
            Ces montants servent uniquement à décrire la mission.
          </p>

          <div className="form-grid-two">
            <label>
              <span>Début avant le</span>
              <Input
                onChange={(event) =>
                  updateParam('debutAvant', event.target.value)
                }
                type="date"
                value={filters.startsBefore ?? ''}
              />
            </label>
            <label>
              <span>Fin après le</span>
              <Input
                onChange={(event) =>
                  updateParam('finApres', event.target.value)
                }
                type="date"
                value={filters.endsAfter ?? ''}
              />
            </label>
          </div>

          <Button
            onClick={() => setSearchParams({}, { replace: true })}
            variant="secondary"
          >
            Réinitialiser les filtres
          </Button>
        </Card>

        <div className="mission-results" aria-live="polite">
          <div className="mission-results-toolbar">
            <p>
              <strong>{missionsQuery.data?.total ?? 0}</strong>{' '}
              {(missionsQuery.data?.total ?? 0) > 1 ? 'missions' : 'mission'}
            </p>
            <label>
              <span>Trier par</span>
              <Select
                onChange={(event) => updateParam('tri', event.target.value)}
                value={filters.sort}
              >
                <option value="relevance">Pertinence</option>
                <option value="newest">Plus récent</option>
                <option value="budget_desc">Budget décroissant</option>
              </Select>
            </label>
          </div>

          {missionsQuery.isLoading ? (
            <div className="mission-grid" aria-label="Chargement des missions">
              {Array.from({ length: 6 }, (_, index) => (
                <Card className="mission-card-skeleton" key={index}>
                  <Skeleton label="Chargement d’une mission" lines={6} />
                </Card>
              ))}
            </div>
          ) : null}

          {missionsQuery.isError ? (
            <ErrorState
              action={{
                label: 'Réessayer',
                onClick: () => void missionsQuery.refetch(),
              }}
              description={getFrenchMissionError(missionsQuery.error)}
              title="Les missions ne peuvent pas être chargées"
            />
          ) : null}

          {missionsQuery.data && missionsQuery.data.items.length === 0 ? (
            <EmptyState
              description={
                favoritesOnly
                  ? 'Ajoutez une mission depuis la découverte pour la retrouver ici après rechargement.'
                  : 'Aucune mission réelle ne correspond à ces critères. Élargissez les filtres.'
              }
              icon={favoritesOnly ? <Heart /> : undefined}
              title={
                favoritesOnly ? 'Aucun favori enregistré' : 'Aucun résultat'
              }
            />
          ) : null}

          {missionsQuery.data?.items.length ? (
            <>
              <div className="mission-grid">
                {missionsQuery.data.items.map((mission) => (
                  <MissionCard
                    avatarUrl={
                      client
                        ? getAvatarPublicUrl(client, mission.owner.avatarPath)
                        : undefined
                    }
                    favoritePending={
                      favoriteMutation.isPending &&
                      pendingFavoriteId === mission.id
                    }
                    key={mission.id}
                    mission={mission}
                    onShare={(item) => void shareMission(item)}
                    onToggleFavorite={(item) => favoriteMutation.mutate(item)}
                  />
                ))}
              </div>
              <Pagination
                currentPage={filters.page}
                disabled={missionsQuery.isFetching}
                onPageChange={(page) =>
                  updateParam('page', page === 1 ? '' : String(page))
                }
                totalPages={totalPages}
              />
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function FavoriteMissionsPage() {
  return <MissionDiscoveryPage favoritesOnly />;
}
