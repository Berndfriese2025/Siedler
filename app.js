window.addEventListener("error", function(ev){
  try{
    const box=document.getElementById("compatError");
    if(box){
      box.style.display="block";
      box.textContent="Auf diesem Gerät ist ein JavaScript-Fehler aufgetreten: "+(ev.message||"unbekannter Fehler");
    }
  }catch(e){}
});

const safeStorage = (() => {
  const memory = {};
  let nativeOK = false;
  try {
    const key = "__ws_test__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    nativeOK = true;
  } catch (e) {}
  return {
    persistent: nativeOK,
    getItem(key) {
      if (nativeOK) {
        try { return window.localStorage.getItem(key); } catch (e) {}
      }
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    },
    setItem(key, value) {
      if (nativeOK) {
        try { window.localStorage.setItem(key, String(value)); return; } catch (e) {}
      }
      memory[key] = String(value);
    },
    removeItem(key) {
      if (nativeOK) {
        try { window.localStorage.removeItem(key); return; } catch (e) {}
      }
      delete memory[key];
    }
  };
})();

const ROAD_POINTS = Array(15).fill(1);
const KNIGHT_POINTS = [1,2,3,4,5,6];
const SETTLEMENT_POINTS = [3,4,5,7,9,11];
const CITY_POINTS = [7,12,20,30];

function blankPlayer(name){
  return {name, turn:0, turns:Array(15).fill(null), pending:0,
    roads:[true,...Array(16).fill(false)], knights:Array(6).fill(false), jokerUsed:Array(6).fill(false),
    settlements:Array(6).fill(false), cities:Array(4).fill(false), history:[]};
}
let state = JSON.parse(safeStorage.getItem("wuerfelSiedlerExactBoardStateV2")||"null") || {
  active:0, players:[blankPlayer("Spieler 1")]
};
function save(){ safeStorage.setItem("wuerfelSiedlerExactBoardStateV2", JSON.stringify(state)); }
function p(){return state.players[state.active]}
function score(pl=p()){return pl.turns.reduce((a,v)=>a+(v===null?0:v),0)}
function toast(s){let t=document.getElementById("toast");t.textContent=s;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1400)}


const svgNS="http://www.w3.org/2000/svg";

/* Geometrie in einem festen 600×600-Koordinatensystem.
   Das SVG skaliert als Ganzes – dadurch bleibt die Karte auf jedem Display identisch. */

/*
  Topologie des klassischen CATAN-Würfelspielbogens.
  Straßen liegen auf den Kanten der sechs ringförmigen Landschaftsfelder.
  Die Koordinaten verwenden ausschließlich das SVG-System und skalieren gemeinsam.
*/

/*
  2–3–2 Spielplan:
  sechs Rohstofffelder um ein zentrales Feld.
  Alle Koordinaten liegen im 600×535 SVG und skalieren gemeinsam.
*/

/* 15 Straßen. Die Reihenfolge bildet einen zusammenhängenden Baupfad
   mit den Verzweigungen des Würfelspielbogens ab. */

/*
  Geometrie nach der Topologie des offiziellen KOSMOS-Spielblocks:
  sechs Landfelder um ein zentrales Meereshex.
*/

/*
  Tatsächliches Straßennetz des normalen Würfelspiel-Spielplans.
  roadDefs enthält 16 Straßensymbole einschließlich der Startstraße.
  Jede Straße hat zwei echte Knotenpunkte; dadurch lässt sich die
  Fortlaufend-Regel korrekt prüfen.
*/
const roadDefs=[
 {a:[369,220],b:[438,180],start:true},   // Startstraße
 {a:[300,180],b:[369,220]},
 {a:[231,220],b:[300,180]},
 {a:[162,180],b:[231,220]},
 {a:[92,220], b:[162,180]},
 {a:[92,220], b:[92,300]},
 {a:[92,300], b:[161,340]},
 {a:[161,340],b:[230,300]},
 {a:[230,300],b:[300,340]},
 {a:[300,340],b:[369,300]},
 {a:[369,300],b:[439,340]},
 {a:[162,340],b:[162,420]},
 {a:[162,420],b:[231,460]},
 {a:[231,460],b:[300,420]},
 {a:[300,420],b:[369,460]},
 {a:[162,100],b:[162,180]},
 {a:[300,100],b:[300,180]}
];

/* Wertungsknoten entsprechend dem Spielblatt */
const settlementDefs=[
 [369,220,3],
 [231,220,4],
 [92,220,5],
 [161,340,7],
 [300,340,9],
 [439,340,11]
];

const cityDefs=[
 [300,100,7],
 [162,100,12],
 [231,460,20],
 [369,460,30]
];

const knightDefs=[
 [369,140,1],
 [231,140,2],
 [161,260,3],
 [231,380,4],
 [369,380,5],
 [439,260,6]
];

function S(tag, attrs={}){
 const el=document.createElementNS(svgNS,tag);
 Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));
 return el;
}
function addRouteBackdrop(){
 const g=document.getElementById("routeBackdrop"); g.innerHTML="";
 roadDefs.forEach((r)=>{
   const mx=(r.a[0]+r.b[0])/2, my=(r.a[1]+r.b[1])/2;
   const dx=r.b[0]-r.a[0], dy=r.b[1]-r.a[1];
   const len=Math.hypot(dx,dy);
   const angle=Math.atan2(dy,dx)*180/Math.PI;
   const ln=S("line",{x1:mx-len*.31,y1:my,x2:mx+len*.31,y2:my,class:"route-line",
                      transform:`rotate(${angle} ${mx} ${my})`});
   const inn=S("line",{x1:mx-len*.31,y1:my,x2:mx+len*.31,y2:my,class:"route-line-inner",
                       transform:`rotate(${angle} ${mx} ${my})`});
   g.append(ln,inn);
 });
}
function addRoad(i,r){
 const mx=(r.a[0]+r.b[0])/2, my=(r.a[1]+r.b[1])/2;
 const dx=r.b[0]-r.a[0], dy=r.b[1]-r.a[1];
 const len=Math.hypot(dx,dy);
 const angle=Math.atan2(dy,dx)*180/Math.PI;
 const g=S("g",{class:"svg-item road","data-type":"road","data-i":i,
                transform:`rotate(${angle} ${mx} ${my})`});
 g.append(
   S("rect",{class:"hit",x:mx-34,y:my-18,width:68,height:36,rx:14}),
   S("rect",{class:"mark",x:mx-25,y:my-7,width:50,height:14,rx:7})
 );
 document.getElementById("roadsLayer").appendChild(g);
}
function addCircleItem(layer, cls, type, i, x, y, value, r=26){
 const g=S("g",{class:`svg-item ${cls}`,"data-type":type,"data-i":i});
 g.append(
   S("circle",{class:"hit",cx:x,cy:y,r:r+12}),
   S("circle",{class:"mark",cx:x,cy:y,r:r})
 );
 const tx=S("text",{x,y:y+1}); tx.textContent=value; g.appendChild(tx);
 document.getElementById(layer).appendChild(g);
}
function addKnight(i,[x,y,value]){
 const g=S("g",{class:"svg-item knight","data-type":"knight","data-i":i});
 g.append(
   S("circle",{class:"hit",cx:x,cy:y,r:27}),
   S("circle",{class:"mark",cx:x,cy:y,r:18})
 );
 const tx=S("text",{x,y:y+1}); tx.textContent=value; g.appendChild(tx);
 g.append(S("line",{class:"slash",x1:x-11,y1:y-11,x2:x+11,y2:y+11}));
 document.getElementById("knightsLayer").appendChild(g);
}

function createBoard(){
 addRouteBackdrop();
 ["roadsLayer","settlementsLayer","citiesLayer","knightsLayer"].forEach(id=>document.getElementById(id).innerHTML="");
 roadDefs.forEach((d,i)=>addRoad(i,d));
 settlementDefs.forEach((d,i)=>addCircleItem("settlementsLayer","settlement","settlement",i,d[0],d[1],d[2],17));
 cityDefs.forEach((d,i)=>addCircleItem("citiesLayer","city","city",i,d[0],d[1],d[2],19));
 knightDefs.forEach((d,i)=>addKnight(i,d));

 const b=document.getElementById("board");
 b.onclick=ev=>{
   let el=ev.target.closest("[data-type]"); if(!el)return;
   let typ=el.dataset.type, i=+el.dataset.i, pl=p();
   let arr = typ==="road"?pl.roads:typ==="knight"?pl.knights:typ==="settlement"?pl.settlements:pl.cities;
   if(typ==="knight" && arr[i]){
      pl.jokerUsed[i]=!pl.jokerUsed[i]; save();render();
      toast(pl.jokerUsed[i]?"Joker verbraucht":"Joker wieder verfügbar"); return;
   }
   if(arr[i]) return;
   buildSpecific(typ,i);
 };
}

function nextIndex(arr){return arr.findIndex(x=>!x)}
function pointsFor(type,i){return type==="road"?1:type==="knight"?KNIGHT_POINTS[i]:type==="settlement"?SETTLEMENT_POINTS[i]:CITY_POINTS[i]}
function sameNode(a,b){return a[0]===b[0] && a[1]===b[1]}
function roadConnected(i,pl){
 const r=roadDefs[i];
 return roadDefs.some((built,j)=>{
   if(!pl.roads[j] || j===i) return false;
   return sameNode(r.a,built.a)||sameNode(r.a,built.b)||sameNode(r.b,built.a)||sameNode(r.b,built.b);
 });
}
function roadTouchesPoint(i,x,y){
 const r=roadDefs[i];
 return (r.a[0]===x&&r.a[1]===y)||(r.b[0]===x&&r.b[1]===y);
}
function anyBuiltRoadTouches(pl,x,y){
 return roadDefs.some((r,i)=>pl.roads[i] && roadTouchesPoint(i,x,y));
}
function buildSpecific(type,i){
 let pl=p();
 if(pl.turn>=15){toast("Diese Partie ist beendet");return}

 if(type==="road"){
   if(i===0 || pl.roads[i]) return;
   if(!roadConnected(i,pl)){toast("Diese Straße grenzt noch nicht an deinen Straßenzug");return}
   pl.roads[i]=true; pl.pending+=1; pl.history.push({kind:"build",type,i,pts:1}); save();render(); return;
 }

 let arr= type==="knight"?pl.knights:type==="settlement"?pl.settlements:pl.cities;
 let required=nextIndex(arr);
 if(i!==required){toast("Bitte in der vorgesehenen Reihenfolge bauen");return}

 if(type==="settlement"){
   const d=settlementDefs[i];
   if(!anyBuiltRoadTouches(pl,d[0],d[1])){toast("Noch keine gebaute Straße führt zu dieser Siedlung");return}
 }
 if(type==="city"){
   const d=cityDefs[i];
   if(!anyBuiltRoadTouches(pl,d[0],d[1])){toast("Noch keine gebaute Straße führt zu dieser Stadt");return}
 }

 let pts=pointsFor(type,i);
 arr[i]=true; pl.pending+=pts; pl.history.push({kind:"build",type,i,pts}); save();render();
}
function buildNext(type){
 let pl=p();
 if(type==="road"){
   const possible=roadDefs.map((r,i)=>i).filter(i=>i>0&&!pl.roads[i]&&roadConnected(i,pl));
   if(possible.length===1){buildSpecific("road",possible[0]);return}
   toast("Tippe die gewünschte anschließende Straße direkt auf der Insel an"); return;
 }
 let arr= type==="knight"?pl.knights:type==="settlement"?pl.settlements:pl.cities;
 let i=nextIndex(arr); if(i<0){toast("Alles gebaut");return}
 buildSpecific(type,i);
}

function undo(){
 let pl=p(), h=pl.history.pop(); if(!h){toast("Nichts rückgängig zu machen");return}
 if(h.kind==="build"){
   let arr=h.type==="road"?pl.roads:h.type==="knight"?pl.knights:h.type==="settlement"?pl.settlements:pl.cities;
   arr[h.i]=false; if(h.type==="knight")pl.jokerUsed[h.i]=false; pl.pending-=h.pts;
 } else if(h.kind==="turn"){
   pl.turn--; pl.turns[pl.turn]=null; pl.pending=h.pendingBefore||0;
 } else if(h.kind==="penalty"){
   pl.turn--; pl.turns[pl.turn]=null;
 }
 save();render();
}
function finishTurn(penalty=false){
 let pl=p(); if(pl.turn>=15){toast("Partie beendet");return}
 if(!penalty && pl.pending===0){toast("Dann bitte „Nichts gebaut“ wählen");return}
 let val=penalty?-2:pl.pending;
 pl.turns[pl.turn]=val;
 pl.history.push({kind:penalty?"penalty":"turn",pendingBefore:0});
 pl.turn++; pl.pending=0;
 save(); render();
 if(pl.turn===15) toast(`${pl.name}: ${score(pl)} Punkte`);
}
function render(){
 let pl=p();
 document.getElementById("activeName").textContent=pl.name;
 document.getElementById("totalScore").textContent=score(pl);
 document.getElementById("turnLabel").textContent=Math.min(pl.turn+1,15)+" / 15";
 document.getElementById("turnPending").textContent=`In diesem Zug: ${pl.pending} Punkte`;
 document.getElementById("finishTurn").disabled=pl.turn>=15;
 document.getElementById("penaltyTurn").disabled=pl.turn>=15;

 let tabs=document.getElementById("playerTabs");tabs.innerHTML="";
 state.players.forEach((x,i)=>{let b=document.createElement("button");b.className="ptab "+(i===state.active?"active":"");b.textContent=x.name+" · "+score(x);b.onclick=()=>{state.active=i;save();render()};tabs.appendChild(b)});

 document.querySelectorAll(".svg-item[data-type]").forEach(el=>{
   let i=+el.dataset.i, typ=el.dataset.type;
   let arr=typ==="road"?pl.roads:typ==="knight"?pl.knights:typ==="settlement"?pl.settlements:pl.cities;
   el.classList.toggle("built",arr[i]);
   if(typ==="knight") el.classList.toggle("used",pl.jokerUsed[i]);
   if(typ==="road"&&i===0) el.classList.add("start"); else el.classList.remove("start");
 });
 let turns=document.getElementById("turns");turns.innerHTML="";
 pl.turns.forEach((v,i)=>{let d=document.createElement("div");d.className="turn "+(i===pl.turn?"current ":"")+(v!==null?"filled ":"")+(v===-2?"penalty":"");d.textContent=v===null?i+1:(v===-2?"×":v);turns.appendChild(d)});
}
document.querySelectorAll("[data-build]").forEach(b=>b.onclick=()=>buildNext(b.dataset.build));
document.getElementById("undoBtn").onclick=undo;
document.getElementById("finishTurn").onclick=()=>finishTurn(false);
document.getElementById("penaltyTurn").onclick=()=>finishTurn(true);

function openPlayers(){
 let box=document.getElementById("nameFields");box.innerHTML="";
 for(let i=0;i<4;i++){let inp=document.createElement("input");inp.type="text";inp.placeholder="Spieler "+(i+1);inp.value=state.players[i]?.name||"";box.appendChild(inp)}
 if(typeof playerDialog.showModal==="function"){playerDialog.showModal();}else{playerDialog.setAttribute("open","");}
}
document.getElementById("renameBtn").onclick=openPlayers;
document.getElementById("savePlayers").onclick=()=>{
 let names=[...document.querySelectorAll("#nameFields input")].map(x=>x.value.trim()).filter(Boolean);
 if(!names.length)names=["Spieler 1"];
 let old=state.players; state.players=names.map((n,i)=>{let q=old[i]||blankPlayer(n);q.name=n;return q});
 state.active=Math.min(state.active,state.players.length-1);save();if(typeof playerDialog.close==="function"){playerDialog.close();}else{playerDialog.removeAttribute("open");} render();
};
document.getElementById("newGameBtn").onclick=()=>{
 if(!confirm("Wirklich einen neuen Spielstand beginnen?"))return;
 let names=state.players.map(x=>x.name); state={active:0,players:names.map(blankPlayer)};save();resetDice();render();
};
document.getElementById("exportBtn").onclick=async()=>{
 let text=state.players.map(x=>`${x.name}: ${score(x)} Punkte (${x.turn}/15 Züge)`).join("\n");
 try{await navigator.clipboard.writeText(text);toast("Spielstand kopiert")}catch(e){prompt("Spielstand",text)}
};

const RESOURCES=[{id:"brick",name:"Lehm",icon:"🧱"},{id:"wood",name:"Holz",icon:"🪵"},{id:"wool",name:"Wolle",icon:"🐑"},{id:"grain",name:"Getreide",icon:"🌾"},{id:"ore",name:"Erz",icon:"⛰️"},{id:"gold",name:"Gold",icon:"🪙"}];
const BUILD_COSTS={road:{label:"Straße",cost:{brick:1,wood:1}},knight:{label:"Ritter",cost:{wool:1,grain:1,ore:1}},settlement:{label:"Siedlung",cost:{brick:1,wood:1,wool:1,grain:1}},city:{label:"Stadt",cost:{grain:2,ore:3}}};
let diceState=JSON.parse(safeStorage.getItem("wuerfelSiedlerDiceStateV2")||"null")||{values:[null,null,null,null,null,null],held:[false,false,false,false,false,false],rolls:0,fixed:false};
function saveDice(){safeStorage.setItem("wuerfelSiedlerDiceStateV2",JSON.stringify(diceState))}
function resetDice(){diceState={values:[null,null,null,null,null,null],held:[false,false,false,false,false,false],rolls:0,fixed:false};saveDice();renderDice()}
function randomResource(){return RESOURCES[Math.floor(Math.random()*RESOURCES.length)].id}
function resourceObj(id){return RESOURCES.find(r=>r.id===id)}
function rollDice(){if(diceState.fixed||diceState.rolls>=3)return;diceState.values=diceState.values.map((v,i)=>diceState.held[i]&&v?v:randomResource());diceState.rolls++;if(diceState.rolls>=3)diceState.fixed=true;saveDice();renderDice()}
function toggleHold(i){if(diceState.rolls===0||diceState.fixed)return;diceState.held[i]=!diceState.held[i];saveDice();renderDice()}
function countsFromDice(){const c={brick:0,wood:0,wool:0,grain:0,ore:0,gold:0};diceState.values.forEach(v=>{if(v)c[v]++});return c}
function directCanPay(cost,c){return Object.entries(cost).every(([r,n])=>(c[r]||0)>=n)}
function goldCanPay(cost,c){let missing=0;for(const [r,n] of Object.entries(cost))missing+=Math.max(0,n-(c[r]||0));return missing>0&&(c.gold||0)>=missing*2}
function paymentStatus(cost,c){if(directCanPay(cost,c))return"direct";if(goldCanPay(cost,c))return"gold";return"no"}
function canPayMutable(c,cost){let n={...c},missing=0;for(const [r,v] of Object.entries(cost)){const use=Math.min(n[r]||0,v);n[r]=(n[r]||0)-use;missing+=v-use}if((n.gold||0)<missing*2)return null;n.gold-=missing*2;return n}
function enumerateCombos(c){const types=["road","knight","settlement","city"],results=[];function rec(cur,res,start,depth){if(cur.length)results.push({items:[...cur],res});if(depth>=3)return;for(let k=start;k<types.length;k++){const t=types[k],paid=canPayMutable(res,BUILD_COSTS[t].cost);if(paid){cur.push(t);rec(cur,paid,k,depth+1);cur.pop()}}}rec([],c,0,0);results.sort((a,b)=>b.items.length-a.items.length);return results}
function legalBoardType(t){const pl=p();if(t==="road")return roadDefs.some((r,i)=>i>0&&!pl.roads[i]&&roadConnected(i,pl));if(t==="knight")return nextIndex(pl.knights)>=0;if(t==="settlement"){const i=nextIndex(pl.settlements);if(i<0)return false;const d=settlementDefs[i];return anyBuiltRoadTouches(pl,d[0],d[1])}if(t==="city"){const i=nextIndex(pl.cities);if(i<0)return false;const d=cityDefs[i];return anyBuiltRoadTouches(pl,d[0],d[1])}return false}
function comboLabel(items){const cnt={};items.forEach(x=>cnt[x]=(cnt[x]||0)+1);return Object.entries(cnt).map(([t,n])=>(n>1?n+"× ":"")+BUILD_COSTS[t].label).join(" + ")}
function renderBuildAvailability(){const c=countsFromDice();document.querySelectorAll("[data-build]").forEach(btn=>{const t=btn.dataset.build;btn.classList.remove("available-direct","available-gold");btn.querySelectorAll(".availability").forEach(e=>e.remove());if(diceState.rolls===0)return;const stat=paymentStatus(BUILD_COSTS[t].cost,c),legal=legalBoardType(t);if(stat!=="no"&&legal){btn.classList.add(stat==="direct"?"available-direct":"available-gold");const s=document.createElement("span");s.className="availability "+stat;s.textContent=stat==="direct"?"✓ Mit dem Wurf möglich":"✓ Mit Goldtausch möglich";btn.appendChild(s)}else if(stat!=="no"&&!legal){const s=document.createElement("span");s.className="availability";s.style.color="#7a7469";s.textContent="Rohstoffe da · Spielplan noch nicht erreichbar";btn.appendChild(s)}})}
function renderPossibilities(){const box=document.getElementById("possibilities");if(!box)return;box.innerHTML="";const c=countsFromDice();for(const t of ["road","knight","settlement","city"]){const stat=diceState.rolls?paymentStatus(BUILD_COSTS[t].cost,c):"no";const sp=document.createElement("span");sp.className="poss "+stat;sp.textContent=BUILD_COSTS[t].label+(stat==="gold"?" · mit Gold":"");box.appendChild(sp)}const combo=document.getElementById("comboBox");if(diceState.rolls===0){combo.innerHTML="Nach dem ersten Wurf zeige ich dir mögliche Bauaktionen und Kombinationen.";return}const combos=enumerateCombos(c).filter(x=>x.items.length>=2),unique=[],seen=new Set();for(const cc of combos){const lab=comboLabel(cc.items);if(!seen.has(lab)){seen.add(lab);unique.push(lab)}if(unique.length>=3)break}if(unique.length)combo.innerHTML="<strong>Kombinationen aus den Rohstoffen:</strong> "+unique.join(" · ");else{const singles=["road","knight","settlement","city"].filter(t=>paymentStatus(BUILD_COSTS[t].cost,c)!=="no");combo.innerHTML=singles.length?"<strong>Aktuell:</strong> "+singles.map(t=>BUILD_COSTS[t].label).join(" oder "):"Für keine vollständige Bauaktion reichen die Rohstoffe derzeit."}}
function renderDice(){const grid=document.getElementById("diceGrid");if(!grid)return;grid.innerHTML="";diceState.values.forEach((v,i)=>{const b=document.createElement("button");b.className="die"+(diceState.held[i]?" held":"");b.type="button";if(v){const r=resourceObj(v);b.innerHTML=`<span class="icon">${r.icon}</span><span class="dname">${r.name}</span>`}else b.innerHTML='<span class="icon">?</span><span class="dname">Würfel</span>';b.onclick=()=>toggleHold(i);grid.appendChild(b)});document.getElementById("rollCount").textContent=`Wurf ${diceState.rolls} / 3`;const hint=document.getElementById("diceHint");hint.textContent=diceState.rolls===0?"Mit allen 6 Würfeln starten":diceState.fixed?"Ergebnis steht fest":"Würfel antippen zum Festhalten · Rest erneut würfeln";const roll=document.getElementById("rollDiceBtn");roll.disabled=diceState.fixed||diceState.rolls>=3;roll.textContent=diceState.rolls===0?"🎲 Würfeln":diceState.rolls<3?"🎲 Rest würfeln":"Ergebnis fest";document.getElementById("releaseDiceBtn").disabled=diceState.rolls===0||diceState.fixed;document.getElementById("finishDiceBtn").disabled=diceState.rolls===0||diceState.fixed;renderPossibilities();renderBuildAvailability()}
function finishDiceResult(){if(diceState.rolls===0)return;diceState.fixed=true;saveDice();renderDice()}
document.getElementById("rollDiceBtn").onclick=rollDice;document.getElementById("releaseDiceBtn").onclick=()=>{if(diceState.fixed)return;diceState.held=Array(6).fill(false);saveDice();renderDice()};document.getElementById("finishDiceBtn").onclick=finishDiceResult;
const originalFinishTurn=finishTurn;finishTurn=function(penalty=false){originalFinishTurn(penalty);resetDice()};

createBoard();render();renderDice();
const storageInfo=document.getElementById("storageInfo");
if(storageInfo && !safeStorage.persistent){
 storageInfo.textContent="Die App läuft auf diesem Gerät. Dauerhaftes Speichern ist in dieser lokalen Ansicht eingeschränkt. Auf iPhone/iPad funktioniert sie am zuverlässigsten über eine HTTPS-Webadresse in Safari.";
}
if(!safeStorage.getItem("wuerfelSiedlerExactBoardWelcomedV2")){
 safeStorage.setItem("wuerfelSiedlerExactBoardWelcomedV2","1");
 setTimeout(()=>toast("Tipp: Spieler über „Spieler ändern“ anlegen"),500);
}