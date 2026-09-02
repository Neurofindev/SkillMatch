import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/Button';

export interface PaginationProps {
  currentPage: number;
  disabled?: boolean;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  totalPages: number;
}

export function Pagination({
  currentPage,
  disabled = false,
  isLoading = false,
  onPageChange,
  totalPages,
}: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav aria-label="Pagination" className="pagination">
      <Button
        aria-label="Page précédente"
        disabled={disabled || currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        variant="secondary"
      >
        <ChevronLeft aria-hidden="true" size={18} />
        <span className="pagination-label">Précédente</span>
      </Button>
      <div className="pagination-pages">
        {pages.map((page) => (
          <Button
            aria-current={page === currentPage ? 'page' : undefined}
            aria-label={`Page ${page}`}
            disabled={disabled}
            key={page}
            onClick={() => onPageChange(page)}
            variant={page === currentPage ? 'primary' : 'quiet'}
          >
            {page}
          </Button>
        ))}
      </div>
      <Button
        aria-label="Page suivante"
        disabled={disabled || currentPage >= totalPages}
        isLoading={isLoading}
        loadingLabel="Chargement"
        onClick={() => onPageChange(currentPage + 1)}
        variant="secondary"
      >
        <span className="pagination-label">Suivante</span>
        <ChevronRight aria-hidden="true" size={18} />
      </Button>
    </nav>
  );
}
