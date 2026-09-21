(function(){
"use strict";

var DATA = window.__NUTRITION__ || {today:null, trends:null, meta:null};
var TODAY  = DATA.today  || {};
var TRENDS = DATA.trends || {days:[], body:[]};
var META   = DATA.meta   || {};

var charts = {};

function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
        return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
}

function fmtInt(n){
    if(n == null || isNaN(n)) return "-";
    return Math.round(n).toLocaleString("en-US");
}

function fmtSigned(n){
    if(n == null || isNaN(n)) return "-";
    var r = Math.round(n);
    return (r >= 0 ? "+" : "") + r.toLocaleString("en-US");
}

function fmtG(n){
    if(n == null || isNaN(n)) return "0";
    var v = Math.round(n * 10) / 10;
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1));
}

function fmtDate(iso){
    if(!iso) return "-";
    var d = new Date(iso + "T00:00:00");
    if(isNaN(d)) return iso;
    return d.toLocaleDateString("en-US", {weekday:"long", month:"long", day:"numeric"});
}

function fmtDateShort(iso){
    if(!iso) return "-";
    var d = new Date(iso + "T00:00:00");
    if(isNaN(d)) return iso;
    return d.toLocaleDateString("en-US", {month:"short", day:"numeric"});
}

function setLastUpdated(){
    var el = document.getElementById("lastUpdated");
    if(!el) return;
    if(META.generatedAt){
        var d = new Date(META.generatedAt);
        el.textContent = "Last updated " + d.toLocaleString("en-US", {
            month:"short", day:"numeric", hour:"numeric", minute:"2-digit"
        });
    } else {
        el.textContent = "";
    }
}

// -------- Today view --------
function renderToday(){
    var host = document.getElementById("today-tab");
    if(!host) return;

    if(!TODAY.date || (!TODAY.meals || !TODAY.meals.length)){
        host.innerHTML = '<div class="empty">' +
            '<b>No food logged yet.</b><br>' +
            'Log meals by chat and this page refreshes on the next build.' +
            '</div>';
        return;
    }

    var isDeficit = TODAY.isDeficit;
    var hasOut    = (TODAY.caloriesOut || 0) > 0;
    var badgeCls, badgeTxt;
    if(!hasOut){
        badgeCls = "neutral";
        badgeTxt = "No WHOOP burn yet for this day";
    } else if(isDeficit){
        badgeCls = "deficit";
        badgeTxt = 'In a deficit, <span class="badge-num">-' + fmtInt(TODAY.deficit) + '</span> kcal';
    } else if(TODAY.net === 0){
        badgeCls = "neutral";
        badgeTxt = "Balanced day";
    } else {
        badgeCls = "surplus";
        badgeTxt = 'Surplus, <span class="badge-num">+' + fmtInt(TODAY.deficit) + '</span> kcal';
    }

    var protein = TODAY.protein_g || 0;
    var target  = TODAY.proteinTarget_g;
    var proteinUnder = (target != null) && (protein < target);
    var proteinPctOfTarget = target ? Math.min(100, Math.round(protein / target * 100)) : 0;

    var h = '';
    h += '<div class="hero">';
    h +=   '<div class="hero-title">Today · ' + esc(fmtDate(TODAY.date)) + '</div>';
    h +=   '<div class="hero-date">Calories in from food vs calories out from WHOOP</div>';
    h +=   '<div class="hero-inout">';
    h +=     '<div class="hero-cell"><div class="hero-label">In · Food</div>';
    h +=       '<div class="hero-value in">' + fmtInt(TODAY.caloriesIn) + '<em>kcal</em></div></div>';
    h +=     '<div class="sep">vs</div>';
    h +=     '<div class="hero-cell right"><div class="hero-label">Out · WHOOP</div>';
    h +=       '<div class="hero-value out">' + fmtInt(TODAY.caloriesOut) + '<em>kcal</em></div></div>';
    h +=   '</div>';
    h +=   '<div style="text-align:center;"><span class="badge ' + badgeCls + '">' + badgeTxt + '</span></div>';
    h += '</div>';

    // Macros
    h += '<h2 style="color:#f3f4f6;font-size:20px;font-weight:700;margin-bottom:16px;">Macros</h2>';
    h += '<div class="macros">';
    h +=   '<div class="macro"><div class="lbl">Protein</div>';
    h +=     '<div class="val">' + fmtG(protein) + '<em>g</em></div>';
    h +=     '<div class="pct">' + (TODAY.proteinPct||0) + '% of calories</div>';
    h +=     '<div class="bar"><i class="protein" style="width:' + Math.min(100, TODAY.proteinPct||0) + '%"></i></div>';
    if(target != null){
        h += '<div class="target">Target ' + target + ' g · ';
        if(proteinUnder){
            h += '<b class="under">Under by ' + Math.max(0, target - Math.round(protein)) + ' g</b>';
        } else {
            h += '<b class="hit">Hit</b>';
        }
        h += ' · ' + proteinPctOfTarget + '% of target';
        h += '</div>';
    }
    h +=   '</div>';

    h +=   '<div class="macro"><div class="lbl">Carbs</div>';
    h +=     '<div class="val">' + fmtG(TODAY.carbs_g) + '<em>g</em></div>';
    h +=     '<div class="pct">' + (TODAY.carbsPct||0) + '% of calories</div>';
    h +=     '<div class="bar"><i class="carbs" style="width:' + Math.min(100, TODAY.carbsPct||0) + '%"></i></div>';
    h +=   '</div>';

    h +=   '<div class="macro"><div class="lbl">Fat</div>';
    h +=     '<div class="val">' + fmtG(TODAY.fat_g) + '<em>g</em></div>';
    h +=     '<div class="pct">' + (TODAY.fatPct||0) + '% of calories</div>';
    h +=     '<div class="bar"><i class="fat" style="width:' + Math.min(100, TODAY.fatPct||0) + '%"></i></div>';
    h +=   '</div>';

    h +=   '<div class="macro"><div class="lbl">Fiber</div>';
    h +=     '<div class="val">' + fmtG(TODAY.fiber_g) + '<em>g</em></div>';
    h +=     '<div class="pct">daily total</div>';
    h +=     '<div class="bar"><i class="fiber" style="width:' + Math.min(100, Math.round(((TODAY.fiber_g||0)/38)*100)) + '%"></i></div>';
    h +=   '</div>';
    h += '</div>';

    // Diary
    h += '<h2 style="color:#f3f4f6;font-size:20px;font-weight:700;margin:32px 0 16px;">Food diary</h2>';
    h += '<div class="diary">';
    (TODAY.meals||[]).forEach(function(m){
        h += '<div class="meal">';
        h +=   '<div class="meal-head">';
        h +=     '<b>' + esc(m.meal) + '</b>';
        h +=     '<span><b>' + fmtInt(m.total.calories_kcal) + '</b> kcal · ' +
                     'P ' + fmtG(m.total.protein_g) + 'g · ' +
                     'C ' + fmtG(m.total.carbs_g)   + 'g · ' +
                     'F ' + fmtG(m.total.fat_g)     + 'g</span>';
        h +=   '</div>';
        h +=   '<table class="items">';
        h +=     '<thead><tr>' +
                    '<th>Item</th><th>Qty</th>' +
                    '<th class="num">kcal</th>' +
                    '<th class="num">Protein</th>' +
                    '<th class="num">Carbs</th>' +
                    '<th class="num">Fat</th>' +
                    '<th class="num">Fiber</th>' +
                 '</tr></thead><tbody>';
        m.items.forEach(function(it){
            h += '<tr>' +
                 '<td class="item">' + esc(it.item) + '</td>' +
                 '<td class="qty">'  + esc(it.quantity) + '</td>' +
                 '<td class="num">'  + fmtInt(it.calories_kcal) + '</td>' +
                 '<td class="num">'  + fmtG(it.protein_g) + ' g</td>' +
                 '<td class="num">'  + fmtG(it.carbs_g)   + ' g</td>' +
                 '<td class="num">'  + fmtG(it.fat_g)     + ' g</td>' +
                 '<td class="num">'  + fmtG(it.fiber_g)   + ' g</td>' +
                 '</tr>';
        });
        h +=     '</tbody></table>';
        h += '</div>';
    });
    h += '</div>';

    h += '<div class="day-total">';
    h +=   '<span class="lbl">Day total</span>';
    h +=   '<span class="val">' + fmtInt(TODAY.caloriesIn) + ' kcal · ' +
                'P ' + fmtG(TODAY.protein_g) + 'g · ' +
                'C ' + fmtG(TODAY.carbs_g)   + 'g · ' +
                'F ' + fmtG(TODAY.fat_g)     + 'g · ' +
                'Fi '+ fmtG(TODAY.fiber_g)   + 'g</span>';
    h += '</div>';

    host.innerHTML = h;
}

// -------- Trends view --------
function renderTrends(){
    var host = document.getElementById("trends-tab");
    if(!host) return;

    var days = TRENDS.days || [];
    var body = TRENDS.body || [];
    var avgDef = TRENDS.avgDailyDeficit || 0;   // negative = deficit
    var avgProtein = TRENDS.avgDailyProtein || 0;
    var target = TRENDS.proteinTargetG;
    var onTarget = TRENDS.daysOnTarget || 0;
    var tracked = TRENDS.daysTracked || 0;
    var total = TRENDS.daysTotal || days.length;

    var defCls = avgDef < 0 ? "deficit" : (avgDef > 0 ? "surplus" : "");
    var defTxt = avgDef < 0 ? "kcal deficit / day" :
                 avgDef > 0 ? "kcal surplus / day" : "balanced";

    var h = '';
    h += '<div class="grid grid-3" style="margin-bottom:24px;">';
    h +=   '<div class="kpi"><div class="lbl">Avg daily net</div>' +
             '<div class="val ' + defCls + '">' + fmtSigned(avgDef) + '<em>kcal</em></div>' +
             '<div class="sub">' + esc(defTxt) + ' · last ' + tracked + '/' + total + ' days tracked</div></div>';
    h +=   '<div class="kpi"><div class="lbl">Avg daily protein</div>' +
             '<div class="val">' + fmtG(avgProtein) + '<em>g</em></div>' +
             '<div class="sub">' + (target != null ? 'target ' + target + ' g' : 'no target') + '</div></div>';
    h +=   '<div class="kpi"><div class="lbl">Days on protein target</div>' +
             '<div class="val">' + onTarget + '<em>/ ' + tracked + '</em></div>' +
             '<div class="sub">since ' + esc(days.length ? fmtDateShort(days[0].date) : '-') + '</div></div>';
    h += '</div>';

    h += '<div class="chart-card" style="margin-bottom:24px;">';
    h +=   '<h3>Calories in vs out</h3>';
    h +=   '<canvas id="calChart" style="max-height:320px;"></canvas>';
    h += '</div>';

    h += '<div class="grid grid-2">';
    h +=   '<div class="chart-card"><h3>Daily protein</h3>' +
             '<canvas id="proteinChart" style="max-height:280px;"></canvas></div>';
    h +=   '<div class="chart-card"><h3>Body composition · weight and body fat</h3>' +
             '<canvas id="bodyChart" style="max-height:280px;"></canvas></div>';
    h += '</div>';

    host.innerHTML = h;

    drawCalChart(days);
    drawProteinChart(days, target);
    drawBodyChart(body);
}

function destroyChart(key){
    if(charts[key]){
        try { charts[key].destroy(); } catch(_){}
        charts[key] = null;
    }
}

var COMMON_OPTS = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
        legend: {
            labels: { color: "#d1d5db", font: {size: 12, weight: "600"} }
        },
        tooltip: {
            backgroundColor: "#111827",
            titleColor: "#f3f4f6",
            bodyColor: "#d1d5db",
            borderColor: "#374151",
            borderWidth: 1
        }
    },
    scales: {
        x: {
            ticks: { color: "#9ca3af", font: {size: 11} },
            grid:  { color: "rgba(75,85,99,0.25)" }
        },
        y: {
            ticks: { color: "#9ca3af", font: {size: 11} },
            grid:  { color: "rgba(75,85,99,0.25)" },
            beginAtZero: true
        }
    }
};

function drawCalChart(days){
    var ctx = document.getElementById("calChart");
    if(!ctx || !window.Chart) return;
    destroyChart("cal");
    var labels = days.map(function(d){ return fmtDateShort(d.date); });
    var cin  = days.map(function(d){ return d.caloriesIn  || 0; });
    var cout = days.map(function(d){ return d.caloriesOut || 0; });
    var net  = days.map(function(d){ return d.net || 0; });
    charts.cal = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                { label: "In · Food",  data: cin,  backgroundColor: "#fbbf24", borderRadius: 3, order: 2 },
                { label: "Out · WHOOP", data: cout, backgroundColor: "#60a5fa", borderRadius: 3, order: 2 },
                { label: "Net (in - out)", data: net, type: "line",
                  borderColor: "#34d399", backgroundColor: "rgba(52,211,153,0.15)",
                  fill: false, tension: 0.25, pointRadius: 2, borderWidth: 2, order: 1, yAxisID: "y2" }
            ]
        },
        options: Object.assign({}, COMMON_OPTS, {
            scales: Object.assign({}, COMMON_OPTS.scales, {
                y: Object.assign({}, COMMON_OPTS.scales.y, {
                    title: { display: true, text: "kcal", color: "#9ca3af" }
                }),
                y2: {
                    position: "right",
                    ticks: { color: "#34d399", font: {size: 11} },
                    grid:  { display: false },
                    title: { display: true, text: "Net kcal", color: "#34d399" }
                }
            })
        })
    });
}

function drawProteinChart(days, target){
    var ctx = document.getElementById("proteinChart");
    if(!ctx || !window.Chart) return;
    destroyChart("protein");
    var labels = days.map(function(d){ return fmtDateShort(d.date); });
    var prot   = days.map(function(d){ return d.protein_g || 0; });
    var datasets = [
        { label: "Protein (g)", data: prot,
          backgroundColor: "#f87171", borderRadius: 3 }
    ];
    if(target != null){
        datasets.push({
            label: "Target " + target + " g",
            data: prot.map(function(){ return target; }),
            type: "line",
            borderColor: "#34d399",
            borderDash: [6,4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
        });
    }
    charts.protein = new Chart(ctx, {
        type: "bar",
        data: { labels: labels, datasets: datasets },
        options: COMMON_OPTS
    });
}

function drawBodyChart(body){
    var ctx = document.getElementById("bodyChart");
    if(!ctx || !window.Chart) return;
    destroyChart("body");
    if(!body || !body.length){
        ctx.parentNode.innerHTML = '<h3>Body composition · weight and body fat</h3>' +
            '<div class="empty" style="padding:32px 20px;">No body-composition readings yet.</div>';
        return;
    }
    var labels = body.map(function(b){ return fmtDateShort(b.measured_at); });
    var w  = body.map(function(b){ return b.weight_kg; });
    var bf = body.map(function(b){ return b.body_fat_pct; });
    charts.body = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                { label: "Weight (kg)", data: w,
                  borderColor: "#60a5fa", backgroundColor: "rgba(96,165,250,0.15)",
                  tension: 0.25, pointRadius: 2, borderWidth: 2, yAxisID: "y" },
                { label: "Body Fat (%)", data: bf,
                  borderColor: "#f87171", backgroundColor: "rgba(248,113,113,0.15)",
                  tension: 0.25, pointRadius: 2, borderWidth: 2, yAxisID: "y2" }
            ]
        },
        options: Object.assign({}, COMMON_OPTS, {
            scales: Object.assign({}, COMMON_OPTS.scales, {
                y: {
                    position: "left",
                    ticks: { color: "#60a5fa", font: {size: 11} },
                    grid:  { color: "rgba(75,85,99,0.25)" },
                    title: { display: true, text: "kg", color: "#60a5fa" }
                },
                y2: {
                    position: "right",
                    ticks: { color: "#f87171", font: {size: 11} },
                    grid:  { display: false },
                    title: { display: true, text: "%", color: "#f87171" }
                }
            })
        })
    });
}

// -------- Wiring --------
function bindTabs(){
    var tabs = document.querySelectorAll(".tab");
    for(var i = 0; i < tabs.length; i++){
        tabs[i].addEventListener("click", function(e){
            var name = e.currentTarget.getAttribute("data-tab");
            for(var j = 0; j < tabs.length; j++){
                var t = tabs[j];
                t.classList.toggle("active", t.getAttribute("data-tab") === name);
            }
            document.getElementById("today-tab").classList.toggle("active",  name === "today");
            document.getElementById("trends-tab").classList.toggle("active", name === "trends");
            if(name === "trends"){
                // Chart.js sizes to layout; if trends was hidden it may need a redraw.
                setTimeout(function(){
                    Object.keys(charts).forEach(function(k){
                        if(charts[k] && charts[k].resize) charts[k].resize();
                    });
                }, 30);
            }
        });
    }
}

function init(){
    setLastUpdated();
    renderToday();
    renderTrends();
    bindTabs();
}

if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
})();
