-- Allow issue_type 'doubleup' and unique per (section, from, to, issue_type)
-- so a pair validated as overlap can later be validated as doubleup separately.

alter table drainer_validated_inconsistencies
  drop constraint if exists drainer_validated_inconsistencies_issue_type_check;

alter table drainer_validated_inconsistencies
  add constraint drainer_validated_inconsistencies_issue_type_check
  check (issue_type in ('gap', 'overlap', 'doubleup'));

alter table drainer_validated_inconsistencies
  drop constraint if exists drainer_validated_inconsistencies_section_id_record_from_id_record_to_id_key;

alter table drainer_validated_inconsistencies
  drop constraint if exists drainer_validated_inconsistencies_section_id_record_from_id_record_to_id_issue_type_key;

alter table drainer_validated_inconsistencies
  add constraint drainer_validated_inconsistencies_section_pair_type_key
  unique (section_id, record_from_id, record_to_id, issue_type);
