import { Pass } from "../../lib/types";

interface PaginationProps {
    pagination: {
        currentPage: number;
        totalPages: number;
        itemsPerPage: number;
        totalItems: number;
        onPageChange: (page: number) => void;
    };
    passSummaries: Pass[];
}

export const Pagination: React.FC<PaginationProps> = ({ pagination, passSummaries }) => {
    if (passSummaries.length === 0) {
        return null;
    }
    return (
        <div className="pagination-container">
          <div className="pagination-controls">
            <button
              className="pagination-button"
              disabled={pagination.currentPage === 1}
              onClick={() => pagination.onPageChange(1)}
            >
              &laquo; First
            </button>
            <button
              className="pagination-button"
              disabled={pagination.currentPage === 1}
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
            >
              &lt; Prev
            </button>

            {/* Page numbers */}
            {(() => {
              const pages = [];
              const maxVisible = 5; // Max visible page numbers
              let startPage = Math.max(1, pagination.currentPage - Math.floor(maxVisible / 2));
              let endPage = Math.min(pagination.totalPages, startPage + maxVisible - 1);

              if (endPage - startPage + 1 < maxVisible) {
                startPage = Math.max(1, endPage - maxVisible + 1);
              }

              for (let i = startPage; i <= endPage; i++) {
                pages.push(
                  <button
                    key={i}
                    className={`pagination-button ${pagination.currentPage === i ? 'active' : ''}`}
                    onClick={() => pagination.onPageChange(i)}
                  >
                    {i}
                  </button>
                );
              }
              return pages;
            })()}

            <button
              className="pagination-button"
              disabled={pagination.currentPage === pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
            >
              Next &gt;
            </button>
            <button
              className="pagination-button"
              disabled={pagination.currentPage === pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.totalPages)}
            >
              Last &raquo;
            </button>
          </div>
        </div>
    );
};