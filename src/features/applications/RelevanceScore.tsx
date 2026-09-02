import { CircleHelp, Info } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import type { RelevanceDetails } from '@/features/applications/applicationApi';

export function RelevanceScore({
  compact = false,
  details,
}: {
  compact?: boolean;
  details: RelevanceDetails;
}) {
  const components = Object.values(details.components);
  return (
    <section
      className="relevance-score"
      aria-label={`Pertinence ${details.score} sur 100`}
    >
      <div className="relevance-score-heading">
        <div>
          <span>Pertinence</span>
          <strong>{Math.round(details.score)}/100</strong>
        </div>
        <Badge tone="info">{details.version}</Badge>
      </div>
      <p className="relevance-notice">
        <Info aria-hidden="true" size={16} /> {details.notice}
      </p>
      <ul className="relevance-factors" aria-label="Facteurs explicatifs">
        {details.factors.slice(0, 3).map((factor) => (
          <li key={factor.label}>
            <span>{factor.label}</span>
            <strong>{Math.round(factor.value)}/100</strong>
          </li>
        ))}
      </ul>
      {!compact ? (
        <>
          <details>
            <summary>Voir la formule détaillée</summary>
            <div className="relevance-components">
              {components.map((component) => (
                <div key={component.label}>
                  <div>
                    <strong>{component.label}</strong>
                    <span>
                      {Math.round(component.score)}/100 · poids{' '}
                      {component.weight}%
                    </span>
                  </div>
                  <progress
                    aria-label={`${component.label} ${Math.round(component.score)} sur 100`}
                    max={100}
                    value={component.score}
                  />
                  <small>{component.detail}</small>
                </div>
              ))}
            </div>
          </details>
          {details.missingData.length ? (
            <div className="relevance-missing">
              <p>
                <CircleHelp aria-hidden="true" size={17} /> Données manquantes
              </p>
              <ul>
                {details.missingData.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
