import { HttpLoanRepository } from './httpLoanRepository';
import type { LoanRepository } from './LoanRepository';

export type { LoanRepository } from './LoanRepository';
export { HttpLoanRepository } from './httpLoanRepository';

export const loanRepository: LoanRepository = new HttpLoanRepository();
