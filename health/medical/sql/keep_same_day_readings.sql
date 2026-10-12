-- Keep real second readings, block only exact duplicates.
-- On 2019-05-15 two orders were drawn minutes apart (9:36 thyroid order with
-- its own "Química de 3", 9:40 chemistry panel), so glucose, cholesterol and
-- triglycerides each have two genuine values. Uniqueness now includes the
-- value: an exact repeat is still rejected, a different reading is kept.

begin;
drop index if exists idx_lab_results_unique;
drop index if exists lab_results_dedup;
create unique index lab_results_dedup on lab_results (archivo, marcador, fecha, valor) where fecha is not null;

insert into lab_results (fecha, "año", archivo, proveedor, panel, marcador, valor, unidad,
                         ref_min, ref_max, flag, estimulada, conversion_aplicada, revision_requerida)
select fecha, "año", archivo, proveedor, panel, marcador, valor, unidad,
       ref_min, ref_max, flag, estimulada, conversion_aplicada, revision_requerida
from lab_rebuild_dropped d
where not exists (select 1 from lab_results k
                  where k.archivo = d.archivo and k.marcador = d.marcador
                    and k.fecha = d.fecha and k.valor = d.valor);
commit;

-- Check: expect 667 rows, 53 for 2019-05-15
select count(*) as total, count(*) filter (where archivo like '2019-05-15%') as may_15 from lab_results;
