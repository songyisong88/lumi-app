-- PROPOSED, NOT APPLIED. Lets a cloud (real-account) image listing be “พรอมต์อย่างเดียว” (prompt only, no image files).
-- Changes 4 existing rows, so it needs approval. The real site never sends imgKind, so its checks stay the same.
create table if not exists private.listing_rules_backup_20261103 as
  select * from private.listing_rules where sell_type = 'img' and field_id in ('files','count','resolution','formats');
update private.listing_rules
   set cond_op = 'neq', cond_field = 'imgKind', cond_value = 'พรอมต์อย่างเดียว'
 where sell_type = 'img' and field_id in ('files','count','resolution','formats');
-- Revert: restore the four rows from private.listing_rules_backup_20261103.
