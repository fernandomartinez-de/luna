(function(){
"use strict";

var PLAN = (window.__DATA__ && window.__DATA__.plan) || {startDate:"",endDate:"",totalWeeks:19,currentWeek:1,weeksRemaining:19,daysToTarget:135,targetLabel:"Early February"};
var BODY = (window.__DATA__ && window.__DATA__.body) || {series:[],latest:null,startWeight:null,startBodyFat:null,deltaWeight:null,deltaBodyFat:null};
var WORKOUTS = (window.__DATA__ && window.__DATA__.workouts) || {liftsThisWeek:0,soccerThisWeek:0,runsThisWeek:0,recent:[]};
var STRENGTH = (window.__DATA__ && window.__DATA__.strength) || {byExercise:{}};

var CITE = {
  "Schoenfeld2010":{t:"The mechanisms of muscle hypertrophy and their application to resistance training.",a:"Schoenfeld BJ.",j:"J Strength Cond Res 2010;24(10):2857-2872.",u:"https://pubmed.ncbi.nlm.nih.gov/20847704/"},
  "Schoenfeld2017Vol":{t:"Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis.",a:"Schoenfeld BJ, Ogborn D, Krieger JW.",j:"J Sports Sci 2017;35(11):1073-1082.",u:"https://pubmed.ncbi.nlm.nih.gov/27433992/"},
  "Schoenfeld2016Freq":{t:"Effects of resistance training frequency on measures of muscle hypertrophy: a systematic review and meta-analysis.",a:"Schoenfeld BJ, Ogborn D, Krieger JW.",j:"Sports Med 2016;46(11):1689-1697.",u:"https://pubmed.ncbi.nlm.nih.gov/27102172/"},
  "Refalo2023":{t:"Influence of resistance training proximity to failure on skeletal muscle hypertrophy: a systematic review with meta-analysis.",a:"Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ.",j:"Sports Med 2023;53(3):649-665.",u:"https://pubmed.ncbi.nlm.nih.gov/36334240/"},
  "Grgic2022":{t:"Effects of resistance training performed to repetition failure or non-failure on muscular strength and hypertrophy.",a:"Grgic J, Schoenfeld BJ, Orazem J, Sabol F.",j:"J Sport Health Sci 2022;11(2):202-211.",u:"https://pubmed.ncbi.nlm.nih.gov/33497853/"},
  "Kassiano2023":{t:"Does range of motion influence muscle hypertrophy? Umbrella review.",a:"Kassiano W, Costa BDV, Nunes JP, et al.",j:"J Strength Cond Res 2023.",u:"https://pubmed.ncbi.nlm.nih.gov/37326475/"},
  "Wolf2023":{t:"Partial vs full range of motion resistance training: a systematic review and meta-analysis.",a:"Wolf M, Androulakis-Korakakis P, Fisher J, Schoenfeld B, Steele J.",j:"Int J Strength Cond 2023.",u:"https://doi.org/10.47206/ijsc.v3i1.182"},
  "Maeo2022":{t:"Triceps brachii hypertrophy is substantially greater after elbow extension training performed in the overhead vs neutral arm position.",a:"Maeo S, Wu Y, Huang M, et al.",j:"Eur J Sport Sci 2022;23(7):1240-1250.",u:"https://pubmed.ncbi.nlm.nih.gov/35819335/"},
  "Maeo2021":{t:"Greater hamstrings muscle hypertrophy but similar damage protection after training at long vs short muscle lengths.",a:"Maeo S, Meng H, Yuhang W, et al.",j:"Med Sci Sports Exerc 2021;53(4):825-837.",u:"https://pubmed.ncbi.nlm.nih.gov/33009197/"},
  "Nunes2020":{t:"What influence does resistance exercise order have on muscular strength and hypertrophy?",a:"Nunes JP, Grgic J, Cunha PM, et al.",j:"Eur J Sport Sci 2020;21(2):149-157.",u:"https://pubmed.ncbi.nlm.nih.gov/32077380/"},
  "Contreras2015":{t:"A comparison of gluteus maximus, biceps femoris, and vastus lateralis EMG during the back squat and barbell hip thrust.",a:"Contreras B, Vigotsky AD, Schoenfeld BJ, Beardsley C, Cronin J.",j:"J Appl Biomech 2015;31(6):452-458.",u:"https://pubmed.ncbi.nlm.nih.gov/26214739/"},
  "Helms2014":{t:"Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation.",a:"Helms ER, Aragon AA, Fitschen PJ.",j:"J Int Soc Sports Nutr 2014;11:20.",u:"https://pubmed.ncbi.nlm.nih.gov/24864135/"},
  "Longland2016":{t:"Higher compared with lower dietary protein during an energy deficit combined with intense exercise promotes greater lean mass gain and fat mass loss.",a:"Longland TM, Oikawa SY, Mitchell CJ, Devries MC, Phillips SM.",j:"Am J Clin Nutr 2016;103(3):738-746.",u:"https://pubmed.ncbi.nlm.nih.gov/26817506/"},
  "Suchomel2016":{t:"The importance of muscular strength in athletic performance.",a:"Suchomel TJ, Nimphius S, Stone MH.",j:"Sports Med 2016;46(10):1419-1449.",u:"https://pubmed.ncbi.nlm.nih.gov/26838985/"}
};

// 19-week mesocycle. Primaries stay heavy across the cut so intensity signals
// muscle retention; accessory volume tapers as the deficit deepens. Deloads at
// weeks 5, 10, 15. Sharpen at week 19. Olympic lifts follow their own quality
// prescription noted per-exercise (never to failure).
var MESO = [
  {wk:1, block:1, blockName:"Accumulation",    phase:"build",   pri:{sets:4,reps:"4-6",rpe:"7"},     acc:{sets:3,reps:"8-12",rpe:"8"}},
  {wk:2, block:1, blockName:"Accumulation",    phase:"build",   pri:{sets:4,reps:"4-6",rpe:"7-8"},   acc:{sets:3,reps:"8-12",rpe:"8"}},
  {wk:3, block:1, blockName:"Accumulation",    phase:"build",   pri:{sets:4,reps:"4-6",rpe:"8"},     acc:{sets:4,reps:"8-12",rpe:"8"}},
  {wk:4, block:1, blockName:"Accumulation",    phase:"build",   pri:{sets:4,reps:"4-6",rpe:"8"},     acc:{sets:4,reps:"8-12",rpe:"8"}},
  {wk:5, block:1, blockName:"Accumulation",    phase:"deload",  pri:{sets:2,reps:"5",rpe:"5-6"},     acc:{sets:2,reps:"10",rpe:"5-6"}},
  {wk:6, block:2, blockName:"Intensification", phase:"build",   pri:{sets:4,reps:"3-5",rpe:"8"},     acc:{sets:3,reps:"8-12",rpe:"8"}},
  {wk:7, block:2, blockName:"Intensification", phase:"build",   pri:{sets:4,reps:"3-5",rpe:"8"},     acc:{sets:3,reps:"8-12",rpe:"8"}},
  {wk:8, block:2, blockName:"Intensification", phase:"build",   pri:{sets:4,reps:"3-5",rpe:"8-9"},   acc:{sets:3,reps:"8-12",rpe:"8"}},
  {wk:9, block:2, blockName:"Intensification", phase:"build",   pri:{sets:3,reps:"3-5",rpe:"8-9"},   acc:{sets:3,reps:"8-12",rpe:"8"}},
  {wk:10,block:2, blockName:"Intensification", phase:"deload",  pri:{sets:2,reps:"5",rpe:"5-6"},     acc:{sets:2,reps:"10",rpe:"5-6"}},
  {wk:11,block:3, blockName:"Peak Intensity",  phase:"build",   pri:{sets:3,reps:"3-5",rpe:"8-9"},   acc:{sets:3,reps:"10-15",rpe:"8"}},
  {wk:12,block:3, blockName:"Peak Intensity",  phase:"build",   pri:{sets:3,reps:"3-5",rpe:"8-9"},   acc:{sets:3,reps:"10-15",rpe:"8"}},
  {wk:13,block:3, blockName:"Peak Intensity",  phase:"build",   pri:{sets:3,reps:"3",rpe:"9"},       acc:{sets:2,reps:"10-15",rpe:"8"}},
  {wk:14,block:3, blockName:"Peak Intensity",  phase:"build",   pri:{sets:3,reps:"3",rpe:"9"},       acc:{sets:2,reps:"10-15",rpe:"8"}},
  {wk:15,block:3, blockName:"Peak Intensity",  phase:"deload",  pri:{sets:2,reps:"5",rpe:"5-6"},     acc:{sets:2,reps:"10",rpe:"5-6"}},
  {wk:16,block:4, blockName:"Retention",       phase:"build",   pri:{sets:3,reps:"3-5",rpe:"8"},     acc:{sets:2,reps:"10-15",rpe:"7-8"}},
  {wk:17,block:4, blockName:"Retention",       phase:"build",   pri:{sets:3,reps:"3-5",rpe:"8"},     acc:{sets:2,reps:"10-15",rpe:"7-8"}},
  {wk:18,block:4, blockName:"Retention",       phase:"build",   pri:{sets:3,reps:"3",rpe:"8"},       acc:{sets:2,reps:"10",rpe:"7-8"}},
  {wk:19,block:4, blockName:"Retention",       phase:"sharpen", pri:{sets:2,reps:"2-3",rpe:"6-7"},   acc:{sets:1,reps:"8-10",rpe:"6"}}
];

// Category workouts. Primaries are free-weight compounds run heavy across the
// cut for muscle-retention intent; accessories are machines/DBs at higher reps
// covering complementary angles. Olympic lifts are prescribed for quality reps
// and never taken to failure - see Olympic & Shoulder note.
var CATEGORIES = {
  "Chest & Tricep":{
    primaries:[
      {n:"Flat Barbell Bench Press", m:"Heaviest loadable chest compound. High mechanical tension across the whole pec.", cue:"Bar path over lower chest, feet planted, controlled eccentric.", rest:180, cite:["Schoenfeld2010","Suchomel2016"]},
      {n:"Incline DB Press",           m:"Loaded stretch on the sternal chest with a strong horizontal press pattern.", cue:"Elbows about 45 degrees from torso, touch just above the sternum.", rest:150, cite:["Wolf2023","Kassiano2023"]},
      {n:"Close Grip Bench Press",     m:"Heaviest triceps compound. Loads long head with high mechanical tension.", cue:"Hands shoulder width, elbows track along ribs, tuck about 30 degrees.", rest:150, cite:["Schoenfeld2010"]}
    ],
    accessories:[
      {n:"Cable or Machine Fly",              m:"Isolated stretch stimulus on the pec with steady tension end to end.", cue:"Slight elbow bend, stretch under control, do not lock at top.", rest:75, cite:["Kassiano2023"]},
      {n:"Overhead Rope Cable Extension",     m:"Long head of triceps is fully stretched only overhead. Best long-head stimulus.", cue:"Elbows fixed by ears, ROM into a full stretch.", rest:90, cite:["Maeo2022"]},
      {n:"Cable Pushdown",                    m:"High stimulus-to-fatigue, add hard sets cheaply at the end of the session.", cue:"Elbows pinned, do not lean into it. Squeeze the lockout.", rest:60, cite:["Refalo2023"]}
    ]
  },
  "Back & Bicep":{
    primaries:[
      {n:"Weighted Pull-Up",           m:"Full-ROM vertical pull, big lat stimulus with a strong stretched position.", cue:"Pull elbows down and back, no kip, chin over the bar.", rest:180, cite:["Wolf2023","Suchomel2016"]},
      {n:"Barbell Row (Pendlay)",      m:"Heaviest horizontal row. Loaded lats and mid-back at length.", cue:"Torso ~parallel, row to lower ribs, dead-stop each rep.", rest:180, cite:["Schoenfeld2010"]},
      {n:"Incline DB Curl",            m:"Long-head biceps bias with a big stretch at the bottom.", cue:"Elbows behind torso, no swing, full extension each rep.", rest:90, cite:["Kassiano2023"]}
    ],
    accessories:[
      {n:"Lat Pulldown (neutral grip)", m:"Same vertical-pull pattern with graded load, better for high volume than pull-ups.", cue:"Bar to upper chest, drive elbows down and back.", rest:90, cite:["Kassiano2023"]},
      {n:"Cable Pullover",              m:"Lengthened lat isolation. High stretch, low CNS cost.", cue:"Straight arms, pull with lats not triceps.", rest:75, cite:["Kassiano2023"]},
      {n:"Bayesian Cable Curl",         m:"Constant-tension biceps at long muscle length.", cue:"Elbow slightly behind hip, arm fully straightens each rep.", rest:75, cite:["Kassiano2023"]}
    ]
  },
  "Legs":{
    primaries:[
      {n:"Back Squat",                 m:"Loaded quad stretch under full ROM. Biggest lower-body strength driver.", cue:"Break at knees and hips, chest tall, below parallel.", rest:210, cite:["Wolf2023","Suchomel2016"]},
      {n:"Romanian Deadlift",          m:"Loaded hip hinge with a large hamstring stretch. Trains hams at length.", cue:"Push hips back, soft knees, bar close to legs, straight bar path.", rest:180, cite:["Schoenfeld2010","Maeo2021"]},
      {n:"Bulgarian Split Squat",      m:"Long-length quad and glute stimulus, unilateral, big stimulus per set.", cue:"Long stance, torso upright for quads, front knee travels.", rest:120, cite:["Wolf2023"]}
    ],
    accessories:[
      {n:"Leg Press (deep)",            m:"High load with less CNS cost than squats. Deep ROM key.", cue:"Feet lower on platform, knees track toes, thighs to chest.", rest:120, cite:["Kassiano2023"]},
      {n:"Seated Leg Curl",             m:"Trains hamstrings at long length. Grows more than lying curl at equated volume.", cue:"Torso upright, drive heels down and under.", rest:90, cite:["Maeo2021"]},
      {n:"Leg Extension (paused)",      m:"Isolated rectus femoris. Adds hard quad sets cheaply.", cue:"Full extension, brief hold at top, control down.", rest:75, cite:["Maeo2021"]},
      {n:"Standing Calf Raise (deficit)", m:"Gastroc bias at long muscle length. Big stretch drives growth.", cue:"Full stretch at the bottom, pause 1 second.", rest:75, cite:["Kassiano2023"]}
    ]
  },
  "Olympic & Shoulder":{
    note:"Olympic lifts are for quality and speed, never taken close to failure. Use ~70-80% of clean 1RM across the mesocycle; treat the mesocycle sets/reps table as an upper bound on volume, and drop by half on deload weeks.",
    primaries:[
      {n:"Power Clean",                 m:"Explosive hip extension and full-body triple extension. Preserves rate of force development from the track years.", cue:"Bar close to body, aggressive second pull, catch in a quarter squat.", rest:180, cite:["Suchomel2016"]},
      {n:"Push Press",                  m:"Heaviest overhead pattern using leg drive. Powerful shoulder and tricep loader.", cue:"Short dip straight down, drive through heels, punch up and slightly back.", rest:180, cite:["Schoenfeld2010","Suchomel2016"]},
      {n:"Standing Overhead Press",     m:"Strict overhead press. Biggest delt strength driver without leg drive.", cue:"Glutes tight, ribs down, full lockout with head through.", rest:150, cite:["Schoenfeld2010"]}
    ],
    accessories:[
      {n:"Seated DB Shoulder Press",     m:"Slightly deeper ROM than barbell, easier to stabilize under fatigue.", cue:"Elbows just forward of ears, press up and slightly in.", rest:120, cite:["Schoenfeld2010"]},
      {n:"Leaning DB Lateral Raise",     m:"Lateral delt at long muscle length. Leaning gives a bigger stretch.", cue:"Lean away from a support, lead with the elbow.", rest:75, cite:["Kassiano2023","Wolf2023"]},
      {n:"Rear Delt Cable Fly",          m:"Isolated posterior delt without upper-trap dominance. Postural balance in a cut.", cue:"Thumbs up, drive elbows back not up.", rest:60, cite:["Schoenfeld2010"]}
    ]
  }
};

// Daily-ish mornings block: easy conditioning plus core and light pull work.
// Kept at low intensity so it does not compound with the deficit.
var MORNINGS = {
  cardio:{n:"Easy Run", detail:"20-30 min zone 2, conversational pace. Keep RPE 5-6."},
  work:[
    {n:"Hanging Leg Raise",    sets:"3", reps:"8-12", rpe:"7-8", cue:"Do not swing. Control the descent.", cite:["Schoenfeld2010"]},
    {n:"Cable Crunch",         sets:"3", reps:"10-15", rpe:"7-8", cue:"Round the spine, do not just hip-flex.", cite:["Schoenfeld2010"]},
    {n:"Face Pull",            sets:"3", reps:"15",    rpe:"6-7", cue:"Rope to eyebrows, external rotation at the end.", cite:["Schoenfeld2010"]},
    {n:"Band Pull-Apart",      sets:"2", reps:"20",    rpe:"6",   cue:"Elbows locked, squeeze scaps together.", cite:["Schoenfeld2010"]}
  ]
};

var CAT_ORDER = ["Chest & Tricep","Back & Bicep","Legs","Olympic & Shoulder"];

window.__OVERLOAD_PART1__ = {PLAN:PLAN,BODY:BODY,WORKOUTS:WORKOUTS,STRENGTH:STRENGTH,CITE:CITE,MESO:MESO,CATEGORIES:CATEGORIES,MORNINGS:MORNINGS,CAT_ORDER:CAT_ORDER};
})();

(function(){
"use strict";
var D = window.__OVERLOAD_PART1__;
var PLAN=D.PLAN, BODY=D.BODY, WORKOUTS=D.WORKOUTS, STRENGTH=D.STRENGTH, CITE=D.CITE, MESO=D.MESO, CATEGORIES=D.CATEGORIES, MORNINGS=D.MORNINGS, CAT_ORDER=D.CAT_ORDER;

function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];});}
function n1(v){return v==null||isNaN(v)?"-":Math.round(v*10)/10;}
function n0(v){return v==null||isNaN(v)?"-":Math.round(v);}
function sign(v){if(v==null||isNaN(v))return "";return v>0?"+":"";}
function citeChip(ids){if(!ids||!ids.length)return "";var parts=ids.map(function(id){var c=CITE[id];return c?'<a href="'+esc(c.u)+'" target="_blank" rel="noopener">'+esc(c.a.split(",")[0]+" et al. "+(c.j.match(/\d{4}/)||[""])[0])+'</a>':"";}).filter(Boolean);return parts.length?'<div class="excite">'+parts.join(" · ")+"</div>":"";}
function meta(w){return MESO[Math.max(0,Math.min(MESO.length-1,(w||1)-1))];}
function phaseLabel(p){return p==="deload"?"Deload":p==="sharpen"?"Sharpen":"Build";}

function toast(msg){var t=document.getElementById("toast");if(!t)return;t.innerHTML=msg;t.classList.add("on");setTimeout(function(){t.classList.remove("on");},1800);}

// -------- Plan view --------
function renderPlan(){
  var w=PLAN.currentWeek||1, tot=PLAN.totalWeeks||19, m=meta(w);
  var pct=Math.max(0,Math.min(100,Math.round(((w-1)/Math.max(1,tot-1))*100)));
  var latest=BODY.latest||{};
  var dw=BODY.deltaWeight, dbf=BODY.deltaBodyFat;
  var wSpark=(BODY.series||[]).slice(-24).map(function(p){return p.weight_kg;}).filter(function(x){return x!=null;});
  var bfSpark=(BODY.series||[]).slice(-24).map(function(p){return p.body_fat_pct;}).filter(function(x){return x!=null;});
  function sparkBars(vals){if(!vals.length)return "";var mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals),rng=Math.max(0.001,mx-mn);return vals.map(function(v){var h=Math.round(4+((v-mn)/rng)*22);return '<i style="height:'+h+'px"></i>';}).join("");}
  function deltaCls(v,goodDown){if(v==null||Math.abs(v)<0.05)return "flat";var down=v<0;return (goodDown?down:!down)?"down":"up";}
  var h='';
  h+='<div class="goal">';
  h+='  <div class="verb">Cut to Abs</div>';
  h+='  <div class="sub">Protect muscle in a calorie deficit. Training keeps the primary lifts <b>heavy</b> to signal muscle retention; accessory volume tapers as the deficit deepens. Diet is separate; do not chase PRs.</div>';
  h+='  <div class="load"><span class="pill warm">Target · '+esc(PLAN.targetLabel||"Early February")+'</span><span class="pill">'+esc(String(PLAN.daysToTarget||""))+' days to go</span><span class="pill ok">Weights in kg</span></div>';
  h+='</div>';
  h+='<div class="timeline">';
  h+='  <div class="tlhead"><b>Week '+w+' of '+tot+'</b><span>'+esc(m.blockName)+' · '+phaseLabel(m.phase)+'</span></div>';
  h+='  <div class="tlbar"><i style="width:'+pct+'%"></i></div>';
  h+='  <div class="tlmeta"><span>Start '+esc(PLAN.startDate||"-")+'</span><span>Target '+esc(PLAN.endDate||"-")+'</span></div>';
  h+='</div>';
  h+='<div class="sec-title">Body composition trend</div>';
  h+='<div class="trend">';
  h+='  <div class="tc hi"><div class="tlab">Body Fat</div><div class="tval">'+n1(latest.body_fat_pct)+'<em>%</em></div>';
  h+='    <div class="tdelta '+deltaCls(dbf,true)+'">'+sign(dbf)+n1(dbf)+' pp since start</div>';
  h+='    <div class="spark">'+sparkBars(bfSpark)+'</div></div>';
  h+='  <div class="tc body"><div class="tlab">Weight</div><div class="tval">'+n1(latest.weight_kg)+'<em>kg</em></div>';
  h+='    <div class="tdelta '+deltaCls(dw,true)+'">'+sign(dw)+n1(dw)+' kg since start</div>';
  h+='    <div class="spark">'+sparkBars(wSpark)+'</div></div>';
  h+='</div>';
  h+='<div class="note"><b>Reading the trend.</b> Weight may fall on a cut; muscle-mass loss is not the goal. Judge the plan by body-fat percentage falling while primary lift loads hold. If weight drops fast and primary bar loads drop with it, ease the deficit. Cite Helms 2014 and Longland 2016 in Method.</div>';
  h+='<div class="sec-title">This week at a glance</div>';
  h+='<div class="excard"><div class="exname">Week '+w+' · '+esc(m.blockName)+'</div>';
  h+='<div class="exmech">Primary: <b>'+m.pri.sets+' sets · '+m.pri.reps+' reps · RPE '+m.pri.rpe+'</b>. Accessory: <b>'+m.acc.sets+' sets · '+m.acc.reps+' reps · RPE '+m.acc.rpe+'</b>.</div>';
  h+='<div class="excue">Cadence this week: '+(WORKOUTS.liftsThisWeek||0)+' lifts logged · '+(WORKOUTS.soccerThisWeek||0)+' soccer · '+(WORKOUTS.runsThisWeek||0)+' runs.</div>';
  h+='</div>';
  h+='<p class="disc">Overload is a training plan, not medical or nutrition advice. Cut nutrition is out of scope; see Method for the evidence base.</p>';
  return h;
}

window.__OVERLOAD_RENDER__ = {esc:esc,n1:n1,n0:n0,sign:sign,citeChip:citeChip,meta:meta,phaseLabel:phaseLabel,toast:toast,renderPlan:renderPlan};
})();

(function(){
"use strict";
var D=window.__OVERLOAD_PART1__, R=window.__OVERLOAD_RENDER__;
var CATEGORIES=D.CATEGORIES, MORNINGS=D.MORNINGS, MESO=D.MESO, CAT_ORDER=D.CAT_ORDER, STRENGTH=D.STRENGTH;
var esc=R.esc, n1=R.n1, citeChip=R.citeChip, meta=R.meta, phaseLabel=R.phaseLabel, toast=R.toast;

var SESSION_STATE = {cat: CAT_ORDER[0]};

function exBlock(ex, kind, spec, rank){
  var hist = (STRENGTH.byExercise||{})[ex.n];
  var histHtml = "";
  if(hist && hist.lastKg!=null){
    histHtml = '<div class="exhist">Last: <b>'+n1(hist.lastKg)+' kg × '+esc(String(hist.lastReps||"-"))+'</b>'+
               (hist.bestKg!=null?' · Best: <b>'+n1(hist.bestKg)+' kg</b>':'')+
               (hist.lastDate?' · '+esc(hist.lastDate):'')+'</div>';
  }
  var h='';
  h+='<div class="excard">';
  h+='  <div class="exname"><span class="rank">'+kind[0].toUpperCase()+rank+'.</span>'+esc(ex.n)+'</div>';
  h+='  <div class="exmech">'+esc(ex.m)+'</div>';
  h+='  <div class="excue">Cue: '+esc(ex.cue)+'</div>';
  h+='  <div class="exspec">';
  h+='    <div class="spec"><span>Sets</span>'+esc(String(spec.sets))+'</div>';
  h+='    <div class="spec"><span>Reps</span>'+esc(String(spec.reps))+'</div>';
  h+='    <div class="spec"><span>RPE</span>'+esc(String(spec.rpe))+'</div>';
  h+='    <div class="spec"><span>Rest</span>'+Math.round((ex.rest||90)/60*10)/10+' min</div>';
  h+='  </div>';
  h+=histHtml;
  h+=citeChip(ex.cite);
  h+='</div>';
  return h;
}

function copyText(cat, catData, m){
  var lines = [];
  lines.push("OVERLOAD · "+cat+" · Wk "+m.wk+" · "+m.blockName+" ("+phaseLabel(m.phase)+")");
  lines.push("");
  lines.push("PRIMARIES ("+m.pri.sets+"×"+m.pri.reps+" @ RPE "+m.pri.rpe+"):");
  catData.primaries.forEach(function(ex,i){ lines.push("  "+(i+1)+". "+ex.n); });
  lines.push("");
  lines.push("ACCESSORIES ("+m.acc.sets+"×"+m.acc.reps+" @ RPE "+m.acc.rpe+"):");
  catData.accessories.forEach(function(ex,i){ lines.push("  "+(i+1)+". "+ex.n); });
  if(catData.note){ lines.push(""); lines.push("Note: "+catData.note); }
  return lines.join("\n");
}

function renderMorningsCard(){
  var h='<div class="sec-title">Mornings block</div>';
  h+='<div class="excard"><div class="exname">'+esc(MORNINGS.cardio.n)+'</div>';
  h+='<div class="exmech">'+esc(MORNINGS.cardio.detail)+'</div></div>';
  MORNINGS.work.forEach(function(ex,i){
    h+='<div class="excard"><div class="exname"><span class="rank">M'+(i+1)+'.</span>'+esc(ex.n)+'</div>';
    h+='<div class="excue">Cue: '+esc(ex.cue)+'</div>';
    h+='<div class="exspec">';
    h+='<div class="spec"><span>Sets</span>'+esc(ex.sets)+'</div>';
    h+='<div class="spec"><span>Reps</span>'+esc(ex.reps)+'</div>';
    h+='<div class="spec"><span>RPE</span>'+esc(ex.rpe)+'</div>';
    h+='</div>'+citeChip(ex.cite)+'</div>';
  });
  return h;
}

function renderSession(){
  var w=D.PLAN.currentWeek||1, m=meta(w);
  var cat = SESSION_STATE.cat || CAT_ORDER[0];
  var catData = CATEGORIES[cat];
  var h='';
  h+='<div class="filter">';
  CAT_ORDER.forEach(function(c){
    h+='<button class="chip" data-cat="'+esc(c)+'" aria-selected="'+(c===cat?"true":"false")+'">'+esc(c)+'</button>';
  });
  h+='<button class="chip" data-cat="__mornings" aria-selected="'+(cat==="__mornings"?"true":"false")+'">Mornings</button>';
  h+='</div>';
  if(cat==="__mornings"){ return h + renderMorningsCard(); }
  var totalSets = catData.primaries.length*m.pri.sets + catData.accessories.length*m.acc.sets;
  h+='<div class="dayhead"><div><h1>'+esc(cat)+'</h1><div class="meta">Week '+w+' · '+esc(m.blockName)+' · '+phaseLabel(m.phase)+'</div></div>';
  h+='<div class="vol"><b>'+totalSets+'</b><span>Hard sets</span></div></div>';
  if(catData.note){ h+='<div class="note"><b>Note.</b> '+esc(catData.note)+'</div>'; }
  h+='<div class="rowlab">Primaries · '+m.pri.sets+'×'+m.pri.reps+' @ RPE '+m.pri.rpe+'</div>';
  catData.primaries.forEach(function(ex,i){ h += exBlock(ex, "P", m.pri, i+1); });
  h+='<div class="rowlab acc">Accessories · '+m.acc.sets+'×'+m.acc.reps+' @ RPE '+m.acc.rpe+'</div>';
  catData.accessories.forEach(function(ex,i){ h += exBlock(ex, "A", m.acc, i+1); });
  var text = copyText(cat, catData, m);
  h+='<div class="copyblk"><div class="ct"><b>Copy to WHOOP Strength Trainer</b><button data-action="copy">Copy</button></div><pre id="copytext">'+esc(text)+'</pre></div>';
  h+='<p class="disc">Overload advises; WHOOP logs. Fitness plan only, not medical advice.</p>';
  return h;
}

window.__OVERLOAD_RENDER__.renderSession = renderSession;
window.__OVERLOAD_STATE__ = SESSION_STATE;
})();

(function(){
"use strict";
var D=window.__OVERLOAD_PART1__, R=window.__OVERLOAD_RENDER__;
var MESO=D.MESO, CITE=D.CITE;
var esc=R.esc, phaseLabel=R.phaseLabel;

function renderBlock(){
  var w=D.PLAN.currentWeek||1;
  var blocks = {};
  MESO.forEach(function(m){ (blocks[m.block]=blocks[m.block]||[]).push(m); });
  var h='<div class="sec-title">The mesocycle · '+MESO.length+' weeks</div>';
  h+='<div class="note"><b>How to read it.</b> Primaries stay heavy across the cut so intensity signals muscle retention (Refalo 2023, Grgic 2022). Accessory volume tapers as the deficit deepens because recovery falls. Deloads reset accumulated fatigue every ~5 weeks. Week 19 sharpens: technique and neural output only, no PR attempts.</div>';
  h+='<div class="blocktbl"><table>';
  h+='<caption>19-week block plan</caption>';
  h+='<thead><tr><th>Wk</th><th>Block</th><th>Phase</th><th>Primary</th><th>Accessory</th></tr></thead><tbody>';
  MESO.forEach(function(m){
    var isNow = (m.wk===w);
    var phCls = "ph"+(m.phase==="deload"?" deload":m.phase==="sharpen"?" sharpen":"");
    h+='<tr class="'+(isNow?"now":"")+'">';
    h+='<td class="wk">'+m.wk+'</td>';
    h+='<td class="'+phCls+'">'+esc(m.blockName)+'</td>';
    h+='<td class="'+phCls+'">'+phaseLabel(m.phase)+'</td>';
    h+='<td class="pri">'+m.pri.sets+'×'+esc(m.pri.reps)+' RPE '+esc(m.pri.rpe)+'</td>';
    h+='<td class="acc">'+m.acc.sets+'×'+esc(m.acc.reps)+' RPE '+esc(m.acc.rpe)+'</td>';
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  h+='<div class="sec-title">Blocks at a glance</div>';
  Object.keys(blocks).sort(function(a,b){return a-b;}).forEach(function(b){
    var rows = blocks[b];
    var first = rows[0];
    h+='<div class="excard"><div class="exname">Block '+b+' · '+esc(first.blockName)+'</div>';
    h+='<div class="exmech">Weeks '+rows[0].wk+' to '+rows[rows.length-1].wk+'. '+describeBlock(b)+'</div>';
    h+='<div class="exspec">';
    h+='<div class="spec"><span>Weeks</span>'+rows.length+'</div>';
    h+='<div class="spec"><span>Deloads</span>'+rows.filter(function(r){return r.phase==="deload";}).length+'</div>';
    h+='<div class="spec"><span>Sharpen</span>'+rows.filter(function(r){return r.phase==="sharpen";}).length+'</div>';
    h+='</div></div>';
  });
  return h;
}

function describeBlock(b){
  b = parseInt(b,10);
  if(b===1) return "Accumulation. Establish primary lift baselines at moderate RPE while accessory volume is highest. Deficit is shallowest here; expect the best primary progress of the mesocycle.";
  if(b===2) return "Intensification. Push primary RPE toward 8-9 with fewer reps per set. Accessory volume held. This is where retention starts being tested.";
  if(b===3) return "Peak intensity. Primaries at RPE 9 on top sets. Accessory volume tapers to protect recovery as the deficit deepens.";
  if(b===4) return "Retention. Keep primary intensity, halve accessory volume, add the sharpening week to arrive at Early February fresh with muscle preserved.";
  return "";
}

function renderMethod(){
  function refs(ids){ return ids.map(function(id){var c=CITE[id];return c?'<div class="ref"><b>'+esc(c.a)+'</b> '+esc(c.t)+' <em>'+esc(c.j)+'</em> <a href="'+esc(c.u)+'" target="_blank" rel="noopener">link</a></div>':"";}).join(""); }
  var h='';
  h+='<div class="sec-title">Evidence base</div>';
  h+='<div class="msec"><h3>Mechanical tension drives hypertrophy<span class="est established">Established</span></h3>';
  h+='<p>Muscle growth is chiefly a response to high mechanical tension. Effort, load, and full range of motion produce more tension per set than short-ROM or light-and-easy work. Metabolic and mechanical damage pathways contribute but sit under tension.</p>';
  h+=refs(["Schoenfeld2010"]);
  h+='</div>';
  h+='<div class="msec"><h3>In a cut, muscle retention leans on intensity, not volume<span class="est established">Established</span></h3>';
  h+='<p>Under a caloric deficit, recovery is compromised and high-volume programs overshoot the athlete\'s tolerance. Training close to failure on hard sets protects the growth signal even when total volume is trimmed. That is why Overload holds primary RPE high across the mesocycle and pulls back accessory volume as the deficit deepens.</p>';
  h+=refs(["Refalo2023","Grgic2022"]);
  h+='</div>';
  h+='<div class="msec"><h3>10-20 hard sets per muscle per week is the effective range<span class="est established">Established</span></h3>';
  h+='<p>Schoenfeld\'s dose-response meta shows a roughly linear return through about 10 to 20 hard sets per muscle per week for trained lifters. Overload targets the middle of this range in Block 1 and lands near the lower end by Block 4, matching the reduced recovery capacity of a deep cut.</p>';
  h+=refs(["Schoenfeld2017Vol","Schoenfeld2016Freq"]);
  h+='</div>';
  h+='<div class="msec"><h3>Train 0 to 3 reps in reserve<span class="est established">Established</span></h3>';
  h+='<p>Sets taken 0 to 3 reps shy of failure produce essentially identical hypertrophy at equated volume, and closer proximity to failure is required when total volume is low. Primary lifts sit at RIR 1 to 2, accessories at RIR 0 to 2; deload weeks intentionally push RIR to 3 to 4.</p>';
  h+=refs(["Refalo2023","Grgic2022"]);
  h+='</div>';
  h+='<div class="msec"><h3>Full range with a loaded stretch<span class="est established">Established</span></h3>';
  h+='<p>Lengthened partials and full ROM training with a loaded stretch outperform short-ROM work at matched load. Overload biases exercise selection toward stretch-emphasized variants: incline DB press, Romanian deadlift, overhead triceps, Bulgarian split squat, seated leg curl.</p>';
  h+=refs(["Kassiano2023","Wolf2023","Maeo2022","Maeo2021"]);
  h+='</div>';
  h+='<div class="msec"><h3>Primaries for high stimulus-to-fatigue, accessories to cover angles<span class="est established">Established</span></h3>';
  h+='<p>Compound free-weight lifts move the most load per unit of systemic fatigue and drive the biggest strength signal, which is what protects contractile tissue in a deficit. Isolation and machine work fills coverage gaps (long-head triceps overhead, long-head biceps stretched, seated hamstring) without adding much CNS cost.</p>';
  h+=refs(["Nunes2020","Contreras2015","Suchomel2016"]);
  h+='</div>';
  h+='<div class="msec"><h3>Cut nutrition is the deficit; training keeps muscle<span class="est established">Established</span></h3>';
  h+='<p>The strongest natural-physique evidence shows that under a deficit, adequate protein (roughly 1.6 to 2.4 g/kg body weight per day) plus intense resistance training preserves lean mass and directs the deficit toward fat. Overload is the training piece; the nutrition piece is separate.</p>';
  h+=refs(["Helms2014","Longland2016"]);
  h+='</div>';
  h+='<p class="disc">Fitness plan, not medical or nutrition advice. See a qualified clinician for medical questions.</p>';
  return h;
}

window.__OVERLOAD_RENDER__.renderBlock = renderBlock;
window.__OVERLOAD_RENDER__.renderMethod = renderMethod;
})();

(function(){
"use strict";
var R=window.__OVERLOAD_RENDER__, S=window.__OVERLOAD_STATE__;

var NAV_STATE = {page: "plan"};

function render(){
  var app=document.getElementById("app");
  if(!app) return;
  var page=NAV_STATE.page;
  var html;
  if(page==="plan") html = R.renderPlan();
  else if(page==="session") html = R.renderSession();
  else if(page==="block") html = R.renderBlock();
  else if(page==="method") html = R.renderMethod();
  else html = R.renderPlan();
  app.innerHTML = html;
  document.getElementById("scroll").scrollTop = 0;
}

function bindNav(){
  var nav=document.getElementById("nav");
  if(!nav) return;
  nav.addEventListener("click", function(e){
    var btn = e.target.closest("button[data-nav]");
    if(!btn) return;
    var page = btn.getAttribute("data-nav");
    NAV_STATE.page = page;
    Array.prototype.forEach.call(nav.querySelectorAll("button"), function(b){
      b.setAttribute("aria-selected", b===btn ? "true" : "false");
    });
    render();
  });
}

function bindApp(){
  var app=document.getElementById("app");
  if(!app) return;
  app.addEventListener("click", function(e){
    var chip = e.target.closest("[data-cat]");
    if(chip){
      S.cat = chip.getAttribute("data-cat");
      render();
      return;
    }
    var copyBtn = e.target.closest("[data-action=copy]");
    if(copyBtn){
      var pre = document.getElementById("copytext");
      if(pre){
        var text = pre.textContent;
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(text).then(function(){R.toast("Copied to clipboard");}, function(){R.toast("Copy failed");});
        } else {
          var ta=document.createElement("textarea"); ta.value=text; document.body.appendChild(ta); ta.select();
          try{ document.execCommand("copy"); R.toast("Copied to clipboard"); }catch(_){ R.toast("Copy failed"); }
          document.body.removeChild(ta);
        }
      }
      return;
    }
  });
}

function bindTheme(){
  var btn=document.querySelector("[data-action=theme]");
  if(!btn) return;
  btn.addEventListener("click", function(){
    var cur=document.documentElement.getAttribute("data-theme");
    var next = cur==="dark" ? "light" : cur==="light" ? "" : "dark";
    if(next) document.documentElement.setAttribute("data-theme", next);
    else document.documentElement.removeAttribute("data-theme");
    try{ localStorage.setItem("overload-theme", next); }catch(_){}
  });
  try{ var saved = localStorage.getItem("overload-theme"); if(saved) document.documentElement.setAttribute("data-theme", saved); }catch(_){}
}

document.addEventListener("DOMContentLoaded", function(){
  bindNav(); bindApp(); bindTheme(); render();
});
if(document.readyState==="interactive" || document.readyState==="complete"){
  bindNav(); bindApp(); bindTheme(); render();
}
})();
