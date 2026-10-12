-- Finalize the 2026-10-12 lab_results rebuild.
-- Paste into the Supabase SQL editor and Run. Runs as one transaction:
-- either everything applies or nothing does.
--
-- Before: lab_results (658 rows) had duplicate loads, wrong dates and
-- partial extractions. A full copy is in lab_results_backup_20261012.
-- Staging lab_results_rebuild was re-extracted from every lab PDF in Drive.

begin;

-- 1. One name per marker, so trends line up across labs and years.
create or replace function pg_temp.canon(m text) returns text language sql immutable as $$
  select case
    when m ~* 'recept' then m
    when m ~* 'peroxidasa|tpo' then 'Anticuerpos anti-peroxidasa tiroidea (Anti-TPO)'
    when m ~* 'tiroglobulin' and m ~* 'anti|ac igg|anti-tg' then 'Anticuerpos anti-tiroglobulina (Anti-TG)'
    when m ~* 'tiroglobulin' then 'Tiroglobulina'
    when m ~* 'tsh' then 'TSH'
    when m ~* 'captaci|^tu' then 'Captación de T3 (TU)'
    when m ~* '(t4|tiroxina)' and m ~* 'libre' then 'T4 Libre'
    when m ~* '(t4|tiroxina)' and m ~* 'total' then 'T4 Total'
    when m ~* '(t3|triyodo)' and m ~* 'libre' then 'T3 Libre'
    when m ~* '(t3|triyodo)' and m ~* 'total' then 'T3 Total'
    when m ~* '^(vcm|volumen corpuscular)' then 'Volumen Corpuscular Medio'
    when m ~* '^(chcm|concentraci)' then 'Concentración de Hemoglobina Corpuscular Media'
    when m ~* '^(hcm|hemoglobina corpuscular)' then 'Hemoglobina Corpuscular Media'
    when m ~* '^(ade|rdw|amplitud)' then 'Amplitud de la Distribución Eritrocitaria'
    when m ~* '^(vpm|volumen plaquetario)' then 'Volumen Plaquetario Medio'
    when m ~* '^leucocitos \(wbc\)$' then 'Leucocitos'
    when m ~* '^eritrocitos \(rbc\)$' then 'Eritrocitos'
    when m ~* '^(neutr[oó]filos|linfocitos|monocitos|eosin[oó]filos|bas[oó]filos)( #)? absolutos$'
         then initcap(split_part(m, ' ', 1)) || ' Absolutos'
    when m ~* '^(neutr[oó]filos|linfocitos|monocitos|eosin[oó]filos|bas[oó]filos)$' then m || ' %'
    when m ~* '^(ast|aspartato)' then 'AST (TGO)'
    when m ~* '^(alt|alanino)' then 'ALT (TGP)'
    when m ~* '^(ggt|gamma)' then 'GGT'
    when m ~* '^globulina' then 'Globulinas'
    when m ~* '^bilirrubina indirecta' then 'Bilirrubina indirecta'
    when m ~* '^bilirrubina directa' then 'Bilirrubina directa'
    when m ~* '^bilirrubina total' then 'Bilirrubina total'
    when m ~* '^prote[ií]nas totales' then 'Proteínas totales'
    when m ~* '^fosfatasa alcalina' then 'Fosfatasa alcalina'
    when m ~* '^colesterol total' then 'Colesterol total'
    when m ~* '^vldl' then 'Colesterol VLDL'
    when m ~* '^[aá]cido [uú]rico' then 'Ácido úrico'
    when m ~* '(ldh|dhl|lactato deshidrogenasa|deshidrogenasa l)' then 'LDH'
    when m ~* '^(ck|creatincinasa|cpk|creatinfosfoquinasa)' then 'CPK'
    when m ~* '^nitr[oó]geno ureico' then 'Nitrógeno ureico (BUN)'
    when m ~* '^cloruro$' then 'Cloro'
    when m ~* '^calcio total$' then 'Calcio'
    when m ~* '^di[oó]xido de carbono' then 'CO2'
    when m ~* '^fosfato$' then 'Fósforo'
    else m end
$$;

update lab_results_rebuild set marcador = pg_temp.canon(marcador);

-- 1b. The Drive file once named 2019-06-02 bundles two separate draws. Quest
--     Mexico printed dates month-first in 2019 (e.g. "5/15/2019"), so its
--     "2/06/2019" and "8/06/2019" are Feb 6 and Aug 6, 2019 (the Feb sample
--     was released "2/07/2019", the next day). File renamed in Drive to
--     2019-02-06_labs_quest-mx_general.pdf.
update lab_results_rebuild
set archivo = '2019-02-06_labs_quest-mx_general.pdf', "año" = 2019,
    fecha = case when (marcador, round(valor, 3)) in (
                ('Calcio', 8.700), ('Tiroglobulina', 96.440), ('TSH', 192.771),
                ('Captación de T3 (TU)', 37.300), ('T4 Total', 4.890), ('T4 Libre', 0.760),
                ('T3 Total', 0.630), ('Glucosa', 97.000), ('Colesterol total', 239.000),
                ('Triglicéridos', 186.000))
            then date '2019-02-06' else date '2019-08-06' end
where drive_file_id = '1ffwqecdhzalYlS6o1XRwtznJRSrJ-KGV';

-- 1c. A file can now hold the same marker on two dates, so retire the
--     (archivo, marcador) uniqueness; (archivo, marcador, fecha) stays.
alter table lab_results drop constraint if exists lab_results_archivo_marcador_key;
drop index if exists lab_results_archivo_marcador_key;

-- 2. Keep the "stimulated Tg" flags from the original data on the matching
--    thyroid results (Apr 17 2020; Nov 22 2022, stored before as Nov 1).
--    Mar 5 2026 thyroid rows were already flagged during the rebuild.
update lab_results_rebuild r set estimulada = true
where r.fecha in ('2020-04-17', '2022-11-22') and r.panel = 'Thyroid'
  and exists (select 1 from lab_results_backup_20261012 b
              where b.estimulada and b.fecha in ('2020-04-17', '2022-11-01')
                and round(b.valor, 3) = round(r.valor, 3));

-- 3. One row per (file, marker, date). If standardizing names made two rows
--    collide (the same result captured twice, or two same-morning panels),
--    keep the first and park the rest for review.
create table if not exists lab_rebuild_dropped as table lab_results_rebuild with no data;
insert into lab_rebuild_dropped
select * from lab_results_rebuild r
where r.id not in (select min(id) from lab_results_rebuild group by archivo, marcador, fecha);
delete from lab_results_rebuild
where id not in (select min(id) from lab_results_rebuild group by archivo, marcador, fecha);

-- 4. Swap: replace lab_results with the rebuilt rows (same table, so its
--    indexes and the anon read policy Luna uses are untouched).
delete from lab_results;
insert into lab_results (fecha, "año", archivo, proveedor, panel, marcador, valor, unidad,
                         ref_min, ref_max, flag, estimulada, conversion_aplicada, revision_requerida)
select fecha, "año", archivo, proveedor, panel, marcador, valor, unidad,
       ref_min, ref_max, flag, estimulada, conversion_aplicada, revision_requerida
from lab_results_rebuild;

commit;

-- Check
select (select count(*) from lab_results) as lab_results_rows,
       (select count(distinct archivo) from lab_results) as files,
       (select count(*) from lab_rebuild_dropped) as parked_for_review,
       (select string_agg(fecha::text || ' (' || n || ')', ', ')
          from (select fecha, count(*) n from lab_results where estimulada group by 1 order by 1) s) as stimulated;
