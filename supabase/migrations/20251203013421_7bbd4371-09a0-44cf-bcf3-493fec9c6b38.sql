-- Add company_id to day_logs for optional company linking
ALTER TABLE public.day_logs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Add daylog_id to tickets for linking tickets created from daylogs
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS daylog_id uuid REFERENCES public.day_logs(id);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_day_logs_company_id ON public.day_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_tickets_daylog_id ON public.tickets(daylog_id);