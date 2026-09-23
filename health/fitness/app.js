(function(){
"use strict";

var PLAN = (window.__DATA__ && window.__DATA__.plan) || {startDate:"",endDate:"",totalWeeks:19,currentWeek:1,weeksRemaining:19,daysToTarget:135,targetLabel:"Early February"};
var BODY = (window.__DATA__ && window.__DATA__.body) || {series:[],latest:null,startWeight:null,startBodyFat:null,deltaWeight:null,deltaBodyFat:null};
var WORKOUTS = (window.__DATA__ && window.__DATA__.workouts) || {liftsThisWeek:0,soccerThisWeek:0,runsThisWeek:0,recent:[]};
var STRENGTH = (window.__DATA__ && window.__DATA__.strength) || {byExercise:{}};
var NUTRITION = (window.__DATA__ && window.__DATA__.nutrition) || {today:null,trends:null,generatedAt:null};
var SUGGESTIONS = (window.__DATA__ && window.__DATA__.suggestions) || {meals:{}};
var TRAININGPLAN = (window.__DATA__ && window.__DATA__.trainingPlan) || [];
var RUNNING = (window.__DATA__ && window.__DATA__.running) || {week:[],suggestion:null};

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
  {wk:1, block:1, blockName:"Accumulation",   phase:"build",   pri:{sets:4,reps:"6-8",rpe:"7"},   acc:{sets:3,reps:"10-15",rpe:"8"}},
  {wk:2, block:1, blockName:"Accumulation",   phase:"build",   pri:{sets:4,reps:"6-8",rpe:"7-8"}, acc:{sets:4,reps:"10-15",rpe:"8"}},
  {wk:3, block:1, blockName:"Accumulation",   phase:"build",   pri:{sets:4,reps:"6-8",rpe:"8"},   acc:{sets:4,reps:"10-15",rpe:"8"}},
  {wk:4, block:1, blockName:"Accumulation",   phase:"build",   pri:{sets:4,reps:"6-8",rpe:"8"},   acc:{sets:4,reps:"10-15",rpe:"8"}},
  {wk:5, block:1, blockName:"Accumulation",   phase:"deload",  pri:{sets:2,reps:"6",rpe:"5-6"},   acc:{sets:2,reps:"12",rpe:"5-6"}},
  {wk:6, block:2, blockName:"Intensification",phase:"build",   pri:{sets:4,reps:"5-7",rpe:"8"},   acc:{sets:3,reps:"10-15",rpe:"8"}},
  {wk:7, block:2, blockName:"Intensification",phase:"build",   pri:{sets:4,reps:"5-7",rpe:"8"},   acc:{sets:3,reps:"10-15",rpe:"8"}},
  {wk:8, block:2, blockName:"Intensification",phase:"build",   pri:{sets:4,reps:"5-7",rpe:"8"},   acc:{sets:3,reps:"10-15",rpe:"8"}},
  {wk:9, block:2, blockName:"Intensification",phase:"build",   pri:{sets:4,reps:"5-7",rpe:"8"},   acc:{sets:3,reps:"10-12",rpe:"8"}},
  {wk:10,block:2, blockName:"Intensification",phase:"deload",  pri:{sets:2,reps:"6",rpe:"5-6"},   acc:{sets:2,reps:"12",rpe:"5-6"}},
  {wk:11,block:3, blockName:"Retention",      phase:"build",   pri:{sets:4,reps:"5-6",rpe:"8"},   acc:{sets:3,reps:"10-12",rpe:"8"}},
  {wk:12,block:3, blockName:"Retention",      phase:"build",   pri:{sets:4,reps:"5-6",rpe:"8"},   acc:{sets:3,reps:"10-12",rpe:"8"}},
  {wk:13,block:3, blockName:"Retention",      phase:"build",   pri:{sets:3,reps:"5-6",rpe:"8"},   acc:{sets:2,reps:"10-12",rpe:"8"}},
  {wk:14,block:3, blockName:"Retention",      phase:"build",   pri:{sets:3,reps:"5-6",rpe:"8"},   acc:{sets:2,reps:"10-12",rpe:"8"}},
  {wk:15,block:3, blockName:"Retention",      phase:"deload",  pri:{sets:2,reps:"6",rpe:"5-6"},   acc:{sets:2,reps:"12",rpe:"5-6"}},
  {wk:16,block:4, blockName:"Taper",          phase:"build",   pri:{sets:3,reps:"5-6",rpe:"8"},   acc:{sets:2,reps:"10-12",rpe:"7-8"}},
  {wk:17,block:4, blockName:"Taper",          phase:"build",   pri:{sets:3,reps:"5-6",rpe:"8"},   acc:{sets:2,reps:"10-12",rpe:"7-8"}},
  {wk:18,block:4, blockName:"Taper",          phase:"build",   pri:{sets:3,reps:"5",rpe:"8"},     acc:{sets:2,reps:"10",rpe:"7-8"}},
  {wk:19,block:4, blockName:"Taper",          phase:"sharpen", pri:{sets:2,reps:"4-5",rpe:"6-7"}, acc:{sets:1,reps:"8-10",rpe:"6"}}
];

// Start/End frames per exercise, sourced from yuhonas/free-exercise-db (public
// domain). Values are relative paths under IMG_BASE. Any exercise absent from
// this map renders no image at all.
var IMG_BASE = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/";
var EX_IMGS = {
  "Flat Barbell Bench Press":       ["Barbell_Bench_Press_-_Medium_Grip/0.jpg","Barbell_Bench_Press_-_Medium_Grip/1.jpg"],
  "Incline DB Press":               ["Incline_Dumbbell_Press/0.jpg","Incline_Dumbbell_Press/1.jpg"],
  "Close Grip Bench Press":         ["Close-Grip_Barbell_Bench_Press/0.jpg","Close-Grip_Barbell_Bench_Press/1.jpg"],
  "Cable or Machine Fly":           ["Cable_Crossover/0.jpg","Cable_Crossover/1.jpg"],
  "Overhead Rope Cable Extension":  ["Cable_Rope_Overhead_Triceps_Extension/0.jpg","Cable_Rope_Overhead_Triceps_Extension/1.jpg"],
  "Cable Pushdown":                 ["Triceps_Pushdown_-_Rope_Attachment/0.jpg","Triceps_Pushdown_-_Rope_Attachment/1.jpg"],
  "Weighted Pull-Up":               ["Weighted_Pull_Ups/0.jpg","Weighted_Pull_Ups/1.jpg"],
  "Barbell Row (Pendlay)":          ["Bent_Over_Barbell_Row/0.jpg","Bent_Over_Barbell_Row/1.jpg"],
  "Incline DB Curl":                ["Incline_Dumbbell_Curl/0.jpg","Incline_Dumbbell_Curl/1.jpg"],
  "Lat Pulldown (neutral grip)":    ["Close-Grip_Front_Lat_Pulldown/0.jpg","Close-Grip_Front_Lat_Pulldown/1.jpg"],
  "Cable Pullover":                 ["Straight-Arm_Dumbbell_Pullover/0.jpg","Straight-Arm_Dumbbell_Pullover/1.jpg"],
  "Bayesian Cable Curl":            ["Standing_Biceps_Cable_Curl/0.jpg","Standing_Biceps_Cable_Curl/1.jpg"],
  "Back Squat":                     ["Barbell_Squat/0.jpg","Barbell_Squat/1.jpg"],
  "Romanian Deadlift":              ["Romanian_Deadlift/0.jpg","Romanian_Deadlift/1.jpg"],
  "Bulgarian Split Squat":          ["Split_Squat_with_Dumbbells/0.jpg","Split_Squat_with_Dumbbells/1.jpg"],
  "Leg Press (deep)":               ["Leg_Press/0.jpg","Leg_Press/1.jpg"],
  "Seated Leg Curl":                ["Seated_Leg_Curl/0.jpg","Seated_Leg_Curl/1.jpg"],
  "Leg Extension (paused)":         ["Leg_Extensions/0.jpg","Leg_Extensions/1.jpg"],
  "Standing Calf Raise (deficit)":  ["Rocking_Standing_Calf_Raise/0.jpg","Rocking_Standing_Calf_Raise/1.jpg"],
  "Power Clean":                    ["Clean/0.jpg","Clean/1.jpg"],
  "Push Press":                     ["Push_Press/0.jpg","Push_Press/1.jpg"],
  "Standing Overhead Press":        ["Standing_Military_Press/0.jpg","Standing_Military_Press/1.jpg"],
  "Seated DB Shoulder Press":       ["Seated_Dumbbell_Press/0.jpg","Seated_Dumbbell_Press/1.jpg"],
  "Leaning DB Lateral Raise":       ["Side_Lateral_Raise/0.jpg","Side_Lateral_Raise/1.jpg"],
  "Rear Delt Cable Fly":            ["Cable_Rear_Delt_Fly/0.jpg","Cable_Rear_Delt_Fly/1.jpg"],
  "Hanging Leg Raise":              ["Hanging_Leg_Raise/0.jpg","Hanging_Leg_Raise/1.jpg"],
  "Cable Crunch":                   ["Cable_Crunch/0.jpg","Cable_Crunch/1.jpg"],
  "Face Pull":                      ["Face_Pull/0.jpg","Face_Pull/1.jpg"],
  "Band Pull-Apart":                ["Band_Pull_Apart/0.jpg","Band_Pull_Apart/1.jpg"]
};

// Category workouts. Primaries are free-weight compounds run heavy across the
// cut for muscle-retention intent; accessories are machines/DBs at higher reps
// covering complementary angles. Olympic lifts are prescribed for quality reps
// and never taken to failure - see Shoulder & Olympic note.
var CATEGORIES = {
  "Chest & Triceps":{
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
  "Shoulder & Olympic":{
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

var CAT_ORDER = ["Chest & Triceps","Back & Bicep","Legs","Shoulder & Olympic"];

window.__OVERLOAD_PART1__ = {PLAN:PLAN,BODY:BODY,WORKOUTS:WORKOUTS,STRENGTH:STRENGTH,NUTRITION:NUTRITION,SUGGESTIONS:SUGGESTIONS,TRAININGPLAN:TRAININGPLAN,RUNNING:RUNNING,CITE:CITE,MESO:MESO,CATEGORIES:CATEGORIES,MORNINGS:MORNINGS,CAT_ORDER:CAT_ORDER,IMG_BASE:IMG_BASE,EX_IMGS:EX_IMGS};
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
var CATEGORIES=D.CATEGORIES, MORNINGS=D.MORNINGS, CAT_ORDER=D.CAT_ORDER, WORKOUTS=D.WORKOUTS;
var IMG_BASE=D.IMG_BASE, EX_IMGS=D.EX_IMGS;
var esc=R.esc, citeChip=R.citeChip, meta=R.meta, phaseLabel=R.phaseLabel, toast=R.toast;

var TRAININGPLAN = D.TRAININGPLAN || [];
var RUNNING = D.RUNNING || {week:[],suggestion:null};
var TRAINING_FN = "https://uuvsvtpfcexhqojlrsxy.supabase.co/functions/v1/training-update";
var LOAD_BY_OPTION = {
  "Chest & Triceps":"moderate",
  "Back & Bicep":"moderate",
  "Shoulder & Olympic":"moderate",
  "Legs":"high",
  "Soccer":"high",
  "Rest":"rest",
  "Flex":"moderate"
};

function imgStrip(exName){
  var paths = EX_IMGS[exName];
  if(!paths || !paths.length) return "";
  var img0 = IMG_BASE + paths[0], img1 = IMG_BASE + paths[1] || "";
  var hide = "this.parentNode && (this.parentNode.style.display='none');";
  return '<div class="imgstrip">'
       + '<figure><img src="'+esc(img0)+'" loading="lazy" alt="'+esc(exName)+' start" onerror="'+hide+'"><figcaption>Start</figcaption></figure>'
       + '<figure><img src="'+esc(img1)+'" loading="lazy" alt="'+esc(exName)+' end"   onerror="'+hide+'"><figcaption>End</figcaption></figure>'
       + '</div>';
}

var SESSION_STATE = {cat: null, editing: false, editAssign: null, pin: "", runEditing: false};

// Day-option cycle order per tap. The 4 lift categories + Soccer, Rest, Flex.
var DAY_OPTIONS = ["Chest & Triceps","Back & Bicep","Shoulder & Olympic","Legs","Soccer","Rest","Flex"];
var DEFAULT_ASSIGN = { // Mon=0 through Sun=6 (Mon-first week per user spec)
  0:"Chest & Triceps", 1:"Back & Bicep", 2:"Legs", 3:"Shoulder & Olympic",
  4:"Flex",   5:"Soccer",       6:"Rest"
};
var DAY_LABEL_SHORT = {
  "Chest & Triceps":"Chest+Tri",
  "Back & Bicep":"Back+Bi",
  "Shoulder & Olympic":"Sh+Oly",
  "Legs":"Legs",
  "Soccer":"Soccer",
  "Rest":"Rest",
  "Flex":"Flex"
};
var DOW_LABEL = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function isoWeekKey(d){
  // ISO week: Thursday of the same ISO week determines the year.
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  var firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  var week = 1 + Math.round(((t - firstThu)/86400000 - 3 + ((firstThu.getUTCDay()+6)%7))/7);
  return t.getUTCFullYear() + "-W" + String(week).padStart(2,"0");
}
function mondayOf(d){
  var t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var off = (t.getDay() + 6) % 7; // Sun=6, Mon=0
  t.setDate(t.getDate() - off);
  return t;
}
function loadWeek(key){
  try {
    var raw = localStorage.getItem("overload-week-" + key);
    if(raw){ var v = JSON.parse(raw); if(v && v.assign && v.done) return v; }
  } catch(_){}
  return {assign: Object.assign({}, DEFAULT_ASSIGN), done: {}};
}
function saveWeek(key, state){
  try { localStorage.setItem("overload-week-" + key, JSON.stringify(state)); } catch(_){}
}
function cycleDay(current){
  var i = DAY_OPTIONS.indexOf(current);
  return DAY_OPTIONS[(i<0?0:(i+1)) % DAY_OPTIONS.length];
}

function planAssign(){
  var byDow = {};
  (TRAININGPLAN||[]).forEach(function(r){ if(r && r.dow) byDow[r.dow] = r; });
  var out = {};
  for(var i=0;i<7;i++){
    var row = byDow[DOW_LABEL[i]];
    var t = row && row.training_type ? row.training_type : "Rest";
    out[i] = t;
  }
  return out;
}

function exBlock(ex, kind, spec, rank){
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
  h+=imgStrip(ex.n);
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
    h+='</div>'+imgStrip(ex.n)+citeChip(ex.cite)+'</div>';
  });
  return h;
}

function computeSuggestion(week){
  // Which categories are already done this week?
  var doneCats = {};
  Object.keys(week.assign).forEach(function(dowStr){
    var a = week.assign[dowStr];
    if(week.done[dowStr] && CAT_ORDER.indexOf(a) >= 0) doneCats[a] = true;
  });
  var remaining = CAT_ORDER.filter(function(c){ return !doneCats[c]; });
  var today = new Date();
  var todayDow = (today.getDay() + 6) % 7;
  // Missed = past lift-category days that are not marked done.
  var missed = [];
  for(var i=0;i<todayDow;i++){
    var a = week.assign[i];
    if(CAT_ORDER.indexOf(a) >= 0 && !week.done[i] && !doneCats[a]){
      missed.push({dow:i, cat:a});
    }
  }
  // Remaining lift-eligible days: today onward whose assignment is not Rest/Soccer AND
  // day is not already marked done.
  var openLiftDaysLeft = 0;
  for(var j=todayDow;j<=6;j++){
    var aa = week.assign[j];
    if(week.done[j]) continue;
    if(aa === "Rest" || aa === "Soccer") continue;
    openLiftDaysLeft++;
  }
  var behindBy = Math.max(0, remaining.length - openLiftDaysLeft);
  return {
    doneCats: doneCats,
    remaining: remaining,
    missed: missed,
    openLiftDaysLeft: openLiftDaysLeft,
    behindBy: behindBy,
    next: remaining.length ? remaining[0] : null,
    todayDow: todayDow
  };
}

function renderCalendar(){
  var now = new Date();
  var mon = mondayOf(now);
  var key = isoWeekKey(mon);
  var stored = loadWeek(key);
  var assign = SESSION_STATE.editing && SESSION_STATE.editAssign
    ? SESSION_STATE.editAssign
    : planAssign();
  var week = {assign: assign, done: stored.done || {}};
  SESSION_STATE.weekKey = key;
  SESSION_STATE.week = week;
  var sug = computeSuggestion(week);
  var todayDow = sug.todayDow;
  var missedDows = {}; sug.missed.forEach(function(m){ missedDows[m.dow] = true; });

  var savedPin = "";
  try { savedPin = localStorage.getItem("overload-editor-pin") || ""; } catch(_){}

  var h = '<div class="wkcal">';
  h += '<div class="wkcalh"><b>This week · '+esc(key)+'</b>';
  if(SESSION_STATE.editing){
    h += '<span>tap a day to change it</span>';
  } else {
    h += '<span>tap done</span>';
  }
  h += '</div>';
  if(SESSION_STATE.editing){
    h += '<div class="exspec" style="align-items:center;gap:8px;margin:6px 0 10px">';
    h +=   '<div class="spec" style="flex:1;min-width:0"><span>PIN</span>' +
           '<input data-wk-pin type="password" autocomplete="off" inputmode="numeric" value="'+esc(savedPin)+'" ' +
           'style="border:0;background:transparent;color:var(--ink);font:inherit;font-weight:600;width:100%;padding:0;outline:none"></div>';
    h +=   '<button class="chip" data-action="save-week" type="button" ' +
           'style="background:var(--ink);color:var(--bg);border-color:var(--ink)">Save</button>';
    h +=   '<button class="chip" data-action="cancel-week" type="button">Cancel</button>';
    h += '</div>';
  } else {
    h += '<div style="display:flex;justify-content:flex-end;margin:6px 0 10px">';
    h +=   '<button class="chip" data-action="edit-week" type="button">Edit</button>';
    h += '</div>';
  }
  h += '<div class="wkgrid">';
  for(var i=0;i<7;i++){
    var d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate()+i);
    var a = week.assign[i] || DEFAULT_ASSIGN[i];
    var isDone = !!week.done[i];
    var isToday = (i === todayDow);
    var isMissed = missedDows[i];
    var cls = "wkday";
    if(isToday) cls += " today";
    if(isDone) cls += " done";
    else if(isMissed) cls += " missed";
    h += '<button class="'+cls+'" data-day="'+i+'" data-date="'+d.toISOString().slice(0,10)+'" aria-label="Day '+DOW_LABEL[i]+' '+esc(a)+'">';
    h += '  <span class="dow">'+DOW_LABEL[i]+'</span>';
    h += '  <span class="lbl">'+esc(DAY_LABEL_SHORT[a]||a)+'</span>';
    if(isDone) h += '<span class="mark">&#10003;</span>';
    else if(isMissed) h += '<span class="mark">!</span>';
    h += '</button>';
  }
  h += '</div>';
  var doneCount = Object.keys(sug.doneCats).length;
  var liftsWhoop = (WORKOUTS && WORKOUTS.liftsThisWeek) || 0;
  h += '<div class="wksum">Done this week: <b>'+doneCount+' of '+CAT_ORDER.length+' lift days</b>. WHOOP shows <b>'+liftsWhoop+' lifts logged</b> (cross-check).';
  if(sug.missed.length){
    h += ' <span class="warn">Missed: '+esc(sug.missed.map(function(m){return DOW_LABEL[m.dow]+' '+m.cat;}).join(", "))+'.</span>';
  }
  h += '</div>';
  if(sug.behindBy > 0 && sug.remaining.length){
    h += '<div class="suggest behind"><b>Behind by '+sug.behindBy+':</b> double up on a day or prioritize <b>'+esc(sug.remaining.join(" &rarr; "))+'</b>.</div>';
  } else if(sug.next){
    h += '<div class="suggest"><b>Suggested today: '+esc(sug.next)+'</b>. Or pick any category below.</div>';
  } else {
    h += '<div class="suggest"><b>All 4 categories done this week.</b> Nice. Mornings and easy runs only.</div>';
  }
  h += '</div>';
  return {html: h, suggestion: sug, week: week, weekKey: key};
}

function renderSession(){
  var w=D.PLAN.currentWeek||1, m=meta(w);
  var cal = renderCalendar();
  var cat = SESSION_STATE.cat || cal.suggestion.next || CAT_ORDER[0];
  var catData = CATEGORIES[cat];
  var h = renderRunningStrip(cal.weekKey) + cal.html;
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

function toggleDayDone(dow){
  if(!SESSION_STATE.week) return;
  var w = SESSION_STATE.week, k = SESSION_STATE.weekKey;
  w.done[dow] = !w.done[dow];
  saveWeek(k, w);
}

function beginEdit(){
  SESSION_STATE.editAssign = Object.assign({}, planAssign());
  SESSION_STATE.editing = true;
}
function cancelEdit(){
  SESSION_STATE.editing = false;
  SESSION_STATE.editAssign = null;
}
function cycleEditDay(dow){
  if(!SESSION_STATE.editing) return;
  if(!SESSION_STATE.editAssign) SESSION_STATE.editAssign = planAssign();
  var current = SESSION_STATE.editAssign[dow] || "Rest";
  SESSION_STATE.editAssign[dow] = cycleDay(current);
}
function saveWeekPlan(pin){
  var editAssign = SESSION_STATE.editAssign || planAssign();
  var updates = [];
  for(var i=0;i<7;i++){
    var opt = editAssign[i] || "Rest";
    updates.push({
      dow: DOW_LABEL[i],
      training_type: opt,
      load: LOAD_BY_OPTION[opt] || "moderate"
    });
  }
  return fetch(TRAINING_FN, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({pin: pin, updates: updates})
  }).then(function(resp){
    return resp.json().catch(function(){return {};}).then(function(body){
      if(resp.status === 200 && body && body.ok){
        // Mutate the shared TRAININGPLAN in place so the strip and any meal
        // renderers pick up the new plan until the next build refreshes.
        var byDow = {};
        (TRAININGPLAN||[]).forEach(function(r){ if(r && r.dow) byDow[r.dow] = r; });
        updates.forEach(function(u){
          byDow[u.dow] = {dow:u.dow, training_type:u.training_type, load:u.load};
        });
        TRAININGPLAN.length = 0;
        DOW_LABEL.forEach(function(d){
          TRAININGPLAN.push(byDow[d] || {dow:d, training_type:"Rest", load:"rest"});
        });
        D.TRAININGPLAN = TRAININGPLAN;
        SESSION_STATE.editing = false;
        SESSION_STATE.editAssign = null;
      }
      return {status: resp.status, body: body};
    });
  });
}

function _todayLocalISO(){
  var d = new Date();
  var yr = d.getFullYear();
  var mo = String(d.getMonth()+1).padStart(2,"0");
  var da = String(d.getDate()).padStart(2,"0");
  return yr+"-"+mo+"-"+da;
}
function _fmtKm(v){
  if(v == null || isNaN(v)) return "-";
  var n = Math.round(v*10)/10;
  return (n % 1 === 0 ? n.toFixed(1) : String(n)) + " km";
}

function renderRunningStrip(weekKey){
  var week = (RUNNING && RUNNING.week) || [];
  var sug = RUNNING && RUNNING.suggestion;
  var editing = !!SESSION_STATE.runEditing;
  var todayIso = _todayLocalISO();

  if(!week.length && !sug){
    return '<div class="wkcal"><div class="wkcalh"><b>Running · '+esc(weekKey||"")+'</b><span>no run data yet</span></div>' +
           '<div class="wksum">No run data yet.</div></div>';
  }

  var savedPin = "";
  try { savedPin = localStorage.getItem("overload-editor-pin") || ""; } catch(_){}

  var h = '<div class="wkcal">';
  h += '<div class="wkcalh"><b>Running · '+esc(weekKey||"")+'</b>';
  h += '<span>'+(editing ? "type distances, save when done" : "km logged per day")+'</span>';
  h += '</div>';

  if(editing){
    h += '<div class="exspec" style="align-items:center;gap:8px;margin:6px 0 10px">';
    h +=   '<div class="spec" style="flex:1;min-width:0"><span>PIN</span>' +
           '<input data-run-pin type="password" autocomplete="off" inputmode="numeric" value="'+esc(savedPin)+'" ' +
           'style="border:0;background:transparent;color:var(--ink);font:inherit;font-weight:600;width:100%;padding:0;outline:none"></div>';
    h +=   '<button class="chip" data-action="save-runs" type="button" ' +
           'style="background:var(--ink);color:var(--bg);border-color:var(--ink)">Save</button>';
    h +=   '<button class="chip" data-action="cancel-runs" type="button">Cancel</button>';
    h += '</div>';
  } else {
    h += '<div style="display:flex;justify-content:flex-end;margin:6px 0 10px">';
    h +=   '<button class="chip" data-action="edit-runs" type="button">Edit</button>';
    h += '</div>';
  }

  h += '<div class="wkgrid">';
  week.forEach(function(day){
    var isToday = (day.date === todayIso);
    var cls = "wkday" + (isToday ? " today" : "");
    h += '<div class="'+cls+'" data-date="'+esc(day.date)+'">';
    h +=   '<span class="dow">'+esc(day.dow)+'</span>';
    if(editing){
      var val = (day.distance_km == null) ? "" : String(day.distance_km);
      h += '<input data-run-date="'+esc(day.date)+'" type="number" step="0.1" min="0" value="'+esc(val)+'" ' +
           'style="width:100%;border:0;background:transparent;color:var(--ink);font:inherit;font-weight:700;font-size:11px;text-align:center;padding:0;outline:none">';
    } else {
      h += '<span class="lbl">'+esc(_fmtKm(day.distance_km))+'</span>';
    }
    h += '</div>';
  });
  h += '</div>';

  if(sug){
    var bfTxt = (sug.body_fat_pct != null) ? ", "+sug.body_fat_pct+"% bf" : "";
    var msg = "Run target: ~"+sug.target_km+" km to burn ~"+sug.target_kcal+" kcal (~"+
              sug.kcal_per_km+" kcal/km at "+sug.weight_kg+" kg"+bfTxt+"). ~"+
              sug.weekly_runs+" runs/week is ~"+sug.weekly_kcal+" kcal. " +
              "Scales with weight, eases toward "+sug.goal_bf+"% body fat. " +
              "Rough estimate, not medical advice.";
    h += '<div class="suggest"><b>Run target</b> · '+esc(msg)+'</div>';
  } else {
    h += '<div class="wksum">No run data yet.</div>';
  }
  h += '</div>';
  return h;
}

function beginRunEdit(){ SESSION_STATE.runEditing = true; }
function cancelRunEdit(){ SESSION_STATE.runEditing = false; }

function saveRuns(pin){
  var runs = [];
  Array.prototype.forEach.call(document.querySelectorAll("[data-run-date]"), function(inp){
    var d = inp.getAttribute("data-run-date");
    var raw = String(inp.value||"").trim();
    var dist;
    if(raw === ""){
      dist = null;
    } else {
      var num = Number(raw);
      dist = (isFinite(num) && num > 0) ? num : null;
    }
    runs.push({date: d, distance_km: dist});
  });
  return fetch(TRAINING_FN, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({pin: pin, runs: runs})
  }).then(function(resp){
    return resp.json().catch(function(){return {};}).then(function(body){
      if(resp.status === 200 && body && body.ok){
        var byDate = {};
        runs.forEach(function(r){ byDate[r.date] = r.distance_km; });
        (RUNNING.week || []).forEach(function(day){
          if(Object.prototype.hasOwnProperty.call(byDate, day.date)){
            day.distance_km = byDate[day.date];
          }
        });
        SESSION_STATE.runEditing = false;
      }
      return {status: resp.status, body: body};
    });
  });
}

window.__OVERLOAD_RENDER__.renderSession      = renderSession;
window.__OVERLOAD_RENDER__.renderRunningStrip = renderRunningStrip;
window.__OVERLOAD_RENDER__.toggleDayDone      = toggleDayDone;
window.__OVERLOAD_RENDER__.beginEdit          = beginEdit;
window.__OVERLOAD_RENDER__.cancelEdit         = cancelEdit;
window.__OVERLOAD_RENDER__.cycleEditDay       = cycleEditDay;
window.__OVERLOAD_RENDER__.saveWeekPlan       = saveWeekPlan;
window.__OVERLOAD_RENDER__.beginRunEdit       = beginRunEdit;
window.__OVERLOAD_RENDER__.cancelRunEdit      = cancelRunEdit;
window.__OVERLOAD_RENDER__.saveRuns           = saveRuns;
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
  h+='<div class="note"><b>How to read it.</b> Primaries stay heavy but submaximal, RPE about 8 at 5 to 8 reps, across the whole cut. Never triples, never RPE 9: that is a strength peak, not a fat-loss retention block. Accessory volume tapers as the deficit deepens because recovery falls. Deloads reset accumulated fatigue every ~5 weeks. Week 19 sharpens: technique and clean submaximal reps, no PR attempts.</div>';
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
  if(b===1) return "Accumulation. Accessory volume is highest and primary loads are established at moderate effort. The deficit is shallowest here, so this is the best window to add a little load to the primary lifts.";
  if(b===2) return "Intensification. Hold primaries heavy at RPE 8 in the 5 to 7 rep range; accessory volume stays moderate. The job is retention, not PRs.";
  if(b===3) return "Retention. Primaries at RPE 8 for 5 to 6 reps. Start trimming accessory sets as the deficit deepens and recovery falls.";
  if(b===4) return "Taper. Hold primary intensity on fewer sets and keep accessories at the minimum that maintains. Week 19 sharpens so you arrive lean with muscle intact.";
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
  h+='<p>Under a caloric deficit, recovery is compromised and high-volume programs overshoot the athlete\'s tolerance. Heavy submaximal loading protects the retention signal even when total volume is trimmed. Overload holds primary sets at RPE about 8 for 5 to 8 reps across the whole cut and trims accessory volume as the deficit deepens. Primaries are deliberately not taken to failure, and never dropped to triples at RPE 9: that is a strength peak, not a retention block.</p>';
  h+=refs(["Refalo2023","Grgic2022"]);
  h+='</div>';
  h+='<div class="msec"><h3>10-20 hard sets per muscle per week is the effective range<span class="est established">Established</span></h3>';
  h+='<p>Schoenfeld\'s dose-response meta shows a roughly linear return through about 10 to 20 hard sets per muscle per week for trained lifters. Overload targets the middle of this range in Block 1 and lands near the lower end by Block 4, matching the reduced recovery capacity of a deep cut.</p>';
  h+='<p>On a four-day split each muscle is trained directly about once a week. Growth in a surplus favors roughly twice, but retaining muscle in a deficit needs less, and pressing carries over to triceps, pulling to biceps, and the Mornings core block adds indirect frequency for the trunk. 1x direct is a deliberate retention choice here, not a shortfall.</p>';
  h+=refs(["Schoenfeld2017Vol","Schoenfeld2016Freq"]);
  h+='</div>';
  h+='<div class="msec"><h3>Train 0 to 3 reps in reserve<span class="est established">Established</span></h3>';
  h+='<p>Sets taken 0 to 3 reps shy of failure produce essentially identical hypertrophy at equated volume, and closer proximity to failure is required when total volume is low. In a retention cut, Overload sits primaries at RIR about 2 (RPE 8) so quality reps still accumulate without draining CNS or joints; accessories run at RIR 1 to 2; deload weeks push RIR to 3 to 4.</p>';
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

// ---------- Nutrition domain ----------
(function(){
"use strict";
var D=window.__OVERLOAD_PART1__, R=window.__OVERLOAD_RENDER__;
var NUTRITION = D.NUTRITION || {today:null,trends:null,generatedAt:null};
var SUGGESTIONS = D.SUGGESTIONS || {meals:{}};
var esc=R.esc;

var CHARTS = {};
function destroyChart(k){ if(CHARTS[k]){ try{CHARTS[k].destroy();}catch(_){} CHARTS[k]=null; } }
function destroyAllCharts(){ Object.keys(CHARTS).forEach(destroyChart); }

function fmtInt(n){ if(n==null||isNaN(n))return "-"; return Math.round(n).toLocaleString("en-US"); }
function fmtSigned(n){ if(n==null||isNaN(n))return "-"; var r=Math.round(n); return (r>=0?"+":"")+r.toLocaleString("en-US"); }
function fmtG(n){ if(n==null||isNaN(n))return "0"; var v=Math.round(n*10)/10; return (v%1===0?v.toFixed(0):v.toFixed(1)); }
function fmtDate(iso){ if(!iso)return "-"; var d=new Date(iso+"T00:00:00"); if(isNaN(d))return iso; return d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}); }
function fmtDateShort(iso){ if(!iso)return "-"; var d=new Date(iso+"T00:00:00"); if(isNaN(d))return iso; return d.toLocaleDateString("en-US",{month:"short",day:"numeric"}); }

function renderNutritionToday(){
  var T = NUTRITION.today || {};
  if(!T.date || !T.meals || !T.meals.length){
    return '<div class="sec-title">Today</div>' +
           '<div class="emptybox"><b>No food logged yet.</b><br>Log meals by chat and the next build refreshes this page.</div>';
  }
  var hasOut = (T.caloriesOut||0) > 0;
  var badgeCls, badgeTxt;
  if(!hasOut){ badgeCls="flat"; badgeTxt = "No WHOOP burn yet for this day"; }
  else if(T.isDeficit){ badgeCls="deficit"; badgeTxt = 'In a deficit · <span class="num">-'+fmtInt(T.deficit)+'</span> kcal'; }
  else if(T.net===0){ badgeCls="flat"; badgeTxt="Balanced day"; }
  else { badgeCls="surplus"; badgeTxt='Surplus · <span class="num">+'+fmtInt(T.deficit)+'</span> kcal'; }

  var protein = T.protein_g || 0;
  var target  = T.proteinTarget_g;
  var proteinUnder = (target!=null) && (protein < target);
  var proteinPctOfTarget = target ? Math.min(100, Math.round(protein/target*100)) : 0;

  var h = '';
  h += '<div class="sec-title">Today</div>';
  h += '<div class="iohero">';
  h +=   '<div class="ihd"><div class="verb">Fuel &amp; Burn</div><div class="whn">'+esc(fmtDate(T.date))+'</div></div>';
  h +=   '<div class="iogrid">';
  h +=     '<div class="iocell"><div class="iolab">In · Food</div><div class="ioval">'+fmtInt(T.caloriesIn)+'<em>kcal</em></div></div>';
  h +=     '<div class="iosep">vs</div>';
  h +=     '<div class="iocell right"><div class="iolab">Out · WHOOP</div><div class="ioval">'+fmtInt(T.caloriesOut)+'<em>kcal</em></div></div>';
  h +=   '</div>';
  h +=   '<div><span class="iobadge '+badgeCls+'">'+badgeTxt+'</span></div>';
  h += '</div>';

  h += '<div class="sec-title">Macros</div>';
  h += '<div class="macros">';
  var proteinCls = (target!=null) ? (proteinUnder ? "macro under-target" : "macro on-target") : "macro";
  h += '<div class="'+proteinCls+'"><div class="mlab">Protein</div>' +
       '<div class="mval">'+fmtG(protein)+'<em>g</em></div>' +
       '<div class="mpct">'+(T.proteinPct||0)+'% of kcal</div>' +
       '<div class="mbar"><i style="width:'+Math.min(100, T.proteinPct||0)+'%"></i></div>';
  if(target!=null){
    h += '<div class="mtgt">Target '+target+' g · ';
    if(proteinUnder) h += '<b class="under">Under '+Math.max(0,target-Math.round(protein))+' g</b>';
    else             h += '<b class="hit">Hit</b>';
    h += ' · '+proteinPctOfTarget+'%</div>';
  }
  h += '</div>';
  h += '<div class="macro"><div class="mlab">Carbs</div><div class="mval">'+fmtG(T.carbs_g)+'<em>g</em></div>' +
       '<div class="mpct">'+(T.carbsPct||0)+'% of kcal</div>' +
       '<div class="mbar"><i style="width:'+Math.min(100, T.carbsPct||0)+'%"></i></div></div>';
  h += '<div class="macro"><div class="mlab">Fat</div><div class="mval">'+fmtG(T.fat_g)+'<em>g</em></div>' +
       '<div class="mpct">'+(T.fatPct||0)+'% of kcal</div>' +
       '<div class="mbar"><i style="width:'+Math.min(100, T.fatPct||0)+'%"></i></div></div>';
  h += '<div class="macro"><div class="mlab">Fiber</div><div class="mval">'+fmtG(T.fiber_g)+'<em>g</em></div>' +
       '<div class="mpct">daily total</div>' +
       '<div class="mbar"><i style="width:'+Math.min(100, Math.round(((T.fiber_g||0)/38)*100))+'%"></i></div></div>';
  h += '</div>';

  h += '<div class="sec-title">Food diary</div>';
  (T.meals||[]).forEach(function(m){
    h += '<div class="meal">';
    h +=   '<div class="mh"><b>'+esc(m.meal)+'</b><span><b>'+fmtInt(m.total.calories_kcal)+'</b> kcal · P '+fmtG(m.total.protein_g)+'g · C '+fmtG(m.total.carbs_g)+'g · F '+fmtG(m.total.fat_g)+'g</span></div>';
    h +=   '<table><thead><tr><th>Item</th><th>Qty</th><th class="num">kcal</th><th class="num">P</th><th class="num">C</th><th class="num">F</th><th class="num">Fi</th></tr></thead><tbody>';
    m.items.forEach(function(it){
      h += '<tr><td class="item">'+esc(it.item)+'</td><td class="qty">'+esc(it.quantity)+'</td>' +
           '<td class="num">'+fmtInt(it.calories_kcal)+'</td>' +
           '<td class="num">'+fmtG(it.protein_g)+'</td>' +
           '<td class="num">'+fmtG(it.carbs_g)+'</td>' +
           '<td class="num">'+fmtG(it.fat_g)+'</td>' +
           '<td class="num">'+fmtG(it.fiber_g)+'</td></tr>';
    });
    h +=   '</tbody></table>';
    h += '</div>';
  });

  h += '<div class="daytot"><span class="lbl">Day total</span><span class="val"><b>'+fmtInt(T.caloriesIn)+'</b> kcal · P '+fmtG(T.protein_g)+'g · C '+fmtG(T.carbs_g)+'g · F '+fmtG(T.fat_g)+'g · Fi '+fmtG(T.fiber_g)+'g</span></div>';
  h += '<p class="disc">View only. Food logged by chat. Metric units.</p>';
  return h;
}

function renderNutritionTrends(){
  var TR = NUTRITION.trends || {days:[],body:[]};
  var days = TR.days || [];
  var avgDef = TR.avgDailyDeficit || 0;
  var avgProtein = TR.avgDailyProtein || 0;
  var target = TR.proteinTargetG;
  var onTarget = TR.daysOnTarget || 0;
  var tracked = TR.daysTracked || 0;
  var total = TR.daysTotal || days.length;

  var defCls = avgDef < 0 ? "deficit" : (avgDef > 0 ? "surplus" : "");
  var defTxt = avgDef < 0 ? "kcal deficit / day" : avgDef > 0 ? "kcal surplus / day" : "balanced";

  var h = '';
  h += '<div class="sec-title">Rolling '+total+' days</div>';
  h += '<div class="kpis">';
  h +=   '<div class="kpi"><div class="klab">Avg daily net</div><div class="kval '+defCls+'">'+fmtSigned(avgDef)+'<em>kcal</em></div><div class="ksub">'+esc(defTxt)+' · '+tracked+'/'+total+' tracked</div></div>';
  h +=   '<div class="kpi"><div class="klab">Avg daily protein</div><div class="kval">'+fmtG(avgProtein)+'<em>g</em></div><div class="ksub">'+(target!=null?'target '+target+' g':'no target')+'</div></div>';
  h +=   '<div class="kpi"><div class="klab">Days on target</div><div class="kval">'+onTarget+'<em>/ '+tracked+'</em></div><div class="ksub">since '+esc(days.length?fmtDateShort(days[0].date):'-')+'</div></div>';
  h += '</div>';

  if(!tracked){
    h += '<div class="emptybox"><b>No nutrition log rows yet in the rolling window.</b><br>Charts will render once meals start logging.</div>';
    return h;
  }

  h += '<div class="chartcard"><h3>Calories in vs out</h3><div class="cwrap"><canvas id="chart-cal"></canvas></div></div>';
  h += '<div class="chartcard small"><h3>Daily protein · target overlay</h3><div class="cwrap"><canvas id="chart-protein"></canvas></div></div>';
  h += '<div class="chartcard small"><h3>Body composition · weight and body fat</h3><div class="cwrap"><canvas id="chart-body"></canvas></div></div>';
  h += '<p class="disc">Metric units. WHOOP burn from <code>whoop_cycles</code>; net = in − out.</p>';
  return h;
}

function accentColor(){
  var v = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  return v || "#E4551C";
}
function inkColor(){
  var v = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
  return v || "#14171C";
}
function goodColor(){
  var v = getComputedStyle(document.documentElement).getPropertyValue("--good").trim();
  return v || "#12905A";
}
function mutedColor(){
  var v = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim();
  return v || "#5B6371";
}
function faintColor(){
  var v = getComputedStyle(document.documentElement).getPropertyValue("--faint").trim();
  return v || "#8B93A1";
}
function lineColor(){
  var v = getComputedStyle(document.documentElement).getPropertyValue("--line").trim();
  return v || "#E4E7EC";
}

function commonChartOpts(){
  var tickColor = mutedColor();
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {mode: "index", intersect: false},
    plugins: {
      legend: {labels: {color: mutedColor(), font: {size: 11, weight: "600", family: "Barlow, system-ui, sans-serif"}, boxWidth: 12}},
      tooltip: {backgroundColor: inkColor(), titleColor: "#fff", bodyColor: "#fff", borderColor: lineColor(), borderWidth: 1}
    },
    scales: {
      x: {ticks: {color: tickColor, font: {size: 10}}, grid: {color: lineColor()}},
      y: {ticks: {color: tickColor, font: {size: 10}}, grid: {color: lineColor()}, beginAtZero: true}
    }
  };
}

function drawCharts(){
  if(!window.Chart) { setTimeout(drawCharts, 60); return; }
  var TR = NUTRITION.trends || {days:[],body:[]};
  var days = TR.days || [];
  if(!days.length || !(TR.daysTracked||0)) return;

  var labels = days.map(function(d){ return fmtDateShort(d.date); });
  var accent = accentColor(), good = goodColor(), muted = mutedColor();

  var cal = document.getElementById("chart-cal");
  if(cal){
    destroyChart("cal");
    CHARTS.cal = new Chart(cal, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {label: "In · Food",   data: days.map(function(d){return d.caloriesIn||0;}),  backgroundColor: accent, borderRadius: 3, order: 2},
          {label: "Out · WHOOP", data: days.map(function(d){return d.caloriesOut||0;}), backgroundColor: muted, borderRadius: 3, order: 2},
          {label: "Net (in − out)", type: "line", data: days.map(function(d){return d.net||0;}),
           borderColor: good, backgroundColor: "transparent", tension: 0.25, pointRadius: 2, borderWidth: 2, order: 1, yAxisID: "y2"}
        ]
      },
      options: Object.assign(commonChartOpts(), {
        scales: Object.assign(commonChartOpts().scales, {
          y2: {position: "right", ticks: {color: good, font: {size: 10}}, grid: {display: false}}
        })
      })
    });
  }

  var prot = document.getElementById("chart-protein");
  if(prot){
    destroyChart("protein");
    var target = TR.proteinTargetG;
    var ds = [{label:"Protein (g)", data: days.map(function(d){return d.protein_g||0;}), backgroundColor: accent, borderRadius: 3}];
    if(target != null){
      ds.push({label: "Target " + target + " g", type: "line", data: days.map(function(){return target;}), borderColor: good, borderDash:[6,4], borderWidth: 2, pointRadius: 0, fill: false});
    }
    CHARTS.protein = new Chart(prot, {type: "bar", data: {labels: labels, datasets: ds}, options: commonChartOpts()});
  }

  var bodyCv = document.getElementById("chart-body");
  var body = TR.body || [];
  if(bodyCv && body.length){
    destroyChart("body");
    var blabels = body.map(function(b){return fmtDateShort(b.measured_at);});
    CHARTS.body = new Chart(bodyCv, {
      type: "line",
      data: {
        labels: blabels,
        datasets: [
          {label: "Weight (kg)",  data: body.map(function(b){return b.weight_kg;}),    borderColor: muted,  backgroundColor:"transparent", tension:0.25, pointRadius:2, borderWidth:2, yAxisID:"y"},
          {label: "Body Fat (%)", data: body.map(function(b){return b.body_fat_pct;}), borderColor: accent, backgroundColor:"transparent", tension:0.25, pointRadius:2, borderWidth:2, yAxisID:"y2"}
        ]
      },
      options: Object.assign(commonChartOpts(), {
        scales: Object.assign(commonChartOpts().scales, {
          y:  {position: "left",  ticks:{color: muted,  font:{size:10}}, grid:{color:lineColor()}, beginAtZero:false},
          y2: {position: "right", ticks:{color: accent, font:{size:10}}, grid:{display:false}}
        })
      })
    });
  } else if(bodyCv){
    destroyChart("body");
    bodyCv.parentNode.parentNode.innerHTML = '<h3>Body composition · weight and body fat</h3><div class="emptybox">No body-composition readings yet.</div>';
  }
}

function renderNutritionPlan(){
  var S = SUGGESTIONS || {meals:{}};
  var meals = S.meals || {};
  var order = [
    {k:"breakfast", label:"Breakfast"},
    {k:"lunch",     label:"Lunch"},
    {k:"dinner",    label:"Dinner"},
    {k:"snack",     label:"Snacks"}
  ];
  var hasAny = order.some(function(o){ return (meals[o.k]||[]).length > 0; });

  if(!S.date && !hasAny){
    return '<div class="sec-title">Plan</div>' +
           '<div class="emptybox"><b>No plan yet.</b><br>Seed <code>meal_templates</code> in Supabase and the next build will populate this page.</div>';
  }

  var loadTxt = S.load ? String(S.load).charAt(0).toUpperCase()+String(S.load).slice(1)+" load" : "";
  var h = '';
  h += '<div class="sec-title">Plan · '+esc(fmtDate(S.date||""))+'</div>';
  h += '<div class="iohero">';
  h +=   '<div class="ihd"><div class="verb">'+esc((S.day_type||"Training")+" day")+'</div>';
  if(S.recovery != null){
    h +=   '<div class="whn">Recovery '+S.recovery+'%</div>';
  }
  h +=   '</div>';
  h +=   '<div class="load" style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">';
  if(loadTxt) h += '<span class="pill">'+esc(loadTxt)+'</span>';
  h +=     '<span class="pill">avg burn '+fmtInt(S.avg_burn||0)+' kcal</span>';
  h +=   '</div>';
  h += '</div>';

  h += '<div class="kpis">';
  h +=   '<div class="kpi"><div class="klab">Calories</div><div class="kval">'+fmtInt(S.calorie_target||0)+'<em>kcal</em></div><div class="ksub">target for the day</div></div>';
  h +=   '<div class="kpi"><div class="klab">Protein</div><div class="kval">'+(S.protein_target_g||0)+'<em>g</em></div><div class="ksub">2.0 g/kg</div></div>';
  h +=   '<div class="kpi"><div class="klab">Water</div><div class="kval">'+(S.water_l||0)+'<em>L</em></div><div class="ksub">daily target</div></div>';
  h += '</div>';

  order.forEach(function(o){
    var opts = meals[o.k] || [];
    h += '<div class="sec-title">'+o.label+'</div>';
    if(!opts.length){
      h += '<div class="emptybox">No suggestions yet.</div>';
      return;
    }
    opts.forEach(function(op){
      h += '<div class="excard">';
      h +=   '<div class="exname">'+esc(op.name||"(unnamed)");
      if(op.planned){
        h += ' <span class="pill warm" style="font-size:10px;margin-left:6px;vertical-align:2px">Planned</span>';
      }
      h +=   '</div>';
      if(op.items){
        h += '<div class="exmech">'+esc(op.items)+'</div>';
      }
      if(!op.planned && op.calories != null){
        h += '<div class="exspec">';
        h +=   '<div class="spec"><span>kcal</span>'+fmtInt(op.calories)+'</div>';
        h +=   '<div class="spec"><span>P</span>'+fmtG(op.protein_g)+'g</div>';
        h +=   '<div class="spec"><span>C</span>'+fmtG(op.carbs_g)+'g</div>';
        h +=   '<div class="spec"><span>F</span>'+fmtG(op.fat_g)+'g</div>';
        h += '</div>';
      }
      h += '</div>';
    });
  });

  h += '<p class="disc">Suggestions rotate daily from <code>meal_templates</code>. Pinned meals from <code>meal_plan</code> appear first. Baked at build time.</p>';
  return h;
}

window.__OVERLOAD_RENDER__.renderNutritionToday  = renderNutritionToday;
window.__OVERLOAD_RENDER__.renderNutritionTrends = renderNutritionTrends;
window.__OVERLOAD_RENDER__.renderNutritionPlan   = renderNutritionPlan;
window.__OVERLOAD_RENDER__.drawNutritionCharts   = drawCharts;
window.__OVERLOAD_RENDER__.destroyNutritionCharts = destroyAllCharts;
})();

(function(){
"use strict";
var R=window.__OVERLOAD_RENDER__, S=window.__OVERLOAD_STATE__;

// Icons for the bottom nav buttons, kept inline so no extra font load.
var ICON = {
  plan:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>',
  session:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8 2-2 3 3-2 2z"/><path d="m6 11 7 7"/><path d="m16 6 3-3 2 2-3 3"/><path d="m18 14-4 4"/><path d="m14 10-4 4"/></svg>',
  block:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></svg>',
  method:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6M9 9h1"/></svg>',
  today:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 15h.01M12 15h.01M16 15h.01"/></svg>',
  trends:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l3-3 4 4 5-7"/></svg>',
  mealplan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z"/><rect x="5" y="5" width="14" height="17" rx="2"/><path d="M9 11h6M9 15h6M9 19h4"/></svg>'
};

var PAGES = {
  training:  [{k:"plan",   label:"Plan"},   {k:"session", label:"Session"}, {k:"block", label:"Block"}, {k:"method", label:"Method"}],
  nutrition: [{k:"today",  label:"Today"},  {k:"trends",  label:"Trends"},  {k:"mealplan", label:"Plan"}]
};
var DEFAULT_PAGE = {training: "plan", nutrition: "today"};

var NAV_STATE = {domain: "training", page: "plan"};
try {
  var savedDom = localStorage.getItem("overload-domain");
  if(savedDom === "training" || savedDom === "nutrition"){ NAV_STATE.domain = savedDom; }
  var savedPage = localStorage.getItem("overload-page-" + NAV_STATE.domain);
  if(savedPage && PAGES[NAV_STATE.domain].some(function(p){return p.k===savedPage;})){
    NAV_STATE.page = savedPage;
  } else {
    NAV_STATE.page = DEFAULT_PAGE[NAV_STATE.domain];
  }
} catch(_){}

function renderPageBody(){
  var app = document.getElementById("app");
  if(!app) return;
  var domain = NAV_STATE.domain, page = NAV_STATE.page;
  var html;
  if(domain === "training"){
    if(page==="plan")         html = R.renderPlan();
    else if(page==="session") html = R.renderSession();
    else if(page==="block")   html = R.renderBlock();
    else if(page==="method")  html = R.renderMethod();
    else                      html = R.renderPlan();
  } else {
    // Charts must be torn down before we replace the DOM they live in.
    if(R.destroyNutritionCharts) R.destroyNutritionCharts();
    if(page==="trends")        html = R.renderNutritionTrends();
    else if(page==="mealplan") html = R.renderNutritionPlan();
    else                       html = R.renderNutritionToday();
  }
  app.innerHTML = html;
  var scroll = document.getElementById("scroll"); if(scroll) scroll.scrollTop = 0;
  if(domain === "nutrition" && page === "trends" && R.drawNutritionCharts){
    // Give the DOM one tick so canvases exist before Chart.js reads sizes.
    setTimeout(R.drawNutritionCharts, 0);
  }
}

function renderNav(){
  var nav = document.getElementById("nav");
  if(!nav) return;
  var pages = PAGES[NAV_STATE.domain] || PAGES.training;
  var h = "";
  pages.forEach(function(p){
    var sel = (p.k === NAV_STATE.page) ? "true" : "false";
    h += '<button data-nav="'+p.k+'" aria-selected="'+sel+'">'+ (ICON[p.k]||"") +'<span>'+p.label+'</span></button>';
  });
  nav.innerHTML = h;
}

function renderAll(){
  renderNav();
  renderPageBody();
  var tag = document.getElementById("brandTag");
  if(tag) tag.textContent = NAV_STATE.domain === "nutrition" ? "Fuel & Deficit" : "Cut to Abs";
  var dom = document.getElementById("dom");
  if(dom){
    Array.prototype.forEach.call(dom.querySelectorAll("button"), function(b){
      b.setAttribute("aria-selected", b.getAttribute("data-dom") === NAV_STATE.domain ? "true" : "false");
    });
  }
}

function setDomain(domain){
  if(!PAGES[domain] || domain === NAV_STATE.domain) return;
  NAV_STATE.domain = domain;
  // Restore per-domain last page, or default.
  var last = null;
  try { last = localStorage.getItem("overload-page-" + domain); } catch(_){}
  if(last && PAGES[domain].some(function(p){return p.k===last;})){
    NAV_STATE.page = last;
  } else {
    NAV_STATE.page = DEFAULT_PAGE[domain];
  }
  try { localStorage.setItem("overload-domain", domain); } catch(_){}
  renderAll();
}

function setPage(page){
  var pages = PAGES[NAV_STATE.domain] || PAGES.training;
  if(!pages.some(function(p){return p.k===page;})) return;
  NAV_STATE.page = page;
  try { localStorage.setItem("overload-page-" + NAV_STATE.domain, page); } catch(_){}
  renderAll();
}

function bindDomain(){
  var dom = document.getElementById("dom");
  if(!dom) return;
  dom.addEventListener("click", function(e){
    var btn = e.target.closest("button[data-dom]");
    if(!btn) return;
    setDomain(btn.getAttribute("data-dom"));
  });
}

function bindNav(){
  var nav = document.getElementById("nav");
  if(!nav) return;
  nav.addEventListener("click", function(e){
    var btn = e.target.closest("button[data-nav]");
    if(!btn) return;
    setPage(btn.getAttribute("data-nav"));
  });
}

// Kept for internal callers that still invoke render() (e.g. calendar clicks).
function render(){ renderPageBody(); }

function bindApp(){
  var app=document.getElementById("app");
  if(!app) return;

  app.addEventListener("click", function(e){
    var day = e.target.closest("[data-day]");
    if(day){
      var dow = parseInt(day.getAttribute("data-day"),10);
      if(S.editing){
        R.cycleEditDay(dow);
      } else {
        R.toggleDayDone(dow);
      }
      render();
      return;
    }
    var editBtn = e.target.closest("[data-action=edit-week]");
    if(editBtn){
      R.beginEdit();
      render();
      return;
    }
    var cancelBtn = e.target.closest("[data-action=cancel-week]");
    if(cancelBtn){
      R.cancelEdit();
      render();
      return;
    }
    var editRunsBtn = e.target.closest("[data-action=edit-runs]");
    if(editRunsBtn){
      R.beginRunEdit();
      render();
      return;
    }
    var cancelRunsBtn = e.target.closest("[data-action=cancel-runs]");
    if(cancelRunsBtn){
      R.cancelRunEdit();
      render();
      return;
    }
    var saveRunsBtn = e.target.closest("[data-action=save-runs]");
    if(saveRunsBtn){
      var runPinEl = document.querySelector("[data-run-pin]");
      var runPin = runPinEl ? String(runPinEl.value||"").trim() : "";
      if(!runPin){ R.toast("Enter your PIN"); return; }
      try { localStorage.setItem("overload-editor-pin", runPin); } catch(_){}
      saveRunsBtn.disabled = true;
      R.saveRuns(runPin).then(function(res){
        saveRunsBtn.disabled = false;
        if(res.status === 200 && res.body && res.body.ok){
          R.toast("Runs saved.");
          render();
        } else if(res.status === 401){
          R.toast("Wrong PIN");
        } else {
          R.toast((res.body && res.body.error) || "Save failed");
        }
      }).catch(function(){
        saveRunsBtn.disabled = false;
        R.toast("Network error");
      });
      return;
    }
    var saveBtn = e.target.closest("[data-action=save-week]");
    if(saveBtn){
      var pinEl = document.querySelector("[data-wk-pin]");
      var pin = pinEl ? String(pinEl.value||"").trim() : "";
      if(!pin){ R.toast("Enter your PIN"); return; }
      try { localStorage.setItem("overload-editor-pin", pin); } catch(_){}
      saveBtn.disabled = true;
      R.saveWeekPlan(pin).then(function(res){
        saveBtn.disabled = false;
        if(res.status === 200 && res.body && res.body.ok){
          R.toast("Week saved. Meals update at the next 7 AM build.");
          render();
        } else if(res.status === 401){
          R.toast("Wrong PIN");
        } else {
          R.toast((res.body && res.body.error) || "Save failed");
        }
      }).catch(function(){
        saveBtn.disabled = false;
        R.toast("Network error");
      });
      return;
    }
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

function boot(){
  bindDomain(); bindNav(); bindApp(); bindTheme(); renderAll();
}
document.addEventListener("DOMContentLoaded", boot);
if(document.readyState==="interactive" || document.readyState==="complete"){
  boot();
}
})();
