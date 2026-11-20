import {
  LoanCreateInputSchema,
  LoanListResponseSchema,
  LoanSchema,
  LoanUpdateInputSchema,
} from '@academy-library/contracts';
import type { Loan, LoanListQuery, LoanListResponse } from '@academy-library/contracts';
import { apiRequest } from '../../api/httpClient';
import type { LoanRepository } from './LoanRepository';

function buildListQueryString(query: LoanListQuery): string {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  return params.toString();
}

export class HttpLoanRepository implements LoanRepository {
  async listMine(query: LoanListQuery, signal?: AbortSignal): Promise<LoanListResponse> {
    return apiRequest(
      `/loans?${buildListQueryString(query)}`,
      (data) => LoanListResponseSchema.parse(data),
      { signal },
    );
  }

  async listAll(query: LoanListQuery, signal?: AbortSignal): Promise<LoanListResponse> {
    return apiRequest(
      `/loans/all?${buildListQueryString(query)}`,
      (data) => LoanListResponseSchema.parse(data),
      { signal },
    );
  }

  async borrow(resourceId: string, signal?: AbortSignal): Promise<Loan> {
    const body = LoanCreateInputSchema.parse({ resourceId });
    return apiRequest('/loans', (data) => LoanSchema.parse(data), {
      method: 'POST',
      body,
      signal,
    });
  }

  async returnLoan(loanId: string, signal?: AbortSignal): Promise<Loan> {
    const body = LoanUpdateInputSchema.parse({ status: 'RETURNED' });
    return apiRequest(`/loans/${encodeURIComponent(loanId)}`, (data) => LoanSchema.parse(data), {
      method: 'PATCH',
      body,
      signal,
    });
  }
}
