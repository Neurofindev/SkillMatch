import { Link } from 'react-router-dom';

const footerLinks = [
  { label: 'Confidentialité', to: '/confidentialite' },
  { label: 'Conditions', to: '/conditions' },
  { label: 'Règles de communauté', to: '/regles-communaute' },
  { label: 'Contact et signalement', to: '/contact' },
] as const;

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="footer-inner">
        <div>
          <Link className="brand" to="/" aria-label="SkillMatch, accueil">
            <span aria-hidden="true">S</span>
            SkillMatch
          </Link>
          <p>Une mise en relation claire entre besoins et compétences.</p>
        </div>
        <nav aria-label="Informations légales">
          {footerLinks.map((item) => (
            <Link key={item.to} to={item.to}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
