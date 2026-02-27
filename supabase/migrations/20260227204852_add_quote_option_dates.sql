-- Add departure and return date columns to quote_options
ALTER TABLE "wa_bridge"."quote_options"
    ADD COLUMN "departure_date" date,
    ADD COLUMN "return_date" date;

-- Recreate the public.quote_options view to pick up new columns
CREATE OR REPLACE VIEW public.quote_options
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.quote_options;

-- Recreate the summary view to include quote dates for the selected quote
CREATE OR REPLACE VIEW public.flight_requests_summary
    WITH (security_invoker = on)
    AS
SELECT
    fr.*,
    c.name                                                                              AS customer_name,
    (SELECT count(*) FROM wa_bridge.flight_request_passengers frp
     WHERE frp.flight_request_id = fr.id)                                              AS passenger_count,
    sq.price                                                                            AS selected_quote_price,
    sq.currency                                                                         AS selected_quote_currency,
    sq.description                                                                      AS selected_quote_description,
    sq.departure_date                                                                   AS selected_quote_departure_date,
    sq.return_date                                                                      AS selected_quote_return_date
FROM wa_bridge.flight_requests fr
JOIN  wa_bridge.customers     c  ON c.id = fr.customer_id
LEFT JOIN wa_bridge.quote_options sq ON sq.flight_request_id = fr.id AND sq.is_selected = true;
