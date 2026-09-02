import {
  CalendarDays,
  Heart,
  Info,
  MapPin,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { MissionSummary } from '@/features/missions/missionApi';
import {
  formatMissionBudget,
  formatMissionDate,
  formatMissionStatus,
  getMissionLocation,
} from '@/features/missions/missionView';

interface MissionCardProps {
  avatarUrl?: string | undefined;
  favoritePending?: boolean;
  mission: MissionSummary;
  onShare: (mission: MissionSummary) => void;
  onToggleFavorite: (mission: MissionSummary) => void;
}

export function MissionCard({
  avatarUrl,
  favoritePending = false,
  mission,
  onShare,
  onToggleFavorite,
}: MissionCardProps) {
  return (
    <Card className="mission-card" interactive>
      <div className="mission-card-heading">
        <div>
          <div className="mission-badges">
            <Badge tone="primary">{mission.category}</Badge>
            <Badge>{formatMissionStatus(mission.status)}</Badge>
          </div>
          <h2>
            <Link to={`/espace/missions/${mission.id}`}>{mission.title}</Link>
          </h2>
        </div>
        <Button
          aria-label={
            mission.isFavorite
              ? `Retirer ${mission.title} des favoris`
              : `Ajouter ${mission.title} aux favoris`
          }
          className={mission.isFavorite ? 'is-favorite' : undefined}
          isLoading={favoritePending}
          onClick={() => onToggleFavorite(mission)}
          size="sm"
          variant="quiet"
        >
          <Heart
            aria-hidden="true"
            fill={mission.isFavorite ? 'currentColor' : 'none'}
          />
        </Button>
      </div>

      <p className="mission-card-description">{mission.description}</p>

      <ul className="mission-facts" aria-label="Informations principales">
        <li>
          <MapPin aria-hidden="true" size={18} />
          {getMissionLocation(mission)}
        </li>
        <li>
          <CalendarDays aria-hidden="true" size={18} />
          Du {formatMissionDate(mission.startsOn)} au{' '}
          {formatMissionDate(mission.endsOn)}
        </li>
        <li>
          <Info aria-hidden="true" size={18} />
          {formatMissionBudget(mission)}
        </li>
      </ul>

      <ul className="mission-skills" aria-label="Compétences requises">
        {mission.skills.slice(0, 5).map((skill) => (
          <li key={skill.id}>{skill.name}</li>
        ))}
      </ul>

      <div className="mission-owner">
        <Avatar
          name={mission.owner.displayName}
          size="sm"
          {...(avatarUrl ? { src: avatarUrl } : {})}
        />
        <div>
          <strong>{mission.owner.displayName}</strong>
          <span>@{mission.owner.username}</span>
        </div>
        {mission.owner.emailVerified ? (
          <Badge aria-label="E-mail confirmé par Supabase" tone="success">
            <ShieldCheck aria-hidden="true" size={14} /> E-mail vérifié
          </Badge>
        ) : null}
      </div>

      <div className="mission-card-actions">
        <Link
          className="button button-primary"
          to={`/espace/missions/${mission.id}`}
        >
          Consulter la mission
        </Link>
        <Button onClick={() => onShare(mission)} variant="secondary">
          <Share2 aria-hidden="true" size={18} /> Partager
        </Button>
      </div>
    </Card>
  );
}
