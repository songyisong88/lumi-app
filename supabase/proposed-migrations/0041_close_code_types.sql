-- PROPOSED, NOT APPLIED (shared live DB). Closes programs/apps, games/plugins/Chrome extensions, bots and Agent Skills
-- for new publishing: products_rules() raises TYPE_CLOSED for any sell_type listed in launch_rules.closed_types.
create table if not exists private.settings_backup_20261103 as select * from private.settings where key = 'launch_rules';
update private.settings
   set value = jsonb_set(value, '{closed_types}',
       (select coalesce(jsonb_agg(distinct x), '[]'::jsonb)
          from jsonb_array_elements(coalesce(value->'closed_types', '[]'::jsonb) || '["sw","game","bot","skill"]'::jsonb) x))
 where key = 'launch_rules';
-- Revert: update private.settings set value = jsonb_set(value,'{closed_types}', (value->'closed_types') - 'sw' - 'game' - 'bot' - 'skill') where key='launch_rules';
